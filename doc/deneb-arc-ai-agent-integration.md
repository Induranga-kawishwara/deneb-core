# Deneb ARC AI Agent Integration — Full Implementation Plan

> **Project:** Deneb ARC v1.1.0 → v2.0 (AI-Augmented Autonomous UI Adaptation Engine)  
> **Author:** chamikathereal  
> **Date:** 2026-09-14  
> **Status:** Awaiting Approval

---

## 1. Executive Summary

Integrate a ChatGPT (GPT-4o-mini) powered AI agent into Deneb ARC so that when a developer runs `npx @deneb-ui/cli init` on a project containing **unknown/unsupported components**, the engine:

1. Detects which components are **already covered** by `@deneb-ui/ui` vs **unknown**
2. Sends unknown component source code to the OpenAI API
3. Receives a generated editable wrapper component
4. Validates it through ARC's existing strict pipeline (AST + Fivora Contract + Design Preservation)
5. Self-heals by feeding errors back to the API until **all checks pass**
6. Applies the fix locally to the developer's project
7. Simultaneously opens a **Pull Request** from `chamikathereal/core` → `deneb-ui/core` (and `chamikathereal/ui` → `deneb-ui/ui`) with the new component + docs page
8. All commits are authored under `chamikathereal` for full GitHub contribution credit

---

## 2. What You Already Have ✅

| Asset | Location | Status |
|---|---|---|
| ARC Engine (scan, analyze, plan, transform, validate, rollback) | `cli/deneb-cli/src/arc/` (19 modules) | ✅ Production |
| Fivora Contract Validator | `fivora-contract.cjs` + `validator.cjs` | ✅ Production |
| AST Parser (Babel/Recast) | `ast.cjs` | ✅ Production |
| Learning & Fingerprint System | `learning.cjs` | ✅ Production |
| Component Library Adapters (Shadcn, HeroUI, Framer) | `adapters.cjs` | ✅ Production |
| 37 Editable Components in `@deneb-ui/ui` | `packages/deneb-ui/src/` | ✅ Production |
| CI/CD Pipeline (Build → Test → npm Publish → Version Bump) | `.github/workflows/ci-cd.yml` | ✅ Production |
| Cross-Repo Sync (core → ui dispatch) | `ci-cd.yml` line 181-189 | ✅ Production |
| Recipe System (`save-recipe` / `learn`) | `recipes-v2.cjs` | ✅ Production |
| Monorepo with npm workspaces | `package.json` (root) | ✅ v2.0.41 |

---

## 3. What You Still Need 🔧

