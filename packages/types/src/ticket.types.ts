export enum TicketStatus {
  NEW = "NEW",
  OPEN = "OPEN",
  PENDING = "PENDING",
  ON_HOLD = "ON_HOLD",
  SOLVED = "SOLVED",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

export enum TicketChannel {
  WEB = "WEB",
  EMAIL = "EMAIL",
  API = "API",
  CHAT = "CHAT",
}

export enum TicketType {
  QUESTION = "QUESTION",
  INCIDENT = "INCIDENT",
  PROBLEM = "PROBLEM",
  FEATURE_REQUEST = "FEATURE_REQUEST",
}

export interface ITicket {
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
  solvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  dueDate?: Date | string | null;
  version: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

export interface CreateTicketParams {
  tenantId: string;
  requesterUserId: string;
  title: string;
  description: string;
  priority?: TicketPriority;
  channel?: TicketChannel;
  type?: TicketType;
  assigneeUserId?: string;
  assignedGroupId?: string;
  dueDate?: Date;
}

export interface UpdateTicketParams {
  expectedVersion: number;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  type?: TicketType;
  assigneeUserId?: string | null;
  assignedGroupId?: string | null;
  dueDate?: Date | null;
}
