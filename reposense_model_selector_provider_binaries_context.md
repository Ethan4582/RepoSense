# RepoSense — Provider Adapters, Model Selector & Binary Catalog (`binary.md`)

This document is the authoritative specification for **Anti-Gravity / Claude CLI** when implementing **Phase 2 (`src/lib/pricing.ts`)**, **Phase 5 (`src/lib/providers/`)**, **Phase 9 (Settings — API & Models)**, and **Phase 10 (T3-Style Model Selector)**.

All models listed here are **general-purpose text, coding, reasoning, and multimodal-input-to-text models**. Pure image-generation, video-generation, audio-transcription, and segmentation models (such as `sam-3.1`, `muse-image-1.0`, `muse-voice-transcribe`, `dall-e-3`, `sora`) are strictly excluded.

---

## 1. Provider Overview & Public Logo Assets

All provider and model logos live directly inside the `public/` directory (e.g., `public/models/` or root `public/`). Resolve logos directly from `public/` without external CDN links.

| Provider Enum | Config Key | Display Name | NPM Adapter | Base URL | Public Logo Asset | Supports Embeddings? |
|---|---|---|---|---|---|---|
| `OPENAI` | `"openai"` | **OpenAI** | `@ai-sdk/openai` | Default (`https://api.openai.com/v1`) | `/models/openai.svg` | **Yes** (`1536` dim) |
| `ANTHROPIC` | `"anthropic"` | **Anthropic** | `@ai-sdk/anthropic` | Default (`https://api.anthropic.com/v1`) | `/models/anthropic.svg` | No |
| `GEMINI` | `"gemini"` | **Gemini** | `@ai-sdk/google` | Default (`https://generativelanguage.googleapis.com/v1beta`) | `/models/gemini.svg` | **Yes** (`768` dim) |
| `META` | `"meta"` | **Meta Model API** | `@ai-sdk/openai` (Responses API) | `https://api.meta.ai/v1` | `/models/meta.svg` | No |
| `DEEPSEEK` | `"deepseek"` | **DeepSeek** | `@ai-sdk/deepseek` | Default (`https://api.deepseek.com`) | `/models/deepseek.svg` | No |
| `XAI` | `"xai"` | **xAI (Grok)** | `@ai-sdk/xai` | Default (`https://api.x.ai/v1`) | `/models/xai.svg` | No |
| `GROQ` | `"groq"` | **Groq** | `@ai-sdk/openai` | `https://api.groq.com/openai/v1` | `/models/groq.svg` | No |

### Pricing Tier Badge Mapping (Phase 10 Model Selector)
Derived from blended cost or output token pricing per 1M tokens:
- `$` — Budget / High-speed (`<= $1.50 / 1M output`)
- `$$` — Balanced / Daily Driver (`$1.51 – $12.00 / 1M output`)
- `$$$` — Frontier Pro (`$12.01 – $30.00 / 1M output`)
- `$$$+` — Ultra-Frontier / Max Reasoning (`> $30.00 / 1M output`)

---

## 2. Meta Model API — Special Adapter Specification (`meta`)

### Configuration Requirements
- **Provider Key:** `"meta"` (Prisma Enum: `META`)
- **Display Name:** `"Meta Model API"`
- **NPM Adapter:** `@ai-sdk/openai` targeting the **Responses API** (`client.responses(modelId)`)
- **Base URL:** `https://api.meta.ai/v1`
- **API Key Source:**
  - In production/app: decrypted user key from the `ApiKey` table (`provider = META`).
  - In local CLI / test runner config: read from `process.env.MODEL_API_KEY`.
- **Default / Primary Model (`muse-spark-1.3`) Settings:**
  - `reasoning`: `true`
  - `reasoningEffort`: `"high"`
  - `reasoningSummary`: `"auto"`
  - `include`: `["reasoning.encrypted_content"]`
  - **Limits:** Context `1,048,576` tokens (`1M`), Max Output `131,072` tokens (`128K`)
  - **Modalities:** Input `["text", "image", "pdf", "video"]`, Output `["text"]`

### How to Use Meta Models via `@ai-sdk/openai`
When calling any model on the Meta Model API (`muse-spark-1.3`, `muse-wonder`, etc.):
1. Create the OpenAI provider instance with `createOpenAI({ baseURL: "https://api.meta.ai/v1", apiKey })`.
2. Select the model via the **Responses API** (`metaProvider.responses(modelId)`).
3. Pass the reasoning configuration in `providerOptions.openai`:
   - `reasoningEffort: "high"`
   - `reasoningSummary: "auto"`
   - `include: ["reasoning.encrypted_content"]`

