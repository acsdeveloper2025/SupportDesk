import { describe, expect, it } from "vitest";

import { buildKbArticleSearchOrClause, escapeLikePattern } from "./kb-search.builder";

describe("kb-search.builder", () => {
  describe("escapeLikePattern", () => {
    it("escapes %, _, and \\ characters", () => {
      expect(escapeLikePattern("100%_test\\path")).toBe("100\\%\\_test\\\\path");
    });
  });

  describe("buildKbArticleSearchOrClause", () => {
    it("returns empty array for whitespace query", () => {
      expect(buildKbArticleSearchOrClause("   ")).toEqual([]);
    });

    it("builds search conditions across title, summary, content, category, and tags", () => {
      const clauses = buildKbArticleSearchOrClause("SSO Setup");
      expect(clauses).toHaveLength(5);
      expect(clauses).toEqual([
        { title: { contains: "SSO Setup", mode: "insensitive" } },
        { summary: { contains: "SSO Setup", mode: "insensitive" } },
        { content: { contains: "SSO Setup", mode: "insensitive" } },
        { category: { name: { contains: "SSO Setup", mode: "insensitive" } } },
        {
          articleTags: { some: { tag: { name: { contains: "SSO Setup", mode: "insensitive" } } } },
        },
      ]);
    });
  });
});
