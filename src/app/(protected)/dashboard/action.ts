



'use server'

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { generateEmbeddings } from "~/lib/gemini";
import { db } from "~/server/db";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function askReposense(question: string, projectId: string) {
  // Validate inputs
  if (!question?.trim() || !projectId?.trim()) {
    throw new Error("Invalid question or projectId");
  }

  // Convert the question to embedding
  const queryVector = await generateEmbeddings(question);
  const vectorQuery = `[${queryVector.join(",")}]`;

  // Execute the query to get most relevant files
  const result = await db.$queryRaw`
    SELECT "fileName", "sourceCode", "summary",
    1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) AS similarity
    FROM "SourceCodeEmbedding"
    WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.5
    AND "projectId" = ${projectId}
    ORDER BY similarity DESC
    LIMIT 12;
  ` as { fileName: string; sourceCode: string; summary: string; similarity: number }[];

  // Build context from relevant files
  let context = "";
  for (const doc of result) {
    context += `File: ${doc.fileName}\nSummary: ${doc.summary}\nCode: ${doc.sourceCode}\n\n---\n\n`;
  }

  // Generate AI response
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: buildPrompt(question, context),
  });

  return {
    answer: text,
    fileReferences: result
  };
}

export async function askFollowUp(question: string, previousAnswer: string) {
 
  const { text } = await generateText({
    model: google('gemini-2.5-flash'),
    prompt: `Previous conversation context:
${previousAnswer}

New follow-up question:
${question}

Please answer the follow-up question based on the previous context. If you need additional information from the codebase, please say so.`
  });

  return {
    answer: text,
    fileReferences: [] // No file references for follow-ups
  };
}

function buildPrompt(question: string, context: string) {
  return `You are a AI code assistant who answers questions about the codebase. Your target audience is a technical intern.
AI assistant is a brand new, powerful, human-like artificial intelligence.

The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
AI is a well-behaved and well-mannered individual.
AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in
If the question is asking about code or a specific file, AI will provide the detailed answer, giving step by step instructions.

START CONTEXT BLOCK
${context}
END OF CONTEXT BLOCK

START QUESTION
${question}
END OF QUESTION

AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer."
AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
AI assistant will not invent anything that is not drawn directly from the context.
Answer in markdown syntax, with code snippets if needed.`;
}