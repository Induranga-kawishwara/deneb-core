export type AcceptanceGateName =
  | 'Source Analysis'
  | 'AST Transformation'
  | 'TypeScript / JS Validation'
  | 'Next.js Build'
  | 'Fivora Contract'
  | 'Manifest / Site Data'
  | 'Runtime Data Binding'
  | 'Runtime Collection Operations'
  | 'Runtime Image Editing'
  | 'Route Coverage'
  | 'Design Preservation'
  | 'Control-Only Protection';

export interface GateResult {
  name: AcceptanceGateName;
  passed: boolean;
  critical: boolean;
  details?: string;
}

export type ConversionStatus = 'CONVERSION_PASSED' | 'CONVERSION_INCOMPLETE' | 'CONVERSION_FAILED';

export interface AcceptanceEvaluation {
  passed: boolean;
  status: ConversionStatus;
  gates: Record<string, GateResult>;
  allCriticalPassed: boolean;
  editabilityCoverage: number;
  designPreservation: number;
}

export declare const ACCEPTANCE_GATES: Record<string, AcceptanceGateName>;

export declare function evaluateAcceptanceGates(metrics: {
  sourceAnalysis?: { passed?: boolean };
  astTransformation?: { passed?: boolean };
  typescriptValidation?: { passed?: boolean };
  buildSuccess?: { passed?: boolean };
  fivoraAudit?: { passed?: boolean };
  fivoraContract?: { passed?: boolean };
  manifestValid?: boolean;
  runtimeEditabilityScore?: number;
  collectionOpsPassed?: boolean;
  imageEditingPassed?: boolean;
  routeCoveragePassed?: boolean;
  designPreservationScore?: number;
  controlOnlyValid?: boolean;
  editabilityCoverage?: number;
}): AcceptanceEvaluation;
