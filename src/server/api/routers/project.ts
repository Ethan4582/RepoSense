import { pollCommits } from "~/lib/github";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { indexGithubRepo } from "~/lib/github-loader";

export const projectRouter = createTRPCRouter({
  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: ctx.user.userId!,
          },
        },
        deletedAt: null,
      },
    });
  }),

  createProject: protectedProcedure.input(
    z.object({
      name: z.string().min(1, "Project name is required"),
      repoUrl: z.string().url("Invalid URL format").min(1, "Repository URL is required"),
      githubToken: z.string().optional(),
    })
  ).mutation(async ({ ctx, input }) => {
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
    await indexGithubRepo(
      input.repoUrl,
      input.githubToken || process.env.GITHUB_TOKEN,
      project.id
    );
    await pollCommits(project.id);
    return project;
  }),

  getCommits: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).query(async ({ ctx, input }) => {
    pollCommits(input.projectId).then().catch(console.error);
    return await ctx.db.commit.findMany({
      where: {
        projectId: input.projectId,
      },
    });
  }),

  saveAnswer: protectedProcedure.input(
    z.object({
      projectId: z.string(),
      question: z.string(),
      fileReference: z.any(),
      answers: z.string()
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.question.create({
      data: {
        answers: input.answers,
        fileReference: input.fileReference,
        question: input.question,
        projectId: input.projectId,
        userId: ctx.user.userId!,
      }
    });
  }),

  getQuestion: protectedProcedure.input(z.object(
    {
      projectId: z.string(),
    }
  )).query(async ({ ctx, input }) => {
    return await ctx.db.question.findMany({
      where: {
        projectId: input.projectId,
      },
      include: {
        user: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }),

  archiveProject: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.project.update({
      where: {
        id: input.projectId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }),

  uploadMeeting: protectedProcedure.input(
    z.object({
      projectId: z.string(),
      meetingUrl: z.string(),
      name: z.string()
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.meeting.create({
      data: {
        meetingUrl: input.meetingUrl,
        projectId: input.projectId,
        name: input.name,
        status: "PROCESSING"
      }
    });
  }),

  getMeetings: protectedProcedure.input(
    z.object({
      projectId: z.string()
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.meeting.findMany({
      where: {
        projectId: input.projectId
      }
      ,include:{
        issues:true,

      }
    });
  })

});


