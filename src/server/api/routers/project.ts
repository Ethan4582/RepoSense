import { pollCommits } from "~/lib/github";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { z } from "zod";
import { indexGithubRepo } from "~/lib/github-loader";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure.input(
    z.object({
      name: z.string().min(1, "Project name is required"),
      repoUrl: z.string().url("Invalid URL format").min(1, "Repository URL is required"),
      githubToken: z.string().optional(),
    })
  ).mutation(async ({ ctx, input }) => {
    // Ensure user exists in the User table
    const project= await ctx.db.project.create({
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
    //load all the document whe get the summary generate the mebding theb store in the datbase 
    await indexGithubRepo(
      input.repoUrl,
      input.githubToken || process.env.GITHUB_TOKEN,
      project.id
    );
    
    await indexGithubRepo(input.repoUrl, input.githubToken || process.env.GITHUB_TOKEN, project.id);
     await pollCommits(project.id);
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
   }),

   //! show all the commit that belong this project 

   getCommits: protectedProcedure.input(
    z.object({
      projectId: z.string(),
    })
  ).query(async ({ ctx, input }) => {
    //check if the project exists

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
      fileReference: z.any(), // singular, matches schema
      answers: z.string()     // plural, matches schema
    })
  ).mutation(async ({ ctx, input }) => {
    // Ensure user exists in the User table
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
      // questionId: z.string(),
    }
  )).query(async ({ ctx, input }) => {
    return await ctx.db.question.findMany({
      where: {
        projectId: input.projectId,
      },
      include:{
        user:true
      }, orderBy: {
        createdAt: 'desc'
      }
    });
  })
})


