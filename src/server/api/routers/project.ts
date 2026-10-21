import { pollCommits, getPullRequestsForProject } from "~/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  createProject: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        repoUrl: z.string().regex(GITHUB_REPO_REGEX, "Please provide a valid, public GitHub repository URL."),
        githubToken: z.string().optional(),
        chatProvider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "META", "DEEPSEEK", "XAI", "GROQ"]).optional().default("OPENAI"),
        chatModel: z.string().optional().default("gpt-4o"),
        embeddingProvider: z.enum(["OPENAI", "GEMINI"]).optional().default("OPENAI"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const match = input.repoUrl.trim().match(GITHUB_REPO_REGEX);
      if (!match || !match[1] || !match[2]) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please provide a valid, public GitHub repository URL.",
        });
      }

      const owner = match[1];
      const repo = match[2];

      const headers: Record<string, string> = {
        "User-Agent": "reposense-app",
        Accept: "application/vnd.github.v3+json",
      };
      const token = input.githubToken || process.env.GITHUB_TOKEN;
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      let res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (res.status === 401 && headers["Authorization"]) {
        delete headers["Authorization"];
        const fallbackRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
        if (fallbackRes.ok) {
          res = fallbackRes;
        } else {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "GitHub authentication failed (401 Bad credentials). Your Personal Access Token may be expired or invalid. Please provide a new token.",
          });
        }
      }

      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Please provide a valid, accessible GitHub repository URL or a valid token if private.",
        });
      }

      const derivedProjectName = input.name?.trim() || `${owner}/${repo}`;
      const embeddingModel = input.embeddingProvider === "OPENAI" ? "text-embedding-3-small" : "gemini-embedding-001";
      const embeddingDimensions = input.embeddingProvider === "OPENAI" ? 1536 : 768;

      const project = await ctx.db.project.create({
        data: {
          name: derivedProjectName,
          repoUrl: input.repoUrl.trim(),
          gitHubToken: input.githubToken?.trim() || null,
          chatProvider: input.chatProvider,
          chatModel: input.chatModel,
          embeddingProvider: input.embeddingProvider,
          embeddingModel,
          embeddingDimensions,
          userToProjects: {
            create: {
              userId: ctx.user.userId!,
            },
          },
        },
      });

      await indexGithubRepo(
        input.repoUrl.trim(),
        input.githubToken ?? process.env.GITHUB_TOKEN,
        project.id
      );
      await pollCommits(project.id);

      return project;
    }),

  getCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const pid = input?.projectId;
      if (pid && pid !== "all") {
        pollCommits(pid).then().catch(console.error);
        return await ctx.db.commit.findMany({
          where: {
            projectId: pid,
          },
          orderBy: {
            commmitDate: "desc",
          },
        });
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
      const projectIds = userProjects.map((p) => p.id);

      return await ctx.db.commit.findMany({
        where: {
          projectId: { in: projectIds },
        },
        orderBy: {
          commmitDate: "desc",
        },
      });
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
      return await ctx.db.question.findMany({
        where: { projectId: input.projectId },
        include: { user: true },
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
      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          user: true,
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

  toggleBookmarkQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

  renameQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.string(),
        question: z.string().min(1, "Thread title cannot be empty"),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
          user: true,
          project: true,
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
        where: { projectId: projectFilter },
        include: { issues: true, project: true },
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
      return await ctx.db.meeting.findUnique({
        where: { id: input.meetingId },
        include: { issues: true, project: true },
      });
    }),

  deleteMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
      return await ctx.db.userToProject.findMany({
        where: {
          projectId: input.projectId,
        },
        include: {
          user: true,
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
