import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { toast } from "sonner"; // or use your preferred toast/alert library

import type { Document } from "@langchain/core/documents";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
});

// export const aiSummariseCommit = async (diff: string) => {
//   const response = await model.generateContent({
//     contents: [
//       {
//         role: "user",
//         parts: [
//           {
//             text: `You are an expert programmer, and your task is to summarize a git diff. Here is the git diff you need to summarize:

// ${diff}

// Reminders about the git diff format:
// For every file, there are a few metadata lines, like (for example):
// diff --git a/lib/index.js b/lib/index.js
// index aadf691..bfef603 100644
// --- a/lib/index.js
// +++ b/lib/index.js

// This means that lib/index.js was modified in this commit. Note that this is only an example. Then there is a specifier of the lines that were modified. A line starting with \`+\` means it was added. A line starting with \`-\` means that line was deleted. A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding. It is not part of the diff.

// Here are some example summary comments for reference:
// - Raised the amount of returned recordings from 10 to 100 [packages/server/recordings_api.ts], [packages/server/constants.ts]
// - Fixed a typo in the GitHub action name [.github/workflows/gpt-commit-summarizer.yml]
// - Moved the octokit initialization to a separate file [src/octokit.ts], [src/index.ts]
// - Added an OpenAI API for completions [packages/utils/apis/openai.ts]
// - Lowered numeric tolerance for test files

// Most commits will have fewer comments than this example list. The last comment does not include the file names because there were more than two relevant files in the hypothetical commit. Do not include parts of the example in your summary. It is given only as an example of appropriate comments.

// Please summarize the provided git diff.`
//           }
//         ]
//       }
//     ]
//   });
  
//   return response.response.text();
// };



export const aiSummariseCommit = async (diff: string) => {
    try {
        // https://github.com/docker/genact-stack/commit/<commithash>.diff
        const response = await model.generateContent({
            contents: [
                {
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
                }
            ]
        });

        return response.response.text();
    } catch (error: any) {
        if (error.status === 503) {
            console.error("Gemini model is overloaded. Please try again in a few seconds.");
        } else {
            console.error("Failed to summarize commit.");
        }
        return "";
    }
};



//summrise each file in the repo then convert to mebedding  

export async function summarizeCode(doc: Document) {
  console.log("getting summary for", doc.metadata.source);
  

  return response.response.text();
}


export async function generateEmbeddings(summary: string) {
  const embeddingModel = genAI.getGenerativeModel({
    model: 'embedding-001', // Use the correct embedding model name
  });

  const result = await embeddingModel.embedContent(summary); // Use embedContent instead of generateContent
  
  return result.embedding.values; // Return the embedding values array
}

// console.log(await generateEmbeddings("This is a test summary for embedding generation."));