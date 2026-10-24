import { z } from "zod";

export type RepoScale = "COMPACT" | "SUB_MEDIUM" | "MEDIUM" | "LARGE";

export function determineRepoScale(fileCount: number, loc: number): RepoScale {
  if (fileCount < 15 || loc < 2500) return "COMPACT";
  if (fileCount <= 40 || loc <= 10000) return "SUB_MEDIUM";
  if (fileCount <= 90 || loc <= 35000) return "MEDIUM";
  return "LARGE";
}

export const DynamicWikiPlanSchema = z.object({
  repoScale: z.enum(["COMPACT", "SUB_MEDIUM", "MEDIUM", "LARGE"]),
  sections: z.array(
    z.object({
      sectionTitle: z.string().describe("Emergent domain module, e.g. 'Authentication & Session Boundary'"),
      pages: z.array(
        z.object({
          slug: z.string(),
          title: z.string().describe("Concrete subsystem, e.g. 'JWT Verification & RBAC Guards'"),
          description: z.string(),
          targetFilePaths: z.array(z.string()).min(1, "Each page must map to >=1 real source file"),
          focusSymbols: z.array(z.string()),
        })
      ).min(1),
    })
  ),
}).superRefine((data, ctx) => {
  const limits: Record<RepoScale, { minSec: number; maxSec: number; minPages: number }> = {
    COMPACT:    { minSec: 3,  maxSec: 4,  minPages: 1 },
    SUB_MEDIUM: { minSec: 5,  maxSec: 7,  minPages: 2 },
    MEDIUM:     { minSec: 8,  maxSec: 11, minPages: 2 },
    LARGE:      { minSec: 12, maxSec: 18, minPages: 2 },
  };

  const cfg = limits[data.repoScale];
  if (data.sections.length < cfg.minSec || data.sections.length > cfg.maxSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${data.repoScale} requires between ${cfg.minSec} and ${cfg.maxSec} sections. Received ${data.sections.length}.`,
    });
  }

  for (const sec of data.sections) {
    if (sec.pages.length < cfg.minPages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Section '${sec.sectionTitle}' in ${data.repoScale} must contain at least ${cfg.minPages} distinct subpages.`,
      });
    }
    for (const page of sec.pages) {
      if (page.title.trim().toLowerCase() === sec.sectionTitle.trim().toLowerCase()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Page title '${page.title}' cannot duplicate parent section '${sec.sectionTitle}'.`,
        });
      }
    }
  }
});

export type DynamicWikiPlan = z.infer<typeof DynamicWikiPlanSchema>;
