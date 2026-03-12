import { Injectable, Logger } from "@nestjs/common";
import type { AuditScoreSummary } from "./scoring.service";

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

export type AiGovernanceRecommendations = {
  executiveSummary: string;
  topRisks: string[];
  recommendedActions: string[];
};

type RecommendationRequest = {
  repoUrl: string;
  auditSummary: AuditScoreSummary;
  findings: Findings;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class FoundryRecommendationsService {
  private readonly logger = new Logger(FoundryRecommendationsService.name);

  async generateRecommendations(
    input: RecommendationRequest,
  ): Promise<AiGovernanceRecommendations | null> {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.trim();
    const apiKey = process.env.AZURE_OPENAI_API_KEY?.trim();
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME?.trim();
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION?.trim() ?? "2024-10-21";

    if (!endpoint || !apiKey || !deployment) {
      this.logger.warn("Foundry recommendations skipped: missing Azure OpenAI configuration");
      return null;
    }

    const promptPayload = {
      repository: input.repoUrl,
      score: input.auditSummary.score,
      riskLevel: input.auditSummary.riskLevel,
      findingsSummary: input.findings.summary,
      findings: input.findings.items.slice(0, 10).map((item) => ({
        severity: item.severity,
        title: item.title,
        evidence: item.evidence.slice(0, 300),
      })),
    };

    const url = `${endpoint.replace(/\/$/, "")}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are an enterprise AI governance analyst. Use only the provided audit data. Return strict JSON with keys: executiveSummary (string), topRisks (string[3]), recommendedActions (string[3]). Do not add markdown.",
            },
            {
              role: "user",
              content: JSON.stringify(promptPayload),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.warn(
          `Foundry recommendations request failed (${response.status}): ${errorBody.slice(0, 500)}`,
        );
        return null;
      }

      const data = (await response.json()) as ChatCompletionsResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        this.logger.warn("Foundry recommendations returned empty content");
        return null;
      }

      const parsed = this.parseJsonContent(content);
      if (!parsed) {
        this.logger.warn("Foundry recommendations returned non-JSON content");
        return null;
      }

      const validated = this.validateRecommendations(parsed);
      if (!validated) {
        this.logger.warn("Foundry recommendations JSON did not match expected shape");
        return null;
      }

      return validated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Foundry recommendations failed: ${message}`);
      return null;
    }
  }

  private parseJsonContent(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      const start = content.indexOf("{");
      const end = content.lastIndexOf("}");

      if (start === -1 || end <= start) {
        return null;
      }

      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  private validateRecommendations(value: unknown): AiGovernanceRecommendations | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const record = value as Record<string, unknown>;
    const executiveSummary = this.normalizeString(record.executiveSummary);
    const topRisks = this.normalizeStringArray(record.topRisks);
    const recommendedActions = this.normalizeStringArray(record.recommendedActions);

    if (!executiveSummary || topRisks.length === 0 || recommendedActions.length === 0) {
      return null;
    }

    return {
      executiveSummary,
      topRisks: topRisks.slice(0, 3),
      recommendedActions: recommendedActions.slice(0, 3),
    };
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
}
