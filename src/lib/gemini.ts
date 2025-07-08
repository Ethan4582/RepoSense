import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
});

export const summrisCommit = async (diff: string) => {
  const response = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert programmer, and your task is to summarize a git diff. Here is the git diff you need to summarize:

${diff}

Reminders about the git diff format:
For every file, there are a few metadata lines, like (for example):
diff --git a/lib/index.js b/lib/index.js
index aadf691..bfef603 100644
--- a/lib/index.js
+++ b/lib/index.js

This means that lib/index.js was modified in this commit. Note that this is only an example. Then there is a specifier of the lines that were modified. A line starting with \`+\` means it was added. A line starting with \`-\` means that line was deleted. A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding. It is not part of the diff.

Here are some example summary comments for reference:
- Raised the amount of returned recordings from 10 to 100 [packages/server/recordings_api.ts], [packages/server/constants.ts]
- Fixed a typo in the GitHub action name [.github/workflows/gpt-commit-summarizer.yml]
- Moved the octokit initialization to a separate file [src/octokit.ts], [src/index.ts]
- Added an OpenAI API for completions [packages/utils/apis/openai.ts]
- Lowered numeric tolerance for test files

Most commits will have fewer comments than this example list. The last comment does not include the file names because there were more than two relevant files in the hypothetical commit. Do not include parts of the example in your summary. It is given only as an example of appropriate comments.

Please summarize the provided git diff.`
          }
        ]
      }
    ]
  });
  
  return response.response.text();
};



console.log(await summrisCommit(
  `diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 5f4b263..c13c41b 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -13,8 +13,8 @@ datasource db {
 model User {
     id           String  @id @default(cuid())
     emailAddress String  @unique
-    firstName    String
-    lastName     String
+    firstName    String?
+    lastName     String?
     imageUrl     String?
 
     stripeSubscriptionId String?             @unique
   }`
));