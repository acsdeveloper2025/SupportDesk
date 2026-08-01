import type { Prisma } from "@prisma/client";

/** Maximum query length accepted by KB article search */
export const KB_SEARCH_QUERY_MAX_LENGTH = 200;

export function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function buildKbArticleSearchOrClause(rawQuery: string): Prisma.KbArticleWhereInput[] {
  const q = escapeLikePattern(rawQuery.trim());
  if (!q) {
    return [];
  }

  return [
    { title: { contains: q, mode: "insensitive" } },
    { summary: { contains: q, mode: "insensitive" } },
    { content: { contains: q, mode: "insensitive" } },
    { category: { name: { contains: q, mode: "insensitive" } } },
    { articleTags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
  ];
}
