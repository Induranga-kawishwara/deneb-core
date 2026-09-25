'use strict';

/**
 * TransformProof (P8, P9, P10)
 * 
 * Formal evidence record for every AST mutation executed by ARC.
 * Captures source provenance, target schema paths, preconditions,
 * and multi-stage verification proofs.
 */

class TransformProof {
  constructor({
    transformId,
    type,
    source = {},
    target = {},
    preconditions = [],
    verification = {},
  }) {
    this.transformId = transformId || `tr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.type = type; // 'TEXT_BIND' | 'ACTION_SPLIT' | 'COLLECTION_BIND' | 'IMAGE_BIND' | 'STYLE_BIND'
    this.source = {
      file: source.file || '',
      loc: source.loc || '',
      tag: source.tag || '',
      originalText: source.originalText || '',
    };
    this.target = {
      path: target.path || '',
      type: target.type || 'text',
      section: target.section || '',
    };
    this.preconditions = Array.isArray(preconditions) ? preconditions : [];
    this.verification = {
      astParsed: Boolean(verification.astParsed ?? true),
      contractValid: Boolean(verification.contractValid ?? true),
      runtimeTestable: Boolean(verification.runtimeTestable ?? true),
      designPreserved: Boolean(verification.designPreserved ?? true),
    };
    this.timestamp = Date.now();
  }

  isVerified() {
    return (
      this.verification.astParsed &&
      this.verification.contractValid &&
      this.verification.designPreserved
    );
  }

  toJSON() {
    return {
      transformId: this.transformId,
      type: this.type,
      source: this.source,
      target: this.target,
      preconditions: this.preconditions,
      verification: this.verification,
      timestamp: this.timestamp,
    };
  }
}

class ProofRegistry {
  constructor() {
    this.proofs = [];
  }

  record(proofData) {
    const proof = new TransformProof(proofData);
    this.proofs.push(proof);
    return proof;
  }

  getAll() {
    return [...this.proofs];
  }

  getVerified() {
    return this.proofs.filter((p) => p.isVerified());
  }

  verifyPhaseInvariants({ plannedCount, boundCount, schemaPathCount }) {
    const violations = [];

    // Invariant 1: Every planned transformation must emit a proof
    if (this.proofs.length < plannedCount) {
      violations.push(`Phase Invariant Violation: Planned ${plannedCount} transforms, but only emitted ${this.proofs.length} proofs.`);
    }

    // Invariant 2: Every verified proof must have a non-empty target path
    const emptyTargets = this.proofs.filter((p) => !p.target.path);
    if (emptyTargets.length > 0) {
      violations.push(`Phase Invariant Violation: Found ${emptyTargets.length} proofs with empty target paths.`);
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  toJSON() {
    return this.proofs.map((p) => (typeof p.toJSON === 'function' ? p.toJSON() : p));
  }
}

module.exports = {
  TransformProof,
  ProofRegistry,
};
