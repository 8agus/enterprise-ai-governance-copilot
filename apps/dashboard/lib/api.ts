const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3001"
    : "https://governance-api-esdgerhya5e4ctga.eastasia-01.azurewebsites.net");

export type FindingSeverity = "low" | "medium" | "high";
export type FindingCategory = "security" | "privacy" | "responsible-ai";
export type RiskLevel = "low" | "moderate" | "high";

export type GovernancePolicies = {
  security: Record<string, boolean>;
  privacy: Record<string, boolean>;
  responsible_ai: Record<string, boolean>;
};

export interface AuditSummary {
  score: number;
  riskLevel: RiskLevel;
  totalFindings: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

export interface Findings {
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  items: Array<{
    id: string;
    category: FindingCategory;
    severity: FindingSeverity;
    title: string;
    evidence: string;
    recommendation: string;
    fileReference?: string;
    filePath?: string;
  }>;
  auditSummary?: AuditSummary;
  aiRecommendations?: {
    executiveSummary?: string | null;
    topRisks?: string[] | null;
    recommendedActions?: string[] | null;
  } | null;
}

export type AuditRunStatus = "pending" | "running" | "completed";

export interface AuditRun {
  id: string;
  repoUrl: string;
  status: AuditRunStatus;
  createdAt: string;
  findings: Findings | null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function assertOk(res: Response, message: string): Promise<void> {
  if (res.ok) {
    return;
  }

  const status = res.status;
  let errorMessage = `${message} (HTTP ${status})`;

  try {
    const text = await res.text();
    if (text) {
      const parsed = JSON.parse(text) as { message?: string | string[] };

      if (Array.isArray(parsed.message)) {
        errorMessage = parsed.message.join("; ");
      } else if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        errorMessage = parsed.message;
      } else {
        errorMessage = text;
      }
    }
  } catch {
    // ignore
  }

  throw new ApiError(errorMessage, status);
}

export async function createAuditRun(repoUrl: string): Promise<AuditRun> {
  const res = await fetch(`${API_URL}/audit-runs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repoUrl }),
  });

  await assertOk(res, "Failed to create audit run");
  return (await res.json()) as AuditRun;
}

export async function getAuditRuns(): Promise<AuditRun[]> {
  const res = await fetch(`${API_URL}/audit-runs`);
  await assertOk(res, "Failed to fetch audit runs");

  return (await res.json()) as AuditRun[];
}

export async function runPendingAudit(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/audit-runs/${id}/run`, {
    method: "POST",
  });

  await assertOk(res, "Failed to run audit");
}

export async function getGovernancePolicies(): Promise<GovernancePolicies> {
  const res = await fetch(`${API_URL}/policies/governance`);
  await assertOk(res, "Failed to fetch governance policies");

  return (await res.json()) as GovernancePolicies;
}
