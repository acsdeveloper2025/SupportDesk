import { createHash } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";

export interface AuthRateLimitConfig {
  defaultLimit: number;
  scopeLimits: Record<string, number>;
  windowSeconds: number;
}

export interface AuthRateLimitAttempt {
  dimensions: string[];
  limit?: number;
  scope: string;
}

export interface AuthRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface AuthRateLimitBucket {
  count: number;
  expiresAt: Date;
}

export abstract class AuthRateLimitStore {
  abstract increment(key: string, expiresAt: Date, now: Date): Promise<AuthRateLimitBucket>;
}

@Injectable()
export class InMemoryAuthRateLimitStore implements AuthRateLimitStore {
  private readonly buckets = new Map<string, AuthRateLimitBucket>();

  increment(key: string, expiresAt: Date, now: Date): Promise<AuthRateLimitBucket> {
    const existing = this.buckets.get(key);

    if (!existing || existing.expiresAt.getTime() <= now.getTime()) {
      const bucket = {
        count: 1,
        expiresAt,
      };
      this.buckets.set(key, bucket);

      return Promise.resolve(bucket);
    }

    existing.count += 1;

    return Promise.resolve(existing);
  }
}

@Injectable()
export class AuthRateLimitService {
  private readonly config: AuthRateLimitConfig;
  private readonly now: () => Date;

  constructor(
    @Inject(AuthRateLimitStore)
    private readonly store: AuthRateLimitStore,
    @Optional()
    @Inject("AuthRateLimitConfig")
    config?: Partial<AuthRateLimitConfig>,
    @Optional()
    @Inject("AuthRateLimitClock")
    now?: () => Date,
  ) {
    this.config = {
      defaultLimit: config?.defaultLimit ?? readPositiveInteger("AUTH_RATE_LIMIT_MAX_REQUESTS", 10),
      scopeLimits:
        config?.scopeLimits ??
        (config
          ? {}
          : {
              "email-verification": readPositiveInteger("AUTH_RATE_LIMIT_VERIFICATION_MAX", 10),
              login: readPositiveInteger("AUTH_RATE_LIMIT_LOGIN_MAX", 5),
              "password-change": readPositiveInteger("AUTH_RATE_LIMIT_PASSWORD_CHANGE_MAX", 5),
              "password-reset-confirm": readPositiveInteger(
                "AUTH_RATE_LIMIT_RESET_CONFIRM_MAX",
                10,
              ),
              "password-reset-request": readPositiveInteger("AUTH_RATE_LIMIT_RESET_REQUEST_MAX", 5),
              refresh: readPositiveInteger("AUTH_RATE_LIMIT_REFRESH_MAX", 20),
              register: readPositiveInteger("AUTH_RATE_LIMIT_REGISTER_MAX", 5),
            }),
      windowSeconds:
        config?.windowSeconds ?? readPositiveInteger("AUTH_RATE_LIMIT_WINDOW_SECONDS", 60),
    };
    this.now = now ?? (() => new Date());
  }

  async consume(input: AuthRateLimitAttempt): Promise<AuthRateLimitDecision> {
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.config.windowSeconds * 1000);
    const key = hashKey(input.scope, input.dimensions);
    const bucket = await this.store.increment(key, expiresAt, now);
    const limit = input.limit ?? this.config.scopeLimits[input.scope] ?? this.config.defaultLimit;

    if (bucket.count <= limit) {
      return {
        allowed: true,
        retryAfterSeconds: 0,
      };
    }

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000),
      ),
    };
  }
}

function hashKey(scope: string, dimensions: string[]): string {
  return createHash("sha256")
    .update([scope, ...dimensions.map((value) => value.trim().toLowerCase())].join("\u0000"))
    .digest("hex");
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
