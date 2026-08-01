import { Injectable } from "@nestjs/common";

export type VirusScanResult = "clean" | "infected";

export abstract class VirusScanner {
  abstract scan(path: string): Promise<VirusScanResult>;
}

@Injectable()
export class NoOpVirusScanner extends VirusScanner {
  scan(_path: string): Promise<VirusScanResult> {
    return Promise.resolve("clean");
  }
}

export const VIRUS_SCANNER = Symbol("VIRUS_SCANNER");
