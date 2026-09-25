# DENEB UI Framework & ARC Algorithm — Complete Project Status & Architecture Report

> **Date:** September 25, 2026  
> **Monorepo Version:** v2.0.90  
> **ARC Engine Version:** v2.2.0 (incorporating ARC v3 Modular Architecture)  
> **Authors:** Chamika Gayashan & Induranga Kawishwara  
> **Target Audience / Purpose:** Comprehensive technical briefing for ChatGPT (or advanced AI coding agents) to consult on improving Deneb and the ARC algorithm. The primary objective is to make `npx @deneb-ui/cli init` reliably scan **any arbitrary web template** and convert it into a **100% visually editable, production-grade storefront** without build errors, runtime crashes, or Fivora contract violations.

---

## ⚠️ CRITICAL CONSTRAINTS & OPERATING BOUNDARIES — READ FIRST

1. **Scope Boundary:** You can **ONLY** modify the `deneb/core` project (the CLI, the ARC engine, `@deneb-ui/core`, `@deneb-ui/ui`, and `@deneb-ui/create-template`).
2. **Third-Party Platform Boundary:** The `Fivora-main` repository (NestJS backend, admin-panel, developer-panel, shopOwner-panel, websiteAgent-panel, fivora-web) is maintained by a separate platform team and **CANNOT** be modified. All template transformations, visual editing contracts, data structures, and schemas must strictly conform to Fivora's existing preflight and ingest contracts.
3. **Template Preservation:** ARC must preserve original design, CSS/Tailwind classes, animations, responsiveness, and layout with **≥98% design preservation**. It must **never** blow away original code or regenerate pages from scratch.

---

## 1. WHAT IS DENEB & WHAT DOES `npx @deneb-ui/cli init` DO?

Deneb is an ecosystem consisting of:
1. **A Headless Style & Visual Edit Engine** (`@deneb-ui/core`): Real-time style patching via DOM variables (`--deneb-*`), font loading, and visual preview protocol messaging.
2. **A Component Library** (`@deneb-ui/ui`): 40+ visual-first, editable commerce components (ProductGrid, Hero, CustomerReviews, CartDrawer, etc.).
3. **A Developer CLI & Adaptive Refactoring Compiler** (`@deneb-ui/cli` containing **ARC**): The compiler that scans a developer's Next.js storefront repository, analyzes its AST, plans editable bindings, transforms JSX into editable contracts, generates `site-data.json` and `fivora-template.json`, and validates against Fivora's ingest rules.

### The Developer Experience Goal
A developer builds an e-commerce storefront using normal React and Next.js (App Router or Pages Router, with Tailwind, CSS Modules, or custom styles).
They run:
```bash
npx @deneb-ui/cli init
```
ARC scans the entire project, identifies every heading, paragraph, card, image, action button, list collection, and theme color, and binds them to Fivora's live preview contracts (`data-preview-field-path`, `data-preview-list-path`, `data-preview-style-target`).
When uploaded to the Fivora marketplace, a non-technical merchant can click **any element on the screen** to edit copy, swap images, change colors, adjust typography, or reorder products in real time with 0ms lag.

---

## 2. MONOREPO STRUCTURE & RECENT UPDATES (v2.0.90)

```
deneb/core/
├── packages/
│   ├── deneb-core/         → @deneb-ui/core (Headless style engine, CSS variables, DOM patcher, preview protocol)
│   ├── deneb-ui/           → @deneb-ui/ui (40+ editable React components for storefronts)
│   └── create-template/    → @deneb-ui/create-template (Scaffolder for new storefronts)
├── cli/
│   └── deneb-cli/          → @deneb-ui/cli (CLI commands: init, validate, zip, doctor, lab, add + ARC engine)
│       └── src/
│           ├── arc/        → ★ THE ARC ENGINE (41 modules, 5 subdirectories)
│           │   ├── transforms/     → Modularized AST transforms (primitives, collections, components, assets, routing, runtime, healing)
│           │   ├── adapters/       → 10 UI library adapters (shadcn, Radix, Swiper, Embla, etc.)
│           │   ├── __tests__/      → 9 comprehensive test suites (124+ automated tests passing)
│           │   └── ...             → IR builder, data-classification, semantic scanner, planner, etc.
│           ├── tools/      → CLI tools (deneb-doctor, template-validator, local-template-lab)
│           ├── common/     → Platform contracts and visual edit definitions
│           └── platform/   → Platform contract definitions
├── templates/
│   └── nextjs/             → Reference storefront template
└── doc/                    → Architectural blueprints and specifications
```

