'use strict';

/**
 * Deneb ARC — AI Agent
 *
 * OpenAI API integration with self-healing validation loop.
 * Generates editable wrapper components for unknown UI components
 * and validates them through ARC's strict pipeline before accepting.
 *
 * Default engine: GPT-4o-mini (configurable via OPENAI_CONTENT_MODEL).
 */

const fs = require('fs');
const path = require('path');
const { parseSource } = require('./ast.cjs');
const { buildComponentPrompt, buildFixPrompt, buildDocsPrompt } = require('./ai-prompts.cjs');

const MAX_RETRIES = 3;

/**
 * Load AI configuration from environment variables.
 * Call loadEnv() before using this if .env is not loaded yet.
 */
function getAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_CONTENT_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS || '4000', 10),
    timeoutMs: parseInt(process.env.OPENAI_CONTENT_TIMEOUT_MS || '120000', 10),
  };
}

/**
 * Load .env file purely locally.
 * Searches upward from targetDir or process.cwd(), supporting local .env and .env.local files.
 * Eliminates the need for any global system configuration.
 *
 * @param {string} [startDir] - Starting directory (defaults to process.cwd())
 */
function loadEnv(startDir) {
  const checked = new Set();
  const candidates = [];

  let curr = path.resolve(startDir || process.cwd());
  for (let i = 0; i < 5; i++) {
    candidates.push(path.join(curr, '.env'));
    candidates.push(path.join(curr, '.env.local'));
    candidates.push(path.join(curr, 'core', '.env'));
    const parent = path.dirname(curr);
    if (parent === curr) break;
    curr = parent;
  }

  candidates.push(path.resolve(__dirname, '..', '..', '..', '..', '.env'));
  candidates.push(path.resolve(__dirname, '..', '..', '.env'));

  for (const envPath of candidates) {
    if (!checked.has(envPath) && fs.existsSync(envPath)) {
      try {
        require('dotenv').config({ path: envPath });
      } catch {
        // dotenv not available — env vars must be set manually
      }
      return;
    }
    checked.add(envPath);
  }
}

/**
 * Check if the AI agent is properly configured and ready to use.
 * @returns {{ ready: boolean, reason?: string }}
 */
function checkAiReady() {
  loadEnv();
  const config = getAiConfig();
  if (!config.apiKey) {
    return { ready: false, reason: 'OPENAI_API_KEY not set. Create a .env file (see .env.example) or set the environment variable.' };
  }
  if (!config.apiKey.startsWith('sk-')) {
    return { ready: false, reason: 'OPENAI_API_KEY does not look valid (should start with sk-).' };
  }
  return { ready: true };
}

/**
 * Call the OpenAI Chat Completions API.
 *
 * Uses native fetch (Node 18+) — no external HTTP library needed.
 *
 * @param {string} prompt - The user prompt
 * @param {object} [opts] - Optional overrides
 * @returns {Promise<{ content: string, inputTokens: number, outputTokens: number }>}
 */
