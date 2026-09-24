export interface CanonicalProvenance {
  file?: string;
  component?: string;
  loc?: string;
  kind?: string;
}

export interface CanonicalFieldOptions {
  provenance?: CanonicalProvenance;
  fallbackValue?: unknown;
}

export interface PathValidationResult {
  valid: boolean;
  error?: string;
}

export declare class CanonicalFieldRef {
  readonly path: string;
  readonly canonicalPath: string;
  readonly parts: string[];
  readonly scope: string;
  readonly section: string | null;
  readonly fieldName: string;
  readonly previewPath: string;
  readonly previewMarker: string;
  readonly runtimePath: string;
  readonly runtimeAccessor: string;
  readonly manifestSchemaPath: string;
  readonly diagnosticsId: string;
  readonly provenance: CanonicalProvenance;
  readonly isCollection: boolean;

  constructor(canonicalPath: string, options?: CanonicalFieldOptions);

  toGetterAst(): any;
  toBindingAst(fallbackValue?: unknown): any;
  toPreviewAttrAst(): any;
  toPreviewStyleTargetAst(): any;
  toSetterCode(valueExpr?: string): string;
  toCollectionItem(index: number | string): CanonicalFieldRef;
  toCollectionChild(childProp: string, childIndexExpr?: number | string): CanonicalFieldRef;
  validate(): PathValidationResult;
  static buildNestedItemPath(parentItemPath: string, childProp: string, childIndexExpr?: string): string;
}

export declare function canonicalField(rawPath: string, options?: CanonicalFieldOptions): CanonicalFieldRef;
export declare function fieldRef(canonicalPath: string, options?: CanonicalFieldOptions): CanonicalFieldRef;
export declare function isValidCanonicalPath(canonicalPath: string): boolean;
export declare function validatePathAlignment(getterCode: string, previewAttrCode: string): boolean;
