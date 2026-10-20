import { pollCommits, getPullRequestsForProject } from "~/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
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
      input.githubToken ?? process.env.GITHUB_TOKEN,
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

  getPullRequests: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).query(async ({ input }) => {
    try {
      return await getPullRequestsForProject(input.projectId);
    } catch (err) {
      console.error("Failed to fetch pull requests:", err);
      return [];
    }
  }),

  saveAnswer: protectedProcedure.input(
    z.object({
      projectId: z.string(),
      question: z.string(),
      answers: z.string(),
      fileReference: z.any()
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.question.create({
      data: {
        answers: input.answers,
        projectId: input.projectId,
        question: input.question,
        fileReference: input.fileReference,
        userId: ctx.user.userId!
      }
    });
  }),

  getQuestions: protectedProcedure.input(z.object({ projectId: z.string() })).query(async ({ ctx, input }) => { return await ctx.db.question.findMany({ where: { projectId: input.projectId }, include: { user: true }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] }); }),

  getQuestion: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.question.findMany({
      where: {
        projectId: input.projectId
      },
      include: {
        user: true
      },
      orderBy: [
        { isPinned: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }),

  togglePinQuestion: protectedProcedure.input(
    z.object({
      questionId: z.string(),
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.question.findUnique({
      where: { id: input.questionId },
      select: { isPinned: true },
    });
    if (!existing) {
      throw new Error("Question not found");
    }
    return await ctx.db.question.update({
      where: { id: input.questionId },
      data: { isPinned: !existing.isPinned },
    });
  }),

  toggleBookmarkQuestion: protectedProcedure.input(
    z.object({
      questionId: z.string(),
    })
  ).mutation(async ({ ctx, input }) => {
    const existing = await ctx.db.question.findUnique({
      where: { id: input.questionId },
      select: { isBookmarked: true },
    });
    if (!existing) {
      throw new Error("Question not found");
    }
    return await ctx.db.question.update({
      where: { id: input.questionId },
      data: { isBookmarked: !existing.isBookmarked },
    });
  }),

  renameQuestion: protectedProcedure.input(
    z.object({
      questionId: z.string(),
      question: z.string().min(1, "Thread title cannot be empty"),
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.question.update({
      where: { id: input.questionId },
      data: { question: input.question },
    });
  }),

  deleteQuestion: protectedProcedure.input(
    z.object({
      questionId: z.string(),
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.question.delete({
      where: { id: input.questionId },
    });
  }),

  getBookmarkedQuestions: protectedProcedure.input(
    z.object({
      projectId: z.string(),
      query: z.string().optional(),
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.question.findMany({
      where: {
        projectId: input.projectId,
        isBookmarked: true,
        ...(input.query?.trim()
          ? {
              OR: [
                { question: { contains: input.query, mode: "insensitive" } },
                { answers: { contains: input.query, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
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
    const meeting = await ctx.db.meeting.create({
      data: {
        meetingUrl: input.meetingUrl,
        projectId: input.projectId,
        name: input.name,
        status: "PROCESSING"
      }
    });
    return meeting;
  }),

  getMeetings: protectedProcedure.input(
    z.object({
      projectId: z.string()
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.meeting.findMany({
      where: {
        projectId: input.projectId
      },
      include: {
        issues: true,
      }
    });
  }),

  deleteMeeting: protectedProcedure.input(
    z.object({
      meetingId: z.string(),
    })
  ).mutation(async ({ ctx, input }) => {
    return await ctx.db.meeting.delete({
      where: { id: input.meetingId }
    });
  }),

  getMeetingById: protectedProcedure.input(
    z.object({
      meetingId: z.string(),
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.meeting.findUnique({
      where: { id: input.meetingId },
      include: {
        issues: true,
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

  getTeamMembers: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).query(async ({ ctx, input }) => {
    return await ctx.db.userToProject.findMany({
      where: {
        projectId: input.projectId,
      },
      include: {
        user: true,
      },
    });
  }),
});
