import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type { Document } from "@langchain/core/documents";


function getModels() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return {
    geminiModel: genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
    embeddingModel: genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  };
}

export const aiSummariseCommit = async (diff: string) => {
  try {
    // First try Hugging Face
    const hfSummary = await summarizeCommitWithHuggingFace(diff);
    if (hfSummary) return hfSummary;

    // Fallback to Gemini if Hugging Face fails
    console.log("Falling back to Gemini for commit summary");
    const { geminiModel } = getModels();
    const response = await geminiModel.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text:
              `You are an expert programmer, and you are trying to summarize a git diff.
Reminders about the git diff format:
For every file, there are a few metadata lines, like (for example):
\`\`\`
diff --git a/lib/index.js b/lib/index.js
index adff691..bfef603 100644
--- a/lib/index.js
+++ b/lib/index.js
\`\`\`
This means that \`/lib/index.js\` was modified in this commit. Note that this is only an example.
Also there is specifier of the lines that were modified.
A line starting with \`+\` means it was added.
A line that starting with \`-\` means that line was deleted.
A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.
It is not part of the diff.

EXAMPLE SUMMARY COMMENTS:
\`\`\`
* Raised the amount of returned recordings from '10' to '100' [packages/server/recordings_api.ts], [packages/server/constants.ts]
* Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
* Moved the \`/octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
* Added an OpenAI API for completions [packages/utils/apis/openai.ts]
* Lowered numeric tolerance for test files
\`\`\`

Most commits will have less comments than this examples list.
The last comment does not include the file names,
because there were more than two relevant files in the hypothetical commit.
Do not include parts of the example in your summary.
It is given only as an example of appropriate comments.

Please summarise the following diff file: \n\n${diff}`
          }
        ]
      }]
    });
    return response.response.text();
  } catch (error: any) {
    console.error("Both summarization methods failed:", error.message);
    return "Failed to generate summary";
  }
};







export async function summarizeCode(doc: Document) {
  // First try Hugging Face
  try {
    console.log("Attempting Hugging Face summary for", doc.metadata.source);
    const hfSummary = await summarizeCodeWithHuggingFace(doc);
    if (hfSummary) return hfSummary;
  } catch (error) {
    if (error instanceof Error) {
      console.log("Hugging Face failed:", error.message);
    } else {
      console.log("Hugging Face failed:", error);
    }
  }

  // Fallback to Gemini
  try {
    console.log("Falling back to Gemini for", doc.metadata.source);
    const { geminiModel } = getModels();
    const code = doc.pageContent.slice(0, 10000);
    const response = await geminiModel.generateContent({
      contents: [{
        role: "user",
        parts: [
          {
            text: `You are an intelligent senior who specializes in onboarding new developers to the project.
You are onboarding a new junior developer to the project and explaining to them the purpose of the file: ${doc.metadata.source}.
Here is the code you need to explain:\n\n${code}
Please give a concise summary less than 100 words.`
          }
        ]
      }]
    });
    return response.response.text();
  } catch (error: any) {
    console.error("Gemini fallback failed:", error.message);
    return `Failed to summarize: ${doc.metadata.source}`;
  }
}

// Hugging Face implementation (primary)
async function summarizeCommitWithHuggingFace(diff: string): Promise<string | null> {
  try {
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
    if (!HF_API_KEY) throw new Error("Hugging Face API key missing");

    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}` },
      data: {
        inputs: `Summarize this git diff:\n\n${diff}`,
        parameters: { max_length: 100, min_length: 30 }
      },
      timeout: 10000
    });

    return response.data?.[0]?.summary_text || null;
  } catch (error: any) {
    console.error("Hugging Face commit summary failed:", error.message);
    return null;
  }
}

async function summarizeCodeWithHuggingFace(doc: Document): Promise<string | null> {
  try {
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
    if (!HF_API_KEY) throw new Error("Hugging Face API key missing");

    const code = doc.pageContent.slice(0, 10000);
    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      method: 'POST',
      headers: { Authorization: `Bearer ${HF_API_KEY}` },
      data: {
        inputs: `Summarize this code file (${doc.metadata.source}):\n\n${code}`,
        parameters: { max_length: 100, min_length: 30 }
      },
      timeout: 10000
    });

    return response.data?.[0]?.summary_text || null;
  } catch (error: any) {
    console.error("Hugging Face code summary failed:", error.message);
    return null;
  }
}

// Gemini remains for embeddings only
export async function generateEmbeddings(summary: string) {
  const { embeddingModel } = getModels();
  const result = await embeddingModel.embedContent(summary);
  return result.embedding.values;
}