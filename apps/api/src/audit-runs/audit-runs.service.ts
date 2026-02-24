import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

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
    // Update status to "running"
    await this.prisma.auditRun.update({
      where: { id },
      data: { status: "running" },
    });

    // Simulate audit work (2 seconds)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate mock findings
    const findings = this.generateMockFindings();

    // Update status to "completed" and set findings
    return this.prisma.auditRun.update({
      where: { id },
      data: { status: "completed", findings },
    });
  }

  private generateMockFindings(): Findings {
    const items = [
      {
        id: "1",
        severity: "high" as const,
        title: "Hardcoded API credentials detected",
        evidence: "Found API key in src/config.ts:12",
        recommendation: "Move credentials to environment variables and use a secrets manager",
      },
      {
        id: "2",
        severity: "medium" as const,
        title: "Dependencies with known vulnerabilities",
        evidence: "3 packages have security advisories",
        recommendation: "Run npm audit fix to update vulnerable packages",
      },
      {
        id: "3",
        severity: "low" as const,
        title: "Missing input validation",
        evidence: "User input not validated in /api/users endpoint",
        recommendation: "Add input validation using a library like Zod or class-validator",
      },
    ];

    return {
      summary: {
        total: items.length,
        high: items.filter((i) => i.severity === "high").length,
        medium: items.filter((i) => i.severity === "medium").length,
        low: items.filter((i) => i.severity === "low").length,
      },
      items,
    };
  }
}