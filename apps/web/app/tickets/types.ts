/**
 * Frontend-local type definitions for the Ticket module.
 * These mirror the API response shapes but are defined independently to avoid
 * coupling the web layer to backend packages (per architecture boundary rules).
 */

export type TicketStatus = "NEW" | "OPEN" | "PENDING" | "ON_HOLD" | "SOLVED" | "CLOSED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketChannel = "WEB" | "EMAIL" | "PHONE" | "API" | "CHAT";
export type TicketType = "QUESTION" | "INCIDENT" | "PROBLEM" | "TASK";
export type CommentVisibility = "PUBLIC" | "INTERNAL";

export interface Ticket {
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
  assigneeUserId: string | null;
  assignedGroupId: string | null;
  solvedAt: string | null;
  closedAt: string | null;
  dueDate: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  tenantId: string;
  ticketId: string;
  authorUserId: string;
  body: string;
  visibility: CommentVisibility;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CommentListResponse {
  items: Comment[];
  meta: {
    totalRecords: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface UpdateTicketPayload {
  version: number;
  title?: string;
  description?: string;
  priority?: TicketPriority;
  channel?: TicketChannel;
  type?: TicketType;
  dueDate?: string | null;
}

export interface TransitionStatusPayload {
  version: number;
  status: TicketStatus;
}

export interface CreateCommentPayload {
  body: string;
  visibility?: CommentVisibility;
}

export interface ApiError {
  statusCode: number;
  message: string;
  code?: string;
}
