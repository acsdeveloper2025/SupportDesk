import { Injectable } from "@nestjs/common";
import { hash, verify } from "@node-rs/argon2";

interface Argon2Settings {
  hashLength: number;
  memoryCost: number;
  parallelism: number;
  timeCost: number;
}

const argon2idAlgorithm = 2;

@Injectable()
export class PasswordHashingService {
  private readonly settings: Argon2Settings;

  constructor(config?: Partial<Argon2Settings>) {
    this.settings = {
      hashLength: config?.hashLength ?? readPositiveInteger("ARGON2_HASH_LENGTH", 32),
      memoryCost: config?.memoryCost ?? readPositiveInteger("ARGON2_MEMORY_COST_KIB", 65_536),
      parallelism: config?.parallelism ?? readPositiveInteger("ARGON2_PARALLELISM", 1),
      timeCost: config?.timeCost ?? readPositiveInteger("ARGON2_TIME_COST", 3),
    };
  }

  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      algorithm: argon2idAlgorithm,
      memoryCost: this.settings.memoryCost,
      outputLen: this.settings.hashLength,
      parallelism: this.settings.parallelism,
      timeCost: this.settings.timeCost,
    });
  }

  async verifyPassword(storedHash: string, password: string): Promise<boolean> {
    try {
      return await verify(storedHash, password);
    } catch {
      return false;
    }
  }
}

function readPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name]);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}
