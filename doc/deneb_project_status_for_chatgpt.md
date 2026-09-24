# DENEB UI Framework — Complete Project Status Report

> **Date:** September 24, 2026  
> **Version:** 2.0.88 (Monorepo) / ARC Engine v2.2.0  
> **Authors:** Chamika Gayashan & Induranga Kawishwara  
> **Purpose:** This document describes the current state of the Deneb project to help determine what features to develop next.

---

## ⚠️ CRITICAL CONSTRAINT — READ FIRST

**I can ONLY modify the `deneb/core` project. The `Fivora-main` project (backend, admin-panel, developer-panel, shopOwner-panel, websiteAgent-panel, fivora-web) is maintained by a separate team and I CANNOT change it.** All feature development must happen within Deneb's scope. Fivora-main details are provided below only as context for understanding the platform Deneb integrates with.

---

## 1. WHAT IS DENEB?

Deneb UI is a **visual-first React component library + CLI toolchain** that converts standard Next.js storefronts into **Fivora-compatible, visually editable templates**. It is published as an npm monorepo under the `@deneb-ui` organization.

### The Core Value Proposition

1. **Shop owners** build e-commerce storefronts using normal Next.js + React
2. **Deneb CLI** (`npx @deneb-ui/cli init`) auto-converts that storefront code so every text, image, and action becomes **live-editable** through Fivora's visual editor
3. The converted template is then uploaded to Fivora where **end users (merchants)** can customize it without writing code
4. **Deneb ARC** (Adaptive Refactoring Compiler) is the AI-powered engine inside the CLI that performs this automatic conversion

---

## 2. DENEB MONOREPO STRUCTURE (v2.0.88)

```
deneb/core/
├── packages/
│   ├── deneb-core/         → @deneb-ui/core  (Headless style engine, CSS variables, DOM patcher, preview protocol)
│   ├── deneb-ui/           → @deneb-ui/ui    (40+ editable React components for storefronts)
│   └── create-template/    → @deneb-ui/create-template  (Scaffold new storefront templates)
├── cli/
│   └── deneb-cli/          → @deneb-ui/cli   (CLI: init, validate, zip, doctor, lab, add + ARC engine)
│       └── src/
│           ├── arc/        → ★ THE ARC ENGINE (33 modules, ~450KB of source code)
│           ├── tools/      → CLI tool commands (doctor, validator, template-lab, converter, preview-bridge)
│           ├── sites/      → Universal page selection logic
│           ├── common/     → Shared utilities
│           ├── platform/   → Platform contract definitions
│           └── recipes/    → Recipe engine for known template patterns
├── templates/
│   └── nextjs/             → Reference storefront template
├── scripts/                → Build, bump, consistency checks, smoke tests
├── doc/                    → Architecture docs, implementation plans
└── .github/workflows/      → CI/CD + npm publish with provenance
```

---

## 3. PACKAGE DETAILS

### 3.1 `@deneb-ui/core` (Headless Style Engine)
- **Purpose:** CSS variable system, DOM patcher, real-time preview protocol for Fivora visual editing
- **Key exports:**
  - Style patching: `patchElementStyle`, `patchStyleByPath`, `styleToCssVariables`, `collectStyleTargetsFromHtml`
  - Theme system: `THEME_PALETTES`, `FONT_PAIRINGS`, `generateThemeVariables`, `parseVisualCustomization`, `customizationToTheme`
  - Font system: `DENEB_FONT_REGISTRY` (large Google Fonts catalog), `buildGoogleFontsStylesheetUrl`, `collectFontIdsFromSiteData`
  - Validation: style tree validators
- **TypeScript, builds to `dist/`**

