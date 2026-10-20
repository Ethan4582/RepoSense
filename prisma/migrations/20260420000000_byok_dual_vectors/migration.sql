-- Phase 1 & Phase 4 Migration: BYOK, IndexingJob, Dual Vectors, Drop Stripe/Credits

-- Create Extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- Create Enums
DO $$ BEGIN
    CREATE TYPE "Provider" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'META', 'DEEPSEEK', 'XAI', 'GROQ');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "KeyStatus" AS ENUM ('UNVERIFIED', 'VALID', 'INVALID', 'QUOTA_EXHAUSTED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "EmbeddingProvider" AS ENUM ('GEMINI', 'OPENAI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JobStep" AS ENUM ('LOADING_REPO', 'SUMMARIZING', 'EMBEDDING', 'STORING', 'COMMITS', 'DONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Drop Stripe / Credits from Phase 1
DROP TABLE IF EXISTS "StripeTransactions" CASCADE;
ALTER TABLE "User" DROP COLUMN IF EXISTS "credits";

-- Alter User for defaults
ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "defaultChatProvider" "Provider",
    ADD COLUMN IF NOT EXISTS "defaultChatModel" TEXT,
    ADD COLUMN IF NOT EXISTS "defaultEmbeddingProvider" "EmbeddingProvider";

-- Alter Project for BYOK
ALTER TABLE "Project" 
    ADD COLUMN IF NOT EXISTS "chatProvider" "Provider",
    ADD COLUMN IF NOT EXISTS "chatModel" TEXT,
    ADD COLUMN IF NOT EXISTS "embeddingProvider" "EmbeddingProvider" NOT NULL DEFAULT 'GEMINI',
    ADD COLUMN IF NOT EXISTS "embeddingModel" TEXT NOT NULL DEFAULT 'gemini-embedding-001',
    ADD COLUMN IF NOT EXISTS "embeddingDimensions" INTEGER NOT NULL DEFAULT 768;

-- Dual Vectors on SourceCodeEmbedding
ALTER TABLE "SourceCodeEmbedding"
    ADD COLUMN IF NOT EXISTS "summaryEmbeddingOpenAI" vector(1536),
    ADD COLUMN IF NOT EXISTS "summaryEmbeddingGemini" vector(768);

-- Migrate old vector column if it exists
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'SourceCodeEmbedding' 
        AND column_name = 'summaryEmbedding'
    ) THEN
        UPDATE "SourceCodeEmbedding" 
        SET "summaryEmbeddingGemini" = "summaryEmbedding" 
        WHERE "summaryEmbeddingGemini" IS NULL AND "summaryEmbedding" IS NOT NULL;
        
        ALTER TABLE "SourceCodeEmbedding" DROP COLUMN "summaryEmbedding";
    END IF;
END $$;

-- Create HNSW Indexes on vectors for fast similarity search
CREATE INDEX IF NOT EXISTS "SourceCodeEmbedding_summaryEmbeddingGemini_idx" 
    ON "SourceCodeEmbedding" USING hnsw ("summaryEmbeddingGemini" vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "SourceCodeEmbedding_summaryEmbeddingOpenAI_idx" 
    ON "SourceCodeEmbedding" USING hnsw ("summaryEmbeddingOpenAI" vector_cosine_ops);

-- Create ApiKey Table
CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "encryptedKey" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "label" TEXT,
    "status" "KeyStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_userId_provider_key" ON "ApiKey"("userId", "provider");
CREATE INDEX IF NOT EXISTS "ApiKey_userId_idx" ON "ApiKey"("userId");

-- Create IndexingJob Table
CREATE TABLE IF NOT EXISTS "IndexingJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStep" "JobStep" NOT NULL DEFAULT 'LOADING_REPO',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "processedFiles" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexingJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IndexingJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IndexingJob_projectId_createdAt_idx" ON "IndexingJob"("projectId", "createdAt");
