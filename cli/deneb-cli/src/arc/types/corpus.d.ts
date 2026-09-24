export interface StorefrontAuditResult {
  templateId: string;
  templateName: string;
  templateDir: string;
  framework: string;
  routerType: string;
  validStructure: boolean;
  fivoraContract: {
    passed: boolean;
    violationCount: number;
    errors: string[];
  };
  runtimeEditability: {
    passed: boolean;
    score: number;
    verifiedFields: number;
    failedFields: number;
  };
  collectionOperations: {
    passed: boolean;
    totalCollections: number;
  };
  interactionPreservation: {
    passed: boolean;
    score: number;
  };
  acceptanceGates: {
    passed: boolean;
    status: 'CONVERSION_PASSED' | 'CONVERSION_INCOMPLETE' | 'CONVERSION_FAILED';
    criticalGatesPassed: boolean;
  };
  passed: boolean;
}

export interface CorpusVerificationReport {
  timestamp: string;
  totalTemplates: number;
  passedTemplates: number;
  failedTemplates: number;
  corpusSuccessRate: number;
  allTemplatesPassed: boolean;
  results: StorefrontAuditResult[];
}

export declare function auditStorefrontTemplate(
  templateDir: string,
  options?: { templateId?: string; templateName?: string }
): StorefrontAuditResult;

export declare function verifyStorefrontCorpus(
  options?: { baseDir?: string; templateIds?: string[] }
): CorpusVerificationReport;