### Meta Model API Binaries

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `muse-wonder` | **Muse Wonder** | 1,048,576 / 131,072 | $4.00 / $20.00 | $0.20 | `$$$` | Frontier coding, long-running agents, and advanced computer use. Plans long tasks, delegates to sub-agents, and recovers from errors. |
| `muse-spark-1.3` *(Default)* | **Muse Spark 1.3** | 1,048,576 / 131,072 | $1.25 / $4.25 | $0.15 | `$$` | Built for long-horizon coding and multi-step agentic work with native tool calling, MCP support, and high-effort reasoning. |
| `muse-spark-1.3-contributor` | **Muse Spark 1.3 Contributor** | 1,048,576 / 131,072 | $0.10 / $0.20 | $0.002 | `$` | Same capabilities as Muse Spark 1.3 at up to 95% lower cost (rate-limited by tokens; inputs/outputs used to improve Meta AI). |
| `muse-spark-1.2` | **Muse Spark 1.2** | 1,048,576 / 131,072 | $1.25 / $4.25 | $0.15 | `$$` | Coding-optimized model purpose-built for agentic workflows, code generation, debugging, and 1M context codebase understanding. |
| `muse-spark-1.2-contributor` | **Muse Spark 1.2 Contributor** | 1,048,576 / 131,072 | $0.10 / $0.20 | $0.002 | `$` | Builder-priced tier of Muse Spark 1.2 with identical coding and reasoning capabilities. |
| `muse-spark-1.1` | **Muse Spark 1.1** | 1,048,576 / 131,072 | $1.25 / $4.25 | $0.15 | `$$` | Multimodal perception, coding, and multi-step agentic workflows across complex multi-file projects. |

*(Note: `muse-wonder-full` is Muse Code subscription-only; `muse-spark-open` and `muse-glimmer` are open-weight downloads; `sam-3.1`, `muse-voice-transcribe`, and `muse-image-1.0` are non-text specialist models and are intentionally excluded from the chat selector).*

---

## 3. OpenAI — Complete Model Binary Catalog (`openai`)

Includes the entire lineup from lightweight nano/mini models through the GPT-5.x series up to the flagship **GPT-6 Astra, GPT-6.1 Sol, GPT-6 Sol, and GPT-6 Luna** frontier models.

