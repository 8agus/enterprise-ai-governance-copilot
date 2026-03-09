import { Injectable } from "@nestjs/common";

type FindingSeverity = "low" | "medium" | "high";
type FindingCategory = "security" | "privacy" | "responsible-ai";

type Findings = {
  summary: { total: number; high: number; medium: number; low: number };
  items: Array<{
    id: string;
    category: FindingCategory;
    severity: FindingSeverity;
    title: string;
    evidence: string;
    recommendation: string;
  }>;
};

export type AuditScoreSummary = {
  score: number;
  riskLevel: "low" | "moderate" | "high";
  totalFindings: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
};

const PENALTY = {
  high: 25,
  medium: 10,
  low: 3,
} as const;

@Injectable()
export class ScoringService {
  calculate(findings: Findings): AuditScoreSummary {
    const highCount = findings.summary.high;
    const mediumCount = findings.summary.medium;
    const lowCount = findings.summary.low;

    const totalPenalty =
      highCount * PENALTY.high +
      mediumCount * PENALTY.medium +
      lowCount * PENALTY.low;

    const score = Math.max(0, Math.min(100, 100 - totalPenalty));

    return {
      score,
      riskLevel: this.toRiskLevel(score),
      totalFindings: findings.summary.total,
      highCount,
      mediumCount,
      lowCount,
    };
  }

  private toRiskLevel(score: number): "low" | "moderate" | "high" {
    if (score >= 80) {
      return "low";
    }

    if (score >= 50) {
      return "moderate";
    }

    return "high";
  }
}
