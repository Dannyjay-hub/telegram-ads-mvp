# Agent-Assisted Development: Best Practices & Lessons Learned

> Extracted from building the Telegram Ad Marketplace MVP — 366 commits, 13 development sessions, 25+ days of continuous deployment.

---

## 1. Project Phases — The Build Order That Works

### Phase 1: Design Before Code

**What we did:** Before writing any code, we created `README.md`, `schema.sql`, and `flow.mermaid` in a single session (Conversation: `db12b380`). This established the architecture, database schema, deal flow state machine, and key decisions like the PR Manager flow and escrow model — all before a single line of TypeScript existed.

**Why it matters:**
- The AI generates dramatically better code when it understands the full system design
- Schema-first development prevents constant migrations — our `schema.sql` is still the source of truth 300+ commits later
- State machine diagrams (mermaid) catch impossible state transitions before they become bugs

**Transferable rule:**
> Always start with documentation + schema + state diagrams. Never start with code. The first conversation should produce zero `.ts` files.

---

### Phase 2: Backend First, Frontend Second

**What we did:** Built the entire backend (bot, services, routes, DB layer) before touching React (Conversation: `33b7af78`). The backend was deployed and testable via Telegram bot commands and REST endpoints before the frontend existed.

**Why it matters:**
- You can test business logic via curl/bot commands without UI
- The API contract is defined by what the backend actually returns, not what the frontend hopes for
- When the frontend starts, it's just connecting to working endpoints — not debugging two unknowns simultaneously

**Transferable rule:**
> Backend → deploy → test manually → then frontend. Never build both in parallel from scratch.

---

### Phase 3: Integration is Where Bugs Live

**What we did:** The majority of our bug-fixing sessions happened at integration points — where frontend met backend, where Telegram API met our logic, where TON blockchain met our payment flow.

**Real examples from our git history:**
- `926ac1f` — Frontend sent `base_price_amount` (snake_case) but backend expected `basePriceAmount` (camelCase). Silent failure.
- `644c1f1` — Payment verification never detected funded campaigns because the webhook response structure didn't match what the frontend was parsing.
- `55539a5` — Category/language matching failed because arrays were being collapsed to strings during serialization.

**Transferable rule:**
> After building each layer independently, budget 30-40% of your time for integration bugs. They're never where you expect.

---

## 2. How to Ask Questions That Get Good Answers

### Pattern A: "Show Me the Code, Then I'll Decide"

When you're unsure about an approach, don't ask "how should I do X?" — instead, ask the AI to show you the actual implementation options, then apply your domain knowledge.

**Example from our project:**
- ❌ "How should I handle campaign applications?"
- ✅ "Show me how open campaigns auto-accept vs closed campaigns requiring review — I want two models because some advertisers want reach, others want control."

The second approach lets you inject your product insight while the AI handles the implementation detail.

### Pattern B: "Is This Still Correct?"

We repeatedly asked the AI to verify whether existing documentation matched the actual codebase. This caught several stale comments and dead code.

**Example:**
- "Confirm if this project structure is correct" → Found `Platform_Documentation.md` listed in README but didn't actually exist
- "Check where it's set to 5 and show me" → Found the exact 4 locations of the auto-approve threshold before deciding to change it

**Transferable rule:**
> Treat the AI as an auditor regularly. Ask it to verify claims against actual code. Documentation drifts constantly.

### Pattern C: "Explain What You Removed"

After any deletion, always ask the AI to justify the removal. This caught a near-mistake in our project:

> "Are you sure they are dead code? What were they meant to do?" — The user asked this about `OpenRequests.tsx` deleted code, which turned out to be genuinely unused `URLSearchParams` construction that was superseded by `getBriefs(filters)`.

**Transferable rule:**
> Challenge every deletion. If the AI can't explain what the code was supposed to do and why it's no longer needed, don't delete it.

---

## 3. Debugging Playbook — Patterns From Real Bugs

### Bug Category 1: Foreign Key Constraint Cascades

**The bug (Conversation: `fa7e4b40`):** Deleting a channel failed because `campaign_applications` referenced `deals` which referenced `channels`. Database wouldn't let us delete in wrong order.

**How we solved it:**
1. Mapped the FK dependency graph: `campaign_applications → deals → channels`
2. Reversed the order: delete applications first, then deals, then channel
3. Added pre-deletion active deal check to prevent deleting channels with live deals

