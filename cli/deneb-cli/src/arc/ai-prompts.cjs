'use strict';

/**
 * Deneb ARC — AI Prompt Templates
 *
 * Carefully engineered prompt templates that teach GPT-4o-mini the exact
 * Deneb editable component conventions. Uses a real EditableServiceCard
 * as a reference pattern so the AI learns the correct structure.
 */

// ─── Reference component (shortened for token efficiency) ────────
const REFERENCE_COMPONENT = `
import React from 'react';
import { EditableText } from './EditableText';
import { EditableImage } from './EditableImage';

export interface ServiceItem {
  id?: string | number;
  name?: string;
  title?: string;
  price?: string | number;
  description?: string;
  imageUrl?: string;
  image?: string;
  features?: unknown[];
  [key: string]: unknown;
}

export interface EditableServiceCardProps extends React.HTMLAttributes<HTMLElement> {
  itemPath: string;
  service: ServiceItem;
  imageFallback?: string;
  as?: React.ElementType;
  align?: 'left' | 'center' | 'right';
  showPrice?: boolean;
}

export function EditableServiceCard({
  itemPath,
  service,
  imageFallback = '/placeholder.svg',
  as: Component = 'article',
  align = 'left',
  showPrice = true,
  className = '',
  style,
  children,
  ...props
}: EditableServiceCardProps) {
  const name = String(service?.name || service?.title || '');
  const description = String(service?.description || '');
  const imageUrl = String(service?.imageUrl || service?.image || '');

  return (
    <Component
      data-preview-item-path={itemPath}
      className={\`editable-service-card \${className}\`.trim()}
      style={{ textAlign: align, ...style }}
      {...(props as any)}
    >
      <div className="service-card-image-wrap">
        <EditableImage
          id={\`\${itemPath}.imageUrl\`}
          data-preview-field-path={\`\${itemPath}.imageUrl\`}
          src={imageUrl}
          fallbackSrc={imageFallback}
          alt={name}
          className="service-card-image"
        />
      </div>
      <div className="service-card-body">
        <EditableText
          as="h2"
          id={\`\${itemPath}.name\`}
          data-preview-field-path={\`\${itemPath}.name\`}
          defaultValue={name}
          className="service-card-title"
        />
        <EditableText
          as="p"
          id={\`\${itemPath}.description\`}
          data-preview-field-path={\`\${itemPath}.description\`}
          defaultValue={description}
          className="service-card-description"
        />
        {children}
      </div>
    </Component>
  );
}
`.trim();

/**
 * Build the main component generation prompt.
 *
 * @param {string} sourceCode - The unknown component's source code
 * @param {string} componentName - The component's name (e.g. "Carousel")
 * @param {object} profile - ARC project profile (framework, libraries, etc.)
 * @returns {string} The complete prompt for OpenAI
 */