| Requirement | Why You Need It | How to Get It |
|---|---|---|
| **GitHub Personal Access Token (PAT)** | The bot needs permission to create branches and open PRs on `chamikathereal/core` and `chamikathereal/ui` | Go to [github.com/settings/tokens](https://github.com/settings/tokens) → Generate new token (classic) → Select scopes: `repo` (full control) → Copy and save as `GITHUB_PAT` |
| **OpenAI API Key** (you already have this) | Calls GPT-4o-mini for component generation | Store as `OPENAI_API_KEY` in `.env` — **rotate the key you shared in chat immediately** |
| **A `.env` file in the core root** | Stores all secrets locally, never committed to git | Create `d:\OFFICE\deneb\core\.env` |
| **`dotenv` npm package** | Loads `.env` at runtime | `npm install dotenv --workspace=@deneb-ui/cli` |
| **`octokit` npm package** | Official GitHub REST API client for creating branches/PRs | `npm install @octokit/rest --workspace=@deneb-ui/cli` |

> [!IMPORTANT]
> **No cloud server, no database, no Docker, no paid hosting required.** The entire system runs inside your existing CLI as a Node.js script using only two API calls (OpenAI + GitHub).

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Developer runs: npx @deneb-ui/cli init             │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: EXISTING ARC PIPELINE (no changes needed)                        │
│                                                                             │
│  scanProject() → buildDependencyGraph() → analyzeProjectFiles()            │
│  → planTransformations() → applyFilePlan() → validateAstFiles()            │
│  → auditFivoraContract() → designPreservationScore()                       │
│                                                                             │
│  Result: All KNOWN components converted successfully.                       │
│          Unknown components collected into `unhandledCandidates[]`          │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: AI AGENT (new module: ai-agent.cjs)                              │
│                                                                             │
│  For each unhandled component:                                              │
│    1. Read the component source code from disk                              │
│    2. Build a structured prompt with:                                       │
│       - Component source code                                               │
│       - Deneb editable wrapper conventions (from a reference template)      │
│       - useSiteData() hook pattern                                          │
│       - data-preview-field-path marker rules                                │
│       - TypeScript interface conventions                                    │
│    3. Call OpenAI API (gpt-4o-mini) with the prompt                         │
│    4. Receive generated EditableXxx.tsx code                                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: SELF-HEALING VALIDATION LOOP (new module: ai-validator.cjs)      │
│                                                                             │
│  ┌─── Loop (max 3 attempts) ──────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │  1. Write generated code to a temp file                             │     │
│  │  2. Run validateAstFiles() — does it parse?                         │     │
│  │  3. Run TypeScript type-check (tsc --noEmit)                        │     │
│  │  4. Run auditFivoraContract() — do markers follow rules?            │     │
│  │  5. Run designPreservationScore() — is CSS intact?                  │     │
│  │                                                                     │     │
│  │  If ALL pass ✅ → Break loop, proceed to Phase 4                    │     │
│  │  If ANY fail ❌ → Feed exact error message back to OpenAI           │     │
│  │                   "Fix this error: [exact validator output]"         │     │
│  │                   → Receive corrected code → Retry from step 1      │     │
│  │                                                                     │     │
│  │  After 3 failures → Skip this component, log warning, continue      │     │
│  └─────────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: LOCAL APPLICATION                                                │
│                                                                             │
│  1. Apply the validated editable wrapper to the developer's project         │
│  2. Update siteData.json with new schema fields                             │
│  3. Update fivora-template.json manifest                                    │
│  4. Save structural fingerprint to learning.cjs (state: 'verified')        │
│  5. Print success to terminal                                               │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: PR-BASED ECOSYSTEM CONTRIBUTION (new module: pr-agent.cjs)       │
│                                                                             │
│  Runs in background (non-blocking, developer doesn't wait):                │
│                                                                             │
│  FOR chamikathereal/core:                                                   │
│    1. Clone/pull latest chamikathereal/core                                 │
│    2. Create branch: feat/ai-editable-<component-name>                      │
│    3. Add EditableXxx.tsx to packages/deneb-ui/src/                         │
│    4. Update packages/deneb-ui/src/index.ts (add export)                    │
│    5. Commit with author: chamikathereal <dmforceeg@gmail.com>              │
│    6. Push branch to chamikathereal/core                                    │
│    7. Open PR: chamikathereal/core → deneb-ui/core                          │
│                                                                             │
│  FOR chamikathereal/ui:                                                     │
│    1. Clone/pull latest chamikathereal/ui                                   │
│    2. Create branch: feat/ai-docs-<component-name>                          │
│    3. Add docs page to src/app/docs/components/<slug>/page.tsx              │
│    4. Update src/components/docs/component-registry.tsx                      │
│    5. Commit with author: chamikathereal <dmforceeg@gmail.com>              │
│    6. Push branch to chamikathereal/ui                                      │
│    7. Open PR: chamikathereal/ui → deneb-ui/ui                              │
│                                                                             │
│  Result: You see 2 PRs on GitHub, review, and click "Merge" (5 seconds)    │
│  → CI/CD auto-bumps version, publishes to npm, deploys docs                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. New Files to Create

### 5.1 Core ARC Module

| File | Purpose |
|---|---|
| **[NEW] `cli/deneb-cli/src/arc/ai-agent.cjs`** | OpenAI API integration — sends component code, receives editable wrapper, handles the self-healing retry loop |
| **[NEW] `cli/deneb-cli/src/arc/ai-prompts.cjs`** | Prompt templates for component generation, docs generation, and error-fix instructions |
| **[NEW] `cli/deneb-cli/src/arc/pr-agent.cjs`** | GitHub API integration — creates branches, commits files, opens PRs under your identity |
| **[NEW] `cli/deneb-cli/src/arc/component-registry.cjs`** | Master list of all known Deneb editable components — used to classify "known vs unknown" |
| **[NEW] `.env`** | Stores `OPENAI_API_KEY` and `GITHUB_PAT` (already in `.gitignore`) |

### 5.2 Modified Existing Files

| File | Change |
|---|---|
| **[MODIFY] `cli/deneb-cli/src/arc/index.cjs`** | After `analyzeProjectFiles()`, add a step to classify unhandled candidates and route them to `ai-agent.cjs` |
| **[MODIFY] `cli/deneb-cli/src/arc/learning.cjs`** | Add `promoteToVerified(fingerprint)` helper for AI-validated components |
| **[MODIFY] `cli/deneb-cli/src/arc/version.cjs`** | Bump `ARC_VERSION` from `1.1.0` to `2.0.0` |
| **[MODIFY] `cli/deneb-cli/src/arc/printer.cjs`** | Add terminal output for AI agent progress (e.g., "⚡ AI adapting Carousel... attempt 1/3") |
| **[MODIFY] `cli/deneb-cli/bin/index.js`** | Add `--ai` flag to `deneb init` command to enable/disable AI agent |
| **[MODIFY] `cli/deneb-cli/package.json`** | Add `dotenv` and `@octokit/rest` dependencies |
| **[MODIFY] `.gitignore`** | Ensure `.env` is listed |

---

## 6. Detailed Module Specifications

### 6.1 `ai-agent.cjs` — The AI Brain

```
Responsibilities:
├── adaptUnknownComponent(sourceCode, componentName, profile)
│   ├── Builds the prompt using ai-prompts.cjs
│   ├── Calls OpenAI API (gpt-4o-mini)
│   ├── Returns { code, schemaFields, propsInterface }
│   └── Handles rate limits, timeouts (120s), and token limits (4000)
│
├── selfHealingLoop(generatedCode, componentName, profile, maxRetries=3)
│   ├── Writes code to temp file
│   ├── Runs validateAstFiles()
│   ├── Runs TypeScript check (tsc --noEmit)  
│   ├── Runs auditFivoraContract()
│   ├── If errors: feeds them back to OpenAI as a fix prompt
│   └── Returns { code, passed, attempts }
│
└── Configuration:
    ├── Model: gpt-4o-mini (from env: OPENAI_CONTENT_MODEL)
    ├── Max tokens: 4000 (from env: OPENAI_MAX_OUTPUT_TOKENS)
    ├── Timeout: 120 seconds (from env: OPENAI_CONTENT_TIMEOUT_MS)
    └── Max retries: 3 (hardcoded safety limit)
```

### 6.2 `ai-prompts.cjs` — Prompt Engineering

This module contains carefully crafted prompt templates that teach GPT-4o-mini your exact coding conventions. The prompts will include:

1. **Component Generation Prompt**: Includes a real `EditableCard.tsx` as a reference example so the AI learns your exact pattern (useSiteData, data-preview-field-path markers, TypeScript interface naming, export style)
2. **Error Fix Prompt**: Takes the exact validator error string and asks the AI to fix only the broken part
3. **Docs Page Prompt**: Generates a Next.js docs page following your existing `component-registry.tsx` patterns

### 6.3 `pr-agent.cjs` — GitHub PR Automation

```
Responsibilities:
├── createComponentPR(componentName, componentCode, docsCode)
│   ├── Uses @octokit/rest with GITHUB_PAT
│   ├── Git author: { name: "chamikathereal", email: "dmforceeg@gmail.com" }
│   │
│   ├── Core Repo PR:
│   │   ├── Fork: chamikathereal/core
│   │   ├── Upstream: deneb-ui/core
│   │   ├── Branch: feat/ai-editable-<name>
│   │   ├── Files: EditableXxx.tsx + updated index.ts
│   │   └── PR title: "feat(ui): add EditableXxx component [AI-generated]"
│   │
│   └── UI Repo PR:
│       ├── Fork: chamikathereal/ui
│       ├── Upstream: deneb-ui/ui
│       ├── Branch: feat/ai-docs-<name>
│       ├── Files: docs page + updated component-registry.tsx
│       └── PR title: "docs: add EditableXxx documentation [AI-generated]"
│
└── PR body includes:
    ├── Auto-generated component description
    ├── List of editable properties discovered
    ├── Validation results (AST ✅, Contract ✅, Design ✅)
    ├── Number of self-healing attempts taken
    └── Structural fingerprint ID for traceability
```

### 6.4 `component-registry.cjs` — Known Component Lookup

```
Responsibilities:
├── isKnownComponent(componentName)
│   └── Checks against the master list of 37 existing Editable* components
│
├── getKnownComponentNames()
│   └── Returns ['EditableCard', 'EditableText', 'EditableHero', ...]
│
└── Source of truth: reads packages/deneb-ui/src/index.ts exports
```

---

## 7. CLI Integration

### Current `deneb init` Flow:
```bash
npx @deneb-ui/cli init
# Scans → Analyzes → Plans → Transforms → Validates → Done
```

### New `deneb init --ai` Flow:
```bash
npx @deneb-ui/cli init --ai
# Scans → Analyzes → Plans → Transforms Known →
# → Detects Unknown → AI Generates → Self-Heals → Validates →
# → Applies Locally → Opens PRs in Background → Done
```

### Terminal Output Example:
```
╔═══════════════════════════════════════════════════════════╗
║          DENEB ARC v2.0 — AI-Augmented Engine            ║
╚═══════════════════════════════════════════════════════════╝

  Scanning project...
  ✓ Framework: Next.js 15 (App Router)
  ✓ Libraries: shadcn, framer-motion, lucide-react
  ✓ 24 JSX files scanned, 67 editable candidates

  Converting known components...
  ✓ Hero section (3 fields)
  ✓ Product cards (5 fields)
  ✓ Footer (8 fields)
  ✓ FAQ Accordion (4 fields)

  ⚡ AI Agent: Detected 2 unknown components
  ⚡ Adapting <ImageCarousel />... attempt 1/3
    ❌ Fivora contract: missing data-preview-list marker
  ⚡ Adapting <ImageCarousel />... attempt 2/3
    ✅ All 14 checks passed!
  ⚡ Adapting <TestimonialSlider />... attempt 1/3
    ✅ All 14 checks passed!

  ✓ Fivora strict contract: PASSED (0 errors)
  ✓ Design preservation: 100%
  ✓ Editable coverage: 100% (67/67 candidates)

  📦 PR opened: chamikathereal/core → deneb-ui/core
     feat/ai-editable-carousel (#47)
  📦 PR opened: chamikathereal/ui → deneb-ui/ui
     feat/ai-docs-carousel (#23)

  ✔ ARC complete. Backup: .deneb-backup-arc-2026-09-14T06-12-00
```

---

## 8. Environment Variables (.env)

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxx           # Your API key (ROTATE the one you shared!)
OPENAI_CONTENT_MODEL=gpt-4o-mini     # Model to use
OPENAI_MAX_OUTPUT_TOKENS=4000         # Max response tokens
OPENAI_CONTENT_TIMEOUT_MS=120000      # 2 minute timeout

# GitHub Configuration  
GITHUB_PAT=ghp_xxxx                   # Your Personal Access Token
GITHUB_USERNAME=chamikathereal        # Your GitHub username
GITHUB_EMAIL=dmforceeg@gmail.com      # Your GitHub email

# Upstream Organization
GITHUB_ORG=deneb-ui                   # Organization name
GITHUB_CORE_REPO=core                 # Core repo name
GITHUB_UI_REPO=ui                     # UI repo name
```

---

## 9. Safety & Guardrails

| Risk | Mitigation |
|---|---|
| AI generates syntactically broken code | `validateAstFiles()` catches it, self-healing loop fixes it |
| AI generates code that breaks Fivora contract | `auditFivoraContract()` catches it, loop fixes it |
| AI damages existing CSS/design | `designPreservationScore()` must be ≥ 95% |
| AI enters infinite retry loop | Hard cap at 3 attempts, then skip with warning |
| API key exposed | `.env` file, never committed (already in `.gitignore`) |
| Bad code reaches `deneb-ui/core` | PR requires manual "Merge" click — human review gate |
| OpenAI API is down/slow | Graceful fallback: ARC continues without AI, unknown components are logged as `skipped` |
| Token cost explosion | `gpt-4o-mini` is ~$0.15/million input tokens; a typical component costs ~$0.002 per generation |

---

## 10. Cost Estimate

| Item | Cost |
|---|---|
| GPT-4o-mini per component (including retries) | ~$0.005 (half a cent) |
| GitHub API | Free (public repos) |
| npm publish | Free (scoped packages) |
| CI/CD (GitHub Actions) | Free (2000 min/month on free plan) |
| **Total cost per unknown component** | **~$0.005** |
| **Monthly estimate (50 unknown components)** | **~$0.25** |

---

## 11. Implementation Order (Phases)

### Phase A: Foundation (Week 1)
- [ ] Create `.env` file with API keys
- [ ] Install `dotenv` and `@octokit/rest` dependencies
- [ ] Create `component-registry.cjs` (known component lookup)
- [ ] Add `--ai` flag to `deneb init` in `bin/index.js`

### Phase B: AI Agent Core (Week 2)
- [ ] Create `ai-prompts.cjs` (prompt templates using existing EditableCard as reference)
- [ ] Create `ai-agent.cjs` (OpenAI API integration + self-healing loop)
- [ ] Integrate into `index.cjs` after `analyzeProjectFiles()`
- [ ] Update `printer.cjs` with AI progress messages

### Phase C: Validation Loop (Week 3)
- [ ] Wire `ai-agent.cjs` → `validator.cjs` → retry loop
- [ ] Add TypeScript check step (`tsc --noEmit` on generated file)
- [ ] Add fingerprint saving on successful AI adaptation
- [ ] Update `learning.cjs` with AI-specific experience tracking

### Phase D: PR Automation (Week 4)
- [ ] Create `pr-agent.cjs` (GitHub API: branch, commit, PR)
- [ ] Generate docs page content via AI
- [ ] Test full flow: init → AI → validate → PR
- [ ] Bump version to ARC v2.0.0

### Phase E: Testing & Polish (Week 5)
- [ ] Test with 10 different Next.js + Shadcn projects
- [ ] Tune prompts based on real-world failure patterns
- [ ] Add `--ai-dry-run` flag for testing without opening PRs
- [ ] Write internal documentation

---

## 12. Verification Plan

### Automated Tests
```bash
# Run existing test suite (must still pass with no regressions)
npm test

# Run ARC on the bundled template
npx @deneb-ui/cli init templates/nextjs --ai --dry-run

# Validate the generated component in isolation
npx @deneb-ui/cli validate .
```

### Manual Verification
1. Run `deneb init --ai` on a fresh Next.js + Shadcn project with a custom Carousel
2. Verify the Carousel becomes editable in the local preview (`deneb lab`)
3. Verify PR appears on GitHub under `chamikathereal/core` with green CI checks
4. Click "Merge" and verify `deneb-ui/core` CI publishes to npm
5. Run `deneb update` in a separate project and verify the new component is available via `deneb add carousel`

---

## User Review Required

> [!IMPORTANT]
> **API Key Security:** Please rotate your OpenAI API key immediately at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). The one shared in chat is now compromised.

> [!IMPORTANT]
> **GitHub PAT Required:** You need to generate a GitHub Personal Access Token with `repo` scope. Without this, the PR automation (Phase 5) cannot function.

## Open Questions

> [!IMPORTANT]
> **1. AI Opt-in or Default?**
> Should AI be enabled by default with `deneb init`, or should it require the `--ai` flag? The plan currently uses `--ai` as an opt-in flag so existing users are not surprised by API calls.

> [!IMPORTANT]
> **2. PR Frequency:**
> Should the bot open one PR per unknown component, or batch all unknown components from a single `init` run into one combined PR?

> [!IMPORTANT]
> **3. Model Upgrade Path:**
> You currently have `gpt-4o-mini`. If you later upgrade to `gpt-4o` (full), the only change is the `OPENAI_CONTENT_MODEL` env var. Do you want the plan to include a model-selection CLI flag like `--ai-model gpt-4o`?
