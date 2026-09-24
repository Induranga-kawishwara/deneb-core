export type DataClassificationType =
  | 'CONTENT'
  | 'COMMERCE_CONTENT'
  | 'PLATFORM_CONTROLLED'
  | 'RUNTIME_DATA'
  | 'COMPUTED_DATA'
  | 'DECORATIVE'
  | 'INTERACTION_STATE';

export interface DataClassificationResult {
  classification: DataClassificationType;
  editable: boolean;
  reason: string;
  isPlatformControlled: boolean;
}

export interface CandidateContext {
  file?: string;
  componentName?: string;
  tag?: string;
  role?: string;
  propName?: string;
  fieldPath?: string;
  bindings?: Map<string, unknown> | Record<string, unknown>;
}

export declare const DATA_CLASSIFICATION: Record<DataClassificationType, DataClassificationType>;

export declare function classifyDataCandidate(
  candidate: {
    tag?: string;
    kind?: string;
    value?: unknown;
    label?: unknown;
    extra?: Record<string, unknown>;
    propName?: string;
    field?: string;
  },
  context?: CandidateContext
): DataClassificationResult;

export declare function isEditableClassification(classification: DataClassificationType): boolean;