async function callOpenAI(prompt, opts = {}) {
  const config = getAiConfig();
  const model = opts.model || config.model;
  const maxTokens = opts.maxTokens || config.maxTokens;
  const timeoutMs = opts.timeoutMs || config.timeoutMs;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a senior React/TypeScript developer specializing in the DENEB UI framework. Output only raw code — no markdown, no explanations.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`OpenAI API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    if (!choice || !choice.message?.content) {
      throw new Error('OpenAI returned empty response — no content in choices[0].message');
    }

    let content = choice.message.content.trim();
    // Strip markdown fences if the model wraps output despite instructions
    content = content.replace(/^```(?:tsx?|jsx?|typescript|javascript)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    return {
      content,
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate generated component code using ARC's validators.
 *
 * @param {string} code - The generated TypeScript/JSX code
 * @param {string} filename - Virtual filename for error messages
 * @returns {{ passed: boolean, errors: string[] }}
 */
function validateGeneratedCode(code, filename) {
  const errors = [];

  // 1. AST syntax check
  try {
    parseSource(code, filename);
  } catch (err) {
    errors.push(`AST syntax error: ${err.message}`);
  }

  // 2. Must have data-preview-field-path markers
  if (!code.includes('data-preview-field-path')) {
    errors.push('Missing data-preview-field-path markers — the component has no editable fields.');
  }

  // 3. Must have data-preview-item-path on the root wrapper
  if (!code.includes('data-preview-item-path')) {
    errors.push('Missing data-preview-item-path on root wrapper element.');
  }

  // 4. Must have proper TypeScript exports
  if (!code.includes('export function') && !code.includes('export const')) {
    errors.push('Missing named export — component must use `export function Editable...()`.');
  }

  // 5. Must have TypeScript interface
  if (!code.includes('export interface')) {
    errors.push('Missing exported TypeScript interface for component props.');
  }

  // 6. Must import EditableText or EditableImage (at least one)
  if (!code.includes("from './EditableText'") && !code.includes("from './EditableImage'")) {
    errors.push('Must import at least EditableText or EditableImage from relative path.');
  }

  // 7. Must NOT have default export (Deneb convention)
  if (/export\s+default\s+/m.test(code)) {
    errors.push('Must NOT use default export — use named export only (Deneb convention).');
  }

  // 8. Check for forbidden patterns
  if (code.includes('useState') || code.includes('useEffect') || code.includes('useContext')) {
    errors.push('Must NOT import React hooks (useState, useEffect, useContext). Component must be stateless.');
  }

  if (code.includes('useSiteData')) {
    errors.push('Must NOT import useSiteData directly. The wrapper uses EditableText/EditableImage primitives instead.');
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

/**
 * Extract the list of editable field paths from generated component code.
 *
 * @param {string} code - The generated component code
 * @returns {string[]} Array of field path patterns found
 */
function extractFieldPaths(code) {
  const matches = code.matchAll(/data-preview-field-path=\{[`"']([^`"']+)[`"']\}/g);
  const paths = new Set();
  for (const m of matches) {
    // Normalize template literal patterns like `${itemPath}.name`
    const path = m[1].replace(/\$\{[^}]+\}/g, '*');
    paths.add(path);
  }
  return [...paths];
}

/**
 * Main AI adaptation function with self-healing validation loop.
 *
 * @param {string} sourceCode - The unknown component's source code
 * @param {string} componentName - The component name (e.g. "Carousel")
 * @param {object} profile - ARC project profile
 * @param {object} [callbacks] - Optional progress callbacks
 * @param {function} [callbacks.onAttempt] - Called at start of each attempt: (attemptNum, maxRetries)
 * @param {function} [callbacks.onValidationFail] - Called when validation fails: (errors, attemptNum)
 * @param {function} [callbacks.onSuccess] - Called on success: (attemptNum)
 * @returns {Promise<{ success: boolean, code?: string, fields?: string[], attempts: number, totalInputTokens: number, totalOutputTokens: number, error?: string }>}
 */
async function adaptComponent(sourceCode, componentName, profile, callbacks = {}) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Generate initial code
  const prompt = buildComponentPrompt(sourceCode, componentName, profile);
  let lastCode = '';
  let lastErrors = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    if (callbacks.onAttempt) callbacks.onAttempt(attempt, MAX_RETRIES);

    try {
      let result;
      if (attempt === 1) {
        result = await callOpenAI(prompt);
      } else {
        const fixPrompt = buildFixPrompt(lastCode, lastErrors.join('\n'), attempt);
        result = await callOpenAI(fixPrompt);
      }

      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
      lastCode = result.content;

      // Validate the generated code
      const filename = `Editable${componentName}.tsx`;
      const validation = validateGeneratedCode(lastCode, filename);

      if (validation.passed) {
        if (callbacks.onSuccess) callbacks.onSuccess(attempt);
        return {
          success: true,
          code: lastCode,
          fields: extractFieldPaths(lastCode),
          attempts: attempt,
          totalInputTokens,
          totalOutputTokens,
        };
      }

      // Validation failed — prepare for retry
      lastErrors = validation.errors;
      if (callbacks.onValidationFail) callbacks.onValidationFail(validation.errors, attempt);
    } catch (err) {
      lastErrors = [err.message];
      if (callbacks.onValidationFail) callbacks.onValidationFail([err.message], attempt);
    }
  }

  // All retries exhausted
  return {
    success: false,
    attempts: MAX_RETRIES,
    totalInputTokens,
    totalOutputTokens,
    error: `Failed after ${MAX_RETRIES} attempts. Last errors:\n${lastErrors.join('\n')}`,
  };
}

/**
 * Generate documentation page for a successfully adapted component.
 *
 * @param {string} componentName - e.g. "Carousel"
 * @param {string} componentCode - The validated Editable*.tsx source
 * @param {string[]} editableFields - List of field paths
 * @returns {Promise<{ success: boolean, code?: string, error?: string }>}
 */
async function generateDocsPage(componentName, componentCode, editableFields) {
  const prompt = buildDocsPrompt(componentName, componentCode, editableFields);

  try {
    const result = await callOpenAI(prompt);
    return { success: true, code: result.content };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  loadEnv,
  checkAiReady,
  getAiConfig,
  callOpenAI,
  validateGeneratedCode,
  extractFieldPaths,
  adaptComponent,
  generateDocsPage,
  MAX_RETRIES,
};