### Chat & Reasoning Binaries (Frontier → Simple)

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `gpt-6-astra` | **GPT-6 Astra** | 1,050,000 / 128,000 | $10.00 / $50.00 | $1.00 | `$$$+` | OpenAI's flagship frontier reasoning and agentic coding model (`low`, `medium`, `high`, `xhigh`, `max` effort). Built for the hardest end-to-end engineering and architecture work. |
| `gpt-6.1-sol` | **GPT-6.1 Sol** | 1,050,000 / 128,000 | $2.00 / $10.00 | $0.10 | `$$` | Upgraded GPT-6 Sol delivering near-Astra intelligence on DeepSWE agentic coding and codebase understanding at one-fifth the price. |
| `gpt-6-sol` | **GPT-6 Sol** | 1,050,000 / 128,000 | $2.00 / $10.00 | $0.10 | `$$` | High-intelligence GPT-6 balanced tier for daily complex coding, debugging, and multi-step reasoning. |
| `gpt-6-luna` | **GPT-6 Luna** | 1,050,000 / 128,000 | $0.10 / $0.50 | $0.01 | `$` | Ultra-fast, low-cost GPT-6 tier ideal for high-volume repository indexing, file summaries, and rapid Q&A. |
| `gpt-5.6-sol` | **GPT-5.6 Sol** | 1,050,000 / 128,000 | $4.00 / $20.00 | $0.40 | `$$$` | Flagship of the GPT-5.6 three-tier family (`gpt-5.6` alias routes here). Built for cross-file code changes and long tool chains. |
| `gpt-5.6-terra` | **GPT-5.6 Terra** | 1,050,000 / 128,000 | $2.00 / $12.00 | $0.20 | `$$` | Middle tier of the GPT-5.6 family balancing full reasoning and tool use with lower token cost. |
| `gpt-5.6-luna` | **GPT-5.6 Luna** | 1,050,000 / 128,000 | $0.20 / $1.20 | $0.02 | `$` | High-throughput, cost-optimized member of the GPT-5.6 family for extraction and summarization. |
| `gpt-5.5-pro` | **GPT-5.5 Pro** | 1,050,000 / 128,000 | $10.00 / $40.00 | $1.00 | `$$$+` | Extended-compute GPT-5.5 tier for deep research and multi-file verification. |
| `gpt-5.5` | **GPT-5.5** | 1,050,000 / 128,000 | $5.00 / $30.00 | $0.50 | `$$$` | General-purpose frontier model prior to the GPT-5.6 split. |
| `gpt-5.4-pro` | **GPT-5.4 Pro** | 1,050,000 / 128,000 | $10.00 / $40.00 | $1.00 | `$$$+` | High-compute 1.05M context reasoning model. |
| `gpt-5.4` | **GPT-5.4** | 1,050,000 / 128,000 | $2.50 / $10.00 | $0.25 | `$$` | First 1.05M-context unified model in the GPT-5 series. |
| `gpt-5.4-mini` | **GPT-5.4 Mini** | 1,050,000 / 128,000 | $0.40 / $1.60 | $0.04 | `$` | Fast, cost-efficient 1M context coding and chat model. |
| `gpt-5.4-nano` | **GPT-5.4 Nano** | 1,050,000 / 128,000 | $0.10 / $0.40 | $0.01 | `$` | Lowest-latency nano model for bulk file summarization. |
| `gpt-5.3-codex` | **GPT-5.3 Codex** | 400,000 / 128,000 | $2.00 / $8.00 | $0.20 | `$$` | Code-specialized GPT-5 model tuned for repository diffs, refactoring, and terminal agents. |
| `gpt-5` | **GPT-5** | 400,000 / 128,000 | $2.00 / $8.00 | $0.20 | `$$` | Unified reasoning and chat architecture. |
| `gpt-5-mini` | **GPT-5 Mini** | 400,000 / 128,000 | $0.30 / $1.20 | $0.03 | `$` | Compact unified reasoning model. |
| `gpt-5-nano` | **GPT-5 Nano** | 400,000 / 128,000 | $0.10 / $0.40 | $0.01 | `$` | Lightweight, high-speed classification and summary model. |
| `o3-pro` | **o3 Pro** | 200,000 / 100,000 | $20.00 / $80.00 | — | `$$$+` | Maximum-compute o-series reasoning model for hard algorithmic and mathematical proofs. |
| `o3` | **o3** | 200,000 / 100,000 | $2.00 / $8.00 | $0.50 | `$$` | Dedicated chain-of-thought reasoning model for complex code analysis. |
| `o4-mini` | **o4 Mini** | 200,000 / 100,000 | $1.10 / $4.40 | $0.275 | `$$` | Fast, cost-effective reasoning model optimized for STEM and coding. |
| `o3-mini` | **o3 Mini** | 200,000 / 100,000 | $1.10 / $4.40 | $0.55 | `$$` | Compact reasoning model with adjustable reasoning effort. |
| `gpt-4.1` | **GPT-4.1** | 1,047,576 / 32,768 | $2.00 / $8.00 | $0.50 | `$$` | High-recall 1M context non-reasoning model for long-context instruction following. |
| `gpt-4.1-mini` | **GPT-4.1 Mini** | 1,047,576 / 32,768 | $0.40 / $1.60 | $0.10 | `$` | Fast 1M context model for codebase Q&A. |
| `gpt-4.1-nano` | **GPT-4.1 Nano** | 1,047,576 / 32,768 | $0.10 / $0.40 | $0.025 | `$` | Ultra-cheap 1M context model for file indexing. |
| `gpt-4o` | **GPT-4o** | 128,000 / 16,384 | $2.50 / $10.00 | $1.25 | `$$` | Legacy omni flagship model. |
| `gpt-4o-mini` | **GPT-4o Mini** | 128,000 / 16,384 | $0.15 / $0.60 | $0.075 | `$` | Legacy budget model. |

### OpenAI Embedding Binaries (`OPENAI` Embedding Provider)
- `text-embedding-3-small` *(Default —Locked at `1536` dimensions in `summaryEmbeddingOpenAI`, $0.02 / 1M tokens)*
- `text-embedding-3-large` *(Supported only when passing `dimensions: 1536` to match column schema, $0.13 / 1M tokens)*

