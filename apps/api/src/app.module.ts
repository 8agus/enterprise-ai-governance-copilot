import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from "./prisma/prisma.module";
import { AuditRunsModule } from "./audit-runs/audit-runs.module";

@Module({
  imports: [PrismaModule, AuditRunsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
