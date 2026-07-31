import { BadRequestException, ConflictException } from "@nestjs/common";
import { TicketChannel, TicketPriority, TicketStatus, TicketType } from "@prisma/client";

export class InvalidTicketTransitionException extends BadRequestException {
  constructor(from: TicketStatus, to: TicketStatus) {
    super(`Invalid ticket status transition from ${from} to ${to}`);
  }
}

export class TicketConcurrencyException extends ConflictException {
  readonly currentVersion: number;
  readonly expectedVersion: number;
  readonly resourceId?: string;

  constructor(expectedVersion: number, currentVersion: number, resourceId?: string) {
    super({
      code: "CONCURRENCY_CONFLICT",
      currentVersion,
      error: "Conflict",
      expectedVersion,
      message: `Ticket version conflict: expected version ${expectedVersion} but current version is ${currentVersion}`,
      resourceId,
      statusCode: 409,
    });
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
    this.resourceId = resourceId;
  }
}

export class ClosedTicketAssignmentException extends BadRequestException {
  constructor(ticketId: string) {
    super(`Cannot assign or unassign a closed ticket (id: ${ticketId})`);
  }
}

export interface TicketProps {
  id: string;
  tenantId: string;
  publicRef: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  channel: TicketChannel;
  type: TicketType;
  requesterUserId: string;
  assigneeUserId?: string | null;
  assignedGroupId?: string | null;
  solvedAt?: Date | null;
  closedAt?: Date | null;
  dueDate?: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.NEW]: [TicketStatus.OPEN, TicketStatus.SOLVED],
  [TicketStatus.OPEN]: [TicketStatus.PENDING, TicketStatus.ON_HOLD, TicketStatus.SOLVED],
  [TicketStatus.PENDING]: [TicketStatus.OPEN, TicketStatus.SOLVED],
  [TicketStatus.ON_HOLD]: [TicketStatus.OPEN, TicketStatus.SOLVED],
  [TicketStatus.SOLVED]: [TicketStatus.OPEN, TicketStatus.CLOSED],
  [TicketStatus.CLOSED]: [],
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TicketAggregate {
  private props: TicketProps;

  constructor(props: TicketProps) {
    TicketAggregate.validateInitialProps(props);
    this.props = { ...props };
  }

  static create(params: {
    id: string;
    tenantId: string;
    publicRef: string;
    title: string;
    description: string;
    requesterUserId: string;
    priority?: TicketPriority;
    channel?: TicketChannel;
    type?: TicketType;
    assigneeUserId?: string | null;
    assignedGroupId?: string | null;
    dueDate?: Date | null;
  }): TicketAggregate {
    const now = new Date();
    return new TicketAggregate({
      assignedGroupId: params.assignedGroupId ?? null,
      assigneeUserId: params.assigneeUserId ?? null,
      channel: params.channel ?? TicketChannel.WEB,
      createdAt: now,
      deletedAt: null,
      description: params.description.trim(),
      dueDate: params.dueDate ?? null,
      id: params.id,
      priority: params.priority ?? TicketPriority.MEDIUM,
      publicRef: params.publicRef,
      requesterUserId: params.requesterUserId,
      status: TicketStatus.NEW,
      tenantId: params.tenantId,
      title: params.title.trim(),
      type: params.type ?? TicketType.QUESTION,
      updatedAt: now,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get publicRef(): string {
    return this.props.publicRef;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get status(): TicketStatus {
    return this.props.status;
  }

  get priority(): TicketPriority {
    return this.props.priority;
  }

  get channel(): TicketChannel {
    return this.props.channel;
  }

  get type(): TicketType {
    return this.props.type;
  }

  get requesterUserId(): string {
    return this.props.requesterUserId;
  }

  get assigneeUserId(): string | null | undefined {
    return this.props.assigneeUserId;
  }

  get assignedGroupId(): string | null | undefined {
    return this.props.assignedGroupId;
  }

  get solvedAt(): Date | null | undefined {
    return this.props.solvedAt;
  }

  get closedAt(): Date | null | undefined {
    return this.props.closedAt;
  }

  get dueDate(): Date | null | undefined {
    return this.props.dueDate;
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

  public transitionTo(newStatus: TicketStatus, expectedVersion: number): void {
    this.verifyVersion(expectedVersion);

    if (this.props.status === newStatus) {
      return;
    }

    const allowed = VALID_TRANSITIONS[this.props.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new InvalidTicketTransitionException(this.props.status, newStatus);
    }

    this.props.status = newStatus;
    const now = new Date();
    this.props.updatedAt = now;

    if (newStatus === TicketStatus.SOLVED) {
      this.props.solvedAt = now;
    } else if (newStatus === TicketStatus.CLOSED) {
      this.props.closedAt = now;
    } else if (newStatus === TicketStatus.OPEN && this.props.solvedAt) {
      // Reopening clears solvedAt
      this.props.solvedAt = null;
    }

    this.props.version += 1;
  }

  public updateFields(
    params: {
      title?: string;
      description?: string;
      priority?: TicketPriority;
      channel?: TicketChannel;
      type?: TicketType;
      assigneeUserId?: string | null;
      assignedGroupId?: string | null;
      dueDate?: Date | null;
    },
    expectedVersion: number,
  ): void {
    this.verifyVersion(expectedVersion);

    if (params.title !== undefined) {
      if (!params.title.trim()) {
        throw new BadRequestException("Ticket title cannot be empty");
      }
      this.props.title = params.title.trim();
    }

    if (params.description !== undefined) {
      if (!params.description.trim()) {
        throw new BadRequestException("Ticket description cannot be empty");
      }
      this.props.description = params.description.trim();
    }

    if (params.priority !== undefined) {
      this.props.priority = params.priority;
    }

    if (params.channel !== undefined) {
      this.props.channel = params.channel;
    }

    if (params.type !== undefined) {
      this.props.type = params.type;
    }

    if (params.assigneeUserId !== undefined) {
      this.props.assigneeUserId = params.assigneeUserId;
    }

    if (params.assignedGroupId !== undefined) {
      this.props.assignedGroupId = params.assignedGroupId;
    }

    if (params.dueDate !== undefined) {
      this.props.dueDate = params.dueDate;
    }

    this.props.updatedAt = new Date();
    this.props.version += 1;
  }

  /**
   * Assign or reassign a user and/or group to this ticket.
   *
   * Returns the previous assignee/group IDs so the caller can include them
   * in the audit event metadata.
   */
  public assign(
    params: {
      assigneeUserId?: string | null;
      assignedGroupId?: string | null;
    },
    expectedVersion: number,
  ): {
    previousAssigneeUserId: string | null | undefined;
    previousAssignedGroupId: string | null | undefined;
  } {
    this.verifyVersion(expectedVersion);

    if (this.props.status === TicketStatus.CLOSED) {
      throw new ClosedTicketAssignmentException(this.props.id);
    }

    if (params.assigneeUserId !== undefined && params.assigneeUserId !== null) {
      if (!uuidPattern.test(params.assigneeUserId)) {
        throw new BadRequestException("assigneeUserId must be a valid UUID");
      }
    }

    if (params.assignedGroupId !== undefined && params.assignedGroupId !== null) {
      if (!uuidPattern.test(params.assignedGroupId)) {
        throw new BadRequestException("assignedGroupId must be a valid UUID");
      }
    }

    const previousAssigneeUserId = this.props.assigneeUserId;
    const previousAssignedGroupId = this.props.assignedGroupId;

    if (params.assigneeUserId !== undefined) {
      this.props.assigneeUserId = params.assigneeUserId;
    }

    if (params.assignedGroupId !== undefined) {
      this.props.assignedGroupId = params.assignedGroupId;
    }

    this.props.updatedAt = new Date();
    this.props.version += 1;

    return { previousAssignedGroupId, previousAssigneeUserId };
  }

  /**
   * Remove the current assignee and group from this ticket.
   *
   * Returns previous values for audit metadata.
   */
  public unassign(expectedVersion: number): {
    previousAssigneeUserId: string | null | undefined;
    previousAssignedGroupId: string | null | undefined;
  } {
    this.verifyVersion(expectedVersion);

    if (this.props.status === TicketStatus.CLOSED) {
      throw new ClosedTicketAssignmentException(this.props.id);
    }

    const previousAssigneeUserId = this.props.assigneeUserId;
    const previousAssignedGroupId = this.props.assignedGroupId;

    this.props.assigneeUserId = null;
    this.props.assignedGroupId = null;
    this.props.updatedAt = new Date();
    this.props.version += 1;

    return { previousAssignedGroupId, previousAssigneeUserId };
  }

  public toProps(): TicketProps {
    return { ...this.props };
  }

  private verifyVersion(expectedVersion: number): void {
    if (this.props.version !== expectedVersion) {
      throw new TicketConcurrencyException(expectedVersion, this.props.version, this.props.id);
    }
  }

  private static validateInitialProps(props: TicketProps): void {
    if (!props.tenantId?.trim()) {
      throw new BadRequestException("Ticket tenantId is required");
    }
    if (!props.publicRef?.trim()) {
      throw new BadRequestException("Ticket publicRef is required");
    }
    if (!props.title?.trim()) {
      throw new BadRequestException("Ticket title is required");
    }
    if (!props.description?.trim()) {
      throw new BadRequestException("Ticket description is required");
    }
    if (!props.requesterUserId?.trim()) {
      throw new BadRequestException("Ticket requesterUserId is required");
    }
  }
}
