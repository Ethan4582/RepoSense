import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure.input(
    z.object({
      name: z.string().min(1, "Project name is required"),
      repoUrl: z.string().url("Invalid URL format").min(1, "Repository URL is required"),
      githubToken: z.string().optional(),
    })
  ).mutation(async ({ ctx, input }) => {
    // Ensure user exists in the User table
    await ctx.db.user.upsert({
      where: { id: ctx.user.userId },
      update: {},
      create: {
        id: ctx.user.userId,
        emailAddress: ctx.user.emailAddress ?? "unknown",
      },
    });

    const project = await ctx.db.project.create({
      data: {
        name: input.name,
        repoUrl: input.repoUrl,
        userToProjects: {
          create: {
            userId: ctx.user.userId!,
          }
        }
      }
    });
    return project;

  }),


  getProjects: protectedProcedure.query(async ({ ctx }) => {
     return await  ctx.db.project.findMany({
      // this will return all projects that the user is associated with
      where: {
         userToProjects: {
            some: {
               userId: ctx.user.userId!,
            },
         },
          deletedAt: null, // Exclude deleted projects
      },
     
   });
   })
})


