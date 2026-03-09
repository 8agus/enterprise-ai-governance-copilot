import { Injectable } from "@nestjs/common";
import { PolicyLoaderService } from "../policies/policy-loader.service";
import type { SampledRepoFile } from "./github-ingestion.service";

type FindingSeverity = "low" | "medium" | "high";

type SecurityFinding = {
  id: string;
  severity: FindingSeverity;
  title: string;
  evidence: string;
  recommendation: string;
};

type SecurityFindings = {
  summary: { total: number; high: number; medium: number; low: number };
  items: SecurityFinding[];
};

@Injectable()
export class SecurityScannerService {
  constructor(private readonly policyLoader: PolicyLoaderService) {}

  scanSampledFiles(sampledFiles: SampledRepoFile[]): SecurityFindings {
    const policy = this.policyLoader.loadBaselinePolicy();
    const findings: SecurityFinding[] = [];
    const findingKeys = new Set<string>();

    for (const file of sampledFiles) {
      const filePathLower = file.path.toLowerCase();
      const fileName = filePathLower.split("/").pop() ?? filePathLower;

      for (const suspicious of policy.security.suspiciousFiles) {
        const suspiciousLower = suspicious.toLowerCase();
        const matched =
          suspiciousLower === ".env"
            ? fileName === ".env" || fileName.startsWith(".env.")
            : fileName === suspiciousLower;

        if (matched) {
          this.addFinding(findings, findingKeys, {
            severity: "high",
            title: "Suspicious sensitive file exposed",
            evidence: `Sampled file '${file.path}' matched suspicious file rule '${suspicious}'`,
            recommendation: "Remove sensitive files from source control and rotate any exposed secrets.",
          });
        }
      }

      for (const rawPattern of policy.security.secretPatterns) {
        const expression = this.toRegExp(rawPattern);
        if (expression.test(file.path)) {
          this.addFinding(findings, findingKeys, {
            severity: "medium",
            title: "Potential secret pattern detected in file path",
            evidence: `File path '${file.path}' matched secret pattern '${rawPattern}'`,
            recommendation: "Review this file for secrets and move sensitive values to secure secret storage.",
          });
        }
      }

      if (/(credential|secret|token|password|api[_-]?key|private[_-]?key)/i.test(file.path)) {
        this.addFinding(findings, findingKeys, {
          severity: "medium",
          title: "Filename suggests credential or secret storage",
          evidence: `File path '${file.path}' contains sensitive naming indicators`,
          recommendation: "Confirm this file does not contain hardcoded secrets or credentials.",
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
      throw new Error(`Invalid security pattern in baseline policy: '${rawPattern}'`);
    }
  }

  private addFinding(
    findings: SecurityFinding[],
    keys: Set<string>,
    finding: Omit<SecurityFinding, "id">,
  ): void {
    const key = `${finding.severity}|${finding.title}|${finding.evidence}`;
    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    findings.push({ id: "", ...finding });
  }
}