function buildComponentPrompt(sourceCode, componentName, profile) {
  return `You are an expert React/TypeScript developer working on the DENEB UI framework.
Your task is to create an editable wrapper component for an existing component.

## RULES (MANDATORY — violating any rule means the output is rejected):

1. **Import only from relative paths**: Use \`./EditableText\` and \`./EditableImage\` (these are the ONLY two Deneb primitives you may use).
2. **Every user-visible text** must be wrapped in \`<EditableText>\` with:
   - \`as\` prop matching the original HTML tag (h1, h2, p, span, etc.)
   - \`id={\`\${itemPath}.fieldName\`}\`
   - \`data-preview-field-path={\`\${itemPath}.fieldName\`}\`
   - \`defaultValue={value}\`
3. **Every user-visible image** must use \`<EditableImage>\` with:
   - \`id={\`\${itemPath}.fieldName\`}\`
   - \`data-preview-field-path={\`\${itemPath}.fieldName\`}\`
   - \`src={value}\`
   - \`fallbackSrc={imageFallback}\`
4. **Lists/arrays** must have \`data-preview-list-path\` on the container and \`data-preview-item-path\` on each item.
5. **Root wrapper** must have \`data-preview-item-path={itemPath}\`.
6. **Export a TypeScript interface** named \`Editable${componentName}Props\` extending \`React.HTMLAttributes<HTMLElement>\`.
7. **Export a named function** (not default export) named \`Editable${componentName}\`.
8. **Preserve all original CSS classes and styling** — do NOT remove or change className values.
9. **Props must include**: \`itemPath: string\` (required), data object, \`as?: React.ElementType\`, \`className?\`, \`style?\`, \`children?\`.
10. **Use \`'use strict'\` is NOT needed** — this is a .tsx file.
11. **Do NOT import React hooks** like useState, useEffect, useContext. The component must be stateless.
12. **Do NOT import useSiteData** — the wrapper component does not need it directly.
13. **NEVER place data-preview-field-path on <div>, <section>, <article>, or broad containers**. ` + '`data-preview-field-path`' + ` must ONLY be on leaf text/media/control elements (<span>, <p>, <h1>-<h6>, <a>, <button>, EditableText, EditableImage).

## REFERENCE PATTERN (follow this structure exactly):

\`\`\`tsx
${REFERENCE_COMPONENT}
\`\`\`

## SOURCE COMPONENT TO ADAPT:

Component name: ${componentName}
Framework: ${profile.framework || 'nextjs'}
Libraries: ${(profile.componentLibraries || []).join(', ') || 'none detected'}

\`\`\`tsx
${sourceCode}
\`\`\`

## YOUR OUTPUT:

Generate ONLY the complete TypeScript (.tsx) file content for \`Editable${componentName}.tsx\`.
Do NOT include markdown fences, explanations, or comments outside the code.
Output the raw TypeScript code directly.`;
}

/**
 * Build the error-fix prompt when the validator rejects AI-generated code.
 *
 * @param {string} previousCode - The code that failed validation
 * @param {string} errorMessage - The exact validator error
 * @param {number} attempt - Current attempt number
 * @returns {string} The fix prompt
 */
function buildFixPrompt(previousCode, errorMessage, attempt) {
  return `The DENEB ARC validator REJECTED your generated component (attempt ${attempt}/3).

## EXACT ERROR:
${errorMessage}

## YOUR PREVIOUS CODE:
\`\`\`tsx
${previousCode}
\`\`\`

## INSTRUCTIONS:
1. Fix ONLY the specific error described above.
2. Do NOT change anything else — preserve all existing field paths, markers, and class names.
3. Output the COMPLETE corrected .tsx file (not a diff, not a snippet — the full file).
4. Do NOT include markdown fences or explanations. Output raw TypeScript code only.`;
}

/**
 * Build the docs page generation prompt.
 *
 * @param {string} componentName - e.g. "Carousel"
 * @param {string} componentCode - The validated EditableCarousel.tsx source
 * @param {string[]} editableFields - List of field paths discovered
 * @returns {string} The docs prompt
 */
function buildDocsPrompt(componentName, componentCode, editableFields) {
  return `Generate a Next.js documentation page for the DENEB UI component "Editable${componentName}".

## COMPONENT CODE:
\`\`\`tsx
${componentCode}
\`\`\`

## EDITABLE FIELDS:
${editableFields.map((f) => `- ${f}`).join('\n')}

## OUTPUT FORMAT:
Generate a React component that exports a default function named \`Editable${componentName}DocsPage\`.
It should render:
1. A title section with the component name
2. A description paragraph explaining what the component does
3. A props table showing all available props with their types and defaults
4. A usage example code block
5. A list of editable field paths

Use plain HTML/JSX with className for styling. Do NOT import any external UI libraries.
Output raw TSX code only — no markdown fences or explanations.`;
}

module.exports = {
  REFERENCE_COMPONENT,
  buildComponentPrompt,
  buildFixPrompt,
  buildDocsPrompt,
};
