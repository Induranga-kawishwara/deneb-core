export interface RscBoundaryMetrics {
  clientBoundariesBefore: number;
  clientBoundariesAfter: number;
  serverComponentsConverted: number;
  serverComponentsPreserved: number;
  minimalBoundarySuccessRate: number;
  conversionExceededThreshold: boolean;
}

export interface RscValidationResult {
  valid: boolean;
  error?: string;
  metrics: RscBoundaryMetrics;
}

export declare function hasMetadataExport(ast: any): boolean;
export declare function hasClientDirective(ast: any): boolean;
export declare function isAsyncServerComponent(ast: any): boolean;
export declare function needsClientDirective(ast: any, code?: string): boolean;
export declare function canSafelyInjectClientDirective(ast: any, relativeFile?: string, profile?: any): boolean;
export declare function ensureClientDirective(ast: any): boolean;
export declare function calculateMinimalClientBoundary(componentInfo: {
  isAsync?: boolean;
  hasMetadata?: boolean;
  hasHooks?: boolean;
  hasEvents?: boolean;
  isLeaf?: boolean;
}): 'server' | 'client' | 'minimal-wrapper';
export declare function computeRscMetrics(files: Array<{
  file: string;
  hadClientDirective: boolean;
  hasClientDirective: boolean;
  isAsyncServer?: boolean;
  hasMetadata?: boolean;
}>): RscBoundaryMetrics;
export declare function validateRscBoundaryIntegrity(
  metrics: RscBoundaryMetrics,
  maxAllowedConversions?: number
): RscValidationResult;
