import { Module } from "@nestjs/common";
import { AuditRunsController } from "./audit-runs.controller";
import { AuditRunsService } from "./audit-runs.service";
import { PrismaModule } from "../prisma/prisma.module";
import { GithubIngestionService } from "./github-ingestion.service";
import { SecurityScannerService } from "./security-scanner.service";
import { PrivacyScannerService } from "./privacy-scanner.service";
import { ResponsibleAiScannerService } from "./responsible-ai-scanner.service";
import { PolicyLoaderService } from "../policies/policy-loader.service";
import { ScoringService } from "./scoring.service";

@Module({
  imports: [PrismaModule],
  controllers: [AuditRunsController],
  providers: [
    AuditRunsService,
    GithubIngestionService,
    SecurityScannerService,
    PrivacyScannerService,
    ResponsibleAiScannerService,
    PolicyLoaderService,
    ScoringService,
  ],
})
export class AuditRunsModule {}
