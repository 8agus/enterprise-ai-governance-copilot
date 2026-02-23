import { Module } from "@nestjs/common";
import { AuditRunsController } from "./audit-runs.controller";
import { AuditRunsService } from "./audit-runs.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AuditRunsController],
  providers: [AuditRunsService],
})
export class AuditRunsModule {}
