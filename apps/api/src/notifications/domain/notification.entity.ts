import { ConflictException } from "@nestjs/common";
import type { NotificationEventType } from "@prisma/client";

export class NotificationConcurrencyException extends ConflictException {
  readonly currentVersion: number;
  readonly expectedVersion: number;
  readonly resourceId?: string;

  constructor(expectedVersion: number, currentVersion: number, resourceId?: string) {
    super({
      code: "CONCURRENCY_CONFLICT",
      currentVersion,
      error: "Conflict",
      expectedVersion,
      message: `Notification version conflict: expected version ${expectedVersion} but current version is ${currentVersion}`,
      resourceId,
      statusCode: 409,
    });
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
    this.resourceId = resourceId;
  }
}

export interface NotificationProps {
  id: string;
  tenantId: string;
  recipientUserId: string;
  eventType: NotificationEventType;
  title: string;
  body?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  actorUserId?: string | null;
  payload?: Record<string, unknown> | null;
  readAt?: Date | null;
  archivedAt?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class NotificationEntity {
  private props: NotificationProps;

  constructor(props: NotificationProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get tenantId(): string {
    return this.props.tenantId;
  }
  get recipientUserId(): string {
    return this.props.recipientUserId;
  }
  get eventType(): NotificationEventType {
    return this.props.eventType;
  }
  get title(): string {
    return this.props.title;
  }
  get body(): string | null | undefined {
    return this.props.body;
  }
  get resourceType(): string | null | undefined {
    return this.props.resourceType;
  }
  get resourceId(): string | null | undefined {
    return this.props.resourceId;
  }
  get actorUserId(): string | null | undefined {
    return this.props.actorUserId;
  }
  get payload(): Record<string, unknown> | null | undefined {
    return this.props.payload;
  }
  get readAt(): Date | null | undefined {
    return this.props.readAt;
  }
  get archivedAt(): Date | null | undefined {
    return this.props.archivedAt;
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
  get isRead(): boolean {
    return !!this.props.readAt;
  }
  get isArchived(): boolean {
    return !!this.props.archivedAt;
  }

  /**
   * Apply read/archive state changes in one version bump.
   * Archiving implies read. Returns whether any field changed.
   */
  applyStateUpdate(
    expectedVersion: number,
    changes: { read?: boolean; archived?: boolean },
    at: Date = new Date(),
  ): boolean {
    this.assertVersion(expectedVersion);

    let changed = false;

    if (changes.read === true && !this.props.readAt) {
      this.props.readAt = at;
      changed = true;
    } else if (changes.read === false && this.props.readAt) {
      this.props.readAt = null;
      changed = true;
    }

    if (changes.archived === true && !this.props.archivedAt) {
      if (!this.props.readAt) {
        this.props.readAt = at;
      }
      this.props.archivedAt = at;
      changed = true;
    } else if (changes.archived === false && this.props.archivedAt) {
      this.props.archivedAt = null;
      changed = true;
    }

    if (!changed) {
      return false;
    }

    this.props.version += 1;
    this.props.updatedAt = at;
    return true;
  }

  private assertVersion(expectedVersion: number): void {
    if (this.version !== expectedVersion) {
      throw new NotificationConcurrencyException(expectedVersion, this.version, this.id);
    }
  }
}
