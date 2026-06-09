# Phase 2 — TrashLab Interview Prep & Take-home Extension Plan

> Interview: 1st round with **John Tan — Co-Founder & CTO @ TrashLab** (via SavvyCal).
> Format: review this take-home live and **add features while driving multiple Claude Code agents concurrently**.
> This doc has three parts:
> 1. Company research — what to know + what to ask
> 2. Feature ideas to add to this app (Payables / AP MVP)
> 3. **Concurrent-agents playbook** — full tutorial + several ways to run agents in parallel

---

## Part 1 — Company research: TrashLab

### What TrashLab is
TrashLab is a **cloud-based "operating system" for waste haulers** — dumpster rental, roll-off, residential, and commercial trash collection companies. It bundles into one app what haulers used to run on 5+ disconnected tools: **dispatch & route optimization, billing/invoicing, driver tracking & driver app, order intake, calls/texts, and payments.**

A flagship piece is an **AI-powered communication center** that automatically turns inbound calls, texts, and emails into orders and customer follow-ups — killing the "missed call = missed job" problem that's endemic in the industry.

- **Founded:** 2022, San Francisco, CA
- **Founders:** John Tan (CTO, ex-Stripe fraud, ex-Google spam/abuse, C++/distributed systems) and Neil (Stanford-trained), built alongside real haulers.
- **Funding:** ~$3–4M (reports vary), one round, led by **Fractal Software**, with **Harlem Capital, Depth Ventures, CreativeCo Capital**. (Fractal is a startup studio — TrashLab is a vertical-SaaS studio company.)
- **Traction:** "hundreds of haulers," servicing **1M+ waste generators** across the US.
- **Team:** 15+ people.

### The thesis (why this matters)
This is classic **vertical SaaS for an overlooked, unsexy, fragmented industry**. Waste hauling is a huge, cash-rich, tech-starved market run on phone calls, whiteboards, and QuickBooks. The bet: become the system of record + system of action for the whole operation, then layer payments and AI automation on top (the high-margin, sticky layers). John's Stripe/Google background → **payments + AI/abuse-detection** are clearly where the technical moat is meant to be.

### Competitive landscape (good to name-drop)
- **Starlight Software Solutions** — roll-off/recycling/commercial, cloud.
- **CurbWaste** — modern all-in-one for residential haulers (closest "modern" competitor).
- **AMCS** — enterprise, comprehensive, older incumbent.
- **TRUX** — logistics + marketplace for dump-truck/roll-off capacity.
- **Routeware** — routing-first, "Routeware Elements" AI platform.
- **Rubicon** — AI waste-hauling optimization + sustainability reporting.
- Legacy reality: a huge share of haulers still run on **QuickBooks + spreadsheets + paper** — the real competitor is "no software."

### How this take-home connects
This take-home is a **Payables / Accounts-Payable app** (vendor invoices, approval workflow, AP aging, simulated payments, mocked invoice extraction). It overlaps TrashLab's world in three sharp ways and you should say so out loud:
1. **Billing & payments** is a core TrashLab pillar — same domain muscles (state machines, money movement, approvals, ledgers).
2. **Mocked invoice ingestion → AI extraction** mirrors TrashLab's "AI turns documents/calls into structured orders/bills."
3. **Multi-tenant org model** (org → users → roles → quorum) is exactly the shape a multi-hauler SaaS needs.

### Questions to ask John (shows you did the work)
**Product / strategy**
- TrashLab is "the OS for haulers" — what's the wedge you lead with in a sales conversation: the AI comms center, dispatch, or payments? Which one actually closes deals?
- How do you think about **AR (getting haulers paid by their customers)** vs **AP**? Is embedded payments / financing on the roadmap given your Stripe background?
- The real competitor is often QuickBooks + paper. How do you win a hauler who "already has a system"?

**Technical / AI**
- The comms center turns calls/texts/emails into orders — how much is LLM vs deterministic? How do you handle extraction confidence and the human-review queue at scale? (Tie to: *I built exactly this review-queue pattern in the take-home.*)
- With your fraud/abuse background — where does that show up at TrashLab? Payment fraud? Duplicate/spam orders?
- What does the stack look like, and where's the hardest distributed-systems problem right now (routing? real-time dispatch? payments reconciliation)?

**Role / team / culture**
- 15 people, vertical SaaS studio (Fractal) — how does engineering decision-making work day to day? How autonomous is an early eng hire?
- How do you all use AI agents internally in the dev workflow today? (Perfect segue — the interview itself is about running agents.)
- What does the first 90 days look like for this role, and what would "great" look like by then?

**Smart "future of the company" framing**
- Vertical SaaS playbook says: own the workflow → own the payments → own the financing/data. Where on that curve is TrashLab, and what's the next layer?

