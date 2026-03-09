import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GithubIngestionService } from "./github-ingestion.service";
import { SecurityScannerService } from "./security-scanner.service";
import { PrivacyScannerService } from "./privacy-scanner.service";
import { ResponsibleAiScannerService } from "./responsible-ai-scanner.service";
import { ScoringService } from "./scoring.service";

type FindingSeverity = "low" | "medium" | "high";

type Findings = {
  summary: { total: number; high: number; medium: number; low: number };
  items: Array<{
    id: string;
    severity: FindingSeverity;
    title: string;
    evidence: string;
    recommendation: string;
  }>;
};

@Injectable()
export class AuditRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubIngestion: GithubIngestionService,
    private readonly securityScanner: SecurityScannerService,
    private readonly privacyScanner: PrivacyScannerService,
    private readonly responsibleAiScanner: ResponsibleAiScannerService,
    private readonly scoring: ScoringService,
  ) {}

  async create(repoUrl: string) {
    return this.prisma.auditRun.create({
      data: { repoUrl, status: "pending" },
    });
  }

  async list() {
    return this.prisma.auditRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async run(id: string) {
    const auditRun = await this.prisma.auditRun.findUnique({ where: { id } });
    if (!auditRun) {
      throw new Error(`Audit run not found for id '${id}'`);
    }

    // Update status to "running"
    await this.prisma.auditRun.update({
      where: { id },
      data: { status: "running" },
    });

    try {
      // Minimal repository ingestion for future policy-driven checks.
      const sampledFiles = await this.githubIngestion.samplePolicyRelevantFiles(auditRun.repoUrl);

      // Deterministic MVP security checks with policy-driven rules.
      const securityFindings = this.securityScanner.scanSampledFiles(sampledFiles);
      const privacyFindings = this.privacyScanner.scanSampledFiles(sampledFiles);
      const responsibleAiFindings = this.responsibleAiScanner.scanSampledFiles(sampledFiles);
      const findings = this.mergeFindings(securityFindings, privacyFindings, responsibleAiFindings);
      const auditSummary = this.scoring.calculate(findings);

      // Simulate audit work (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update status to "completed" and set findings
      return this.prisma.auditRun.update({
        where: { id },
        data: { status: "completed", findings: { ...findings, auditSummary } },
      });
    } catch (error) {
      await this.prisma.auditRun.update({
        where: { id },
        data: { status: "pending" },
      });

      throw new Error(error instanceof Error ? error.message : "Audit execution failed");
    }
  }

  private mergeFindings(...collections: Findings[]): Findings {
    const mergedItems = collections.flatMap((collection) => collection.items).map((item, index) => ({
      ...item,
      id: String(index + 1),
    }));

    return {
      summary: {
        total: mergedItems.length,
        high: mergedItems.filter((item) => item.severity === "high").length,
        medium: mergedItems.filter((item) => item.severity === "medium").length,
        low: mergedItems.filter((item) => item.severity === "low").length,
      },
      items: mergedItems,
    };
  }
}