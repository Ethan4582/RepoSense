import { getPullRequestsForProject, getRepoGithubDetails, decryptProjectToken } from "~/lib/github";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { withoutProjectSecrets } from "~/lib/project";
import type { Prisma } from "@prisma/client";

export const projectRouter = createTRPCRouter({
  getProjects: protectedProcedure.query(async ({ ctx }) => {
    const projects = await ctx.db.project.findMany({
      where: {
        userToProjects: {
          some: {
            userId: ctx.user.userId,
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

    const enriched = await Promise.all(
      projects.map(async (p) => {
        const token = await decryptProjectToken(p).catch(() => null);
        const meta = await getRepoGithubDetails(p.repoOwner, p.repoName, token);
        return {
          ...withoutProjectSecrets(p),
          description: meta.description,
          stars: meta.stars,
          language: meta.language,
        };
      })
    );

    return enriched;
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
          const member = await ctx.db.userToProject.findUnique({
            where: { userId_projectId: { userId: ctx.user.userId, projectId: pid } },
            select: { id: true },
          });
          if (!member) return [];
          return await getPullRequestsForProject(pid);
        }

        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId,
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
        projectId: z.string().max(64),
        branch: z.string().max(255).optional(),
        question: z.string().trim().min(1).max(4000),
        answers: z.string().trim().min(1).max(100_000),
        fileReference: z.unknown().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.create({
        data: {
          answers: input.answers,
          branch: input.branch ?? "main",
          projectId: input.projectId,
          question: input.question,
          fileReference: input.fileReference as Prisma.InputJsonValue | undefined,
          userId: ctx.user.userId,
        },
      });
    }),

  getQuestions: protectedProcedure
    .input(z.object({ projectId: z.string(), branch: z.string().max(255).optional() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
        select: { id: true },
      });
      if (!member) throw new TRPCError({ code: "NOT_FOUND" });

      return await ctx.db.question.findMany({
        where: {
          projectId: input.projectId,
          ...(input.branch ? { branch: input.branch } : {}),
        },
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
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
      let projectFilter: string | { in: string[] };

      if (pid && pid !== "all") {
        projectFilter = pid;
      } else {
        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId,
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
        projectId: z.string().max(64),
        meetingUrl: z.string().max(2000).url(),
        name: z.string().min(1).max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.db.userToProject.findUnique({
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
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
      let projectFilter: string | { in: string[] };

      if (pid && pid !== "all") {
        projectFilter = pid;
      } else {
        const userProjects = await ctx.db.project.findMany({
          where: {
            userToProjects: {
              some: {
                userId: ctx.user.userId,
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
          project: { userToProjects: { some: { userId: ctx.user.userId } } },
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
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
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
        where: { userId_projectId: { userId: ctx.user.userId, projectId: input.projectId } },
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
