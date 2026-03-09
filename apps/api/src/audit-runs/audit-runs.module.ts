import { Module } from "@nestjs/common";
import { AuditRunsController } from "./audit-runs.controller";
import { AuditRunsService } from "./audit-runs.service";
import { PrismaModule } from "../prisma/prisma.module";
import { GithubIngestionService } from "./github-ingestion.service";
import { SecurityScannerService } from "./security-scanner.service";
import { PrivacyScannerService } from "./privacy-scanner.service";
import { ResponsibleAiScannerService } from "./responsible-ai-scanner.service";
import { PoliciesModule } from "../policies/policies.module";
import { ScoringService } from "./scoring.service";

@Module({
  imports: [PrismaModule, PoliciesModule],
  controllers: [AuditRunsController],
  providers: [
    AuditRunsService,
    GithubIngestionService,
    SecurityScannerService,
    PrivacyScannerService,
    ResponsibleAiScannerService,
    ScoringService,
  ],
})
export class AuditRunsModule {}
