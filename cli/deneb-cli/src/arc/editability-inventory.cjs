'use strict';

const { isEditableClassification } = require('./data-classification.cjs');

/**
 * EditabilityInventory (P2 & P3)
 * 
 * Computes an inventory of all visible content nodes discovered before transformation,
 * classifying them into:
 * - EXPECTED_EDITABLE
 * - PLATFORM_CONTROLLED
 * - RUNTIME_DATA
 * - DECORATIVE
 * - INTERACTION_STATE
 * 
 * Guarantees that "100% editable" strictly measures 100% of expected merchant content,
 * enforcing the "No candidate lost" invariant.
 */

const INVENTORY_TIERS = {
  EXPECTED_EDITABLE: 'EXPECTED_EDITABLE',
  PLATFORM_CONTROLLED: 'PLATFORM_CONTROLLED',
  RUNTIME_DATA: 'RUNTIME_DATA',
  DECORATIVE: 'DECORATIVE',
  INTERACTION_STATE: 'INTERACTION_STATE',
};

function buildEditabilityInventory(candidates = []) {
  const items = [];
  let expectedEditableCount = 0;
  let platformControlledCount = 0;
  let runtimeDataCount = 0;
  let decorativeCount = 0;
  let interactionStateCount = 0;

  for (const c of candidates) {
    const classification = c.dataClassification || 'CONTENT_STATIC';
    let tier = INVENTORY_TIERS.EXPECTED_EDITABLE;

    if (classification === 'PLATFORM_CONTROLLED') {
      tier = INVENTORY_TIERS.PLATFORM_CONTROLLED;
      platformControlledCount++;
    } else if (classification === 'RUNTIME_COMPUTED' || classification === 'HARDCODED_UNSAFE') {
      tier = INVENTORY_TIERS.RUNTIME_DATA;
      runtimeDataCount++;
    } else if (classification === 'INTERACTION_STATE') {
      tier = INVENTORY_TIERS.INTERACTION_STATE;
      interactionStateCount++;
    } else if (c.isDecorative || classification === 'STYLE_TOKEN') {
      tier = INVENTORY_TIERS.DECORATIVE;
      decorativeCount++;
    } else if (isEditableClassification(classification)) {
      tier = INVENTORY_TIERS.EXPECTED_EDITABLE;
      expectedEditableCount++;
    } else {
      tier = INVENTORY_TIERS.EXPECTED_EDITABLE;
      expectedEditableCount++;
    }

    items.push({
      loc: c.loc,
      file: c.file,
      tag: c.tag,
      kind: c.kind,
      tier,
      classification,
    });
  }

  return {
    totalDiscovered: candidates.length,
    expectedEditableCount,
    platformControlledCount,
    runtimeDataCount,
    decorativeCount,
    interactionStateCount,
    items,
  };
}

module.exports = {
  INVENTORY_TIERS,
  buildEditabilityInventory,
};
