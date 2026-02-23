import { Body, Controller, Get, Post } from "@nestjs/common";
import { AuditRunsService } from "./audit-runs.service";

type CreateAuditRunBody = {
  repoUrl: string;
};

@Controller("audit-runs")
export class AuditRunsController {
  constructor(private readonly auditRuns: AuditRunsService) {}

  @Post()
  async create(@Body() body: CreateAuditRunBody) {
    return this.auditRuns.create(body.repoUrl);
  }

  @Get()
  async list() {
    return this.auditRuns.list();
  }
}