import { Injectable } from "@nestjs/common";
import { PolicyLoaderService } from "../policies/policy-loader.service";
import type { SampledRepoFile } from "./github-ingestion.service";

type FindingSeverity = "low" | "medium" | "high";
type FindingCategory = "security" | "privacy" | "responsible-ai";

type SecurityFinding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  evidence: string;
  snippet?: string | null;
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
    const governancePolicies = this.policyLoader.getGovernancePolicies();
    const findings: SecurityFinding[] = [];
    const findingKeys = new Set<string>();

    for (const file of sampledFiles) {
      const filePathLower = file.path.toLowerCase();
      const fileName = filePathLower.split("/").pop() ?? filePathLower;
      const contentText = typeof file.content === "string" ? file.content : "";

      if (governancePolicies.security.dependency_vulnerabilities) {
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
      }

      if (governancePolicies.security.hardcoded_secrets) {
        for (const rawPattern of policy.security.secretPatterns) {
          const expression = this.toRegExp(rawPattern);
          const matchedContent = contentText.length > 0 && this.matches(contentText, expression);
          const matchedPath = !matchedContent && this.matches(file.path, expression);

          if (matchedContent || matchedPath) {
            const patternMatchSource = matchedContent ? "sampled file content" : "sampled file path";
            const snippet = matchedContent ? this.extractSnippet(contentText, expression) : null;

            this.addFinding(findings, findingKeys, {
              severity: "medium",
              title: "Potential secret pattern detected",
              evidence: `Policy pattern matched ${patternMatchSource} for file '${file.path}' (security pattern '${rawPattern}')`,
              snippet,
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
    const normalizedPattern = rawPattern.replace(/\\\\/g, "\\");

    try {
      if (normalizedPattern.startsWith("(?i)")) {
        return new RegExp(normalizedPattern.slice(4), "i");
      }

      return new RegExp(normalizedPattern);
    } catch {
      throw new Error(`Invalid security pattern in baseline policy: '${rawPattern}'`);
    }
  }

  private matches(text: string, expression: RegExp): boolean {
    const candidate = new RegExp(expression.source, expression.flags.replace(/g/g, ""));
    return candidate.test(text);
  }

  private extractSnippet(contentText: string, expression: RegExp): string | null {
    const candidate = new RegExp(expression.source, expression.flags.replace(/g/g, ""));
    const match = candidate.exec(contentText);

    if (!match || typeof match.index !== "number") {
      return null;
    }

    const lineStart = contentText.lastIndexOf("\n", match.index) + 1;
    const nextNewLineIndex = contentText.indexOf("\n", match.index);
    const lineEnd = nextNewLineIndex === -1 ? contentText.length : nextNewLineIndex;
    const line = contentText.slice(lineStart, lineEnd).trim();

    return line ? line.slice(0, 120) : null;
  }

  private addFinding(
    findings: SecurityFinding[],
    keys: Set<string>,
    finding: Omit<SecurityFinding, "id" | "category">,
  ): void {
    const key = `${finding.severity}|${finding.title}|${finding.evidence}`;
    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    findings.push({ id: "", category: "security", ...finding });
  }
}
