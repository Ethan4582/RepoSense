import { pollCommits, getPullRequestsForProject } from "~/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Octokit } from "octokit";
import { indexGithubRepo } from "~/lib/github-loader";

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

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
      name: z.string().optional(),
      repoUrl: z.string().regex(GITHUB_REPO_REGEX, "Please provide a valid, public GitHub repository URL."),
      githubToken: z.string().optional(),
    })
  ).mutation(async ({ ctx, input }) => {
    const match = input.repoUrl.trim().match(GITHUB_REPO_REGEX);
    if (!match || !match[1] || !match[2]) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please provide a valid, public GitHub repository URL.",
      });
    }

    const owner = match[1];
    const repo = match[2];
    const token = input.githubToken || process.env.GITHUB_TOKEN;
    const octokit = new Octokit({ auth: token });

    // Verify repository reachability before creating project and indexing
    try {
      await octokit.rest.repos.get({ owner, repo });
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please provide a valid, public GitHub repository URL.",
      });
    }

    const derivedProjectName = input.name?.trim() || `${owner}/${repo}`;

    const project = await ctx.db.project.create({
      data: {
        name: derivedProjectName,
        repoUrl: input.repoUrl.trim(),
        userToProjects: {
          create: {
            userId: ctx.user.userId!,
          }
        }
      }
    });

    await indexGithubRepo(
      input.repoUrl.trim(),
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
        ...(input.query
          ? {
              question: {
                contains: input.query,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
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
});
