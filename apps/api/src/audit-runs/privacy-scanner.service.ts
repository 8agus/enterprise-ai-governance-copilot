import { Injectable } from "@nestjs/common";
import { PolicyLoaderService } from "../policies/policy-loader.service";
import type { SampledRepoFile } from "./github-ingestion.service";

type FindingSeverity = "low" | "medium" | "high";
type FindingCategory = "security" | "privacy" | "responsible-ai";

type PrivacyFinding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  evidence: string;
  recommendation: string;
};

type PrivacyFindings = {
  summary: { total: number; high: number; medium: number; low: number };
  items: PrivacyFinding[];
};

@Injectable()
export class PrivacyScannerService {
  constructor(private readonly policyLoader: PolicyLoaderService) {}

  scanSampledFiles(sampledFiles: SampledRepoFile[]): PrivacyFindings {
    const policy = this.policyLoader.loadBaselinePolicy();
    const governancePolicies = this.policyLoader.getGovernancePolicies();
    const findings: PrivacyFinding[] = [];
    const findingKeys = new Set<string>();

    if (!governancePolicies.privacy.pii_detection) {
      return {
        summary: { total: 0, high: 0, medium: 0, low: 0 },
        items: [],
      };
    }

    for (const file of sampledFiles) {
      const lowerPath = file.path.toLowerCase();

      for (const rawPattern of policy.privacy.piiPatterns) {
        const expression = this.toRegExp(rawPattern);
        if (expression.test(file.path)) {
          this.addFinding(findings, findingKeys, {
            severity: "medium",
            title: "Potential PII-related file indicator detected",
            evidence: `File path '${file.path}' matched privacy PII pattern '${rawPattern}'`,
            recommendation:
              "Review this file for personal data handling and ensure privacy-safe storage/access controls.",
          });
        }
      }

      for (const rawPattern of policy.privacy.loggingPatterns) {
        const expression = this.toRegExp(rawPattern);
        if (expression.test(file.path)) {
          this.addFinding(findings, findingKeys, {
            severity: "medium",
            title: "Potential risky logging indicator detected",
            evidence: `File path '${file.path}' matched privacy logging pattern '${rawPattern}'`,
            recommendation: "Review logging to avoid recording personal or sensitive user data.",
          });
        }
      }

      if (/(export|dump|backup|customer|user-data|pii|personal-data|gdpr|privacy)/i.test(file.path)) {
        this.addFinding(findings, findingKeys, {
          severity: "high",
          title: "File path suggests personal data storage or export",
          evidence: `File path '${file.path}' contains privacy-sensitive naming indicators`,
          recommendation: "Verify data minimization, retention controls, and access restrictions for personal data.",
        });
      }

      if (/(log|logger|audit)/i.test(lowerPath) && /(user|customer|profile|account|email|phone)/i.test(lowerPath)) {
        this.addFinding(findings, findingKeys, {
          severity: "low",
          title: "Logging path may involve personal data",
          evidence: `File path '${file.path}' suggests logging and user-related data handling`,
          recommendation: "Review logs for personal data exposure and apply masking or redaction where needed.",
        });
      }
    }

    return {
      summary: {
        total: findings.length,
        high: findings.filter((item) => item.severity === "high").length,
        medium: findings.filter((item) => item.severity === "medium").length,
        low: findings.filter((item) => item.severity === "low").length,
      },
      items: findings.map((finding, index) => ({ ...finding, id: String(index + 1) })),
    };
  }

  private toRegExp(rawPattern: string): RegExp {
    try {
      if (rawPattern.startsWith("(?i)")) {
        return new RegExp(rawPattern.slice(4), "i");
      }

      return new RegExp(rawPattern);
    } catch {
      throw new Error(`Invalid privacy pattern in baseline policy: '${rawPattern}'`);
    }
  }

  private addFinding(
    findings: PrivacyFinding[],
    keys: Set<string>,
    finding: Omit<PrivacyFinding, "id" | "category">,
  ): void {
    const key = `${finding.severity}|${finding.title}|${finding.evidence}`;
    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    findings.push({ id: "", category: "privacy", ...finding });
  }
}
