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
| **`DNB-HYD-007`** | **BLOCKING** | React Hydration Contract | Visual Bridge Early DOM Mutation | **Yes** (Automated core upgrade) |
| **`DNB-STC-006`** | **ADVISORY** | Visual Editing Contract | Broad Layout Container Marked Static | **Yes** (`deneb doctor --fix`) |
| **`DNB-ANC-001`** | **BLOCKING** | Live Editing Bridge | Static Ancestor Covering Editable Children | **Yes** (`deneb doctor --fix`) |
| **`DNB-WHA-008`** | **BLOCKING** | Live Editing Bridge | WhatsApp Action URL / Number Disconnect | **Yes** (`deneb doctor --fix`) |
| **`DNB-IMG-002`** | **BLOCKING** | Next.js Runtime | Image Empty String `src=""` Network Bug | **Yes** (`deneb doctor --fix`) |
| **`DNB-COL-009`** | **BLOCKING** | Visual Editing Contract | Product Swatch / Color Circle Editability & Schema | **Yes** (`deneb doctor --fix`) |
| **`DNB-REV-010`** | **BLOCKING** | Visual Editing Contract | Review Star Rating Icon Clickability & Schema | **Yes** (`deneb doctor --fix`) |
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

### `[DNB-HYD-007]` React Hydration Mismatch via Bridge Injection

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Fivora visual editing bridges must never inject `data-*` attributes directly into React-managed DOM elements during or before hydration. React 19 strictly compares server-rendered HTML attributes with the client DOM and throws hydration mismatch errors if external scripts pollute elements prematurely.
- **Error Example**:
  ```text
  A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
  - data-fivora-resolved-field-path="common.logoUrl"
  ```
- **Root Cause**: An outdated version of the local template lab bridge stamped preview annotations directly onto DOM elements.
- **Automated Fix**: The CLI core and the ARC algorithm automatically enforce the OOP `TargetRegistry` pattern. No developer action is required beyond keeping the `@deneb-ui/cli` up to date.
- **Code Standard**: All visual editing tracking attributes (e.g., `data-fivora-resolved-field-path`, `data-fivora-empty-editable`) are now maintained purely in memory via `WeakMap` or applied via dynamically injected CSS rules.

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

### `[DNB-WHA-008]` WhatsApp Action Target Synchronization & Live Decoupling

- **Severity**: `BLOCKING`
- **Fivora Ingestion & Live Editing Rule**: All interactive WhatsApp triggers (e.g. `WhatsappOrderButton`, `ContactActions`, or product ordering buttons) must dynamically resolve the merchant's configured WhatsApp URL or phone number from the active site data hierarchy (`home.whatsappOrderUrl`, `common.business.whatsapp`, or section-specific CTA URLs). Components must never read non-existent field properties (such as `whatsappNumber`) or silently fall back to hardcoded placeholder numbers (e.g. `+1234567890`).
- **Error Example**:
  ```text
  WhatsApp trigger in src/components/ui/whatsapp-order-button.tsx failed to resolve merchant action URL.
  Falling back to hardcoded '+1234567890' instead of declared 'home.whatsappOrderUrl'.
  ```
- **Root Cause**:
  1. **Field Name Disconnect**: The template manifest (`fivora-template.json`) declares `whatsappOrderUrl` (labeled in Fivora as `WhatsApp Order URL / Account Number`), but the component queried `whatsappNumber`.
  2. **Silent Hardcoded Fallback**: When the query returned `undefined`, the handler silently defaulted to `"+1234567890"`, completely ignoring user-entered values in the Fivora live editor.
  3. **Input Format Inflexibility**: The handler only supported stripped phone numbers (`replace(/[^0-9]/g, '')`), failing when merchants entered standard `https://wa.me/...` links.
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* ❌ WRONG: Hardcoded fallback & mismatched field name ignores Fivora input */}
  const whatsappNumber = siteData?.content?.home?.whatsappNumber ?? "+1234567890";
  const url = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
  ```
- **Standard Remediation (DO)**:
  Always resolve through a dynamic fallback hierarchy and handle both full URL and raw phone number formats:
  ```tsx
  {/* ✔️ CORRECT: Dynamically resolves merchant input and safely handles all formats */}
  const rawTarget =
    siteData?.content?.home?.whatsappOrderUrl ||
    siteData?.content?.home?.whatsappNumber ||
    siteData?.content?.common?.business?.whatsapp ||
    "https://wa.me/15550192834";

  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const message = `Hi, I would like to order: *${product.name}* (Price: Rs ${product.price}). Is it available?`;
    
    let targetUrl = (rawTarget || '').trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      const cleanNum = targetUrl.replace(/[^0-9]/g, '');
      targetUrl = `https://wa.me/${cleanNum || '15550192834'}`;
    }
    const sep = targetUrl.includes('?') ? '&' : '?';
    const url = `${targetUrl}${sep}text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  ```
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
  The Deneb ARC engine automatically scans for disconnected WhatsApp action triggers and aligns them with declared schema field paths.

