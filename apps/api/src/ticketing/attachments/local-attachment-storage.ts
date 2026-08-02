import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { BadRequestException, Injectable } from "@nestjs/common";

export interface StoredFileResult {
  absolutePath: string;
  relativePath: string;
  sha256: string;
  storedFilename: string;
}

@Injectable()
export class LocalAttachmentStorage {
  private readonly root: string;

  constructor() {
    this.root = path.resolve(
      process.env.ATTACHMENTS_STORAGE_ROOT ?? "./data/supportdesk/attachments",
    );
  }

  getRoot(): string {
    return this.root;
  }

  generateStoredFilename(extension: string): string {
    const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (!safeExtension) {
      throw new BadRequestException("File extension is required");
    }
    return `${randomUUID()}.${safeExtension}`;
  }

  resolveTenantTicketDir(tenantId: string, ticketId: string): string {
    this.assertSafeId(tenantId, "tenantId");
    this.assertSafeId(ticketId, "ticketId");
    return path.join(this.root, `tenant-${tenantId}`, `ticket-${ticketId}`);
  }

  async writeFile(input: {
    tenantId: string;
    ticketId: string;
    extension: string;
    source: Readable | Buffer;
  }): Promise<StoredFileResult> {
    const directory = this.resolveTenantTicketDir(input.tenantId, input.ticketId);
    await mkdir(directory, { recursive: true });

    return this.writeToDirectory({
      directory,
      extension: input.extension,
      source: input.source,
    });
  }

  resolveTenantCatalogRequestDir(tenantId: string, requestId: string): string {
    this.assertSafeId(tenantId, "tenantId");
    this.assertSafeId(requestId, "requestId");
    return path.join(this.root, `tenant-${tenantId}`, `request-${requestId}`);
  }

  resolveTenantAssetDir(tenantId: string, assetId: string): string {
    this.assertSafeId(tenantId, "tenantId");
    this.assertSafeId(assetId, "assetId");
    return path.join(this.root, `tenant-${tenantId}`, `asset-${assetId}`);
  }

  /** Writes an attachment for an asset record scope. */
  async writeFileForAsset(input: {
    tenantId: string;
    assetId: string;
    extension: string;
    source: Readable | Buffer;
  }): Promise<StoredFileResult> {
    const directory = this.resolveTenantAssetDir(input.tenantId, input.assetId);
    await mkdir(directory, { recursive: true });
    return this.writeToDirectory({
      directory,
      extension: input.extension,
      source: input.source,
    });
  }

  /** Writes an attachment for a non-ticket scope (e.g. catalog request). */
  async writeFileForRequest(input: {
    tenantId: string;
    requestId: string;
    extension: string;
    source: Readable | Buffer;
  }): Promise<StoredFileResult> {
    const directory = this.resolveTenantCatalogRequestDir(input.tenantId, input.requestId);
    await mkdir(directory, { recursive: true });
    return this.writeToDirectory({
      directory,
      extension: input.extension,
      source: input.source,
    });
  }

  private async writeToDirectory(input: {
    directory: string;
    extension: string;
    source: Readable | Buffer;
  }): Promise<StoredFileResult> {
    const storedFilename = this.generateStoredFilename(input.extension);
    const absolutePath = this.assertWithinRoot(path.join(input.directory, storedFilename));
    const hash = createHash("sha256");

    if (Buffer.isBuffer(input.source)) {
      hash.update(input.source);
      await writeFile(absolutePath, input.source);
    } else {
      const writeStream = createWriteStream(absolutePath);
      input.source.on("data", (chunk: Buffer | string) => {
        hash.update(chunk);
      });
      await pipeline(input.source, writeStream);
    }

    return {
      absolutePath,
      relativePath: path.relative(this.root, absolutePath).split(path.sep).join("/"),
      sha256: hash.digest("hex"),
      storedFilename,
    };
  }

  openReadStream(relativeOrAbsolutePath: string): Readable {
    return createReadStream(this.resolveExistingPath(relativeOrAbsolutePath));
  }

  async deleteFile(relativeOrAbsolutePath: string): Promise<void> {
    const absolutePath = this.resolveExistingPath(relativeOrAbsolutePath);
    try {
      await unlink(absolutePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  async exists(relativeOrAbsolutePath: string): Promise<boolean> {
    try {
      await access(this.resolveExistingPath(relativeOrAbsolutePath));
      return true;
    } catch {
      return false;
    }
  }

  resolveExistingPath(relativeOrAbsolutePath: string): string {
    if (relativeOrAbsolutePath.includes("\0") || relativeOrAbsolutePath.includes("..")) {
      throw new BadRequestException("Invalid attachment storage path");
    }

    const candidate = path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.join(this.root, relativeOrAbsolutePath);

    return this.assertWithinRoot(candidate);
  }

  assertWithinRoot(candidatePath: string): string {
    const resolved = path.resolve(candidatePath);
    const rootWithSep = this.root.endsWith(path.sep) ? this.root : `${this.root}${path.sep}`;

    if (resolved !== this.root && !resolved.startsWith(rootWithSep)) {
      throw new BadRequestException("Invalid attachment storage path");
    }

    return resolved;
  }

  private assertSafeId(value: string, label: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`Invalid ${label}`);
    }
  }
}
