import { getPullRequestsForProject } from "~/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { encryptKeyWithIv } from "~/lib/providers";
import { alignChatModel, resolveProjectKeys } from "~/lib/providers/guard";
import { GitHubAccessError, getRepoMetadata, parseRepoUrl } from "~/lib/github";
import { runIndexingWorkflow, inlineStepRunner } from "~/lib/indexing-workflow";
import { writesPaused } from "~/lib/emergency";
import { withoutProjectSecrets } from "~/lib/project";

const GITHUB_REPO_REGEX = /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

const getEncryptionSecret = (): string =>
  process.env.ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export const projectRouter = createTRPCRouter({
  getProjects: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: ctx.user.userId!,
          },
        },
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        indexingJobs: {
          orderBy: { startedAt: "desc" },
          take: 1,
        },
        _count: { select: { wikiPages: true } },
      },
    });
    return projects.map(withoutProjectSecrets);
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        repoUrl: z.string().regex(GITHUB_REPO_REGEX, "Please provide a valid GitHub repository URL."),
        githubToken: z.string().optional(),
        chatProvider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).optional().default("OPENAI"),
        chatModel: z.string().optional(),
        embeddingProvider: z.enum(["OPENAI", "GEMINI"]).optional().default("OPENAI"),
        isPublicWiki: z.boolean().optional().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (writesPaused()) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Repository indexing is temporarily paused." });
      }

      const coordinates = parseRepoUrl(input.repoUrl.trim());
      const userId = ctx.user.userId!;

      let meta;
      try {
        meta = await getRepoMetadata(coordinates.repoUrl, input.githubToken);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof GitHubAccessError ? err.message : "Could not read this GitHub repository.",
        });
      }

      const existing = await ctx.db.project.findFirst({
        where: {
          repoOwner: coordinates.owner,
          repoName: coordinates.repo,
          userToProjects: { some: { userId } },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You have already added this repository.",
        });
      }

      let encryptedGithubToken: string | null = null;
      let githubTokenIv: string | null = null;
      if (input.githubToken?.trim()) {
        const encrypted = await encryptKeyWithIv(input.githubToken.trim(), getEncryptionSecret());
        encryptedGithubToken = encrypted.encryptedKey;
        githubTokenIv = encrypted.iv;
      }

      const embeddingModel = input.embeddingProvider === "OPENAI" ? "text-embedding-3-small" : "gemini-embedding-001";
      const embeddingDimensions = input.embeddingProvider === "OPENAI" ? 1536 : 768;

      const project = await ctx.db.project.create({
        data: {
          name: `${coordinates.owner}/${coordinates.repo}`,
          repoOwner: coordinates.owner,
          repoName: coordinates.repo,
          repoUrl: coordinates.repoUrl,
          encryptedGithubToken,
          githubTokenIv,
          isPrivateRepo: meta.isPrivate,
          isPublicWiki: meta.isPrivate ? false : input.isPublicWiki,
          chatProvider: input.chatProvider,
          chatModel: alignChatModel(input.chatProvider, input.chatModel),
          embeddingProvider: input.embeddingProvider,
          embeddingModel,
          embeddingDimensions,
          userToProjects: { create: { userId } },
        },
      });

      try {
        await resolveProjectKeys(userId, project);
        const job = await ctx.db.indexingJob.create({
          data: { projectId: project.id, status: "QUEUED", currentStep: "LOADING_REPO" },
        });
        runIndexingWorkflow({
          projectId: project.id,
          jobId: job.id,
          userId,
          step: inlineStepRunner,
          db: ctx.db,
        }).catch((err) => console.error("[createProject] indexing failed:", err));
      } catch (err) {
        console.warn("[createProject] indexing deferred:", err instanceof Error ? err.message : err);
      }

      return withoutProjectSecrets(project);
    }),
  getCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
      }).optional()
    )
    .query(async () => {
      return [];
    }),

  getPullRequests: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pid = input?.projectId;
      try {
        if (pid && pid !== "all") {
          return await getPullRequestsForProject(pid);
        }

        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId!,
              },
            },
            deletedAt: null,
          },
          select: { id: true },
        });

        const results = await Promise.allSettled(
          userProjects.map((p) => getPullRequestsForProject(p.id))
        );

        const allPrs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
        return allPrs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } catch (err) {
        console.error("Failed to fetch pull requests:", err);
        return [];
      }
    }),

  saveAnswer: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        question: z.string(),
        answers: z.string(),
        fileReference: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.create({
        data: {
          answers: input.answers,
          projectId: input.projectId,
          question: input.question,
          fileReference: input.fileReference,
          userId: ctx.user.userId!,
        },
      });
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, imageUrl: true },
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      });
    }),

  getQuestion: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, imageUrl: true },
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      });
    }),

  togglePinQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.question.findFirst({
        where: {
          id: input.questionId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        select: { isPinned: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return await ctx.db.question.update({
        where: { id: input.questionId },
        data: { isPinned: !existing.isPinned },
      });
    }),

  toggleBookmarkQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.question.findFirst({
        where: {
          id: input.questionId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        select: { isBookmarked: true },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return await ctx.db.question.update({
        where: { id: input.questionId },
        data: { isBookmarked: !existing.isBookmarked },
      });
    }),

  renameQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
        question: z.string().min(1, "Thread title cannot be empty"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.question.findFirst({
        where: {
          id: input.questionId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.update({
        where: { id: input.questionId },
        data: { question: input.question },
      });
    }),

  deleteQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.question.findFirst({
        where: {
          id: input.questionId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.delete({
        where: { id: input.questionId },
      });
    }),

  getBookmarkedQuestions: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        query: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pid = input?.projectId;
      let projectFilter: any;

      if (pid && pid !== "all") {
        projectFilter = pid;
      } else {
        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId!,
              },
            },
            deletedAt: null,
          },
          select: { id: true },
        });
        projectFilter = { in: userProjects.map((p) => p.id) };
      }

      return await ctx.db.question.findMany({
        where: {
          projectId: projectFilter,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
          isBookmarked: true,
          ...(input?.query
            ? {
                question: {
                  contains: input.query,
                  mode: "insensitive",
                },
              }
            : {}),
        },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, imageUrl: true },
          },
          project: {
            select: { id: true, name: true, repoUrl: true, isPublicWiki: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }),

  uploadMeeting: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        meetingUrl: z.string(),
        name: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.meeting.create({
        data: {
          meetingUrl: input.meetingUrl,
          projectId: input.projectId,
          name: input.name,
          status: "PROCESSING",
        },
      });
    }),

  getMeetings: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pid = input?.projectId;
      let projectFilter: any;

      if (pid && pid !== "all") {
        projectFilter = pid;
      } else {
        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId!,
              },
            },
            deletedAt: null,
          },
          select: { id: true },
        });
        projectFilter = { in: userProjects.map((p) => p.id) };
      }

      return await ctx.db.meeting.findMany({
        where: {
          projectId: projectFilter,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        include: {
          issues: true,
          project: { select: { id: true, name: true, repoUrl: true, isPublicWiki: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getMeetingById: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.meeting.findFirst({
        where: {
          id: input.meetingId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        include: {
          issues: true,
          project: { select: { id: true, name: true, repoUrl: true, isPublicWiki: true } },
        },
      });
    }),

  deleteMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.meeting.findFirst({
        where: {
          id: input.meetingId,
          project: { userToProjects: { some: { userId: ctx.user.userId! } } },
        },
        select: { id: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.meeting.delete({
        where: { id: input.meetingId },
      });
    }),

  getTeamMembers: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.userToProject.findMany({
        where: {
          projectId: input.projectId,
        },
        select: {
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              imageUrl: true,
            },
          },
        },
      });
    }),

  archiveProject: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId!, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      const project = await ctx.db.project.update({
        where: {
          id: input.projectId,
        },
        data: {
          deletedAt: new Date(),
        },
      });
      return withoutProjectSecrets(project);
    }),
});

