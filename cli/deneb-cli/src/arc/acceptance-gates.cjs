'use strict';

/**
 * Deneb ARC v3 — Production Acceptance Gates Engine
 * Implements the 12-Gate Acceptance Matrix recommended for enterprise Next.js -> Fivora compilation.
 */
const ACCEPTANCE_GATES = {
  SOURCE_ANALYSIS: 'Source Analysis',
  AST_TRANSFORMATION: 'AST Transformation',
  TYPESCRIPT_VALIDATION: 'TypeScript / JS Validation',
  BUILD_SUCCESS: 'Next.js Build',
  FIVORA_CONTRACT: 'Fivora Contract',
  MANIFEST_SITE_DATA: 'Manifest / Site Data',
  RUNTIME_DATA_BINDING: 'Runtime Data Binding',
  RUNTIME_COLLECTION_OPS: 'Runtime Collection Operations',
  RUNTIME_IMAGE_EDITING: 'Runtime Image Editing',
  ROUTE_COVERAGE: 'Route Coverage',
  DESIGN_PRESERVATION: 'Design Preservation',
  CONTROL_ONLY_PROTECTION: 'Control-Only Protection',
};

/**
 * Evaluates compilation metrics against the 12-Gate Acceptance Matrix.
 */
function evaluateAcceptanceGates(metrics = {}) {
  const gates = {
    sourceAnalysis: {
      name: ACCEPTANCE_GATES.SOURCE_ANALYSIS,
      passed: Boolean(metrics.sourceAnalysis?.passed !== false),
      critical: true,
    },
    astTransformation: {
      name: ACCEPTANCE_GATES.AST_TRANSFORMATION,
      passed: Boolean(metrics.astTransformation?.passed !== false),
      critical: true,
    },
    typescriptValidation: {
      name: ACCEPTANCE_GATES.TYPESCRIPT_VALIDATION,
      passed: Boolean(metrics.typescriptValidation?.passed !== false),
      critical: true,
    },
    buildSuccess: {
      name: ACCEPTANCE_GATES.BUILD_SUCCESS,
      passed: Boolean(metrics.buildSuccess?.passed !== false),
      critical: true,
    },
    fivoraContract: {
      name: ACCEPTANCE_GATES.FIVORA_CONTRACT,
      passed: Boolean(
        metrics.fivoraAudit?.passed === true ||
        metrics.fivoraContract?.passed === true ||
        (metrics.fivoraAudit === undefined && metrics.fivoraContract === undefined)
      ),
      critical: true,
    },
    manifestSiteData: {
      name: ACCEPTANCE_GATES.MANIFEST_SITE_DATA,
      passed: Boolean(metrics.manifestValid !== false),
      critical: true,
    },
    runtimeDataBinding: {
      name: ACCEPTANCE_GATES.RUNTIME_DATA_BINDING,
      passed: Boolean((metrics.runtimeEditabilityScore ?? 100) >= 98),
      critical: true,
    },
    runtimeCollectionOps: {
      name: ACCEPTANCE_GATES.RUNTIME_COLLECTION_OPS,
      passed: Boolean(metrics.collectionOpsPassed !== false),
      critical: true,
    },
    runtimeImageEditing: {
      name: ACCEPTANCE_GATES.RUNTIME_IMAGE_EDITING,
      passed: Boolean(metrics.imageEditingPassed !== false),
      critical: false,
    },
    routeCoverage: {
      name: ACCEPTANCE_GATES.ROUTE_COVERAGE,
      passed: Boolean(metrics.routeCoveragePassed !== false),
      critical: false,
    },
    designPreservation: {
      name: ACCEPTANCE_GATES.DESIGN_PRESERVATION,
      passed: Boolean((metrics.designPreservationScore ?? 100) >= 98),
      critical: false,
    },
    controlOnlyProtection: {
      name: ACCEPTANCE_GATES.CONTROL_ONLY_PROTECTION,
      passed: Boolean(metrics.controlOnlyValid !== false),
      critical: true,
    },
  };

  const criticalGates = Object.values(gates).filter((g) => g.critical);
  const allCriticalPassed = criticalGates.every((g) => g.passed);
  const editabilityCoverage = metrics.editabilityCoverage ?? 100;
  const designPreservation = metrics.designPreservationScore ?? 100;

  // Conversion only passes when all critical gates pass and editability coverage >= 98%
  const conversionPassed = allCriticalPassed && editabilityCoverage >= 98;
  const status = conversionPassed
    ? 'CONVERSION_PASSED'
    : allCriticalPassed
      ? 'CONVERSION_INCOMPLETE'
      : 'CONVERSION_FAILED';

  return {
    passed: conversionPassed,
    status,
    gates,
    allCriticalPassed,
    editabilityCoverage,
    designPreservation,
  };
}

module.exports = {
  ACCEPTANCE_GATES,
  evaluateAcceptanceGates,
};
