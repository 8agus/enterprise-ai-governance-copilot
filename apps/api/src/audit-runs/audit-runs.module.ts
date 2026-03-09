import { Module } from "@nestjs/common";
import { AuditRunsController } from "./audit-runs.controller";
import { AuditRunsService } from "./audit-runs.service";
import { PrismaModule } from "../prisma/prisma.module";
import { GithubIngestionService } from "./github-ingestion.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuditRunsController],
  providers: [AuditRunsService, GithubIngestionService],
})
export class AuditRunsModule {}
