'use strict';

/**
 * Deneb ARC — Adaptive Refactoring Compiler
 * Modular Transforms Facade
 *
 * This module delegates all transformation passes to the modular `transforms/` pipeline:
 * - `transforms/transform-context.cjs`: AST traversal, node lookup, and attribute helpers
 * - `transforms/primitives/`: Primitive text, image, link, and button transforms
 * - `transforms/components/`: Reusable component, child card, and compound content transforms
 * - `transforms/collections/`: `.map()` list and item path threading
 * - `transforms/assets/`: Tailwind background images and media transforms
 * - `transforms/routing/`: Route page key inference and layout provider wrapping
 * - `transforms/runtime/`: Provider hooks and site data context rewrite
 * - `transforms/healing/`: Marker sanitization and empty-state/modal conditionals
 * - `transforms/element-transform.cjs`: Element-level AST mutation dispatcher
 * - `transforms/index.cjs`: File-level plan execution orchestrator
 */

module.exports = require('./transforms/index.cjs');
