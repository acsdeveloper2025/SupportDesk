import type { Prisma } from "@prisma/client";

/** Maximum search text length accepted by GET /api/v1/tickets/search. */
export const TICKET_SEARCH_QUERY_MAX_LENGTH = 200;

/**
 * Escapes LIKE/ILIKE metacharacters so user input is treated literally.
 * Prisma `contains` maps to parameterized LIKE; escaping prevents wildcard injection.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Builds the tenant-scoped text-search OR clause for PostgreSQL ILIKE matching
 * across public reference, title, description, and requester identity fields.
 */
export function buildTicketSearchOrClause(rawQuery: string): Prisma.TicketWhereInput[] {
  const q = escapeLikePattern(rawQuery.trim());
  if (!q) {
    return [];
  }

  return [
    { publicRef: { contains: q, mode: "insensitive" } },
    { title: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
    { requesterUser: { email: { contains: q, mode: "insensitive" } } },
    { requesterUser: { emailNormalized: { contains: q, mode: "insensitive" } } },
    {
      requesterUser: {
        profile: { displayName: { contains: q, mode: "insensitive" } },
      },
    },
    {
      requesterUser: {
        profile: { firstName: { contains: q, mode: "insensitive" } },
      },
    },
    {
      requesterUser: {
        profile: { lastName: { contains: q, mode: "insensitive" } },
      },
    },
  ];
}
