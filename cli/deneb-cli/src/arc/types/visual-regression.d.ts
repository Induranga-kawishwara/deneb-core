export interface ViewportConfig {
  width: number;
  height: number;
}

export interface ViewportDiffResult {
  viewport: 'mobile' | 'tablet' | 'desktop';
  dimensions: ViewportConfig;
  preservationScore: number;
  pixelDiffCount?: number;
  layoutShiftDetected: boolean;
  discrepancies: string[];
}

export interface VisualRegressionReport {
  mode: 'playwright-screenshot' | 'in-process-layout-simulation';
  passed: boolean;
  overallPreservationScore: number;
  targetThreshold: number;
  viewports: {
    mobile: ViewportDiffResult;
    tablet: ViewportDiffResult;
    desktop: ViewportDiffResult;
  };
  routesTested: string[];
  blockingIssues: string[];
}

export declare const STANDARD_VIEWPORTS: {
  mobile: ViewportConfig;
  tablet: ViewportConfig;
  desktop: ViewportConfig;
};

export declare function calculateVisualPreservation(
  beforeSnapshot: any,
  afterSnapshot: any,
  options?: { threshold?: number; viewports?: ('mobile' | 'tablet' | 'desktop')[] }
): VisualRegressionReport;

export declare function runVisualRegressionTest(options: {
  url?: string;
  projectDir?: string;
  beforeCode?: string;
  afterCode?: string;
  routes?: string[];
  threshold?: number;
  headless?: boolean;
}): Promise<VisualRegressionReport>;
