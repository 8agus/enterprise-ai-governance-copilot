const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type FindingSeverity = "low" | "medium" | "high";

export interface Findings {
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  items: Array<{
    id: string;
    severity: FindingSeverity;
    title: string;
    evidence: string;
    recommendation: string;
  }>;
}

export type AuditRunStatus = "pending" | "running" | "completed";

export interface AuditRun {
  id: string;
  repoUrl: string;
  status: AuditRunStatus;
  createdAt: string;
  findings: Findings | null;
}

async function assertOk(res: Response, message: string): Promise<void> {
  if (res.ok) {
    return;
  }

  throw new Error(message);
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