### Recent Monorepo Updates (Commits up to `ff906db` / v2.0.90):
- **Live Catalog Polling Safeguards (`SiteDataProvider.tsx`, `PlatformProductDetail.tsx`, `EditableProductGrid.tsx`):**
  Added guards to suppress automatic polling of `/site-catalog/[slug]/live-data` during preview mode or when the slug is `'template-validation'`. This prevents noisy 404/500 console cascades during static exports.
- **Contract Attribute Quote Stripping (`template-visual-edit-contract.ts`):**
  Fixed `isHiddenHtmlElement` so CSS utility classes like `"overflow-hidden"` inside quoted strings are not falsely classified as the HTML `hidden` attribute.
- **Resilient CI Test Suites:**
  Stabilized corpus and explain-blocked test runners in isolated CI environments.

---

## 3. THE ARC ENGINE PIPELINE (HOW IT CURRENTLY WORKS)

ARC processes a project through 13 sequential phases:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: SCANNER & DEPENDENCY GRAPH (scanner.cjs)                               │
│  • Detects Next.js version, App Router vs Pages Router, mixed JS/TS              │
│  • Locates all pages, components, layouts, and public assets                     │
│  • Builds project-wide import/export dependency graph                            │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 2: PROJECT IR BUILDER (ir-builder.cjs)                                    │
│  • Constructs project Intermediate Representation                                │
│  • Component interfaces, prop shapes, and data source arrays                     │
│  • Maps .map() loops to data sources & child components                          │
│  • Resolves Next.js static asset imports to public URLs                          │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 3: SEMANTIC ANALYSIS (semantic.cjs)                                       │
│  • Walks AST to classify every JSX element (heading, text, image, action, list)  │
│  • Evaluates library adapters (shadcn, Radix, Swiper, Embla, Accordion, etc.)    │
│  • Detects user-facing content vs internal technical markers                     │
│  • Generates candidate transformation list with initial confidence scores        │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 4: DATA CLASSIFICATION & FLOW (data-classification.cjs, data-flow.cjs)    │
│  • Classifies data into 7 tiers (platform, business, content, style, dynamic, etc)│
│  • Protects platform-controlled data from visual overwrite                       │
│  • Unrolls nested member collections (e.g. category.products.map())              │
│  • Resolves destructuring and spread props across component boundaries           │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 5: PLANNING & CONFIDENCE SCORING (planner.cjs)                            │
│  • Evaluates thresholds:                                                         │
│      - AUTO (>= 0.85): Transform automatically with high certainty               │
│      - VALIDATE (0.60 - 0.84): Transform with contract verification              │
│      - SKIP (< 0.60): Discard candidate (MAJOR SOURCE OF UNEDITABLE CONTENT)     │
│  • Generates unique, non-colliding field paths (e.g. `home.heroTitle`)           │
│  • Plans style binding operations (`data-preview-style-target`)                  │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 6: RSC BOUNDARY OPTIMIZER (rsc-boundary.cjs)                              │
│  • Analyzes Server Component vs Client Component boundaries                      │
│  • Prevents illegal hook injections into async server components or layouts      │
│  • Determines where `'use client'` must be placed                                │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 7: MODULAR TRANSFORMATION (transforms/ directory)                         │
│  • Modular sub-engines: primitives, collections, components, assets, routing     │
│  • Injects `data-preview-field-path`, `data-preview-list-path`, etc.             │
│  • Replaces hardcoded literals with `siteData` bindings                          │
│  • Splits action/label contracts for links and buttons                           │
│  • Instruments root layout with `<SiteDataProvider>`                             │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 8: RESIDUAL PASS (residual.cjs)                                           │
│  • Catches any visible literal text that bypassed the primary transformer        │
│  • Either binds to a residual field path or marks `data-preview-static`          │
│  • Intended to guarantee 100% visible text coverage                              │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 9: MANIFEST & SITE DATA GENERATION (manifest.cjs)                         │
│  • Emits `site-data.json` containing default values for all bound fields         │
│  • Emits `fivora-template.json` containing `editorSchema`, pages, and navigation │
│  • Registers `controlOnlyPaths` for platform-managed data                        │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 10: MULTI-LAYER VALIDATION (fivora-contract.cjs, validator.cjs)           │
│  • AST Syntax Audit via Recast parser                                            │
│  • Fivora Strict Contract Audit (no markers on broad containers, unique paths)   │
│  • Action/Label collision audit                                                  │
│  • 12-Gate Acceptance Matrix (acceptance-gates.cjs)                              │
│  • Visual Preservation Score calculation (must be ≥ 98%)                         │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 11: HEALING & SANITIZATION (transforms/healing/sanitizer.cjs, doctor.cjs) │
│  • Cleans contradictory markers, legacy links, and decorative overlays           │
│  • Auto-heals TypeScript map callbacks and JSON imports                          │
│  • Injects missing `useSiteData()` bindings (Source of recent bugs)              │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 12: LEARNING & EXPERIENCE (learning.cjs)                                  │
│  • Stores AST fingerprint outcomes in `~/.deneb/arc/experiences.json`            │
│  • Boosts confidence on previously successful patterns                           │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼───────────────────────────────────────────┐
│  PHASE 13: TRANSACTIONAL COMMIT OR ROLLBACK (workspace.cjs)                      │
│  • Commits transformed files to workspace if all gates pass                      │
│  • Executes atomic rollback if critical validation fails                         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. FIELD REPORT: REAL-WORLD BUGS ENCOUNTERED IN THE VANTA STOREFRONT

