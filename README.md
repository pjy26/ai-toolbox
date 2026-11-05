# Amara

**Not just remembered. Truly understood. Amara grows with you.**

Amara is a relationship-centered AI companion. Memory creates continuity; continuity supports understanding; understanding makes interactions more personal; and shared experiences deepen companionship. The product combines a consistent companion persona, persistent memory, semantic recall, shared Moments, Dreams, Letters, and multidimensional memory analysis.

**Live product:** [www.amarapjy.xyz](https://www.amarapjy.xyz)

## Product Highlights

- **Companion chat** — A consistent, carefully shaped conversational persona powered by an OpenAI-compatible LLM API.
- **Persistent memory** — Important facts, preferences, emotional context, and relationship history can be retained across sessions.
- **Semantic memory recall** — Embedding-based retrieval helps Amara find relevant earlier memories instead of relying only on recent messages.
- **Dreams** — Nightly Dream documents turn shared conversations into reflective, readable memories and future conversation context.
- **Relationship progression** — Emotional state and relationship stages evolve with meaningful interaction rather than message count alone.
- **User control** — Dedicated surfaces for memories, Dreams, account settings, subscription management, and cancellation.
- **Bilingual experience** — English and Chinese interfaces across the main product and policy pages.
- **Membership tiers** — Free includes Today, About You, and one important person. Plus unlocks unlimited people, Moments, Dreams, Letters, and multidimensional analysis at $6.99/month or $59.99/year. A $0.99 one-week Plus experience does not renew. Premium is presented as in development and checkout is disabled.
- **Payments** — Plus checkout, signed Waffo webhooks, and automatic membership updates. New product IDs are documented in `.env.example`; apply `migrations/relationship_membership_plans.sql` before launch.
- **Trust and safety** — Authentication, content-safety checks, privacy policy, terms of service, and clear cancellation information.

## Technology

| Layer | Technology |
| --- | --- |
| Web application | Next.js 14 App Router, React 18, TypeScript |
| UI | Tailwind CSS, Lucide icons |
| Authentication and database | Supabase Auth and Postgres |
| Memory retrieval | OpenAI-compatible embeddings with vector search |
| Conversation model | DeepSeek through an OpenAI-compatible API |
| Payments | Waffo Pancake subscriptions and customer portal |
| Hosting | Vercel |

## Project Structure

```text
app/                 Application pages and API routes
components/          Product UI, authentication, and locale components
lib/                 Companion, memory, payment, and safety logic
migrations/          Supabase database migrations
scripts/             Operational and integration utilities
docs/                Product and architecture notes
```

## Local Development

Requirements: Node.js 18+ and a Supabase project.

```bash
npm install
cp .env.example .env.local
# Fill in your own local credentials, then run:
npm run dev
```

Apply `init.sql` and the required files under `migrations/` to your own Supabase database. Never reuse production credentials for local development.

## Validation

```bash
npm run build
```

The production build includes TypeScript validation and Next.js route generation.

### Persona stability evaluation

The synthetic runner covers both locales, both independent companion genders, all four personas, and eight scenarios: everyday conversation, tiredness, happiness, respecting refusal, AI identity, same-day time grounding, no-memory honesty, and previous-session context. It repeats cases and checks language, length, question count, identity, time, and supplied facts.

```bash
# Preview the matrix without API calls
npx tsx scripts/persona-stability.ts --repeats=2

# Explicit live run; writes raw synthetic replies and results to eval-results/
npx tsx scripts/persona-stability.ts --live --repeats=2

# Optional model-assisted 1–5 rubric scores (additional model calls)
npx tsx scripts/persona-stability.ts --live --repeats=2 --judge

# Narrow a run while iterating
npx tsx scripts/persona-stability.ts --live --locale=en --gender=female --persona=gentle --scenario=time_interval
```

Hard checks and model-assisted scores are diagnostic signals, not proof of a stable persona. Always review raw replies across repeated runs, especially failures; the report includes a human-review sampling recommendation.

## Environment and Secrets

All provider credentials are read from environment variables. `.env.example` documents the required configuration without containing private keys. Waffo webhook payloads are verified from the raw request body before any subscription state is changed.

## Development Status

Amara is under active product development. Core chat, memory, Dreams, bilingual UI, and subscription checkout are implemented. Current work focuses on memory quality, long-term relationship continuity, and a more natural Dream-to-next-day conversation loop.

---

## 中文简介

Amara 是一个强调连续关系与个人记忆的 AI 伴侣产品。项目包含稳定人格对话、跨会话记忆、语义检索、每晚 Dream 文档、关系阶段、双语界面和自动订阅会员系统。当前持续优化的方向是让记忆更准确，并让每一次对话都能自然承接此前共同经历。
