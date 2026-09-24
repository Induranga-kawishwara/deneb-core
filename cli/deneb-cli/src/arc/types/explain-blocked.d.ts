export interface BlockedFinding {
  ruleId: string;
  category: 'FIVORA_CONTRACT' | 'ACCEPTANCE_GATE' | 'SYNTAX_ERROR' | 'RSC_SAFETY' | 'RUNTIME_DATA';
  severity: 'BLOCKING' | 'WARNING';
  file: string;
  line?: number;
  column?: number;
  snippet?: string;
  message: string;
  remediation: string;
}

export interface BlockedExplanationReport {
  timestamp: string;
  targetDir: string;
  projectName: string;
  blocked: boolean;
  rollbackOccurred: boolean;
  totalBlockingIssues: number;
  criticalGatesPassed: boolean;
  findings: BlockedFinding[];
  summary: {
    contractPassed: boolean;
    acceptanceStatus: string;
    runtimeEditabilityScore?: number;
  };
}

export declare function analyzeBlockedProject(
  targetDir?: string,
  options?: { runId?: string; strict?: boolean }
): BlockedExplanationReport;

export declare function formatBlockedExplanationTerminal(
  report: BlockedExplanationReport
): string;

export declare function printBlockedExplanation(
  report: BlockedExplanationReport,
  options?: { json?: boolean }
): void;
