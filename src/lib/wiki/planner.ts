import { z } from 'zod';

export const WikiPlannerSchema = z.object({
  overviewTitle: z.string(),
  domainSummary: z.string(),
  sections: z.array(z.object({
    sectionTitle: z.string(), sectionOrder: z.number().int(),
    pages: z.array(z.object({ slug: z.string(), title: z.string(), pageOrder: z.number().int(), targetFilePaths: z.array(z.string()), focusSymbols: z.array(z.string()), expectedMermaidType: z.enum(['flowchart', 'sequenceDiagram', 'classDiagram', 'stateDiagram']).optional() })),
  })),
});
export type WikiPlanner = z.infer<typeof WikiPlannerSchema>;
