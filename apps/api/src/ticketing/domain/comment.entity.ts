import { BadRequestException, ConflictException } from "@nestjs/common";
import type { CommentVisibility } from "@prisma/client";

export class CommentConcurrencyException extends ConflictException {
  readonly currentVersion: number;
  readonly expectedVersion: number;
  readonly resourceId?: string;

  constructor(expectedVersion: number, currentVersion: number, resourceId?: string) {
    super({
      code: "CONCURRENCY_CONFLICT",
      currentVersion,
      error: "Conflict",
      expectedVersion,
      message: `Comment version conflict: expected version ${expectedVersion} but current version is ${currentVersion}`,
      resourceId,
      statusCode: 409,
    });
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
    this.resourceId = resourceId;
  }
}

export class CommentEditWindowExpiredException extends BadRequestException {
  constructor(commentId: string) {
    super(
      `Cannot edit or delete comment (id: ${commentId}) after the 15-minute edit window has expired.`,
    );
  }
}

export interface CommentProps {
  id: string;
  tenantId: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  visibility: CommentVisibility;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export class CommentEntity {
  private props: CommentProps;

  constructor(props: CommentProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get ticketId(): string {
    return this.props.ticketId;
  }
  get authorUserId(): string {
    return this.props.authorUserId;
  }
  get body(): string {
    return this.props.body;
  }
  get visibility(): CommentVisibility {
    return this.props.visibility;
  }
  get version(): number {
    return this.props.version;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get deletedAt(): Date | null | undefined {
    return this.props.deletedAt;
  }
  get isDeleted(): boolean {
    return !!this.props.deletedAt;
  }

  /**
   * Updates the body of the comment.
   * Enforces optimistic concurrency and a 15-minute edit window.
   */
  updateBody(newBody: string, expectedVersion: number): void {
    if (this.isDeleted) {
      throw new BadRequestException("Cannot update a deleted comment");
    }

    if (this.version !== expectedVersion) {
      throw new CommentConcurrencyException(expectedVersion, this.version, this.id);
    }

    this.enforceEditWindow();

    this.props.body = newBody;
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  /**
   * Soft-deletes the comment.
   * Enforces optimistic concurrency and a 15-minute edit window.
   */
  softDelete(expectedVersion: number): void {
    if (this.isDeleted) {
      throw new BadRequestException("Comment is already deleted");
    }

    if (this.version !== expectedVersion) {
      throw new CommentConcurrencyException(expectedVersion, this.version, this.id);
    }

    this.enforceEditWindow();

    this.props.deletedAt = new Date();
    this.props.version += 1;
    this.props.updatedAt = new Date();
  }

  /**
   * Enforces that the comment can only be edited within 15 minutes of creation.
   */
  private enforceEditWindow(): void {
    const now = new Date();
    const ageInMinutes = (now.getTime() - this.createdAt.getTime()) / (1000 * 60);

    if (ageInMinutes > 15) {
      throw new CommentEditWindowExpiredException(this.id);
    }
  }
}
