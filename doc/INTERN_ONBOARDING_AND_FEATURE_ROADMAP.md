# DENEB UI Framework — Intern Onboarding, Documentation & Feature Roadmap

> **Status:** Official Engineering Guide  
> **Target Audience:** Engineering Mentors & Interns  
> **Codebase:** `deneb-ui-framework-monorepo` (v2.0.81)  
> **Location:** [`D:\OFFICE\deneb\core`](file:///D:/OFFICE/deneb/core)  
> **Collaboration:** Fivora Visual Editing Platform ([deneb.fivora.site](https://deneb.fivora.site))  

---

## 1. Executive Summary & Program Objectives

This document establishes the official **12-Week Engineering Internship Plan and Documentation Framework** for the DENEB UI project. It is designed to guide an engineering intern through progressive onboarding, production-level component design, real-time iframe communication protocols, and AST-driven compiler engineering in Deneb ARC.

### Core Objectives:
1. **Onboarding & Fluency**: Achieve full familiarity with monorepo lockstep versioning, strict developer error standards, and multi-package testing.
2. **Real-Time Visual Styling**: Master the 0ms CSS variable DOM patcher and `postMessage` preview bridge without triggering full React re-renders.
3. **AST Adaptation Engine**: Contribute robust adapters and heuristic improvements to the `@babel/parser` + `recast` pipeline in Deneb ARC.
4. **Documentation Rigor**: Maintain 100% documentation coverage for every new component, schema field, and error resolution.

---

## 2. Documentation Architecture Plan ("The Docs Plan")

The documentation plan is divided into two distinct tracks: **What the Intern Reads (Study Track)** and **What the Intern Writes (Contribution Track)**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DOCUMENTATION TRACKS                            │
├──────────────────────────────────────┬──────────────────────────────────────┤
│        READ TRACK (INCOMING)         │       WRITE TRACK (OUTGOING)         │
│  - Architecture Overview             │  - Component API Specifications      │
│  - Developer Error Standards         │  - Schema & Visual Marker Docs       │
│  - ARC Algorithm Improvement Plan    │  - Recipe Bank Runbooks              │
│  - Fivora Platform Contract v2       │  - Architecture Decision Records     │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 2.1 The Read Track (Mandatory Study Materials)
Before writing production code, the intern must thoroughly review these existing internal resources:

1. **System & Style Architecture**:
   * [`doc/architecture-overview-the-real-time-style-ecosystem.md`](file:///D:/OFFICE/deneb/core/doc/architecture-overview-the-real-time-style-ecosystem.md)
   * Focus: How `FIVORA_PREVIEW_STYLE_PATCH` bypasses React re-rendering to inject CSS variables directly into DOM nodes.
2. **Error Taxonomy & Diagnosis**:
   * [`doc/DEVELOPER_ERROR_STANDARDS.md`](file:///D:/OFFICE/deneb/core/doc/DEVELOPER_ERROR_STANDARDS.md)
   * Focus: Registry of standard error codes (`DNB-ENG-001`, `DNB-EMP-002`, `DNB-ACT-004`, `DNB-EXP-001`), diagnostic rules, and automated fixes.
3. **ARC Adaptation Blueprint**:
   * [`doc/Deneb ARC — Algorithm Improvement Plan.md`](file:///D:/OFFICE/deneb/core/doc/Deneb%20ARC%20—%20Algorithm%20Improvement%20Plan.md)
   * Focus: The 8-phase execution plan for ARC, AST non-negotiable rules, and deterministic style-bind mapping.

---

### 2.2 The Write Track (Documentation Deliverables Required from Intern)

Whenever the intern touches code, corresponding documentation must be submitted in the same pull request:

| Work Category | Documentation Deliverable | Target Location |
| :--- | :--- | :--- |
| **New UI Component** | Component README, Props Table, Visual Marker Contract, Schema Sample | `packages/deneb-ui/README.md` & Component header JSDoc |
| **New Doctor Auto-Fix** | Standard Error Spec, Root Cause, Diagnosis Logic, Auto-Fix Script | `doc/DEVELOPER_ERROR_STANDARDS.md` |
| **New ARC Adapter / Op** | Adapter Specification, Before/After AST Diff Example | `doc/Deneb ARC — Algorithm Improvement Plan.md` |
| **New Starter Template** | Template Features, Theme Configuration, Preflight Checklist | `packages/create-template/README.md` |
| **Architectural Change** | Architecture Decision Record (ADR) | `doc/adr/ADR-XXXX-<title>.md` |

---

## 3. 12-Week Milestone Breakdown

### Phase 1: Onboarding, Quality Standards & First PR (Weeks 1 – 2)

#### Week 1: Environment Readiness & Architecture Study
* **Reading Focus**:
  * Read [`doc/architecture-overview-the-real-time-style-ecosystem.md`](file:///D:/OFFICE/deneb/core/doc/architecture-overview-the-real-time-style-ecosystem.md).
  * Study `SiteDataProvider.tsx` and `domPatcher.ts`.
* **Technical Tasks**:
  * Clone repository, run `npm install`, `npm run build`, and `npm test` (all 66 test suites must pass).
  * Launch reference template lab:
    ```bash
    cd templates/nextjs
    npm run lab
    ```
* **Docs Deliverable**:
  * Document any setup hiccups or environment nuances in a personal onboarding log.

#### Week 2: Test Suite Hardening & First Pull Request
* **Technical Tasks**:
  * Add unit tests for edge cases in [`packages/deneb-core/src/engine/cssVariables.ts`](file:///D:/OFFICE/deneb/core/packages/deneb-core/src/engine/cssVariables.ts).
  * Address any lint or type warnings in [`cli/deneb-cli/src/tools/deneb-doctor.cjs`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/tools/deneb-doctor.cjs).
* **Docs Deliverable**:
  * PR description formatted with summary, root cause, test evidence, and verification command.

---

### Phase 2: Component Library Expansion & Real-Time Styling (Weeks 3 – 5)

#### Week 3: High-Demand Commerce Components (`EditableCountdownTimer` & `EditableSizeGuide`)
* **Technical Tasks**:
  * Build `EditableCountdownTimer.tsx` for promotional and flash sale banners.
  * Build `EditableSizeGuideModal.tsx` for apparel measurements with responsive tables.
  * Embed proper visual editing markers (`data-fivora-field`, `data-preview-style-target`).
* **Docs Deliverable**:
  * Document props, default site data JSON fixtures, and styling variables in [`packages/deneb-ui/README.md`](file:///D:/OFFICE/deneb/core/packages/deneb-ui/README.md).

#### Week 4: Showcase & Navigation Components (`EditableComparisonTable` & `EditableMegaMenu`)
* **Technical Tasks**:
  * Build `EditableComparisonTable.tsx` for side-by-side product feature specs.
  * Build `EditableMegaMenu.tsx` for responsive multi-level navigation.
* **Docs Deliverable**:
  * Write usage examples with code snippets showing integration with `SiteDataProvider`.

#### Week 5: Accessibility (a11y) & 0ms Style Performance Audit
* **Technical Tasks**:
  * Implement focus trapping, ESC key dismiss, and ARIA roles across all modals and drawers.
  * Benchmark style updates to ensure 0ms DOM response with zero dropped frames.
* **Docs Deliverable**:
  * Add an Accessibility & Performance section to component documentation.

---

### Phase 3: Developer Tooling, Templates & Lab (Weeks 6 – 8)

#### Week 6: Local Visual Lab Enhancements
* **Technical Tasks**:
  * Enhance [`cli/deneb-cli/src/tools/local-template-lab.cjs`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/tools/local-template-lab.cjs).
  * Add a **Responsive Viewport Switcher** (Mobile: 375px, Tablet: 768px, Desktop: 1280px) to the lab toolbar.
  * Add an **Export Tuned site-data.json** button to allow developers to save changes made in the lab.
* **Docs Deliverable**:
  * Update Local Lab guide in [`cli/deneb-cli/README.md`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/README.md).

#### Week 7: New Storefront Starter Template Variant
* **Technical Tasks**:
  * Create a new vertical-specific template (e.g. `luxury-jewelry` or `food-beverage`) in [`packages/create-template`](file:///D:/OFFICE/deneb/core/packages/create-template).
  * Wire the new template into the interactive prompt in `create-template/bin/index.js`.
* **Docs Deliverable**:
  * Write the template's README, including static export verification and live demo instructions.

#### Week 8: Automated Doctor Repair (`deneb doctor --fix`)
* **Technical Tasks**:
  * Expand [`deneb-doctor.cjs`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/tools/deneb-doctor.cjs) to auto-repair missing schema paths (`DNB-SCH-001`) and large uncompressed image warnings.
* **Docs Deliverable**:
  * Update [`doc/DEVELOPER_ERROR_STANDARDS.md`](file:///D:/OFFICE/deneb/core/doc/DEVELOPER_ERROR_STANDARDS.md) marking targeted codes as "Auto-Fix Supported: Yes".

---

### Phase 4: Deneb ARC Adaptation Engine & AST Compiler (Weeks 9 – 11)

#### Week 9: Third-Party Framework Adapters (shadcn/ui & Lucide)
* **Technical Tasks**:
  * Extend [`cli/deneb-cli/src/arc/adapters.cjs`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/arc/adapters.cjs).
  * Support shadcn `Button asChild` wrapping Next.js `<Link>` without action/label collisions.
  * Ensure decorative Lucide icons preserve styling attributes.
* **Docs Deliverable**:
  * Document AST transformation rules and edge cases in [`doc/Deneb ARC — Algorithm Improvement Plan.md`](file:///D:/OFFICE/deneb/core/doc/Deneb%20ARC%20—%20Algorithm%20Improvement%20Plan.md).

#### Week 10: Dynamic Collection & Catalog AST Handling
* **Technical Tasks**:
  * Update [`transformer.cjs`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/arc/transformer.cjs) to differentiate static inline arrays from dynamic API data mapped via `.map()`.
  * Ensure card style bindings `${list}[*].card` are attached without synthesizing artificial dummy items.
* **Docs Deliverable**:
  * Add unit test fixtures and document collection transformation rules in ARC documentation.

#### Week 11: Recipe Engine & Heuristic Calibration
* **Technical Tasks**:
  * Create and calibrate new industry recipes in [`cli/deneb-cli/src/recipes/`](file:///D:/OFFICE/deneb/core/cli/deneb-cli/src/recipes).
  * Verify fingerprint boosts via `deneb init --explain`.
* **Docs Deliverable**:
  * Add a "How to Author and Calibrate Recipes" runbook to the docs folder.

---

### Phase 5: Capstone, Release & Handover (Week 12)

#### Week 12: End-to-End Verification, Release & Demo
* **Technical Tasks**:
  * Execute full monorepo release verification:
    ```bash
    npm run check:lockstep
    npm run check:packages
    npm test
    npm run publish:dry-run
    ```
* **Docs Deliverable**:
  * Finalize **Intern Capstone Report**:
    1. Summary of shipped components and CLI features.
    2. Test coverage metrics and bundle impact analysis.
    3. Recommendations for future development.
* **Capstone Demo**:
  * 20-minute live demonstration for the engineering team.

---

## 4. Definition of Done (DoD) Checklist for All PRs

Before any pull request from the intern is merged into `main`, the mentor must verify:

- [ ] **Tests Green**: `npm test` passes 100% across all monorepo workspaces.
- [ ] **Lockstep Intact**: All packages in `package.json` maintain version parity.
- [ ] **AST Integrity**: ARC transformations make minimal necessary changes; no original Tailwind classes are destroyed.
- [ ] **0ms Style Response**: In-canvas visual editing responds via CSS variables without full page re-renders.
- [ ] **Documentation Included**: READMEs, JSDocs, and error manuals updated.
- [ ] **No Forbidden Assets**: Git and package clean zip excludes `node_modules`, `.next`, `.env*`, and `.git`.

---

## 5. Mentorship Support Structure

| Touchpoint | Frequency | Details |
| :--- | :--- | :--- |
| **Daily Sync** | 15 mins (Daily) | Review yesterday's output, identify blockers, confirm day's goals. |
| **Code Review** | Within 24 hours | Rigorous, constructive feedback focused on architecture and style rules. |
| **Weekly 1:1** | 45 mins (Weekly) | Conceptual deep-dives (AST, Babel, postMessage protocols, career growth). |
| **Mid-Term Review** | End of Week 6 | Progress evaluation, adjustment of remaining milestones. |
