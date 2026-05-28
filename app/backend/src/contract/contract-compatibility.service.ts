import { Injectable } from "@nestjs/common";
import { AppConfigService } from "../config/app-config.service";
import {
  ContractCompatibilityDto,
  ContractCompatibilityFlow,
} from "./contract-compatibility.types";

const DEFAULT_CONTRACT_VERSION = "1.0.0";
const DEFAULT_CONTRACT_SCHEMA = "quickex.v1";

const FLOW_MINIMUM_VERSION: Record<ContractCompatibilityFlow, string> = {
  linkMetadata: "1.0.0",
  paymentLinkStatus: "1.0.0",
  quote: "1.0.0",
  compose: "1.0.0",
};

const METHOD_MINIMUM_VERSION: Record<string, string> = {
  health_check: "1.0.0",
  initiate_payment: "1.1.0",
  settle_payment: "1.2.0",
};

@Injectable()
export class ContractCompatibilityService {
  constructor(private readonly appConfig: AppConfigService) {}

  buildCompatibility(
    flow: ContractCompatibilityFlow,
    contractId?: string,
    method?: string,
  ): ContractCompatibilityDto {
    const configuredContractId = this.appConfig.quickexContractId?.trim() ?? null;
    const configuredContractVersion = this.appConfig.quickexContractVersion?.trim() ?? null;
    const configuredSchema = this.appConfig.quickexContractSchema?.trim() ?? null;

    const targetContractId = contractId?.trim() ?? configuredContractId;
    const knownId = targetContractId !== null && configuredContractId === targetContractId;

    const currentVersion = knownId
      ? configuredContractVersion ?? DEFAULT_CONTRACT_VERSION
      : null;

    const requiredVersion = this.getRequiredVersion(flow, method);
    const schema = configuredSchema ?? DEFAULT_CONTRACT_SCHEMA;

    const supported = currentVersion !== null && this.isGreaterOrEqual(currentVersion, requiredVersion);

    const reason = this.buildReason(
      targetContractId,
      currentVersion,
      requiredVersion,
      supported,
      knownId,
      flow,
      method,
    );

    return {
      contractId: targetContractId,
      currentVersion,
      requiredVersion,
      supported,
      schema,
      reason,
      recommendation: this.buildRecommendation(targetContractId, currentVersion, requiredVersion, supported),
      method,
    };
  }

  validateComposeCompatibility(
    contractId: string,
    method: string,
  ): ContractCompatibilityDto {
    return this.buildCompatibility("compose", contractId, method);
  }

  private getRequiredVersion(flow: ContractCompatibilityFlow, method?: string): string {
    if (flow === "compose" && method) {
      return METHOD_MINIMUM_VERSION[method] ?? FLOW_MINIMUM_VERSION.compose;
    }
    return FLOW_MINIMUM_VERSION[flow];
  }

  private buildReason(
    contractId: string | null,
    currentVersion: string | null,
    requiredVersion: string,
    supported: boolean,
    knownId: boolean,
    flow: ContractCompatibilityFlow,
    method?: string,
  ): string {
    if (!contractId) {
      return "Contract deployment is not configured. Set QUICKEX_CONTRACT_ID.";
    }

    if (!knownId) {
      return "Contract ID is not recognized by this backend deployment.";
    }

    if (!currentVersion) {
      return "Contract version is unknown. Set QUICKEX_CONTRACT_VERSION for deterministic compatibility checks.";
    }

    if (!supported) {
      return method
        ? `Contract version ${currentVersion} does not meet the minimum required version ${requiredVersion} for '${method}'.`
        : `Contract version ${currentVersion} does not meet the minimum required version ${requiredVersion}.`;
    }

    return method
      ? `Contract deployment ${contractId} is compatible for '${method}' and '${flow}'.`
      : `Contract deployment ${contractId} is compatible for '${flow}'.`;
  }

  private buildRecommendation(
    contractId: string | null,
    currentVersion: string | null,
    requiredVersion: string,
    supported: boolean,
  ): string {
    if (!contractId) {
      return "Configure QUICKEX_CONTRACT_ID so that client compatibility metadata can be returned.";
    }
    if (!currentVersion) {
      return `Set QUICKEX_CONTRACT_VERSION=${requiredVersion} or higher for ${contractId}.`;
    }
    if (supported) {
      return `Continue using contract ${contractId} with version ${currentVersion}.`;
    }
    return `Upgrade contract ${contractId} to at least version ${requiredVersion}.`;
  }

  private isGreaterOrEqual(a: string, b: string): boolean {
    const [majorA, minorA, patchA] = this.parseVersion(a);
    const [majorB, minorB, patchB] = this.parseVersion(b);

    if (majorA !== majorB) return majorA > majorB;
    if (minorA !== minorB) return minorA > minorB;
    return patchA >= patchB;
  }

  private parseVersion(version: string): [number, number, number] {
    const parts = version.split(".").map((part) => Number(part));
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  }
}
