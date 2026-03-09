import { Module } from "@nestjs/common";
import { PolicyLoaderService } from "./policy-loader.service";
import { PoliciesController } from "./policies.controller";

@Module({
  controllers: [PoliciesController],
  providers: [PolicyLoaderService],
  exports: [PolicyLoaderService],
})
export class PoliciesModule {}