### 3.2 `@deneb-ui/ui` (Component Library — 40+ Components)
- **Purpose:** Visual-first React components purpose-built for editable commerce storefronts
- **Key component categories:**
  - **Core primitives:** EditableText, EditableHeading, EditableParagraph, EditableBadge, EditableQuote, EditableButton, EditableImage, EditableMap, EditableList, EditableBox, EditableGrid, EditableSection, EditableDialog
  - **Commerce:** EditableProductCard, EditableProductGrid, EditableProductDetail, EditableProductShowcase, PlatformProductDetail, EditableCartDrawer, EditableFilterSidebar, EditablePricingCard, ProductQuickView
  - **Social proof:** EditableCustomerReviews, EditableGoogleFeedback, EditableTestimonialCard, EditableTestimonialSection, EditableTestimonialCarousel
  - **Layout & Navigation:** EditableNavbar, EditableFooter, EditableHero (Centered + Split variants), EditableAnnouncementBar, EditableCategoryPills, StickyMobileBar
  - **Content:** EditableServiceCard, EditableCard, EditableFAQAccordion, EditableContactForm, EditableBeforeAfterSlider, EditableBookingModal
  - **Platform integration:** SiteDataProvider (context provider for editable data), ThemeStyles, ThemeToggle, FontLoader, ResponsiveBaseStyles, DenebComponentStyles, CookieConsentBanner, TrustBadges, PlatformAdditionalPages
  - **Cart system:** useCart hook, EditableCartDrawer
  - **Utility hooks:** useComponentStyle, useWhatsAppForm, useDenebFonts
- **Also exports canonical aliases** (e.g., `Button`, `Card`, `Hero`, `Footer`, etc. — shadcn/HeroUI naming style)
- **Peer deps:** React 18 or 19
- **TypeScript, builds to `dist/`**
- **Has `platform-contract.json`** defining platform-controlled field paths that Fivora manages (not user-editable in visual editor)

### 3.3 `@deneb-ui/cli` (CLI Toolchain)
- **Purpose:** Full developer workflow — scaffold, convert, validate, and package Fivora-ready templates
- **CLI commands available:** `deneb init`, `deneb validate`, `deneb zip`, `deneb doctor`, `deneb lab`, `deneb add`
- **Contains the ARC engine** (see next section)
- **Dependencies:** `@babel/parser`, `recast` (AST tools), `@octokit/rest` (GitHub API), `adm-zip`, `dotenv`
- **Key tools:**
  - `deneb-doctor.cjs` — Project health diagnostic (75KB)
  - `deneb-template-validator.cjs` — Full template validation (141KB)
  - `template-converter.cjs` — Legacy regex-based converter (38KB, superseded by ARC)
  - `local-template-lab.cjs` — Local preview lab (20KB)
  - `template-preview-focus-bridge.cjs` — Preview/focus bridge for visual editing (69KB)
  - `recipe-engine.cjs` — Recipe matching engine for known patterns

### 3.4 `@deneb-ui/create-template` (Scaffolder)
- **Purpose:** `npm create @deneb-ui/template my-store` — scaffolds a new storefront from reference template
- **Contains reference template for Next.js**

---

## 4. THE ARC ENGINE — COMPLETE STATUS

### 4.1 What ARC Does

**ARC (Adaptive Refactoring Compiler)** is an AST-driven, AI-augmented engine that automatically converts any standard Next.js storefront into a Fivora-compatible visually editable template. It is the **core innovation** of Deneb.

