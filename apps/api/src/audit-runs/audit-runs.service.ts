import { HttpException, Injectable, InternalServerErrorException, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GithubIngestionService } from "./github-ingestion.service";
import { SecurityScannerService } from "./security-scanner.service";
import { PrivacyScannerService } from "./privacy-scanner.service";
import { ResponsibleAiScannerService } from "./responsible-ai-scanner.service";
import { ScoringService } from "./scoring.service";
import { FoundryRecommendationsService } from "./foundry-recommendations.service";

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
    snippet?: string | null;
    recommendation: string;
  }>;
};

@Injectable()
export class AuditRunsService {
  private readonly logger = new Logger(AuditRunsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubIngestion: GithubIngestionService,
    private readonly securityScanner: SecurityScannerService,
    private readonly privacyScanner: PrivacyScannerService,
    private readonly responsibleAiScanner: ResponsibleAiScannerService,
    private readonly scoring: ScoringService,
    private readonly foundryRecommendations: FoundryRecommendationsService,
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
    let stage = "run started";
    this.logger.log(`[${id}] run started`);

    stage = "audit run record loaded";
    const auditRun = await this.prisma.auditRun.findUnique({ where: { id } });
    if (!auditRun) {
      throw new NotFoundException(`Audit run not found for id '${id}'`);
    }
    this.logger.log(`[${id}] audit run record loaded`);

    // Update status to "running"
    stage = "run marked running";
    await this.prisma.auditRun.update({
      where: { id },
      data: { status: "running" },
    });
    this.logger.log(`[${id}] run marked running`);

    try {
      // Minimal repository ingestion for future policy-driven checks.
      stage = "files sampled";
      const sampledFiles = await this.githubIngestion.samplePolicyRelevantFiles(auditRun.repoUrl);
      this.logger.log(`[${id}] files sampled (${sampledFiles.length})`);

      // Deterministic MVP security checks with policy-driven rules.
      stage = "scanners completed";
      const securityFindings = this.securityScanner.scanSampledFiles(sampledFiles);
      const privacyFindings = this.privacyScanner.scanSampledFiles(sampledFiles);
      const responsibleAiFindings = this.responsibleAiScanner.scanSampledFiles(sampledFiles);
      const findings = this.mergeFindings(securityFindings, privacyFindings, responsibleAiFindings);
      this.logger.log(
        `[${id}] scanners completed (security=${securityFindings.items.length}, privacy=${privacyFindings.items.length}, responsible-ai=${responsibleAiFindings.items.length})`,
      );

      stage = "score calculated";
      const auditSummary = this.scoring.calculate(findings);
      this.logger.log(
        `[${id}] score calculated (score=${auditSummary.score}, riskLevel=${auditSummary.riskLevel}, totalFindings=${auditSummary.totalFindings})`,
      );

      stage = "ai recommendations generated";
      const aiRecommendations = await this.foundryRecommendations.generateRecommendations({
        repoUrl: auditRun.repoUrl,
        auditSummary,
        findings,
      });
      this.logger.log(
        `[${id}] ai recommendations ${aiRecommendations ? "generated" : "unavailable"}`,
      );

      // Simulate audit work (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update status to "completed" and set findings
      stage = "findings persisted";
      const updatedRun = await this.prisma.auditRun.update({
        where: { id },
        data: {
          status: "completed",
          findings: { ...findings, auditSummary, aiRecommendations },
        },
      });

      this.logger.log(`[${id}] findings persisted`);
      this.logger.log(`[${id}] run marked completed`);
      return updatedRun;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`[${id}] failed at stage '${stage}': ${errorMessage}`);

      await this.prisma.auditRun.update({
        where: { id },
        data: { status: "pending" },
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Audit execution failed",
      );
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