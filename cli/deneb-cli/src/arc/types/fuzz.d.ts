export type FuzzMutationType =
  | 'PROP_RENAME'
  | 'WRAP_FRAGMENT'
  | 'WRAP_DIV'
  | 'SPREAD_PROPS'
  | 'CONDITIONAL_TERNARY'
  | 'CONDITIONAL_LOGICAL'
  | 'INJECT_OPTIONAL_CHAIN'
  | 'NEST_MEMBER_COLLECTION'
  | 'CORRUPT_SYNTAX';

export interface MutationResult {
  mutationType: FuzzMutationType;
  description: string;
  applied: boolean;
  originalCode: string;
  mutatedCode: string;
}

export interface MutationResilienceResult {
  mutationType: FuzzMutationType;
  description: string;
  parsed: boolean;
  analyzed: boolean;
  transformed: boolean;
  outputValidSyntax: boolean;
  crashed: boolean;
  errorMessage?: string;
  candidatesFound: number;
  transformationsApplied: number;
  status: 'ADAPTED_CLEANLY' | 'SKIPPED_SAFELY' | 'PARSER_REJECTED_CLEANLY' | 'CRASHED';
  resilient: boolean;
}

export interface FuzzHarnessReport {
  timestamp: string;
  totalMutations: number;
  resilientCount: number;
  crashedCount: number;
  syntaxErrorsInOutput: number;
  resilienceScore: number;
  allResilient: boolean;
  results: MutationResilienceResult[];
}

export interface FuzzOptions {
  filePath?: string;
  strict?: boolean;
  mutationTypes?: FuzzMutationType[];
}

export declare const MUTATION_TYPES: readonly FuzzMutationType[];

export declare function applyMutation(
  code: string,
  mutationType: FuzzMutationType,
  options?: { propName?: string; newPropName?: string; spreadName?: string }
): MutationResult;

export declare function generateFuzzCorpus(
  code: string,
  options?: { mutationTypes?: FuzzMutationType[] }
): MutationResult[];

export declare function testMutationResilience(
  mutatedCode: string,
  mutationType: FuzzMutationType,
  options?: FuzzOptions
): MutationResilienceResult;

export declare function runFuzzHarness(
  componentCode?: string,
  options?: FuzzOptions
): FuzzHarnessReport;