During recent live testing of `npx @deneb-ui/cli init` on a production-ready footwear storefront (`vanta-shoes-template`), several critical failure points were identified. **These empirical findings illustrate the exact gaps ChatGPT needs to help solve:**

### Bug 1: Indiscriminate Hook Injection Breaks Server Components & Plain TS
* **What Happened:**
  The doctor/healing check `[DNB-SCP-001]` (`Component Scope siteData Binding`) scanned all files for references to `siteData`. When found, it unshifted `const siteData = useSiteData()` into the function body and added `import { useSiteData } from '@deneb-ui/ui'`.
* **The Consequences:**
  1. **Root Layout Crash:** In Next.js App Router, `src/app/layout.tsx` is an async/server component that renders `<SiteDataProvider>`. Injecting `useSiteData()` inside `RootLayout` threw a runtime fatal error: `TypeError: (0, useSiteData) is not a function` because a context hook cannot be called inside a server component or outside its own provider.
  2. **Plain Utility TypeScript Collision:** In `src/lib/requiredPages.ts`, the function was `export function getRequiredPages(siteData: SiteData)`. The healer injected `const siteData = useSiteData()` inside the function, resulting in: `Module parse failed: Identifier 'siteData' has already been declared`.
  3. **404 Route Server Crash:** In `src/app/not-found.tsx`, the hook was injected into a component that lacked the `'use client'` directive, causing any 404 or missing asset to cascade into a 500 internal server error.
* **Root Cause in Code:**
  `cli/deneb-cli/src/arc/transforms/runtime/provider.cjs` and `sanitizer.cjs` blindly inject the hook without checking:
  - Is the function an async component or Server Component?
  - Does the function already accept `siteData` as a parameter?
  - Is the component the provider itself (`SiteDataProvider`)?
  - Is the file marked with `'use client'`?

### Bug 2: The "137 Low-Confidence Candidates Skipped" Problem
* **What Happened:**
  ARC reported:
  ```
  ✓ 0 high-confidence transformations
  ✓ 14 existing dynamic values preserved
  ⚠ 137 low-confidence candidates skipped
  ```
* **The Consequences:**
  Over 85% of the template's copy, banners, category cards, feature lists, and promotional blocks were completely skipped and left static. The resulting website was only ~15% editable, falling far short of the "100% editable" value proposition.
* **Root Cause in Code:**
  `planner.cjs` sets a hard threshold of `0.60`. Elements wrapped in complex Tailwind layouts, composite strings with template expressions, or non-standard JSX tags received scores around 0.35–0.55 and were discarded rather than safely elevated or wrapped with span extractors.

### Bug 3: Fivora Strict Contract Schema Mismatches
* **What Happened:**
  ARC generated an `editorSchema` that Fivora's validator rejected with 4 blocking findings:
  1. `editorSchema path "shop.priceLkrLabel" declares unsupported type "currency"` (Fivora only accepts `text`, `textarea`, `number`, `image`, `url`, `boolean`, `select`, `color`).
  2. `editorSchema declares duplicate editable field path "site.announcement.linkUrl" in sections "site_announcement" and "site"` (Collision across multiple sections).
  3. `Route "/products/detail" is missing data-preview-page-key="products_detail"`.
  4. `Route "/products/vanta-aero-x" is missing data-preview-page-key="products_vanta-aero-x"`.
