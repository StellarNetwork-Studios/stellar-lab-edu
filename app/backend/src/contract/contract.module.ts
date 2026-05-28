import { Module } from "@nestjs/common";
import { AppConfigModule } from "../config";
import { ContractCompatibilityService } from "./contract-compatibility.service";

@Module({
  imports: [AppConfigModule],
  providers: [ContractCompatibilityService],
  exports: [ContractCompatibilityService],
})
export class ContractModule {}