### 4.2 ARC Pipeline — How It Works (Step by Step)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: SCAN — scanProject()                                                  │
│  • Detects framework (Next.js version, App Router vs Pages Router)             │
│  • Finds all JSX/TSX files, build the file list                                │
│  • Identifies routes (pages), components, layouts                              │
│  • Detects component libraries (shadcn, HeroUI, etc)                           │
│  • Resolves TypeScript path aliases                                            │
│  • Reads package.json, tsconfig.json                                           │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 2: DEPENDENCY GRAPH — buildDependencyGraph()                             │
│  • Maps import relationships between all files                                 │
│  • Identifies which components are used on which pages/routes                  │
│  • Determines "owner scope" for field paths                                    │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 3: IR BUILD — buildProjectIR()                                           │
│  • Constructs project-wide Intermediate Representation                         │
│  • Component Graph: declarations, exports, prop shapes, interfaces             │
│  • Data Sources: array declarations, sample object shapes                      │
│  • Collection Flow: maps .map() loops to data sources & child components       │
│  • Asset Imports: Next.js static imports → clean public URLs                   │
│  • CSS Background Images: discovers Tailwind bg-[url(...)] and inline styles   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 4: SEMANTIC ANALYSIS — analyzeFile() for each JSX file                   │
│  • Walks AST to identify every JSX element                                     │
│  • Classifies each element: text, heading, image, action, link, form, etc.     │
│  • Detects user-facing vs technical content                                    │
│  • Generates "candidates" for transformation with confidence scores            │
│  • Uses adapter system (shadcn, Embla, Swiper, Radix, etc.)                    │
│  • Resolves imported data bindings across file boundaries                      │
│  • Text Fragment Analysis for complex text compositions                        │
│  • Collects design snapshots (classNames, styles) for preservation             │
│  File: semantic.cjs (1,200 lines, 47KB)                                        │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 5: PLANNING — planTransformations()                                      │
│  • Assigns confidence thresholds:                                              │
│    - AUTO (>= 0.85): Transform automatically                                  │
│    - VALIDATE (>= 0.60): Transform but needs validation                        │
│    - SKIP (< 0.60): Skip transformation                                        │
│  • Applies recipe boosts and fingerprint boosts from learning                  │
│  • Infers field paths (section.fieldName) for each candidate                   │
│  • Classifies field types (text, textarea, image, url, number, boolean, etc.)  │
│  • Builds unique field paths, avoiding collisions                              │
│  • Appends style bind transforms                                              │
│  File: planner.cjs (391 lines)                                                 │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 6: AI AGENT (Optional, --ai flag)                                        │
│  • Classifies known vs unknown components                                      │
│  • Uses GPT-4o-mini to generate editable wrappers for unknown components       │
│  • Self-healing validation loop (up to 3 retries)                              │
│  • Auto-opens PRs to deneb-ui/core for new components                          │
│  • Auto-generates documentation pages                                          │
│  File: ai-agent.cjs, ai-prompts.cjs, ai-evaluator.cjs                          │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 7: TRANSFORMATION — applyFilePlan() for each file                        │
│  • Rewrites JSX elements to be editable using recast (AST manipulation)        │
│  • Adds data-preview-field-path attributes                                     │
│  • Adds data-preview-list-path for collections                                 │
│  • Adds data-preview-item-path for list items                                  │
│  • Adds data-preview-page-key for multi-page routing                           │
│  • Replaces hardcoded strings with siteData bindings                           │
│  • Injects useSiteData hook imports                                            │
│  • Instruments layout file with SiteDataProvider                               │
│  • Handles RSC (React Server Components) boundaries                            │
│  • Splits action/label contracts for interactive elements                      │
│  File: transformer.cjs (2,752 lines, 101KB — THE LARGEST FILE)                 │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 8: RESIDUAL PASS — applyResidualPass()                                  │
│  • Catches everything the main pass missed                                     │
│  • Every remaining visible literal text is either:                              │
│    - Bound to a field path, OR                                                 │
│    - Marked data-preview-static with a reason                                  │
│  • This ensures 100% visual text coverage                                      │
│  File: residual.cjs (456 lines)                                                │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 9: DATA GENERATION — buildSiteDataAndManifest()                          │
│  • Generates site-data.json (initial content values for all bound fields)      │
│  • Generates fivora-template.json (manifest with editor schema, pages, etc.)   │
│  • Prunes unbound leaves from site data                                        │
│  • Applies font theme based on fonts used in the project                       │
│  • Computes control-only paths (fields managed by Fivora, not visual editor)   │
│  File: manifest.cjs (732 lines)                                                │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 10: VALIDATION — Multi-Layer Validation                                  │
│  Layer A: AST Syntax — parseSource() on every transformed file                 │
│  Layer B: Contract Validation — orphan paths, missing schema, collisions       │
│  Layer C: Fivora Contract Audit (ported from Fivora backend):                  │
│    • Marker placement rules (no field-path on broad containers like div/main)  │
│    • Action/label collision detection                                          │
│    • Path coverage (every schema field has a marker in the source)             │
│    • Schema uniqueness (no duplicate editor fields)                            │
│    • Page coverage (every route has a page key)                                │
│    • Preview runtime check                                                     │
│    • Static marker authorship audit                                            │
│    • Empty state source audit                                                  │
│    • Select options validation                                                 │
│    • List bounds audit                                                         │
│    • Route-owned marker coverage                                               │
│  Layer D: Design Preservation Score (must be >= 98%)                           │
│  Layer E: Runtime Editability Verification:                                    │
│    • Contract simulation verification (in-process)                             │
│    • Optional Playwright headless browser testing                              │
│  File: validator.cjs, fivora-contract.cjs (794 lines), runtime-validator.cjs   │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 11: AI EVALUATOR (Post-transform, optional)                              │
│  • RSC boundary integrity check                                                │
│  • Component export verification in page/layout files                          │
│  • Fivora strict leaf contract verification                                    │
│  • Manifest route ↔ file 1:1 correspondence                                   │
│  • Self-healing: uses OpenAI to fix detected issues automatically              │
│  File: ai-evaluator.cjs (451 lines)                                            │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 12: LEARNING — recordExperience()                                        │
│  • Records transformation outcomes (success/failure per fingerprint)            │
│  • Stores locally in ~/.deneb/arc/experiences.json                              │
│  • Fingerprint boosting: successful patterns get confidence boost next time    │
│  • Rule states: observed → candidate → experimental → verified → stable        │
│  • Architecture registry: learns project structure patterns                    │
│  • No network upload — purely local persistence                                │
│  File: learning.cjs (273 lines)                                                │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────┐
│  STEP 13: REPORTING — buildReport()                                            │
│  • Generates complete JSON report with all metrics                             │
│  • If critical failure: ROLLS BACK all changes                                 │
│  • If contract failure: prints warnings but keeps changes                      │
│  • Saves report to .deneb/runs/<runId>/                                        │
│  • Supports --dry-run (simulates without writing)                              │
│  • Supports --explain (detailed transformation explanations)                   │
│  • Supports --json (machine-readable output)                                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 ARC Module Inventory (33 Source Files)

