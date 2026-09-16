# DENEB & FIVORA DEVELOPER ERROR ARCHITECTURE & STANDARDS MANUAL

> **Version**: 2.2.0  
> **Target Runtime**: Node.js 20 LTS / Next.js 15+ / Fivora Visual Editing v2 Strict  
> **Authors**: Deneb Architecture & System Engineering  
> **Status**: Official Engineering Standard  

---

## 1. Executive Summary & Purpose

This standard establishes the **official developer error taxonomy, diagnosis rules, and automated remediation contracts** for all Deneb storefront templates deployed to the Fivora live commerce platform.

By following this standard:
1. **Zero Recurring Errors**: Every known runtime incompatibility, contract collision, or preflight failure is diagnosed at the earliest possible stage.
2. **Standardized Identification**: Every failure condition carries an unambiguous error code (`DNB-XXX-###`), exact line-level diagnosis, root cause explanation, and automated remediation command.
3. **Automated Algorithmic Correction**: The Deneb ARC engine and `deneb doctor --fix` automatically repair compliant issues without manual developer overhead.

---

## 2. Standard Error Code Registry

| Error Code | Severity | Category | Short Title | Auto-Fix Supported |
|---|---|---|---|---|
| **`DNB-ENG-001`** | **BLOCKING** | Platform Runtime | Node 20 LTS Dependency Compatibility | **Yes** (`deneb doctor --fix`) |
| **`DNB-EMP-002`** | **BLOCKING** | Visual Editing Contract | Empty-State Singleton Field Unmounted | **Yes** (Fallback container) |
| **`DNB-ARR-003`** | **BLOCKING** | Visual Editing Contract | Empty-State Array Out-of-Range Elements | **Yes** (Array guard pattern) |
| **`DNB-ACT-004`** | **BLOCKING** | Live Editing Bridge | Action URL vs Visible Text Label Collision | **Yes** (`deneb doctor --fix`) |
| **`DNB-HID-005`** | **BLOCKING** | Visual Editing Contract | Forbidden Hidden Marker / Regex Collision | **Yes** (`deneb doctor --fix`) |
| **`DNB-STC-006`** | **ADVISORY** | Visual Editing Contract | Broad Layout Container Marked Static | **Yes** (`deneb doctor --fix`) |
| **`DNB-ANC-001`** | **BLOCKING** | Live Editing Bridge | Static Ancestor Covering Editable Children | **Yes** (`deneb doctor --fix`) |
| **`DNB-EXP-001`** | **BLOCKING** | Next.js Build | Missing Static Export Configuration | **Yes** (`deneb doctor --fix`) |
| **`DNB-IMG-001`** | **BLOCKING** | Next.js Build | Missing Image Unoptimized Export Setting | **Yes** (`deneb doctor --fix`) |
| **`DNB-MNF-001`** | **BLOCKING** | Manifest v2 | Manifest Schema or Version Invalid | **No** (Manual config) |
| **`DNB-RTE-001`** | **BLOCKING** | Route Architecture | Manifest Route Missing Filesystem Match | **No** (Create route page) |
| **`DNB-SYN-001`** | **BLOCKING** | Site Data | Site Data JSON Syntax or Path Missing | **No** (Add field to JSON) |
| **`DNB-SCH-001`** | **ADVISORY** | Schema Sync | Source Field Path Missing in editorSchema | **Yes** (`deneb doctor --fix`) |
| **`DNB-AST-002`** | **ADVISORY** | AST Standard | Dynamic Non-Literal Field Marker Expression | **No** (Use literal string) |
| **`DNB-AST-003`** | **ADVISORY** | Performance | Large Public Asset Detected (> 4MB) | **No** (Compress asset) |

---

## 3. Detailed Diagnosis & Remediation Guides

### `[DNB-ENG-001]` Node 20 LTS Platform Engine Incompatibility

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Fivora builds and tests templates under **Node.js 20 LTS**. If `package-lock.json` contains any transitive package declaring `engines.node` requiring `Node >= 22` (e.g. nested `content-type@3.1.0`), validation is aborted immediately.
- **Root Cause**: Modern npm dependency trees resolve newer major packages whose engine requirements exclude Node 20.
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
- **Code Standard**: In `package.json`, inject explicit overrides to enforce compatible versions:
  ```json
  "overrides": {
    "content-type": "2.1.0",
    "@octokit/request": {
      "content-type": "2.1.0"
    }
  }
  ```

---