* **Root Cause in Code:**
  - `manifest.cjs` inferred schema types without validating against Fivora's allowed whitelist.
  - Section naming did not enforce global uniqueness for leaf field paths.
  - Dynamic App Router routes (subfolders with pages) were not assigned proper `data-preview-page-key` attributes.

### Bug 4: Broken Asset References Cascading to Server 500s
* **What Happened:**
  `site-data.json` had `"logoUrl": "/fivora-logo.png"`. That file did not exist in the project's `public/` directory (only `logo.svg` existed). The browser requested `/fivora-logo.png`, Next.js triggered `not-found.tsx`, and because `not-found.tsx` had an invalid server hook, the entire dev server threw 500 errors on every initial page load.

---

## 5. THE CORE ARCHITECTURAL CHALLENGE: GETTING TO TRUE 100% EDITABILITY

To achieve true 100% editability on any web template, ARC must solve several fundamental AST challenges:

### 1. Leaf vs Container Disambiguation
Fivora strictly forbids `data-preview-field-path` on broad layout containers (`<header>`, `<nav>`, `<section>`, `<div>`). The marker must reside on the exact leaf element rendering the text (`<h1>`, `<h2>`, `<p>`, `<span>`, `<a>`).
* *Challenge:* When text is mixed with icons or badges (e.g. `<button><Icon /> Buy Now</button>`), putting the marker on the button breaks icon rendering. ARC must wrap only the raw text node in a `<span data-preview-field-path="...">Buy Now</span>`.

### 2. Composite & Interpolated Expressions
Real storefronts rarely have pure static strings. They have:
```tsx
<h2>Trending in {currentCategory || 'Footwear'} ({itemCount} items)</h2>
```
* *Challenge:* How does ARC extract this into an editable field without breaking the dynamic runtime expressions `{currentCategory}` and `{itemCount}`?

### 3. Collection Lists (.map()) & Spread Props
Product grids, customer review sliders, and navigation links iterate over arrays.
* *Challenge:* ARC must annotate the parent container with `data-preview-list-path="products"` and the card root with `data-preview-item-path="products[${index}]"`. If the developer uses destructuring (`items.map(({ id, title, price }) => ...)`), ARC must track the alias scope without corrupting TypeScript types.

### 4. React Server Component (RSC) Boundaries
Next.js App Router enforces strict rules:
- Server Components cannot use hooks (`useContext`, `useSiteData`).
- Components providing Context Providers (`SiteDataProvider`) cannot consume their own context.
- Client components must have `'use client'` at the very top.
* *Challenge:* ARC must automatically detect file boundaries and inject `'use client'` only where necessary, avoiding invalid hook placement in server layouts or pure utility helper files.

### 5. Idempotent Transformation
A developer may run `deneb init` multiple times as they update their template.
* *Challenge:* Subsequent runs must detect existing markers, imports, and wrappers, leaving them intact without duplicating `useSiteData()`, duplicating span wrappers, or generating schema collisions.

---

## 6. CURRENT INVENTORY OF ARC SOURCE FILES (41 MODULES)

