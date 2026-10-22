# RepoSense

[![Demo Video](hero_image.png)](https://www.youtube.com/watch?v=PQqPkdpA0V0)


## Core capabilities

- DeepWiki generation: Scans Git trees, builds light structural skeletons, and generates complete documentation across five architectural layers (entry, core logic, external integrations, data persistence, and tooling).
- Grounded codebase QA: Ask natural-language questions about logic, data flow, or configuration. Answers include verifiable inline citations.
- Interactive source inspector: Clicking any citation displays the file in a stacked, full-width code panel with line-level syntax highlighting.
- Bring Your Own Key (BYOK): Connect your own API keys for OpenAI, Google Gemini, Anthropic, Groq, DeepSeek, Meta, and xAI. Keys are stored encrypted with AES-256-GCM.
- Branch and pull request awareness: Switch between branches and pull requests to view documentation and chat against exact commit revisions.
- Native pgvector search: Vector similarity queries run on PostgreSQL using the cosine distance operator with HNSW index acceleration.


## Technology stack

- Framework: Next.js 15 (App Router, React Server Components, TypeScript)
- API router: Hono mounted at `/api` with Server-Sent Events (SSE)
- Database: PostgreSQL on Neon with the pgvector extension
- ORM: Prisma ORM with vector column mappings
- Authentication: Clerk
- Styling and UI: Tailwind CSS, Radix UI, Lucide icons, PrismJS, Mermaid.js
- LLM runtime: Vercel AI SDK (`ai`)


## Architecture overview

For a thorough description of the ingestion pipeline, capacity math, schema definitions, and failure modes, read the [System design document](system-design.md).

![Architecture Overview](public/docs/5.png)


## Getting started

### Prerequisites

- Node.js 18 or higher (Node.js 22 recommended)
- pnpm, npm, or bun
- A PostgreSQL database with the pgvector extension (such as Neon)
- A Clerk application account for authentication

### Environment configuration


Populate the required environment variables:

```env
# Database (PostgreSQL with pgvector)
DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
DIRECT_URL="postgresql://user:password@host/dbname?sslmode=require"

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Encryption Key (32-byte hex for AES-256-GCM BYOK vault)
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

# GitHub Personal Access Token (optional, raises public rate limits from 60/hr to 5,000/hr)
GITHUB_TOKEN="ghp_..."

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Installation and database setup

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Push the Prisma schema to your PostgreSQL database:
   ```bash
   npx prisma db push
   ```

3. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`.

---

## Indexing a repository

1. Sign in to your RepoSense dashboard.
2. If using frontier models, navigate to the API Keys settings page to store your provider credentials.
3. Paste any public GitHub URL (or private repository URL with a connected GitHub token).
4. Select the target branch.
5. Click Index Repository. Watch the live progress bar as RepoSense filters files, extracts skeletons, generates embeddings, and constructs the DeepWiki pages.

---

## License

This project is licensed under the MIT License.