### `[DNB-EMP-002]` Empty-State Singleton Field Persistence Guard

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Fivora tests templates in empty state (`siteData.content.* = []` or `{}`). Every singleton field declared in `editorSchema` **must remain mounted in the DOM** even when dynamic collections are empty.
- **Error Example**:
  ```text
  Empty-state export removed data-preview-field-path="home.bookRepairCtaLabel".
  Keep the editable target mounted when its value is empty, false, or zero.
  ```
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* WRONG: When services is empty, bookRepairCtaLabel unmounts completely! */}
  {services.map((service, index) => (
    <Card key={service.id}>
      <span data-preview-field-path="home.bookRepairCtaLabel">Book Repair</span>
    </Card>
  ))}
  ```
- **Standard Remediation (DO)**:
  Provide an empty-state container or keep the detail card mounted permanently:
  ```tsx
  {services.length === 0 ? (
    <div className="col-span-full py-12 text-center">
      <span data-preview-field-path="home.bookRepairCtaLabel">Book Repair</span>
    </div>
  ) : (
    services.map((service, index) => ( ... ))
  )}
  ```

---

### `[DNB-ARR-003]` Empty-State Array Out-of-Range Guard

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: During empty-state testing, list fields are set to `[]`. The template must NOT render out-of-range array items (e.g. `[0]`, `[1]`, `[2]`).
- **Error Example**:
  ```text
  Empty-state export emitted out-of-range array item: home.featuredPhones[0].name
  ```
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* WRONG: If liveList is empty array [], this falls back to 6 hardcoded items! */}
  const phones = liveList?.length ? liveList : DEFAULT_PHONES;
  ```
- **Standard Remediation (DO)**:
  Always preserve empty array state when live data is provided as an array:
  ```tsx
  // CORRECT: Respects live array when present (even if empty [])
  const rawPhones = Array.isArray(liveList) ? liveList : DEFAULT_PHONES;
  ```

---

### `[DNB-ACT-004]` Action URL vs Visible Text Label Decoupling

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Interactive triggers (`<a>` and `<button>`) must decouple URL field paths from text label field paths. If a URL path is placed directly on an element with visible text children, live editing updates will overwrite the text/icon children with raw URL strings.
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* WRONG: Overwrites button text and icon when URL is edited */}
  <button data-preview-field-path="home.whatsappOrderUrl">
    <Icon />
    <span>Order via WhatsApp</span>
  </button>
  ```
- **Standard Remediation (DO)**:
  Place the action URL on the interactive trigger or click handler, and place label preview contracts on the inner `<span>`:
  ```tsx
  {/* CORRECT: Clean separation between trigger and label */}
  <button type="button" onClick={handleOrder}>
    <Icon />
    <span
      data-preview-field-path="home.whatsappOrderLabel"
      data-preview-style-target="home.whatsappOrderLabel"
      data-preview-style-type="text"
    >
      {label}
    </span>
  </button>
  ```

---

### `[DNB-HID-005]` Forbidden Hidden Markers & Class Token Collisions

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Preview contract attributes (`data-preview-field-path`, `data-preview-style-target`) must never be placed on hidden elements (`<span hidden>`, `display: none`). Furthermore, responsive or layout classes must not trigger validator token collisions.
- **Token Sanitization Standard**:
  - Replace `overflow-hidden` with `overflow-clip` on container cards.
  - Replace responsive `hidden md:block` with `[display:none] md:[display:block]` on elements containing or wrapping preview contracts.
  - Completely eliminate artificial `<span hidden ...>` markers.

---

### `[DNB-STC-006]` Granular Static Markup

- **Severity**: `ADVISORY`
- **Fivora Ingestion Rule**: `data-preview-static` must only be placed on the smallest leaf elements (icons, badges, small buttons), **never** on broad layout containers (`<div>`, `<section>`, `<nav>`, `<main>`, `<header>`).
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
  Automatically strips broad static annotations from layout elements.

---

## 4. Developer Verification Workflow

To guarantee 100% preflight success before publishing or packaging:

1. **Run Architecture Doctor**:
   ```bash
   deneb doctor
   ```
   *Inspect the Standardized Developer Action Matrix and review any advisory or blocking items.*

2. **Auto-Remediate Supported Errors**:
   ```bash
   deneb doctor --fix
   ```

3. **Validate Fivora Contracts Locally**:
   ```bash
   npm run validate
   ```
   *Runs isolated snapshot packaging, ZIP policy verification, Node 20 compatibility checks, probe fixture validation, real-time style contract verification, and empty-state testing.*

4. **Package Template**:
   ```bash
   npm run zip
   ```
   *Generates `fivora-template.zip` ready for one-click upload to the Fivora creator portal.*
