export type InteractivePatternType =
  | 'NAVBAR_MOBILE_TOGGLE'
  | 'ACCORDION'
  | 'TABS'
  | 'MODAL_DIALOG'
  | 'CAROUSEL'
  | 'CART_DRAWER'
  | 'FORM_SUBMIT'
  | 'DROPDOWN_MENU';

export interface InteractivePatternCheck {
  pattern: InteractivePatternType;
  component: string;
  triggerSelector?: string;
  targetSelector?: string;
  passed: boolean;
  reason?: string;
}

export interface InteractionVerificationReport {
  mode: 'playwright-behavioral' | 'ast-event-integrity-simulation';
  passed: boolean;
  interactionScore: number;
  totalTested: number;
  passedTests: number;
  failedTests: number;
  patterns: InteractivePatternCheck[];
}

export declare const INTERACTIVE_PATTERNS: Record<InteractivePatternType, InteractivePatternType>;

export declare function verifyInteractions(options: {
  url?: string;
  projectDir?: string;
  ast?: any;
  code?: string;
  headless?: boolean;
}): Promise<InteractionVerificationReport>;

export declare function verifyInteractionsSync(options: {
  projectDir?: string;
  files?: Array<{ file: string; code: string }>;
}): InteractionVerificationReport;