---

## 4. Anthropic — Complete Model Binary Catalog (`anthropic`)

Matches the full Anthropic selector hierarchy from **Fable (Mythos-class)** and **Opus 5.5 / 5 / 4.x** through **Sonnet 5 / 4.6** and **Haiku 5.5 / 4.5**.

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `claude-fable-5-1` | **Fable 5.1** | 1,000,000 / 128,000 | $10.00 / $50.00 | $1.00 | `$$$+` | Anthropic's latest Mythos-class frontier model (above Opus class). Unmatched on multi-day agentic engineering, deep security auditing, and complex architecture. |
| `claude-fable-5` | **Fable 5** | 1,000,000 / 128,000 | $10.00 / $50.00 | $1.00 | `$$$+` | First generally available Mythos-class model (`claude-fable-5`). State-of-the-art on FrontierBench and long-horizon reasoning. |
| `claude-opus-5-5` | **Opus 5.5** | 1,000,000 / 128,000 | $6.00 / $30.00 | $0.60 | `$$$` | Top-scoring Opus-class model with adaptive thinking for deep codebase refactoring and autonomous debugging. |
| `claude-opus-5` | **Opus 5** | 1,000,000 / 128,000 | $5.00 / $25.00 | $0.50 | `$$$` | Proactive frontier Opus model delivering near-Fable 5 intelligence at half the price. |
| `claude-opus-4-8` | **Opus 4.8** | 1,000,000 / 128,000 | $5.00 / $25.00 | $0.50 | `$$$` | High-reliability Opus 4 release with hardened safety and deep code synthesis. |
| `claude-opus-4-7` | **Opus 4.7** | 1,000,000 / 128,000 | $5.00 / $25.00 | $0.50 | `$$$` | Agentic coding powerhouse featuring adaptive thinking and native MCP-Atlas tool recovery. |
| `claude-opus-4-6` | **Opus 4.6** | 500,000 / 64,000 | $5.00 / $25.00 | $0.50 | `$$$` | Extended-thinking Opus model with deterministic `budget_tokens` control. |
| `claude-3-opus-latest` | **Opus 3** | 200,000 / 4,096 | $15.00 / $75.00 | $1.50 | `$$$+` | Classic Claude 3 Opus model (`claude-3-opus-20240229`). |
| `claude-sonnet-5` | **Sonnet 5** | 1,000,000 / 64,000 | $3.00 / $15.00 | $0.30 | `$$` | Next-generation balanced coding and reasoning workhorse for fast, high-accuracy daily development. |
| `claude-sonnet-4-6` | **Sonnet 4.6** | 500,000 / 64,000 | $3.00 / $15.00 | $0.30 | `$$` | High-speed agentic coding Sonnet model with hybrid extended thinking. |
| `claude-sonnet-4-5` | **Sonnet 4.5** | 500,000 / 64,000 | $3.00 / $15.00 | $0.30 | `$$` | Reliable software engineering and code review model. |
| `claude-3-7-sonnet-latest` | **Sonnet 3.7** | 200,000 / 64,000 | $3.00 / $15.00 | $0.30 | `$$` | First hybrid reasoning Claude Sonnet model. |
| `claude-haiku-5-5` | **Haiku 5.5** | 500,000 / 64,000 | $0.80 / $4.00 | $0.08 | `$` | Latest frontier-speed Haiku model with near-Sonnet coding intelligence at budget cost. |
| `claude-haiku-4-5` | **Haiku 4.5** | 200,000 / 32,000 | $0.80 / $4.00 | $0.08 | `$` | Fast, economical model for repository file summarization and instant chat. |
| `claude-3-5-haiku-latest` | **Haiku 3.5** | 200,000 / 8,192 | $0.80 / $4.00 | $0.08 | `$` | Legacy fast Haiku model. |

---

## 5. Gemini — Complete Model Binary Catalog (`gemini`)

*Note: Always use the enum and identifier `GEMINI` / `gemini` (never `GOOGLE`) across the database, routes, and UI.*

