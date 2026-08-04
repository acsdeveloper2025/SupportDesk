import { createHash, randomBytes } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";

export interface GeneratedSecureToken {
  token: string;
  tokenHash: string;
}

@Injectable()
export class SecureTokenService {
  private readonly defaultBytes: number;

  constructor(@Optional() defaultBytes?: number) {
    this.defaultBytes = defaultBytes ?? readPositiveInteger("SECURE_TOKEN_BYTES", 32);
  }

  generateToken(byteLength = this.defaultBytes): GeneratedSecureToken {
    const token = randomBytes(byteLength).toString("base64url");

    return {
      token,
      tokenHash: this.hashToken(token),
    };
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token, "utf8").digest("hex");
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