| Category | File | Description |
|---|---|---|
| **Pipeline Core** | `index.cjs` (47KB) | Main pipeline orchestrator, run phases, error handling |
| | `scanner.cjs` (23KB) | Project scanning, framework detection, route identification |
| | `ir-builder.cjs` (26KB) | Intermediate representation, component graph, data flows |
| | `semantic.cjs` (48KB) | AST semantic analysis, candidate generation |
| | `planner.cjs` (16KB) | Confidence scoring, transformation planning, path allocation |
| | `manifest.cjs` (27KB) | Site data generation, `fivora-template.json` generator |
| | `residual.cjs` (18KB) | Residual pass for uncovered visible text |
| | `workspace.cjs` (8KB) | Transactional staging, commit, and atomic rollback |
| **Transforms** | `transforms/element-transform.cjs` | Core JSX element transformation dispatcher |
| | `transforms/transform-context.cjs` | Scoped transformation state and AST path management |
| | `transforms/primitives/` | Sub-transforms for text, headings, badges, buttons, images |
| | `transforms/collections/` | Sub-transforms for `.map()` loops and array bindings |
| | `transforms/components/` | Custom component wrappers and prop mappings |
| | `transforms/assets/` | Background images, SVG icons, static asset path normalization |
| | `transforms/routing/` | Page key injection (`data-preview-page-key`) |
| | `transforms/runtime/provider.cjs` | Layout instrumentation and `<SiteDataProvider>` mounting |
| | `transforms/healing/sanitizer.cjs` | Marker sanitization, container cleanup, hook injection |
| **Validation & Audit** | `fivora-contract.cjs` (29KB) | Exact port of Fivora platform ingest and validation rules |
| | `acceptance-gates.cjs` (4KB) | 12-Gate acceptance evaluation |
| | `validator.cjs` (8KB) | AST syntax check, duplicate marker check |
| | `visual-regression.cjs` (6KB) | Visual preservation score across viewports |
| | `interaction-verifier.cjs` (6KB) | Interactive element (modals, dropdowns, accordions) audit |
| | `corpus-verifier.cjs` (10KB) | Multi-storefront batch verification |
| **Data & Classification**| `data-classification.cjs` (6KB) | 7-tier data classification engine |
| | `data-flow.cjs` (7KB) | Collection unrolling, destructuring resolution |
| | `canonical-paths.cjs` (7KB) | Field path canonicalization and alias resolution |
| | `field-paths.cjs` (7KB) | Semantic field path naming conventions |
| **Architecture & RSC** | `rsc-boundary.cjs` (8KB) | Server/Client component boundary detection |
| | `adapters/` (6KB) | UI library adapters (shadcn, Radix, Swiper, Embla, etc.) |
| | `component-registry.cjs` (5KB) | Known component dictionary |
| | `font-plan.cjs` (2KB) | Discovered font mapping to Google Fonts registry |
| **AI & Self-Healing** | `ai-agent.cjs` (12KB) | Optional OpenAI agent for unknown component adaptation |
| | `ai-evaluator.cjs` (18KB) | AI self-healing for AST and contract violations |
| | `learning.cjs` (10KB) | Fingerprint experience recording and local boosting |
| | `fuzz-engine.cjs` (18KB) | AST mutation fuzzing and compiler resilience testing |
| | `explain-blocked.cjs` (15KB) | Remediation generator for blocked conversions |

---

## 7. QUESTIONS & ROADMAP FOR CHATGPT CONSULTATION

Please review this document and provide concrete architectural recommendations, algorithm designs, and code-level patterns to address the following:

### Question 1: How to Safely Elevate the 137 Skipped Candidates to 100% Coverage?
- What heuristic or AST-pattern matching algorithm should ARC use to classify low-confidence candidates (currently `< 0.60`) so that banners, feature sections, and complex card layouts become fully editable without risking false positives?
- How should we structure a multi-stage confidence elevation pass that analyzes parent context, sibling tags, and Tailwind classes to safely boost candidate certainty?

### Question 2: How to Guarantee 100% Safe Hook & Scope Injection (`[DNB-SCP-001]`)?
- What exact AST verification rules must `injectSiteDataHook` implement to guarantee it **NEVER**:
  - Injects into Server Components or async functions?
  - Injects into non-component utility functions (e.g. `getRequiredPages`)?
  - Injects a duplicate identifier when a function parameter is already named `siteData`?
  - Injects into the Root Layout component that mounts `<SiteDataProvider>`?
- When a client component references `siteData`, how should ARC ensure `'use client'` is automatically added to the top of the file without disrupting comments or directives?

### Question 3: How to Handle Complex Mixed Expressions Without Breaking JSX?
- For complex JSX children like `<h1>Shop {collection.name} ({count} items)</h1>`, what is the best algorithm to:
  - Option A: Wrap individual literal text fragments in discrete `<span data-preview-field-path="...">` elements?
  - Option B: Lift the entire expression into a formatted template string in `site-data.json` with token interpolation?
  - What are the tradeoffs in Fivora's visual editor?

### Question 4: How to Auto-Harmonize the Schema Against Fivora Ingest Rules?
- How can `manifest.cjs` guarantee that:
  - No unsupported types (like `"currency"`, `"object"`, `"custom"`) are ever emitted into `editorSchema`?
  - Field paths are globally unique across all sections (preventing duplicate path errors)?
  - Dynamic and nested App Router routes (e.g. `src/app/products/[slug]/page.tsx` or `src/app/products/detail/page.tsx`) automatically receive valid `data-preview-page-key` attributes?

### Question 5: What is the Optimal Architecture for ARC v3?
- Given that `transformer.cjs` has now been modularized into `transforms/`, what further architectural decoupling or testing strategies should we adopt to ensure long-term maintainability?
- Should the AST engine remain in CommonJS (`.cjs`) or is a TypeScript/ESM migration warranted?

---

*Document compiled and verified against D:\OFFICE\deneb\core on September 25, 2026. All package versions, file paths, test results, and empirical field findings reflect the live codebase state.*
