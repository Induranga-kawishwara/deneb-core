'use strict';

const ARC_NAME = 'Deneb ARC';
const ARC_FULL_NAME = 'Deneb Adaptive Refactoring Compiler — AI-Augmented';
const ARC_VERSION = '2.2.0';
const SCHEMA_VERSION = 2;
const ENGINE_ID = 'deneb-arc';

const CONFIDENCE = {
  AUTO: 0.85,
  VALIDATE: 0.6,
  SKIP: 0.6,
};

module.exports = {
  ARC_NAME,
  ARC_FULL_NAME,
  ARC_VERSION,
  SCHEMA_VERSION,
  ENGINE_ID,
  CONFIDENCE,
};
