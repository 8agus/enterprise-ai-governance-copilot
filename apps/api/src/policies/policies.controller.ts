import { Controller, Get } from "@nestjs/common";
import { PolicyLoaderService } from "./policy-loader.service";

@Controller("policies")
export class PoliciesController {
  constructor(private readonly policyLoader: PolicyLoaderService) {}

  @Get("governance")
  governance() {
    return this.policyLoader.getGovernancePolicies();
  }
}