### Chat & Reasoning Binaries (Frontier → Simple)

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `gemini-4-argon` | **Gemini 4 Argon** | 1,048,576 / 1,048,576 | $2.00 / $10.00 *(intro)* | $0.10 | `$$` | Gemini's newest frontier model with a unified 1M input/output window and tunable thinking levels (`low`, `medium`, `high`). |
| `gemini-3.1-pro-preview` | **Gemini 3.1 Pro** | 2,097,152 / 65,536 | $2.00 / $12.00 | $0.20 | `$$` | 2M-token context flagship model for massive monorepo comprehension and multi-file synthesis. |
| `gemini-3-deep-think` | **Gemini 3 Deep Think** | 1,048,576 / 65,536 | $4.00 / $16.00 | $0.40 | `$$$` | Deep-reasoning variant of Gemini 3 for hard architectural and algorithmic challenges. |
| `gemini-3.8-flash` | **Gemini 3.8 Flash** | 1,048,576 / 65,536 | $0.30 / $2.50 | $0.03 | `$` | High-speed workhorse with strong agentic coding and tool-use performance. |
| `gemini-3.5-flash` | **Gemini 3.5 Flash** | 1,048,576 / 65,536 | $0.25 / $1.50 | $0.025 | `$` | Balanced, low-latency 1M context model for RAG chat and commit summaries. |
| `gemini-3.5-flash-lite` | **Gemini 3.5 Flash-Lite** | 1,048,576 / 65,536 | $0.075 / $0.30 | $0.01 | `$` | Ultra-cheap, high-throughput model ideal for bulk repository file summarization. |
| `gemini-3-flash-preview` | **Gemini 3 Flash** | 1,048,576 / 65,536 | $0.20 / $1.00 | $0.02 | `$` | Fast multimodal and coding model in the Gemini 3 series. |
| `gemini-2.5-pro` | **Gemini 2.5 Pro** | 2,097,152 / 65,536 | $1.25 / $10.00 | $0.125 | `$$` | Proven 2M-context reasoning and coding model. |
| `gemini-2.5-flash` | **Gemini 2.5 Flash** | 1,048,576 / 65,536 | $0.15 / $0.60 | $0.0375 | `$` | High-efficiency 1M context model for indexing and Q&A. |
| `gemini-2.5-flash-lite` | **Gemini 2.5 Flash-Lite** | 1,048,576 / 65,536 | $0.075 / $0.30 | $0.018 | `$` | Lowest-cost Gemini 2.5 model for large-scale file summarization. |

### Gemini Embedding Binary (`GEMINI` Embedding Provider)
- `gemini-embedding-001` *(Default — Locked at `768` dimensions in `summaryEmbeddingGemini`)*

---

## 6. DeepSeek — Complete Model Binary Catalog (`deepseek`)

Includes both the newest **V4.1-Flash (`deepseek-flash`)** and **V4-Pro (`deepseek-v4-pro`)** 1M-context models as well as **V3 (`deepseek-chat`)** and **R1 (`deepseek-reasoner`)**.

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `deepseek-flash` | **DeepSeek V4.1 Flash** | 1,000,000 / 384,000 | $0.15 / $0.60 *(off-peak)* | $0.03 | `$` | DeepSeek's newest 1M-context model with vision, thinking by default, and massive 384K output capacity. |
| `deepseek-v4-pro` | **DeepSeek V4 Pro** | 1,000,000 / 384,000 | $0.50 / $1.98 *(off-peak)* | $0.10 | `$$` | Flagship 1M-context DeepSeek V4 Pro checkpoint with tunable thinking effort (`low`, `high`, `max`). |
| `deepseek-reasoner` | **DeepSeek R1** | 128,000 / 64,000 | $0.55 / $2.19 | $0.14 | `$$` | Dedicated chain-of-thought reasoning model for complex code logic and verification. |
| `deepseek-chat` | **DeepSeek V3** | 128,000 / 16,384 | $0.27 / $1.10 | $0.07 | `$` | Fast, low-cost general coding and repository summarization model. |

---

## 7. xAI (Grok) — Complete Model Binary Catalog (`xai`)