| Module | Lines | Size | Purpose |
|--------|-------|------|---------|
| `transformer.cjs` | 2,752 | 101KB | AST transformation engine (largest file) |
| `semantic.cjs` | 1,200 | 47KB | Semantic analysis, element classification |
| `index.cjs` | 1,079 | 42KB | Main pipeline orchestrator |
| `fivora-contract.cjs` | 794 | 29KB | Fivora platform contract validation (ported from backend) |
| `manifest.cjs` | 732 | 27KB | Site data & manifest generation |
| `scanner.cjs` | 658 | 23KB | Project scanning & dependency detection |
| `ir-builder.cjs` | 582 | 22KB | Intermediate Representation builder |
| `ast.cjs` | ~600 | 18KB | AST parsing, utilities, code printers |
| `ai-evaluator.cjs` | 451 | 18KB | AI-powered self-healing evaluator |
| `residual.cjs` | 456 | 17KB | Residual pass — catches what main pass missed |
| `planner.cjs` | 391 | 16KB | Confidence scoring & transformation planning |
| `ai-agent.cjs` | 335 | 12KB | OpenAI API integration, component adaptation |
| `printer.cjs` | ~300 | 11KB | Terminal output formatting |
| `learning.cjs` | 273 | 10KB | Experience recording & fingerprint learning |
| `runtime-validator.cjs` | 287 | 9KB | Runtime editability verification |
| `pr-agent.cjs` | ~250 | 9KB | GitHub PR automation for new components |
| `next-config.cjs` | ~250 | 8KB | next.config.js manipulation |
| `ai-prompts.cjs` | ~200 | 8KB | AI prompt engineering templates |
| `validator.cjs` | ~200 | 8KB | AST & contract validators |
| `field-paths.cjs` | ~200 | 7KB | Field path inference & naming |
| `adapters.cjs` | 174 | 6KB | Component library adapter system |
| `data-flow.cjs` | ~150 | 5KB | Data flow analysis (.map() unrolling) |
| `component-registry.cjs` | 159 | 5KB | Known component master lookup |
| `text-fragment-analyzer.cjs` | ~130 | 5KB | Complex text composition analysis |
| `rsc-boundary.cjs` | ~120 | 5KB | React Server Component boundary handling |
| `fs-utils.cjs` | ~120 | 4KB | File system utilities |
| `diff.cjs` | ~100 | 4KB | Diff generation for explain mode |
| `explain.cjs` | ~100 | 4KB | Transformation explanation generator |
| `canonical-paths.cjs` | ~80 | 3KB | Path canonicalization |
| `style-candidates.cjs` | ~80 | 3KB | Style binding candidate detection |
| `font-plan.cjs` | ~50 | 2KB | Font ID collection from site data |
| `recipes-v2.cjs` | ~40 | 2KB | Recipe V2 matching |
| `version.cjs` | 23 | 412B | Version constants |