---

## Part 2 — Features to add to the app (live, during the interview)

The README already lists "what was left out" — that's a **gift**: it's a pre-vetted backlog the author (and likely the interviewer) expects. Pick features that (a) show range, (b) map to TrashLab's domain, and (c) are parallelizable across agents.

**Stack reminder:** Backend = Node + **Hono** + **Drizzle** (Postgres) + Zod, Vitest integration tests. Frontend = React 19 + MUI + TanStack Query + react-router + react-toastify. Nx monorepo, **pnpm**. Layered architecture: `routes → services → repositories`. Every list endpoint is paginated; every endpoint/repo change ships its `*.integration.test.ts` / `*Repo.test.ts`.

### Tier A — high signal, self-contained (great for parallel agents)
| # | Feature | Why it impresses | Touches |
|---|---|---|---|
| A1 | **Real invoice extraction** (swap mock for Claude / Document AI behind `extractionService.extract(file)`) | Directly mirrors TrashLab's AI comms center; the seam already exists | `extractionService`, route, frontend confidence UI |
| A2 | **In-app notifications** (table + delivery + unread tray) | Named in README; full-stack slice | new schema, repo, service, route, frontend tray |
| A3 | **Duplicate-invoice detection** (warn on same vendor+invoice#+amount) | Echoes John's fraud/abuse background | `billService`, repo query, test |
| A4 | **Scheduled jobs / overdue flagging** (cron worker: `scheduled → paid` on date, overdue reminders) | Shows you understand background work + idempotency | new worker, service |
| A5 | **Approval automations** (auto-approve under $X from trusted vendor; route by amount band) | Layers on the existing state machine | `billStateMachine`, `approvalService` |
| A6 | **Targeted approvers + approval rules** (tag specific users on a bill; mandatory-approver rules per user or per vendor) | Adds controls sophistication and shows you can extend a state machine cleanly | new `approval_rules` schema, `approvalRulesRepo`, `approvalRulesService`, rule-check hook in `approvalService.submitDecision`, frontend rules config + bill approvers UI |

#### A6 — Targeted approvers + approval rules (detail)

Three sub-features that form one coherent slice:

1. **Tag a user on a specific bill** (`bill_required_approvers` join table: `billId`, `userId`).
   - Admin or bill creator can add/remove tagged approvers before the bill enters `pending_approval`.
   - The `summarize` response adds a `requiredApprovers` list; the frontend shows them alongside the quorum bar.
   - When the bill reaches quorum *and* every tagged approver has approved, it transitions to `approved`. Either condition alone is not enough.

2. **Org-level approval rules** (`approval_rules` table: `id`, `organizationId`, `type`, `subjectUserId?`, `vendorId?`, `priority`, `createdAt`).
   - `type: "mandatory_user"` — a specific user must approve every bill in the org.
   - `type: "mandatory_for_vendor"` — a specific user must approve every bill from a given vendor.
   - Rules are evaluated when a bill is submitted for approval: `approvalService` derives the effective required-approver set (org quorum + rules + any bill-level tags) and writes the union into `bill_required_approvers` automatically.
   - Frontend: an "Approval Rules" settings page (admin only) to create/delete rules (list is paginated).

3. **Dual-control / "plus one" rule** (`type: "mandatory_plus_one"` on `approval_rules`): a named mandatory approver (`subjectUserId`) must approve *plus* at least one other distinct approver. This is enforced in `approvalService.submitDecision`: even after the named user approves, the quorum check counts only towards `approved` once a second distinct user has also approved.

**Implementation sketch (layered architecture):**
- **Schema:** `approval_rules` table + `bill_required_approvers` join table (both scoped by `organizationId` / `billId`).
- **Repo:** `approvalRulesRepo` (CRUD + `listByOrg`) + `billRequiredApproversRepo` (set/get per bill).
- **Service:** `approvalRulesService` (manage rules); extend `approvalService.submitDecision` to re-check the effective required-approver set and only flip to `approved` when both quorum and all required approvers are satisfied.
- **Routes:** `GET/POST/DELETE /api/approval-rules` (admin); `POST/DELETE /api/bills/:id/required-approvers` (admin/creator).
- **Tests:** `approvalRulesRepo.test.ts`, `approvalRules.integration.test.ts`, update `approvals.integration.test.ts` for the new gate.
- **Frontend:** rules settings page, bill detail shows tagged approvers + per-approver status badges.

### Tier B — payments depth (John = ex-Stripe)
| # | Feature | Why |
|---|---|---|
| B1 | Replace "mark paid" with **submit-for-payment → `processing` → webhook → `paid`** (mock Modern Treasury / Stripe Treasury) | Speaks his language; README literally specs it |
| B2 | **Ledger** of debits/credits + idempotent webhook handler keyed on `external_payment_id` | Real money-movement rigor |
| B3 | **Approver dollar limits** + dual-control on release | Controls = trust |

### Tier C — public-platform
| # | Feature | Why |
|---|---|---|
| C1 | **Public API keys + scoped tokens** | "products, not features" thinking |
| C2 | **Signed webhooks with retries/DLQ** | Distributed-systems signal |
| C3 | **Email notifications for invitations** (SES/SendGrid behind existing token model) | Small, complete, README-listed |

### Recommended live demo set (3 parallel agents)
Pick **A1 + A2 + A3** — independent enough to run concurrently, each a full vertical slice (schema/service/route/test/UI), and each maps cleanly to a TrashLab talking point (AI extraction, notifications, fraud detection). Keep B1 in your back pocket if John steers toward payments.

> **Tip:** narrate the *why* as you dispatch each agent — TrashLab wants to see judgment, not just throughput.

---

## Part 3 — Concurrent-agents playbook (the main event)

The interview explicitly wants you **running multiple agents concurrently, live**. There are several ways; know all of them and pick based on whether the tasks touch the **same files** or not.

### Decision rule (say this out loud)
- **Tasks edit *different* files / areas?** → run them truly in parallel (worktrees or subagents). Low conflict risk.
- **Tasks edit the *same* files?** → parallel work causes merge pain. Serialize, or split the file boundaries first, then parallelize.

---

### Way 1 — Subagents in ONE session (simplest, demo-friendly)
Inside a single Claude Code session, I (the orchestrator) can spawn **multiple subagents in a single message** and they execute **concurrently**. You just ask for it:

> "Spin up 3 agents in parallel: one adds in-app notifications, one adds duplicate-invoice detection, one swaps the mocked extraction for a real Claude call. Keep them to separate files."

- **How it works:** each subagent gets its own fresh context window and returns only its final summary to the orchestrator. Independent calls in one turn run at the same time.
- **Isolation option:** a subagent can be given its **own git worktree** so its edits don't collide with others (`isolation: "worktree"`), auto-cleaned if unchanged.
- **Background option:** a subagent can run **in the background** (`run_in_background: true`) and notify when done — so you dispatch 3, keep talking to John, and get pinged as each finishes.
- **Best for:** the live interview. One screen, you orchestrate, agents fan out. Lowest cognitive load.
- **Watch out:** subagents start cold (no conversation history) — give each a crisp, self-contained brief. Don't have two of them edit the same file.

**Live script example to type:**
```
Run these three as parallel background subagents, each in its own worktree,
each must add the matching integration test and follow the layered-architecture
+ pnpm + list-pagination skills:

1) extractionService: replace the mock with a real Claude extraction call,
   keep the ExtractedInvoice shape and confidence scores.
2) Notifications: new notifications table + repo + service + route +
   frontend unread tray.
3) billService: duplicate-invoice detection (same vendor + invoice# + amount)
   that warns on create.

Report back a summary + the test results for each.
```

---

### Way 2 — Git worktrees + multiple terminal Claude Code instances (most "real")
Run **N separate Claude Code processes**, each in its **own git worktree** of this repo, each on its own branch. True OS-level parallelism, full separate sessions, you can watch all three work.

```bash
# from repo root — one worktree + branch per feature
git worktree add ../payable-notifications -b feat/notifications
git worktree add ../payable-dedupe        -b feat/dupe-detection
git worktree add ../payable-extraction    -b feat/real-extraction

# open 3 terminals (or tmux panes) and launch an agent in each
cd ../payable-notifications && claude
cd ../payable-dedupe        && claude
cd ../payable-extraction    && claude
```
Then in each session, give that one feature's brief. When done:
```bash
# back in main repo, merge each branch
git merge feat/notifications
git merge feat/dupe-detection
git merge feat/real-extraction

# cleanup
git worktree remove ../payable-notifications
git worktree prune
```
- **Best for:** showing you understand isolation + branching; visually impressive (3 terminals working at once).
- **Watch out:** each worktree needs its own deps/DB if they run servers. For pure code-gen it's fine; if they each `pnpm dev` you'll want different ports / DB schemas. `pnpm install` is per-worktree (or share the store — pnpm does by default via the global content-addressable store, so it's fast).

**tmux one-liner to set up 3 panes:**
```bash
tmux new-session -d -s agents \; \
  send-keys 'cd ../payable-notifications && claude' C-m \; \
  split-window -h \; send-keys 'cd ../payable-dedupe && claude' C-m \; \
  split-window -v \; send-keys 'cd ../payable-extraction && claude' C-m \; \
  select-layout tiled \; attach
```

---

### Way 3 — Headless / programmatic (`claude -p`) fan-out (scriptable)
Run Claude Code non-interactively and launch several at once from a shell script. Good for "kick off 5, collect results."

```bash
#!/usr/bin/env bash
# run-agents.sh — fire several headless agents in parallel
set -euo pipefail

run() { # $1=worktree dir, $2=branch, $3=prompt
  git worktree add "$1" -b "$2" 2>/dev/null || true
  ( cd "$1" && claude -p "$3" --permission-mode acceptEdits ) \
    > "logs/${2//\//_}.log" 2>&1 &
}

mkdir -p logs
run ../payable-notifications feat/notifications \
  "Add in-app notifications: schema, repo, service, route, frontend tray. Add the integration + repo tests. Follow the repo's skills."
run ../payable-dedupe feat/dupe-detection \
  "Add duplicate-invoice detection in billService (same vendor+invoice#+amount). Add tests."
run ../payable-extraction feat/real-extraction \
  "Replace the mocked extractionService with a real Claude call, keep ExtractedInvoice shape + confidence. Add tests."

wait   # block until all finish
echo "All agents done. See logs/ and the feature branches."
```
- **Best for:** reproducibility, CI-like batch runs, "I scaled this to 5 features."
- **Watch out:** `--permission-mode acceptEdits` (or `--dangerously-skip-permissions` in a sandbox only) so they don't block on prompts; review diffs before merging. Pipe each to its own log so output doesn't interleave.

---

### Way 4 — Claude Code on the web / cloud (offload long runs)
Kick off agents in the cloud (claude.ai/code) on separate branches while your laptop session does something else — useful if a feature is long-running and you want to keep the live conversation snappy. Each runs in its own sandboxed environment and opens a PR you review.
- **Best for:** parallelism without hogging local CPU/terminals; durable runs that survive you closing the laptop.
- **Watch out:** needs the repo reachable (GitHub). Slightly less "live theater" than 3 terminals on screen.

---

### Quick comparison
| Way | Parallelism | Isolation | Visibility | Best when |
|---|---|---|---|---|
| 1. Subagents (one session) | concurrent calls | per-subagent worktree optional | one screen, summaries | **the live demo** |
| 2. Worktrees + N terminals | true OS-level | full (branch+dir) | watch all live | showing isolation/branching |
| 3. `claude -p` fan-out | true, scripted | full (branch+dir) | log files | batch / reproducible |
| 4. Cloud / web | true, remote | full (sandbox+PR) | PRs | long runs, offload |

### Golden rules for running agents concurrently
1. **Partition by files, not by feature description** — two agents on the same file = pain. Carve boundaries first.
2. **Self-contained briefs** — each agent starts cold; spell out the skill/test requirements (this repo enforces `*.integration.test.ts`, `pnpm`, layered architecture, pagination).
3. **One branch/worktree per agent**, merge at the end. Never let parallel agents write the same working tree.
4. **Review every diff before merge.** Speed is the point; unreviewed merges are not.
5. **Narrate your orchestration** — John is evaluating *judgment*: why these tasks, why parallel, how you'd catch a bad one.
6. **Have a fallback** — if an agent goes sideways live, kill it, re-brief tighter, move on. Composure > perfection.

---

## Pre-call checklist
- [ ] Book the SavvyCal slot, add `interview.tracker@silver` for follow-up.
- [ ] Re-read this repo's README "what was left out" table (your backlog).
- [ ] Pre-create the 3 worktrees/branches so you're not fumbling git live.
- [ ] Dry-run **Way 1** once before the call so the orchestration flow is muscle memory.
- [ ] Skim the 3 prep guides Maria sent (Behavioral classics, Storytelling, US culture).
- [ ] Have 2–3 questions for John ready (Part 1).

---

### Sources
- [TrashLab — About / "OS for waste haulers"](https://trashlab.com/about-us)
- [John Tan — Co-Founder & CTO (The Org)](https://theorg.com/org/trashlab/org-chart/john-tan)
- [TrashLab — Crunchbase profile & funding](https://www.crunchbase.com/organization/trashlab-software)
- [TrashLab — LinkedIn](https://www.linkedin.com/company/trash-lab)
- [Trashlab — Tracxn (competitors & funding)](https://tracxn.com/d/companies/trashlab/__nbOJLS8cZigVNTxsRBY3W-dzFWZm0DdRWLsOmjs75ns)
- [Waste-hauler software competitors overview (Basestation)](https://www.thebasestation.com/post/8-best-roll-off-dumpster-software-solutions-reviews-buyers-guide)
- [Starlight Software Solutions](https://www.starlightsoftwaresolutions.com/)
