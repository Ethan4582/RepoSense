import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import type { Document } from "@langchain/core/documents";

// Keep Gemini for embeddings
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
});

// Keep existing commit summarization function
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

// NEW: Use Hugging Face for code summarization instead of Gemini
export async function summarizeCode(doc: Document) {
  console.log("Getting summary from Hugging Face for", doc.metadata.source);
  
  try {
    const code = doc.pageContent.slice(0, 10000); // Limit to 10000 characters
    const HF_API_KEY = process.env.HUGGING_FACE_API_KEY;
    
    if (!HF_API_KEY) {
      throw new Error("Missing HUGGING_FACE_API_KEY in environment variables");
    }
    
    // Use a model that's good for code summarization
    const response = await axios({
      url: 'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        inputs: `Summarize this code file (${doc.metadata.source}):\n\n${code}`,
        parameters: {
          max_length: 100,
          min_length: 30,
          do_sample: false,
        },
      },
      timeout: 30000, // 30 second timeout
    });
    
    // Extract summary from response
    if (response.data && response.data[0] && response.data[0].summary_text) {
      return response.data[0].summary_text;
    } else {
      console.warn("Unexpected response format from Hugging Face:", response.data);
      return `Code file from ${doc.metadata.source}`;
    }
  } catch (error: any) {
    console.error('Error generating summary with Hugging Face:', error.message);
    
    // More comprehensive error handling
    if (error.response?.status === 400) {
      console.log(`Bad request for file ${doc.metadata.source}, using fallback summary`);
      return `Source code from ${doc.metadata.source}`;
    } else if (error.response?.status === 404) {
      console.log("Model not found. Using fallback summary method");
      return `Source code from ${doc.metadata.source}`;
    } else if (error.response?.status === 429) {
      // Re-throw rate limit errors for the caller to handle with backoff
      throw new Error("Hugging Face rate limit exceeded");
    } else if (error.response?.status === 503) {
      throw new Error("Hugging Face model is loading"); // Let outer handler deal with retries
    }
    
    // Generic fallback
    return `Source code from ${doc.metadata.source}`;
  }
}

// KEEP: Gemini for embeddings (unchanged)
export async function generateEmbeddings(summary: string) {
  const embeddingModel = genAI.getGenerativeModel({
    model: 'embedding-001', // Use the correct embedding model name
  });

  const result = await embeddingModel.embedContent(summary); // Use embedContent instead of generateContent
  
  return result.embedding.values; // Return the embedding values array
}