**Total ARC Engine: ~12,000+ lines of code, ~450KB of source**

### 4.4 ARC Adapter System (10 Library Adapters)

| Adapter | Supported Libraries |
|---------|-------------------|
| `ui-frameworks.cjs` | shadcn/ui, Radix UI, HeroUI/NextUI, Chakra UI, Mantine, Ant Design, Material UI, daisyUI |
| `swiper.cjs` | Swiper.js carousel |
| `embla.cjs` | Embla Carousel |
| `slick.cjs` | react-slick |
| `accordion.cjs` | Accordion patterns |
| `dialog.cjs` | Dialog/Modal patterns |
| `gallery.cjs` | Gallery patterns |
| `tabs.cjs` | Tabs patterns |
| `picture-source.cjs` | `<picture>` / `<source>` elements |
| `registry.cjs` | Adapter registration & dispatch |

### 4.5 ARC Confidence System

```
Confidence >= 0.85 (AUTO)     → Transform automatically, high certainty
Confidence >= 0.60 (VALIDATE) → Transform but flag for validation
Confidence <  0.60 (SKIP)     → Skip, too uncertain to transform
```

Confidence is boosted by:
- Recipe matching (up to +0.08)
- Fingerprint learning from past successful runs
- Adapter recognition (known UI library patterns)

### 4.6 ARC Tests

- **Single test file:** `cli/deneb-cli/src/arc/__tests__/arc.test.cjs` (116KB, comprehensive)
- **Run command:** `node --test cli/deneb-cli/src/arc/__tests__/arc.test.cjs`
- **Fixture files** in `__fixtures__/` for test scenarios

---

## 5. WHAT ARC CAN CURRENTLY DO (COMPLETED FEATURES ✅)

1. ✅ Full AST-based transformation (no regex hacks)
2. ✅ Semantic element classification (text, heading, image, action, form, etc.)
3. ✅ Automatic field-path generation with collision avoidance
4. ✅ Multi-page support with page keys
5. ✅ Collection support (.map() → list/item markers)
6. ✅ Cross-file import resolution for data bindings
7. ✅ Intermediate Representation (IR) for project-wide understanding
8. ✅ Residual pass for 100% visible text coverage
9. ✅ Fivora strict contract validation (ported from backend)
10. ✅ Design preservation scoring (must maintain ≥98%)
11. ✅ React Server Component (RSC) boundary handling
12. ✅ Next.js App Router + Pages Router support
13. ✅ Static export configuration for Fivora hosting
14. ✅ Backup & rollback on critical failure
15. ✅ AI Agent for unknown component adaptation (GPT-4o-mini)
16. ✅ AI Evaluator self-healing (RSC boundaries, exports, leaf contracts)
17. ✅ GitHub PR automation for new components
18. ✅ Learning system with fingerprint persistence
19. ✅ Component library adapters (shadcn, Radix, Swiper, Embla, etc.)
20. ✅ Dry-run mode, explain mode, JSON output mode
21. ✅ Runtime editability verification (contract simulation + optional Playwright)
22. ✅ Action/label splitting for interactive elements
23. ✅ Form submission action handling (WhatsApp, email, etc.)
24. ✅ Recipe system for known template patterns
25. ✅ Font system with large Google Fonts registry
26. ✅ Theme system with CSS variables
27. ✅ Real-time style patching via DOM patcher
28. ✅ Platform contract for Fivora-managed fields
29. ✅ Template Lab for local preview
30. ✅ Doctor command for project health diagnostics
31. ✅ 40+ editable React components in @deneb-ui/ui
32. ✅ Cart system with useCart hook
33. ✅ Visual customization (colors, typography, spacing, layout)
34. ✅ Auto-reconciliation of unknown paths to controlOnlyPaths
35. ✅ CI/CD pipeline with npm publish + provenance

