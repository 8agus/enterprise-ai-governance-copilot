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

export type GovernancePolicies = {
  security: {
    dependency_vulnerabilities: boolean;
    hardcoded_secrets: boolean;
  };
  privacy: {
    pii_detection: boolean;
  };
  responsible_ai: {
    missing_governance_docs: boolean;
    missing_content_safety: boolean;
    missing_evaluation_framework: boolean;
    prompt_injection_patterns: boolean;
    missing_human_review: boolean;
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

const defaultGovernancePolicies: GovernancePolicies = {
  security: {
    dependency_vulnerabilities: true,
    hardcoded_secrets: true,
  },
  privacy: {
    pii_detection: true,
  },
  responsible_ai: {
    missing_governance_docs: true,
    missing_content_safety: true,
    missing_evaluation_framework: true,
    prompt_injection_patterns: true,
    missing_human_review: true,
  },
};

@Injectable()
export class PolicyLoaderService {
  private readonly governancePolicies: GovernancePolicies;

  constructor() {
    this.governancePolicies = this.loadGovernancePolicies();
  }

  getGovernancePolicies(): GovernancePolicies {
    return this.governancePolicies;
  }

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

  private loadGovernancePolicies(): GovernancePolicies {
    const policyPath = this.resolveGovernancePoliciesPath();

    try {
      const raw = readFileSync(policyPath, "utf-8");
      return this.parseGovernanceYaml(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to load governance policies from ${policyPath}: ${message}`);
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

  private resolveGovernancePoliciesPath(): string {
    const candidates = [
      resolve(process.cwd(), "apps", "api", "policies", "governance-policies.yaml"),
      resolve(process.cwd(), "policies", "governance-policies.yaml"),
      resolve(__dirname, "..", "..", "..", "policies", "governance-policies.yaml"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error("apps/api/policies/governance-policies.yaml not found from current runtime path");
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

  private parseGovernanceYaml(raw: string): GovernancePolicies {
    const parsed: GovernancePolicies = JSON.parse(JSON.stringify(defaultGovernancePolicies)) as GovernancePolicies;
    const lines = raw.split(/\r?\n/);
    let inPoliciesRoot = false;
    let currentSection: keyof GovernancePolicies | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      if (!line.startsWith(" ") && trimmed === "policies:") {
        inPoliciesRoot = true;
        currentSection = null;
        continue;
      }

      if (!inPoliciesRoot) {
        throw new Error("Governance policy YAML must define a top-level 'policies' section");
      }

      if (line.startsWith("  ") && !line.startsWith("    ") && trimmed.endsWith(":")) {
        const section = trimmed.slice(0, -1);
        if (!this.isGovernanceSection(section)) {
          throw new Error(`Unsupported governance section '${section}'`);
        }

        currentSection = section;
        continue;
      }

      if (line.startsWith("    ") && !line.startsWith("      ")) {
        if (!currentSection) {
          throw new Error("Governance rule defined before section");
        }

        const separatorIndex = trimmed.indexOf(":");
        if (separatorIndex <= 0) {
          throw new Error(`Invalid governance rule line '${line}'`);
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        const value = this.parseBoolean(rawValue, key);
        this.assignGovernanceRule(parsed, currentSection, key, value);
        continue;
      }

      throw new Error(`Unsupported governance YAML line: '${line}'`);
    }

    return parsed;
  }

  private parseBoolean(value: string, key: string): boolean {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    throw new Error(`Governance rule '${key}' must be a boolean`);
  }

  private isGovernanceSection(value: string): value is keyof GovernancePolicies {
    return value === "security" || value === "privacy" || value === "responsible_ai";
  }

  private assignGovernanceRule(
    policies: GovernancePolicies,
    section: keyof GovernancePolicies,
    key: string,
    value: boolean,
  ): void {
    if (!Object.prototype.hasOwnProperty.call(policies[section], key)) {
      throw new Error(`Unsupported governance rule '${section}.${key}'`);
    }

    if (section === "security") {
      policies.security[key as keyof GovernancePolicies["security"]] = value;
      return;
    }

    if (section === "privacy") {
      policies.privacy[key as keyof GovernancePolicies["privacy"]] = value;
      return;
    }

    policies.responsible_ai[key as keyof GovernancePolicies["responsible_ai"]] = value;
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
