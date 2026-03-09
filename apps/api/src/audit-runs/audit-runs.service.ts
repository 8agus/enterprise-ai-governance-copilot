import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GithubIngestionService } from "./github-ingestion.service";
import { SecurityScannerService } from "./security-scanner.service";

@Injectable()
export class AuditRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubIngestion: GithubIngestionService,
    private readonly securityScanner: SecurityScannerService,
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
      const findings = this.securityScanner.scanSampledFiles(sampledFiles);

      // Simulate audit work (2 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update status to "completed" and set findings
      return this.prisma.auditRun.update({
        where: { id },
        data: { status: "completed", findings },
      });
    } catch (error) {
      await this.prisma.auditRun.update({
        where: { id },
        data: { status: "pending" },
      });

      throw new Error(error instanceof Error ? error.message : "Audit execution failed");
    }
  }
}