Includes the full Grok lineup up to the flagship **Grok 4.7** 500K-context coding and reasoning model.

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Cached Input | Tier | Description |
|---|---|---|---|---|---|---|
| `grok-4.7` | **Grok 4.7** | 500,000 / 128,000 | $2.00 / $6.00 | $0.20 | `$$` | xAI's flagship 500K-context coding and reasoning model with four reasoning effort levels. |
| `grok-4.6` | **Grok 4.6** | 500,000 / 128,000 | $2.00 / $6.00 | $0.20 | `$$` | High-capability agentic coding and reasoning model. |
| `grok-4.5` | **Grok 4.5** | 256,000 / 64,000 | $2.00 / $6.00 | $0.20 | `$$` | Balanced frontier model for software engineering and deep Q&A. |
| `grok-4.20-reasoning` | **Grok 4.20 Reasoning** | 256,000 / 64,000 | $2.00 / $8.00 | $0.20 | `$$` | Specialized extended-reasoning Grok 4 checkpoint. |
| `grok-4.1` | **Grok 4.1** | 256,000 / 64,000 | $2.00 / $6.00 | $0.20 | `$$` | High-precision coding and tool-use model. |
| `grok-4.1-fast` | **Grok 4.1 Fast** | 256,000 / 64,000 | $0.50 / $2.00 | $0.05 | `$` | Low-latency variant of Grok 4.1 for fast chat and file indexing. |
| `grok-4` | **Grok 4** | 256,000 / 64,000 | $3.00 / $15.00 | $0.30 | `$$` | Core Grok 4 reasoning model. |
| `grok-4-fast` | **Grok 4 Fast** | 256,000 / 64,000 | $0.60 / $2.40 | $0.06 | `$` | High-speed Grok 4 tier. |
| `grok-code-fast-1` | **Grok Code Fast 1** | 256,000 / 64,000 | $0.40 / $1.60 | $0.04 | `$` | Purpose-built fast coding model for repository diffs and code Q&A. |
| `grok-3` | **Grok 3** | 131,072 / 32,768 | $3.00 / $15.00 | $0.75 | `$$` | Legacy Grok 3 flagship model. |
| `grok-3-mini` | **Grok 3 Mini** | 131,072 / 32,768 | $0.30 / $0.50 | $0.075 | `$` | Lightweight, fast reasoning model for budget indexing. |

---

## 8. Groq — Strictly Limited 3-Model Catalog (`groq`)

Per product specification, **Groq is strictly capped at 3 curated models** so users on free or unknown subscription tiers never hit unsupported binary errors:

| Binary ID (`model`) | Display Name | Context / Output | Input / Output (per 1M) | Tier | Description |
|---|---|---|---|---|---|
| `llama-3.3-70b-versatile` | **Llama 3.3 70B Versatile** | 128,000 / 32,768 | $0.59 / $0.79 | `$` | Primary Groq workhorse for fast repository summarization and coding Q&A. |
| `llama-3.1-8b-instant` | **Llama 3.1 8B Instant** | 128,000 / 131,072 | $0.05 / $0.08 | `$` | Ultra-fast, near-instant token generation for rapid bulk file summaries. |
| `openai/gpt-oss-120b` | **GPT-OSS 120B (Groq LPU)** | 128,000 / 32,768 | $0.15 / $0.75 | `$` | Frontier open-weight reasoning model running at LPU speed on Groq. |

---

## 9. Implementation Rules for Anti-Gravity

1. **Seed Static Catalog + Dynamic Merge:**
   - Export the static catalog above from `src/lib/providers/catalog.ts` (and pricing from `src/lib/pricing.ts`).
   - When `listModels(apiKey)` runs for a provider, return the curated catalog above first so every frontier and lightweight binary is guaranteed to appear with its human-friendly display name, description, context window, and `$`–`$$$+` badge.
2. **Default Recommended Models per Provider:**
   - **OpenAI:** `gpt-6.1-sol` (Chat) / `gpt-6-luna` (Fast Indexing) / `text-embedding-3-small` (Embeddings)
   - **Anthropic:** `claude-sonnet-5` (Chat) / `claude-fable-5-1` (Frontier) / `claude-haiku-5-5` (Fast Indexing)
   - **Gemini:** `gemini-4-argon` (Chat) / `gemini-3.5-flash-lite` (Fast Indexing) / `gemini-embedding-001` (Embeddings)
   - **Meta:** `muse-spark-1.3` (Chat & Indexing) / `muse-wonder` (Frontier)
   - **DeepSeek:** `deepseek-flash` (Chat & Indexing) / `deepseek-v4-pro` (Frontier)
   - **xAI:** `grok-4.7` (Chat) / `grok-4.1-fast` (Fast Indexing)
   - **Groq:** `llama-3.3-70b-versatile` (Chat) / `llama-3.1-8b-instant` (Fast Indexing)