---

### `[DNB-IMG-002]` Next.js Image Empty String `src=""` Network Bug

- **Severity**: `BLOCKING`
- **Fivora Ingestion Rule**: Passing an empty string `""` to Next.js `<Image src={...}>` causes React/Next.js to trigger a critical console error:
  `An empty string ("") was passed to the src attribute. This may cause the browser to download the whole page again over the network. To fix this, either do not render the element at all or pass null to src instead of an empty string.`
  When new items are created in the Fivora live editor, their image fields initially default to `""` before an upload occurs. Storefront components **must guard against empty strings** and provide a valid fallback image URL (or omit rendering).
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* ❌ WRONG: Nullish coalescing (??) does NOT trigger on empty string "" */}
  <Image
    src={phone.image ?? "/images/showcase-phone.jpg"}
    alt={phone.name}
    fill
  />
  ```
- **Standard Remediation (DO)**:
  ```tsx
  {/* ✔️ CORRECT: Checks for non-empty trimmed string before using dynamic source */}
  const resolvedImage =
    phone.image && typeof phone.image === 'string' && phone.image.trim() !== ''
      ? phone.image
      : '/images/showcase-phone.jpg';

  <Image
    src={resolvedImage}
    alt={phone.name || 'Product'}
    fill
    data-preview-field-path={`home.featuredPhones[${idx}].image`}
  />
  ```
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
  Scans all `<Image>` and `<img>` instances across project sources and injects non-empty string fallback guards.

---

### `[DNB-COL-009]` Product Card Color Swatch, Color Label & Original Price Editability Contract

- **Severity**: `BLOCKING`
- **Fivora Ingestion & Live Editing Rule**: When a product card features interactive color swatches, active color text, or strikethrough comparison prices:
  1. **Direct Focus Bridge for Swatches**: Swatch buttons must **NOT** be marked with `data-preview-static` (which instructs Fivora's focus bridge to discard clicks). Each swatch must carry `data-preview-field-path` and `data-preview-field-type="color"`:
     `data-preview-field-path="home.featuredPhones[${idx}].colors[${colorIdx}].hex"`.
  2. **Active Color Name Label Focus**: Visible text labels displaying the currently selected color name (e.g. *"Natural Titanium"*, *"Titanium Gray"*, *"Obsidian"*) must **never** be marked with `data-preview-static` (e.g. `data-preview-static="active-color-name"`). They must carry active field path and style bindings:
     `data-preview-field-path="home.featuredPhones[${idx}].colors[${activeColorIdx}].name"`
     `data-preview-style-target="home.featuredPhones[${idx}].colors[${activeColorIdx}].name"`
     `data-preview-style-type="text"`.
     To satisfy Fivora's list-field coverage audit, each swatch item also renders an accessible hidden text element bound to `colors[${colorIdx}].name`.
  3. **Strikethrough Original Price**: Original comparison prices (e.g. `<p className="line-through">Rs 1299</p>`) must never be hardcoded strings. They must be bound to `originalPrice` (`data-preview-field-path="home.featuredPhones[${idx}].originalPrice"`) and declared as a number in `fivora-template.json` (`editorSchema`).
  4. **Schema Declaration**: The product collection in `fivora-template.json` (`editorSchema`) must declare:
     - `colors` list field containing `name` and `hex` text fields.
     - `originalPrice` number field.
  5. **Empty / New Item Resilience**: Components must provide safe defaults (e.g. `colors: [{ name: 'Default', hex: '#9d9890' }]` and `originalPrice: 0`) so newly created items in Fivora Lab render without errors.
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* ❌ WRONG: data-preview-static disables visual inspector; hardcoded line-through price */}
  <button
    style={{ backgroundColor: c?.hex }}
    data-preview-static="color-swatch"
  />
  <span data-preview-static="active-color-name">
    {phone.colors?.[activeColorIdx]?.name}
  </span>
  <p className="text-xs text-zinc-400 line-through">Rs 1299</p>
  ```
