import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ATTACHMENT_ALLOWED_EXTENSIONS,
  extractExtension,
  sanitizeOriginalFilename,
} from "./attachment-validation";
import { LocalAttachmentStorage } from "./local-attachment-storage";
import { NoOpVirusScanner } from "./virus-scanner";

describe("attachment validation helpers", () => {
  it("extracts and sanitizes filenames", () => {
    expect(extractExtension("report.PDF")).toBe("pdf");
    expect(extractExtension("../../etc/passwd")).toBe("");
    expect(sanitizeOriginalFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeOriginalFilename("my invoice (1).pdf")).toBe("my invoice (1).pdf");
    expect(ATTACHMENT_ALLOWED_EXTENSIONS.has("pdf")).toBe(true);
  });
});

describe("LocalAttachmentStorage", () => {
  let root: string;
  let storage: LocalAttachmentStorage;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "supportdesk-attachments-"));
    storage = new LocalAttachmentStorage(root);
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("stores files with UUID filenames and sha256 checksums", async () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const ticketId = "22222222-2222-4222-8222-222222222222";
    const content = Buffer.from("hello attachment");

    const stored = await storage.writeFile({
      extension: "txt",
      source: content,
      tenantId,
      ticketId,
    });

    expect(stored.storedFilename).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.txt$/i,
    );
    expect(stored.sha256).toBe(createHash("sha256").update(content).digest("hex"));
    expect(await readFile(stored.absolutePath)).toEqual(content);
    expect(stored.relativePath.startsWith("tenant-")).toBe(true);
  });

  it("rejects path traversal attempts outside the attachment root", () => {
    expect(() => storage.resolveExistingPath("../../etc/passwd")).toThrow(
      /Invalid attachment storage path/,
    );
    expect(() => storage.resolveExistingPath("/etc/passwd")).toThrow(
      /Invalid attachment storage path/,
    );
    expect(() => storage.assertWithinRoot(path.join(root, "..", "escape.txt"))).toThrow(
      /Invalid attachment storage path/,
    );
  });
});

describe("NoOpVirusScanner", () => {
  it("always returns clean", async () => {
    await expect(new NoOpVirusScanner().scan("/tmp/file")).resolves.toBe("clean");
  });
});
