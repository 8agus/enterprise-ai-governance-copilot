import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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

    // Update status to "completed" and return
    return this.prisma.auditRun.update({
      where: { id },
      data: { status: "completed" },
    });
  }
}