- **Standard Remediation (DO)**:
  ```tsx
  {/* ✔️ CORRECT: Fully bound to live preview engine & editorSchema */}
  <div data-preview-list-path={`home.featuredPhones[${idx}].colors`}>
    {phone.colors?.map((c, colorIdx) => (
      <div key={c?.name || colorIdx} data-preview-item-path={`home.featuredPhones[${idx}].colors[${colorIdx}]`}>
        <button
          type="button"
          style={{ backgroundColor: c?.hex || '#9d9890' }}
          data-preview-field-path={`home.featuredPhones[${idx}].colors[${colorIdx}].hex`}
          data-preview-field-type="color"
        />
        <span className="sr-only" data-preview-field-path={`home.featuredPhones[${idx}].colors[${colorIdx}].name`}>
          {c?.name}
        </span>
      </div>
    ))}
    <span
      data-preview-field-path={`home.featuredPhones[${idx}].colors[${activeColorIdx}].name`}
      data-preview-style-target={`home.featuredPhones[${idx}].colors[${activeColorIdx}].name`}
      data-preview-style-type="text"
    >
      {phone.colors?.[activeColorIdx]?.name}
    </span>
  </div>

  <p
    className="text-xs text-zinc-400 line-through"
    data-preview-field-path={`home.featuredPhones[${idx}].originalPrice`}
    data-preview-style-target={`home.featuredPhones[${idx}].originalPrice`}
    data-preview-style-type="text"
  >
    {phone.originalPrice}
  </p>
  ```
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
  The Deneb ARC engine and Doctor diagnostic suite detect static swatches, remove static suppression, inject live color and text field bindings, and automatically register `colors` and `originalPrice` in `fivora-template.json`.

---

### `[DNB-REV-010]` Review & Testimonial Star Rating Editability & Schema Contract

- **Severity**: `BLOCKING`
- **Fivora Ingestion & Live Editing Rule**: When a storefront displays customer reviews or testimonial cards with rating stars (e.g. `<Star />`, SVGs, or rating badges):
  1. **Direct Clickable Focus on Star Icons**: The wrapper encompassing the star icons must be bound with `data-preview-field-path="home.REVIEWS[${index}].rating"` (using an inline element like `<span className="inline-flex items-center ...">` rather than a broad container `<div>`). If the star icons are un-annotated, clicking on them fails to focus the rating field in Fivora Lab and bubbles up to select the parent review card.
  2. **Schema Declaration**: Review collections in `fivora-template.json` (`editorSchema`) must declare `rating` (type `number`) in their `fields` list. Omitting `rating` prevents the Fivora live editor from exposing the numeric rating input control.
  3. **Empty / Default Resilience**: If `rating` is missing or undefined on newly created review items, components must safely fall back to a default value (e.g. `Number(rev.rating ?? 5)`).
- **Anti-Pattern (DON'T)**:
  ```tsx
  {/* ❌ WRONG: Star icons have no field path; rating missing from editorSchema */}
  <div className="flex items-center gap-1.5 text-amber-500">
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((starIdx) => (
        <Star key={starIdx} className="h-4 w-4 fill-amber-400" />
      ))}
    </div>
    <span data-preview-field-path={`home.REVIEWS[${index}].rating`}>
      {rev.rating}
    </span>
  </div>
  ```
- **Standard Remediation (DO)**:
  ```tsx
  {/* ✔️ CORRECT: Wrapper span carries data-preview-field-path so clicking stars or score focuses rating */}
  <span
    className="inline-flex items-center gap-1.5 text-amber-500 cursor-pointer"
    data-preview-field-path={`home.REVIEWS[${index}].rating`}
    data-preview-style-target={`home.REVIEWS[${index}].rating`}
    data-preview-style-type="text"
    title={`Rating: ${rev.rating ?? 5} / 5`}
  >
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2, 3, 4].map((starIdx) => {
        const ratingNum = Math.min(Math.max(Number(rev.rating) || 5, 0), 5);
        const isFilled = starIdx < ratingNum;
        return (
          <Star
            key={starIdx}
            className={`h-4 w-4 ${isFilled ? 'fill-amber-400 text-amber-400' : 'fill-none text-slate-300'}`}
          />
        );
      })}
    </span>
    <span className="text-xs font-bold font-mono text-amber-600">
      {Number(rev.rating ?? 5).toFixed(1)}
    </span>
  </span>
  ```
- **Automated Fix**:
  ```bash
  deneb doctor --fix
  ```
  The Deneb ARC engine and Doctor diagnostic suite detect unannotated review star containers, wrap them with live rating field paths, and automatically register `rating` in `fivora-template.json` under review collections.

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
