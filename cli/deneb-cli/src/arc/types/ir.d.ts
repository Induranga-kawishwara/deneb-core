export type ClientBoundary = 'server' | 'client' | 'hybrid';

export type DataSourceKind =
  | 'static-literal'
  | 'inline-array'
  | 'imported-json'
  | 'imported-module'
  | 'server-fetch'
  | 'api'
  | 'database'
  | 'computed';

export interface PropsSignature {
  kind: 'none' | 'destructured' | 'identifier' | 'unknown';
  names: string[];
  paramName: string | null;
  typeAnnotationName: string | null;
}

export interface ComponentUsage {
  componentName: string;
  file: string;
  loc: string;
  props: Record<string, unknown>;
}

export interface DenebComponent {
  id: string;
  name: string;
  file: string;
  kind: 'function' | 'arrow' | 'default-export' | 'class';
  isDefault: boolean;
  propsSignature: PropsSignature;
  memberAccesses: Record<string, string[]>;
  usages: ComponentUsage[];
  clientBoundary: ClientBoundary;
  routes: string[];
}

export interface DataSource {
  name: string;
  file: string;
  kind: DataSourceKind;
  items: unknown[];
  fieldKeys: string[];
  editable: boolean;
  sourceFile?: string;
}

export interface CollectionDefinition {
  file: string;
  loc: string;
  rootLoc: string;
  arrayName: string;
  itemParam: string | null;
  indexParam: string | null;
  rootTagName: string;
  isChildCustomComponent: boolean;
  childComponent: DenebComponent | null;
  passedProps: Record<string, string>;
  hasSpreadItem: boolean;
  pipelineChain: string[];
  dataSource: DataSource | null;
}

export interface AssetImport {
  file: string;
  identifier: string;
  publicUrl: string;
}

export interface BackgroundImageUsage {
  file: string;
  loc: string;
  url: string;
  rawClass: string;
}

export interface IRValidationStats {
  componentCount: number;
  dataSourceCount: number;
  collectionCount: number;
  assetCount: number;
  backgroundCount: number;
  usageCount: number;
}

export interface IRValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: IRValidationStats;
}

export interface ProjectIR {
  components: Map<string, DenebComponent>;
  dataSources: Map<string, DataSource>;
  collections: CollectionDefinition[];
  assetImports: Map<string, Map<string, string>>;
  backgroundImages: BackgroundImageUsage[];
  componentUsages: ComponentUsage[];

  getComponent(name: string): DenebComponent | null;
  getDataSource(name: string): DataSource | null;
  getCollectionByLoc(loc: string): CollectionDefinition | null;
  getAssetImport(file: string, identifier: string): string | null;
  getComponentUsages(name: string): ComponentUsage[];
}

export declare function createDenebComponent(def: Partial<DenebComponent> & { name: string; file: string }): DenebComponent;
export declare function createDataSource(def: Partial<DataSource> & { name: string; file: string }): DataSource;
export declare function createCollectionDefinition(def: Partial<CollectionDefinition> & { file: string; arrayName: string }): CollectionDefinition;
export declare function buildProjectIR(profile: any): ProjectIR;
export declare function validateProjectIR(ir: ProjectIR): IRValidationResult;
