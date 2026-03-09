import { Injectable } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BaselinePolicy = {
  security: {
    secretPatterns: string[];
    suspiciousFiles: string[];
  };
  privacy: {
    piiPatterns: string[];
    loggingPatterns: string[];
  };
  responsible_ai: {
    requiredFiles: string[];
    recommendedConfigPatterns: string[];
  };
};

type BaselineSection = keyof BaselinePolicy;
type BaselineField =
  | "secretPatterns"
  | "suspiciousFiles"
  | "piiPatterns"
  | "loggingPatterns"
  | "requiredFiles"
  | "recommendedConfigPatterns";

const sectionFields: Record<BaselineSection, BaselineField[]> = {
  security: ["secretPatterns", "suspiciousFiles"],
  privacy: ["piiPatterns", "loggingPatterns"],
  responsible_ai: ["requiredFiles", "recommendedConfigPatterns"],
};

@Injectable()
export class PolicyLoaderService {
  loadBaselinePolicy(): BaselinePolicy {
    const policyPath = this.resolveBaselinePath();

    try {
      const raw = readFileSync(policyPath, "utf-8");
      return this.parseBaselineYaml(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to load baseline policy from ${policyPath}: ${message}`);
    }
  }

  private resolveBaselinePath(): string {
    const candidates = [
      resolve(process.cwd(), "policies", "baseline.yml"),
      resolve(process.cwd(), "..", "..", "policies", "baseline.yml"),
      resolve(__dirname, "..", "..", "..", "..", "policies", "baseline.yml"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error("policies/baseline.yml not found from current runtime path");
  }

  private parseBaselineYaml(raw: string): BaselinePolicy {
    const parsed: BaselinePolicy = {
      security: { secretPatterns: [], suspiciousFiles: [] },
      privacy: { piiPatterns: [], loggingPatterns: [] },
      responsible_ai: { requiredFiles: [], recommendedConfigPatterns: [] },
    };

    const lines = raw.split(/\r?\n/);
    let currentSection: BaselineSection | null = null;
    let currentField: BaselineField | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      if (!line.startsWith(" ") && trimmed.endsWith(":")) {
        const sectionName = trimmed.slice(0, -1);
        if (!this.isBaselineSection(sectionName)) {
          throw new Error(`Unsupported section '${sectionName}' in baseline policy`);
        }

        currentSection = sectionName;
        currentField = null;
        continue;
      }

      if (line.startsWith("  ") && !line.startsWith("    ") && trimmed.endsWith(":")) {
        if (!currentSection) {
          throw new Error("Field defined before section in baseline policy");
        }

        const fieldName = trimmed.slice(0, -1);
        if (!this.isAllowedField(currentSection, fieldName)) {
          throw new Error(`Unsupported field '${fieldName}' under section '${currentSection}'`);
        }

        currentField = fieldName;
        continue;
      }

      if (line.startsWith("    - ")) {
        if (!currentSection || !currentField) {
          throw new Error("List item defined before section/field in baseline policy");
        }

        const value = this.unquoteValue(trimmed.slice(2).trim());
        parsed[currentSection][currentField].push(value);
        continue;
      }

      throw new Error(`Unsupported YAML line: '${line}'`);
    }

    return parsed;
  }

  private isBaselineSection(value: string): value is BaselineSection {
    return value === "security" || value === "privacy" || value === "responsible_ai";
  }

  private isAllowedField(section: BaselineSection, value: string): value is BaselineField {
    return sectionFields[section].includes(value as BaselineField);
  }

  private unquoteValue(value: string): string {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    return value;
  }
}