---

## 6. FIVORA-MAIN — CONTEXT ONLY (CANNOT MODIFY)

### 6.1 What is Fivora?

Fivora is the **platform** that Deneb templates are deployed to. It provides:
- Visual editing UI for merchants to customize storefront templates
- AI content generation agent
- Template marketplace
- Site hosting and deployment (via CapRover)
- Payment processing (PayHere)
- Analytics, contact forms, chatbots
- Multi-tenant architecture with roles: Admin, Developer, Shop Owner, Website Agent

### 6.2 Fivora Architecture

```
Fivora-main/
├── backend/           → NestJS REST API + Prisma ORM (PostgreSQL)
│   └── src/
│       ├── templates/           → Template upload, validation, sandbox
│       ├── sites/               → Site instance management (204KB main service!)
│       │   ├── site-instances.service.ts       → Core site management
│       │   ├── template-preview-focus-bridge.ts → Visual editing bridge (123KB)
│       │   ├── universal-template-theme.ts     → Theme management (39KB)
│       │   ├── universal-page-selection.ts     → Page management
│       │   ├── static-site-seo.ts              → SEO optimization
│       │   ├── caprover-domain-provisioner.ts  → Domain management
│       │   └── universal-chatbot.ts            → Chatbot integration
│       ├── visual-customization/ → Visual customization API
│       ├── ai-content/          → AI content generation
│       ├── auth/                → Authentication
│       ├── catalog/             → Product catalog
│       ├── payments/            → Payment processing
│       ├── storage/             → File storage
│       └── ... (26 modules total)
│
├── admin-panel/       → React + Vite administrator dashboard
├── developer-panel/   → React + Vite template developer portal
├── shopOwner-panel/   → React + Vite shop owner portal
├── websiteAgent-panel/→ React + Vite merchant/agent portal
└── fivora-web/        → Next.js marketing and storefront web app
```

### 6.3 Key Fivora Platform Capabilities (Deneb Must Integrate With)

- **Template Upload & Validation:** Fivora backend validates uploaded templates against strict contracts
- **Visual Editing Protocol:** Uses `data-preview-field-path`, `data-preview-list-path`, `data-preview-item-path`, `data-preview-page-key` attributes
- **Template Preview Focus Bridge:** Real-time visual editing synchronization (123KB — the largest file in Fivora)
- **Universal Template Theme:** Theme system with palette management
- **Site Instance Management:** Creates and manages individual merchant sites
- **Developer Guide:** Fivora maintains a 159KB developer template guide for template developers
- **CI/CD:** GitHub Actions → CapRover deployment

### 6.4 Platform-Controlled Fields (Deneb Must Respect)

These fields are managed by Fivora and must NOT have visual editing markers:
- `__fivoraIntake.*` (tone, language, business summary, reference URL)
- `additionalPages[*].id`, `additionalPages[*].route`
- `common.*` (currency, whatsapp, email, address, contact, hours, newsletter)
- `contact.*` (phone, map link, whatsapp)
- `products[*].id`, `products[*].isAvailable`, `products[*].measurement`, `products[*].unit`, `products[*].currency`
- `testimonials[*].id`, `categories[*].slug`, `services[*].id`
- `about.collageImages[*].id`

---

## 7. EXISTING DEMO STOREFRONTS

The `deneb/` directory contains several demo storefronts that have been converted with ARC:

