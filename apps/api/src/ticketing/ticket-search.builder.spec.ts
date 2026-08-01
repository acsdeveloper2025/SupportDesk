import { TicketStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { validateSearchTicketsQuery } from "./dto/search-tickets.dto";
import {
  buildTicketSearchOrClause,
  escapeLikePattern,
  TICKET_SEARCH_QUERY_MAX_LENGTH,
} from "./ticket-search.builder";
import { TicketsRepository } from "./tickets.repository";

describe("ticket-search.builder", () => {
  it("escapes LIKE metacharacters so wildcards are literal", () => {
    expect(escapeLikePattern("100%_done\\")).toBe("100\\%\\_done\\\\");
  });

  it("builds OR clauses across publicRef, title, description, and requester fields", () => {
    const clauses = buildTicketSearchOrClause("VPN");
    expect(clauses).toHaveLength(8);
    expect(clauses[0]).toEqual({ publicRef: { contains: "VPN", mode: "insensitive" } });
    expect(clauses[1]).toEqual({ title: { contains: "VPN", mode: "insensitive" } });
    expect(clauses[2]).toEqual({ description: { contains: "VPN", mode: "insensitive" } });
    expect(clauses[3]).toEqual({
      requesterUser: { email: { contains: "VPN", mode: "insensitive" } },
    });
  });

  it("returns an empty clause list for blank query text", () => {
    expect(buildTicketSearchOrClause("   ")).toEqual([]);
  });

  it("exports the search query max length constant", () => {
    expect(TICKET_SEARCH_QUERY_MAX_LENGTH).toBe(200);
  });
});

describe("validateSearchTicketsQuery", () => {
  it("accepts valid search, filter, sort, and pagination params", () => {
    const dto = validateSearchTicketsQuery({
      hasAttachments: "true",
      hasComments: "false",
      page: "2",
      pageSize: "10",
      q: "printer",
      sortBy: "priority",
      sortDir: "asc",
      status: "NEW,OPEN",
    });

    expect(dto.q).toBe("printer");
    expect(dto.page).toBe(2);
    expect(dto.pageSize).toBe(10);
    expect(dto.sortBy).toBe("priority");
    expect(dto.sortDir).toBe("asc");
    expect(dto.status).toEqual(["NEW", "OPEN"]);
    expect(dto.hasAttachments).toBe(true);
    expect(dto.hasComments).toBe(false);
  });

  it("rejects oversized search text", () => {
    expect(() => validateSearchTicketsQuery({ q: "x".repeat(201) })).toThrow(/Invalid query/);
  });

  it("rejects unsupported sort fields", () => {
    expect(() => validateSearchTicketsQuery({ sortBy: "relevance" })).toThrow(/Invalid query/);
  });

  it("rejects invalid sort direction", () => {
    expect(() => validateSearchTicketsQuery({ sortDir: "up" })).toThrow(/Invalid query/);
  });

  it("rejects invalid page and page size", () => {
    expect(() => validateSearchTicketsQuery({ page: 0 })).toThrow(/Invalid query/);
    expect(() => validateSearchTicketsQuery({ pageSize: 101 })).toThrow(/Invalid query/);
  });

  it("rejects invalid UUID filters", () => {
    expect(() => validateSearchTicketsQuery({ assigneeUserId: "not-a-uuid" })).toThrow(
      /Invalid query/,
    );
  });

  it("rejects invalid date filters", () => {
    expect(() => validateSearchTicketsQuery({ createdAfter: "yesterday" })).toThrow(
      /Invalid query/,
    );
  });

  it("rejects invalid boolean filters", () => {
    expect(() => validateSearchTicketsQuery({ hasAttachments: "maybe" })).toThrow(/Invalid query/);
  });
});

describe("TicketsRepository.buildWhereClause search combinations", () => {
  const repository = new TicketsRepository({} as never);
  const tenantId = "11111111-1111-1111-1111-111111111111";

  it("applies tenant isolation and soft-delete exclusion by default", () => {
    expect(repository.buildWhereClause(tenantId)).toEqual({
      deletedAt: null,
      tenantId,
    });
  });

  it("combines text search with status filters via AND", () => {
    const where = repository.buildWhereClause(tenantId, {
      q: "vpn",
      status: [TicketStatus.OPEN],
    });

    expect(where.tenantId).toBe(tenantId);
    expect(where.status).toEqual({ in: [TicketStatus.OPEN] });
    expect(Array.isArray(where.AND)).toBe(true);
    const andConditions = where.AND as Array<{ OR?: unknown[] }>;
    expect(andConditions).toHaveLength(1);
    expect(andConditions[0]?.OR).toEqual(
      expect.arrayContaining([
        { title: { contains: "vpn", mode: "insensitive" } },
        { publicRef: { contains: "vpn", mode: "insensitive" } },
      ]),
    );
  });

  it("combines OWN scope with search without clobbering either OR", () => {
    const where = repository.buildWhereClause(tenantId, {
      q: "outage",
      requesterOrAssigneeUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(Array.isArray(where.AND)).toBe(true);
    const andConditions = where.AND as Array<{ OR?: unknown[] }>;
    expect(andConditions).toHaveLength(2);
    expect(andConditions[0]?.OR).toEqual([
      { requesterUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
      { assigneeUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    ]);
    expect(Array.isArray(andConditions[1]?.OR)).toBe(true);
    expect(andConditions[1]?.OR?.length).toBeGreaterThan(0);
  });

  it("matches nothing for GROUP scope with empty memberships", () => {
    const where = repository.buildWhereClause(tenantId, {
      assignedGroupIds: [],
    });
    expect(where.id).toEqual({ in: [] });
  });

  it("applies hasAttachments and hasComments existence filters", () => {
    const where = repository.buildWhereClause(tenantId, {
      hasAttachments: true,
      hasComments: false,
    });

    expect(where.AND).toEqual([
      { attachments: { some: { deletedAt: null } } },
      { comments: { none: { deletedAt: null } } },
    ]);
  });

  it("applies date range filters", () => {
    const where = repository.buildWhereClause(tenantId, {
      createdAfter: "2026-01-01T00:00:00.000Z",
      createdBefore: "2026-12-31T23:59:59.999Z",
      dueAfter: "2026-06-01T00:00:00.000Z",
      updatedAfter: "2026-02-01T00:00:00.000Z",
    });

    expect(where.createdAt).toEqual({
      gte: "2026-01-01T00:00:00.000Z",
      lte: "2026-12-31T23:59:59.999Z",
    });
    expect(where.updatedAt).toEqual({ gte: "2026-02-01T00:00:00.000Z" });
    expect(where.dueDate).toEqual({ gte: "2026-06-01T00:00:00.000Z" });
  });
});
