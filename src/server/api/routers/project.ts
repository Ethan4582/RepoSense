import { pollCommits } from "~/lib/github";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { checkCredits, indexGithubRepo } from "~/lib/github-loader";

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
    //backend valiadation for the credits check 
    const user = await ctx.db.user.findUnique({ where: { id: ctx.user.userId! }, select: { credits: true } })

if (!user) {
    throw new Error("User not found")
}

const currentCredits = user.credits || 0
const fileCount = await checkCredits(input.repoUrl, input.githubToken)

if (currentCredits < fileCount) {
    throw new Error("Insufficient credits")
}

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
 // decrease the file count
    await ctx.db.user.update({
      where: { id: ctx.user.userId! },
      data: { credits: { decrement: fileCount } },
    });

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
      }
      ,include:{
        issues:true,
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


  // Arhcive Project 

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

  // get how does  the credit is available  

 getMyCredits: protectedProcedure.query(async({ctx})=>{
  return await ctx.db.user.findUnique({
    where: {
      id: ctx.user.userId!
    },
    select: {
      credits: true
    }
  }); 
}),


 checkCredits: protectedProcedure.input(
   z.object({
     githubUrl: z.string(),
     githubToken: z.string().optional()
   })
 ).mutation(async ({ ctx, input }) => {
   const fileCount = await checkCredits(input.githubUrl, input.githubToken);
   const userCredits = await ctx.db.user.findUnique({
     where: {
       id: ctx.user.userId!
     },
     select: {
       credits: true
     }
   })
   return {
     fileCount,
     userCredits: userCredits?.credits || 0
   };
 })

})


