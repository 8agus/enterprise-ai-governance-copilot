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
}