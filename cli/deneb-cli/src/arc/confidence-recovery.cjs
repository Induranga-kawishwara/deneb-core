'use strict';

/**
 * ConfidenceRecovery (P1)
 * 
 * Multi-stage recovery pipeline to elevate low-confidence (< 0.60) content candidates
 * that are visibly merchant-facing but received conservative scores.
 * Replaces the binary < 0.60 = SKIP with contextual evidence gathering.
 */

function recoverCandidateConfidence(candidate, context = {}) {
  if (!candidate || candidate.skip) return { confidence: candidate.confidence || 0, recovered: false, boost: 0 };

  const initialScore = candidate.confidence || 0;
  if (initialScore >= 0.85) {
    return { confidence: initialScore, recovered: false, boost: 0 };
  }

  let totalBoost = 0;
  const reasons = [];

  const tag = String(candidate.tag || '').toLowerCase();
  const componentName = String(candidate.componentName || '');
  const parentName = String(candidate.parentName || '');
  const className = String(candidate.className || '');
  const value = String(candidate.value || candidate.label || '').trim();

  // Stage 1: Element Semantics
  // Prominent text elements, semantic heading tags, or semantic component names
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
    totalBoost += 0.20;
    reasons.push('semantic-heading-tag');
  } else if (['p', 'blockquote', 'article'].includes(tag)) {
    totalBoost += 0.12;
    reasons.push('semantic-text-tag');
  } else if (/(?:Title|Heading|Headline|Banner|Caption|Badge|Promo|Notice)/i.test(componentName || tag)) {
    totalBoost += 0.18;
    reasons.push('semantic-component-name');
  } else if (/(?:Label|Button|Cta|Action|Trigger)/i.test(componentName || tag) && value) {
    totalBoost += 0.15;
    reasons.push('action-label-component');
  }

  // Stage 2: Parent Context
  const parentCombined = `${parentName} ${className}`.toLowerCase();
  if (/(?:hero|banner|showcase|intro|spotlight)/i.test(parentCombined)) {
    totalBoost += 0.15;
    reasons.push('hero-or-banner-context');
  } else if (/(?:feature|benefit|card|grid|product|testimonial|review)/i.test(parentCombined)) {
    totalBoost += 0.12;
    reasons.push('card-or-feature-context');
  } else if (/(?:footer|header|nav|announcement)/i.test(parentCombined)) {
    totalBoost += 0.10;
    reasons.push('header-footer-nav-context');
  }

  // Stage 3: Styling Semantics (Tailwind utility tokens)
  if (/\b(?:text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|font-(?:bold|medium|semibold|light|extrabold))\b/.test(className)) {
    totalBoost += 0.12;
    reasons.push('tailwind-typography-token');
  }
  if (/\b(?:leading-|tracking-|line-clamp-)/.test(className)) {
    totalBoost += 0.06;
    reasons.push('tailwind-editorial-token');
  }

  // Stage 4: User-Facing Literal Text Validation
  // If it contains genuine human words (> 2 chars, letters, not technical code or URLs)
  if (value.length > 2 && /[a-zA-Z]{2,}/.test(value) && !value.startsWith('{') && !value.startsWith('http') && !value.startsWith('/')) {
    totalBoost += 0.10;
    reasons.push('valid-human-text-literal');
  }

  const newScore = Math.min(0.92, initialScore + totalBoost);
  const recovered = initialScore < 0.60 && newScore >= 0.60;

  return {
    confidence: newScore,
    recovered,
    boost: totalBoost,
    reasons,
  };
}

module.exports = {
  recoverCandidateConfidence,
};
