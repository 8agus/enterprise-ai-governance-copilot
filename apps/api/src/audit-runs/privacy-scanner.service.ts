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
  snippet?: string | null;
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
      const contentText = typeof file.content === "string" ? file.content : "";

      for (const rawPattern of policy.privacy.piiPatterns) {
        const expression = this.toRegExp(rawPattern);
        const matchedContent = contentText.length > 0 && this.matches(contentText, expression);
        const matchedPath = !matchedContent && this.matches(file.path, expression);

        if (matchedContent || matchedPath) {
          const patternMatchSource = matchedContent ? "sampled file content" : "sampled file path";
          const snippet = matchedContent ? this.extractSnippet(contentText, expression) : null;

          this.addFinding(findings, findingKeys, {
            severity: "medium",
            title: "Potential PII-related file indicator detected",
            evidence: `Policy pattern matched ${patternMatchSource} for file '${file.path}' (privacy PII pattern '${rawPattern}')`,
            snippet,
            recommendation:
              "Review this file for personal data handling and ensure privacy-safe storage/access controls.",
          });
        }
      }

      for (const rawPattern of policy.privacy.loggingPatterns) {
        const expression = this.toRegExp(rawPattern);
        const matchedContent = contentText.length > 0 && this.matches(contentText, expression);
        const matchedPath = !matchedContent && this.matches(file.path, expression);

        if (matchedContent || matchedPath) {
          const patternMatchSource = matchedContent ? "sampled file content" : "sampled file path";
          const snippet = matchedContent ? this.extractSnippet(contentText, expression) : null;

          this.addFinding(findings, findingKeys, {
            severity: "medium",
            title: "Potential risky logging indicator detected",
            evidence: `Policy pattern matched ${patternMatchSource} for file '${file.path}' (privacy logging pattern '${rawPattern}')`,
            snippet,
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
    const normalizedPattern = rawPattern.replace(/\\\\/g, "\\");

    try {
      if (normalizedPattern.startsWith("(?i)")) {
        return new RegExp(normalizedPattern.slice(4), "i");
      }

      return new RegExp(normalizedPattern);
    } catch {
      throw new Error(`Invalid privacy pattern in baseline policy: '${rawPattern}'`);
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
