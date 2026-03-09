import { Injectable } from "@nestjs/common";
import type { SampledRepoFile } from "./github-ingestion.service";
import { PolicyLoaderService } from "../policies/policy-loader.service";

type FindingSeverity = "low" | "medium" | "high";
type FindingCategory = "security" | "privacy" | "responsible-ai";

type ResponsibleAiFinding = {
  id: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  evidence: string;
  recommendation: string;
};

type ResponsibleAiFindings = {
  summary: { total: number; high: number; medium: number; low: number };
  items: ResponsibleAiFinding[];
};

const AI_INDICATORS = [
  "openai",
  "gpt",
  "llm",
  "prompt",
  "completion",
  "chatcompletion",
  "embedding",
  "anthropic",
  "gemini",
  "assistant",
  "model",
] as const;

const GOVERNANCE_DOC_INDICATORS = [
  "responsible-ai",
  "ai-governance",
  "model-card",
  "governance",
  "risk-assessment",
  "usage-policy",
  "ai-policy",
] as const;

const CONTENT_SAFETY_INDICATORS = [
  "moderation",
  "content safety",
  "safety filter",
  "blocklist",
  "allowlist",
  "toxicity",
  "harm",
  "filter",
  "jailbreak prevention",
] as const;

const EVALUATION_INDICATORS = [
  "eval",
  "evaluation",
  "benchmark",
  "red-team",
  "red team",
  "safety test",
  "test prompts",
] as const;

const HUMAN_REVIEW_INDICATORS = [
  "review",
  "approval",
  "human-in-the-loop",
  "escalation",
  "manual override",
  "reviewer",
] as const;

@Injectable()
export class ResponsibleAiScannerService {
  constructor(private readonly policyLoader: PolicyLoaderService) {}

  scanSampledFiles(sampledFiles: SampledRepoFile[]): ResponsibleAiFindings {
    const governancePolicies = this.policyLoader.getGovernancePolicies();
    const findings: ResponsibleAiFinding[] = [];
    const findingKeys = new Set<string>();

    const scannedText = sampledFiles.map((file) => this.fileScanText(file));
    const combinedScanText = scannedText.join("\n");
    const isAiRelated = this.containsAny(combinedScanText, AI_INDICATORS);
    const hasPromptHandling = /prompt|chat|messages?|assistant|completion/i.test(combinedScanText);

    const hasGovernanceDocs = sampledFiles.some((file) => {
      const text = this.fileScanText(file);
      const isDocumentationFile =
        /(^|\/)(docs?|readme)/i.test(file.path) || /\.mdx?$/i.test(file.path) || /policy/i.test(file.path);
      return isDocumentationFile && this.containsAny(text, GOVERNANCE_DOC_INDICATORS);
    });

    if (governancePolicies.responsible_ai.missing_governance_docs && !hasGovernanceDocs) {
      this.addFinding(findings, findingKeys, {
        severity: "medium",
        title: "Missing AI governance documentation",
        evidence:
          "No sampled documentation file or content was found referencing responsible AI, model governance, or AI usage policy.",
        recommendation:
          "Add repository documentation covering responsible AI principles, intended use, risks, and governance controls.",
      });
    }

    const hasContentSafety = this.containsAny(combinedScanText, CONTENT_SAFETY_INDICATORS);
    if (governancePolicies.responsible_ai.missing_content_safety && isAiRelated && !hasContentSafety) {
      this.addFinding(findings, findingKeys, {
        severity: hasPromptHandling ? "high" : "medium",
        title: "Missing content safety or moderation controls",
        evidence:
          "Repository contains prompt or AI interaction patterns but no sampled content safety or moderation controls were detected.",
        recommendation: "Add moderation or content safety controls for prompt/input/output handling.",
      });
    }

    const hasEvaluationFramework = this.containsAny(combinedScanText, EVALUATION_INDICATORS);
    if (governancePolicies.responsible_ai.missing_evaluation_framework && !hasEvaluationFramework) {
      this.addFinding(findings, findingKeys, {
        severity: "medium",
        title: "Missing evaluation framework",
        evidence: "No sampled evaluation, benchmark, or red-team framework artifacts were found.",
        recommendation: "Add repeatable evaluation tests and benchmark datasets.",
      });
    }

    for (const file of sampledFiles) {
      const content = file.content;
      if (!content) {
        continue;
      }

      if (governancePolicies.responsible_ai.prompt_injection_patterns && this.hasPromptInjectionRisk(content)) {
        this.addFinding(findings, findingKeys, {
          severity: "high",
          title: "Potential prompt injection risk pattern detected",
          evidence:
            `Potential prompt injection risk detected in sampled file '${file.path}' due to unsafe prompt construction pattern.`,
          recommendation:
            "Isolate system instructions from user input and implement prompt injection defenses.",
        });
      }
    }

    const hasHumanReviewProcess = this.containsAny(combinedScanText, HUMAN_REVIEW_INDICATORS);
    if (governancePolicies.responsible_ai.missing_human_review && isAiRelated && !hasHumanReviewProcess) {
      this.addFinding(findings, findingKeys, {
        severity: "medium",
        title: "Missing human review or approval process",
        evidence:
          "No sampled files referenced human review, manual approval, or escalation controls for AI-assisted decisions.",
        recommendation:
          "Introduce documented human review or escalation controls for high-risk AI actions.",
      });
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

  private fileScanText(file: SampledRepoFile): string {
    return `${file.path}\n${file.content ?? ""}`.toLowerCase();
  }

  private containsAny(text: string, indicators: readonly string[]): boolean {
    return indicators.some((indicator) => text.includes(indicator));
  }

  private hasPromptInjectionRisk(content: string): boolean {
    const lower = content.toLowerCase();

    if (/ignore previous instructions|system prompt|developer message/i.test(lower)) {
      return true;
    }

    const unsafeCompositionPatterns = [
      /(prompt|messages?)\s*[:=][\s\S]{0,180}(\+|\$\{)[\s\S]{0,120}(user|input|request|query|message)/i,
      /(user|input|request|query|message)[\s\S]{0,120}(\+|\$\{)[\s\S]{0,180}(system|prompt|instruction)/i,
    ];

    return unsafeCompositionPatterns.some((pattern) => pattern.test(content));
  }

  private addFinding(
    findings: ResponsibleAiFinding[],
    keys: Set<string>,
    finding: Omit<ResponsibleAiFinding, "id" | "category">,
  ): void {
    const key = `${finding.severity}|${finding.title}|${finding.evidence}`;
    if (keys.has(key)) {
      return;
    }

    keys.add(key);
    findings.push({ id: "", category: "responsible-ai", ...finding });
  }
}