**Transferable rule:**
> When you hit FK constraint errors, draw the dependency graph. Delete leaf nodes first, work backwards to the root. Never try to delete a parent before its children.

### Bug Category 2: Race Conditions

**The bug (`3aa85e1`):** Two users could simultaneously pay for the last campaign slot, causing double-spending.

**How we solved it:**
- Added a mutex lock around campaign payment
- Used atomic database operations (`atomicAllocateSlot`) to prevent concurrent slot allocation
- The DB-level check is the source of truth, not application-level code

**Transferable rule:**
> Any operation involving money or limited inventory (slots, seats, tokens) needs atomic DB-level guards. Application-level locks are supplementary, not primary.

### Bug Category 3: Notification Spam

**The bug:** During 24h monitoring, we used `copyMessage` to verify posts were still live. Every copy sent a notification to subscribers — 9 checks over 24h meant 9 phantom notifications.

**How we solved it:**
- Switched from `copyMessage` (copies to same channel) to `forwardMessage` (forwards to a private verification channel only the bot can see)
- Zero notifications, zero visible traces, same verification result

**Transferable rule:**
> When interacting with external APIs, always consider the side effects. "Does this work?" is a different question from "Does this work without annoying users?"

### Bug Category 4: The Stale Data Loop

**The bug (`8578dd1`):** After authentication failed once, the frontend entered an infinite 401 → reload → 401 loop. Each page load attempted auth, got rejected, reloaded, attempted auth again.

**How we solved it:**
- Added a `sessionStorage` guard: if auth fails, set a flag. On next load, check the flag before attempting auth again.
- Clear the flag only on explicit login action, not on page load.

**Transferable rule:**
> Any error that triggers a retry must have a circuit breaker. Infinite retry loops are the #1 cause of "my app is frozen."

---

## 4. Architecture Decisions That Paid Off

### Decision 1: Three Entry Points, One Pipeline

The biggest architectural win was designing three independent deal creation paths (service packages, open campaigns, closed campaigns) that all converge into a single `deal` pipeline.

**Why it paid off:**
- Monitoring, posting, payout, and refund logic is written once
- Adding a 4th entry point (e.g., channel invitations) only requires wiring the entry — the pipeline doesn't change
- Testing is concentrated: if the pipeline works for service packages, it works for campaigns too

### Decision 2: Clean Architecture (Repository Pattern)

We used interfaces (`repositories/interfaces.ts`) with Supabase implementations (`repositories/supabase/`). Every database call goes through a repository, never directly from routes.

**Why it paid off:**
- When Supabase query bugs appeared, they were isolated to one file per entity
- Switching from `supabase.from('deals')` in routes to `dealRepository.findById()` made the codebase readable
- Could theoretically swap Supabase for Prisma/Drizzle without touching business logic

### Decision 3: Anti-Gaming Monitoring (Random Time Bands)

Instead of predictable check intervals (every 3h), we randomized checks within time bands. A channel owner can never predict when the next check is coming.

**Why it paid off:**
- Prevents the "delete ad → wait → repost before check" exploit
- The algorithm is simple (ceil(duration/3) bands, one random check per band + final check)
- No additional infrastructure needed — just Math.random() within bounds

### Decision 4: Network Switching via Environment Variable

One `TON_NETWORK=testnet` env var switches the entire stack: bot token, wallet address, mnemonic, API endpoints. Both mainnet and testnet bots run the same codebase.

**Why it paid off:**
- No code branches for testnet vs mainnet
- Deployment is identical — only env vars change
- Testing on testnet is cheap and safe

---

## 5. Code Quality Practices

### Practice 1: Kill Dead Code Aggressively

In our final audit, we found 5 dead service files (`deals.ts`, `notifications.ts`, `posting.ts`, `wallet.ts`, `channels.ts`) — early prototypes that had been replaced by proper PascalCase services but never deleted. They added confusion without serving any purpose.

**How to find dead code:**
1. `grep -r "from.*'/services/filename'" backend/src/` — if zero results, the file has no importers
2. Check for circular dependencies — dead files sometimes import from *other* dead files, creating an illusion of use
3. Run the TypeScript compiler after deletion — if it passes, nothing depended on the file

**Transferable rule:**
> After replacing a file, delete the old one in the same commit. "I'll clean it up later" means never.

### Practice 2: Comments Should Explain WHY, Not WHAT

