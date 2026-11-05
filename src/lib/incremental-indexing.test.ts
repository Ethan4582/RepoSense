import { describe, expect, it } from "vitest";
import {
  classifyChangedPaths,
  isStructuralChange,
  selectAffectedPages,
} from "./incremental-indexing";

describe("incremental indexing", () => {
  it("classifies renamed files as an old-path deletion and new-path load", () => {
    const result = classifyChangedPaths([
      {
        path: "src/new.ts",
        previousPath: "src/old.ts",
        status: "renamed",
      },
    ]);
    expect([...result.loadPaths]).toEqual(["src/new.ts"]);
    expect([...result.deletePaths]).toEqual(["src/old.ts"]);
  });

  it("selects only pages that cite a changed file", () => {
    const pages = [
      { slug: "auth", relevantFiles: ["src/auth.ts"] },
      { slug: "billing", relevantFiles: ["src/billing.ts"] },
    ];
    expect(
      selectAffectedPages(pages, new Set(["src/auth.ts"])).map(
        (page) => page.slug,
      ),
    ).toEqual(["auth"]);
  });

  it("forces replanning for schema and routing changes", () => {
    expect(isStructuralChange(["prisma/schema.prisma"])).toBe(true);
    expect(isStructuralChange(["src/routes/projects.ts"])).toBe(true);
    expect(isStructuralChange(["src/lib/format.ts"])).toBe(false);
  });
});