| Storefront | Industry | Location |
|-----------|----------|----------|
| `car-sale` | Automotive sales | `deneb/car-sale/` |
| `coffee` | Coffee shop | `deneb/coffee/` |
| `mobile-shop` | Mobile phone sales | `deneb/mobile-shop/` |
| `restu-web` | Restaurant | `deneb/restu-web/` |
| `salon-web` | Beauty salon | `deneb/salon-web/` |
| `shoe` | Shoe store | `deneb/shoe/` |
| `ui` | Main documentation/demo site | `deneb/ui/` |

---

## 8. CURRENT TECHNICAL DEBT & KNOWN LIMITATIONS

1. **transformer.cjs is 2,752 lines / 101KB** — The largest single file, increasingly difficult to maintain
2. **CJS modules** — The ARC engine uses CommonJS (.cjs), not ESM
3. **No unit tests per module** — Only one monolithic 116KB test file for the entire ARC engine
4. **No TypeScript in ARC** — The ARC engine is all plain JavaScript (.cjs files)
5. **Template support limited to Next.js** — No Vite/Remix/Astro template support
6. **Recipe system (v2) is minimal** — Only basic recipe matching, needs more industry-specific recipes
7. **Adapter system** — Works well for known libraries but struggles with custom component libraries
8. **AI Agent** — Dependent on OpenAI API key, no fallback LLM support
9. **No hot-reload support** in template lab
10. **Font system** — Limited to Google Fonts, no custom font upload

---

## 9. WHAT TO DEVELOP NEXT — OPEN QUESTIONS FOR YOU

Given the constraints (can only modify Deneb, cannot change Fivora-main), please advise on the following:

### 9.1 Priority Features to Consider
1. **More editable components** — What additional component types would increase template versatility?
2. **Industry-specific recipe packs** — Should we create specialized recipes for restaurants, salons, e-commerce, etc.?
3. **Framework expansion** — Should we support Vite, Remix, or Astro in addition to Next.js?
4. **Transformer modularization** — Should we split the 2,752-line transformer.cjs into smaller modules?
5. **TypeScript migration of ARC** — Should we rewrite ARC in TypeScript?
6. **ESM migration** — Should we move from CJS to ESM modules?
7. **Better testing strategy** — Should we split the monolithic test into per-module tests?
8. **Plugin system for ARC** — Allow third-party adapter/recipe contributions?
9. **More AI capabilities** — More AI-assisted template optimization? Different LLM support?
10. **Performance optimization** — Is ARC fast enough for large projects?
11. **Documentation** — What documentation improvements would help adoption?
12. **Versioning strategy** — Should we move to semantic versioning with changelogs?
13. **Editor/IDE integration** — VSCode extension for Deneb development?
14. **Analytics/Telemetry** — Optional telemetry for understanding usage patterns?
15. **New component categories** — Blog, portfolio, booking, real-estate, education?

### 9.2 Questions I Need Help Answering
- What is the **highest-impact feature** we should build next to increase adoption?
- Are there **architectural improvements** that would make the codebase more maintainable?
- Should we **prioritize breadth** (more components, more frameworks) or **depth** (better accuracy, more adapters)?
- What **testing strategy** would give us the most confidence?
- Are there **industry best practices** from similar tools (e.g., Builder.io, Framer, Webflow) we should learn from?

---

## 10. TECHNOLOGY STACK SUMMARY

| Layer | Technology |
|-------|-----------|
| Language | JavaScript (CJS) + TypeScript |
| Framework Support | Next.js (App Router + Pages Router) |
| AST Parsing | `@babel/parser` + `recast` |
| AI Integration | OpenAI API (GPT-4o-mini) |
| Component Library | React 18/19, TypeScript |
| Style Engine | CSS Variables, DOM patching |
| Font System | Google Fonts registry |
| Package Management | npm workspaces (monorepo) |
| CI/CD | GitHub Actions |
| Publishing | npm with provenance |
| Testing | Node.js native test runner |
| GitHub Automation | @octokit/rest |

---

*This document was generated from the actual codebase at D:\OFFICE\deneb\core on September 24, 2026. All line counts, file sizes, and feature descriptions are based on the current state of the code.*