We cleaned 10 stale comments in our audit. The pattern:
- ❌ `// TODO: Add refund logic` — listed as TODO but refund logic was already implemented in `backgroundJobs.ts`
- ❌ `// Removed isDraft` — records what was removed, not why or what replaced it
- ❌ `// Temporary GlassCard component if not found` — the component wasn't temporary, it was permanent

**What we replaced them with:**
- ✅ `// Refunds handled by runCampaignExpiration in backgroundJobs.ts`
- ✅ (deleted entirely — no comment needed)
- ✅ (deleted entirely — the code is self-explanatory)

### Practice 3: README as Single Source of Truth

We consolidated everything into one README: architecture, deal flow, setup, deployment, limitations, future roadmap, AI disclosure. The `docs/` folder (6 separate markdown files) was deleted because it duplicated and contradicted the README.

**Transferable rule:**
> One comprehensive document > six scattered ones. If you can't find something in 5 seconds, your documentation structure is wrong.

---

## 6. Deployment & Operations Lessons

### Lesson 1: Deploy Early, Deploy Often

We deployed to Railway after the first working bot handler — not after the "complete" MVP. This meant:
- Every feature was tested in production (with real Telegram API, real TON blockchain)
- Integration bugs surfaced immediately, not in a "deployment week" crunch
- The testnet bot was a stress-free sandbox for risky changes

### Lesson 2: Testnet is Not Optional

Creating a second bot and wallet for testnet (commit `b994bf3`) was one of the best decisions. We could:
- Test payment flows with free testnet TON
- Break things without losing real money
- Verify monitoring, timeouts, and refunds against live blockchain

### Lesson 3: Git History Tells a Story

Our 366 commits follow a clear pattern:
```
feat: → new capability
fix: → bug resolution  
docs: → documentation
chore: → cleanup/maintenance
style: → visual changes
refactor: → restructure without behavior change
```

Each commit message explains the *why*, not just the *what*:
- ✅ `fix: campaign refund not executing + TON payment infinite retry loop`
- ❌ `fixed stuff`

**Transferable rule:**
> Write commit messages for your future self. Six months from now, you should be able to `git log --oneline` and understand the project's evolution.

---

## 7. Working with AI — Meta-Lessons

### Lesson 1: AI is Best at Breadth, You're Best at Depth

The AI generated route handlers, UI components, and boilerplate faster than any human could. But the *novel* decisions — open vs closed campaigns, anti-gaming monitoring, escrow-first architecture — came from your product understanding.

**The optimal split:**
- **You:** Product decisions, state machine design, security model, UX flows
- **AI:** Implementation, syntax, boilerplate, API integration, debugging assistance

### Lesson 2: Review Every Deletion, Skip Boilerplate Review

Not all AI output needs the same level of scrutiny:
- **Low risk:** New React component, CSS styling, test scaffolding → scan quickly
- **High risk:** Anything touching money, auth, or data deletion → read line by line
- **Critical:** Deleting files, changing database schema, modifying payment logic → challenge the AI

### Lesson 3: Context Continuity Across Sessions

Our project spanned 13 conversations. Each new session started with the AI needing to re-learn the codebase. What helped:
- Comprehensive README (the AI reads it for context)
- Consistent naming conventions (PascalCase services, lowercase prototypes made dead code obvious)
- Clean git history (the AI can `git log` to understand project evolution)

### Lesson 4: Don't Let the AI Refactor What's Working

Multiple times we caught the AI wanting to "improve" working code during unrelated tasks. The rule:
> If you're fixing bug X, don't also refactor module Y. One concern per session.

---

## 8. Checklist for Your Next Project

- [ ] Start with docs: README + schema + state diagrams
- [ ] Build backend first, deploy it, test via curl/bot
- [ ] Build frontend against working API
- [ ] Deploy to staging/testnet immediately
- [ ] Use atomic DB operations for anything financial
- [ ] Randomize any schedule that could be gamed
- [ ] Write commit messages your future self will thank you for
- [ ] Delete dead code in the same commit you replace it
- [ ] Challenge every AI deletion — ask "what was this for?"
- [ ] Consolidate docs into one README
- [ ] Budget 30-40% of time for integration bugs
- [ ] Add circuit breakers to any retry logic
- [ ] Keep a clean architecture — repository pattern separates DB from logic
- [ ] Env-based switching for testnet/mainnet (no code branches)
- [ ] Audit periodically — dead code and stale comments accumulate silently

---

*This document was generated from the actual development history of the Telegram Ad Marketplace MVP (Jan 22 – Feb 16, 2026). All examples reference real commits, real bugs, and real decisions.*
