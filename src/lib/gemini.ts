import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Document } from "@langchain/core/documents";

function getModels(apiKey?: string) {
  const key = apiKey ?? process.env.GEMINI_API_KEY ?? '';
  if (!key) {
    throw new Error('Gemini API key is required');
  }
  const genAI = new GoogleGenerativeAI(key);
  return {
    geminiModel: genAI.getGenerativeModel({ model: 'gemini-2.0-flash' }),
    embeddingModel: genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  };
}

export const aiSummariseCommit = async (diff: string, apiKey?: string) => {
  try {
    const { geminiModel } = getModels(apiKey);
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
  } catch {
    return "Failed to generate summary";
  }
};

export async function summarizeCode(doc: Document, apiKey?: string) {
  try {
    const { geminiModel } = getModels(apiKey);
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
  } catch {
    return `Failed to summarize: ${doc.metadata.source}`;
  }
}

export async function generateEmbeddings(summary: string, apiKey?: string) {
  const { embeddingModel } = getModels(apiKey);
  const result = await embeddingModel.embedContent(summary);
  return result.embedding.values;
}
