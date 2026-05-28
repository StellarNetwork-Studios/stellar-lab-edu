import { Test, TestingModule } from "@nestjs/testing";
import { AppConfigService } from "../config/app-config.service";
import { ContractCompatibilityService } from "./contract-compatibility.service";

describe("ContractCompatibilityService", () => {
  let service: ContractCompatibilityService;
  let appConfig: {
    quickexContractId?: string;
    quickexContractVersion?: string;
    quickexContractSchema?: string;
  };

  beforeEach(async () => {
    appConfig = {
      quickexContractId: "GTESTCONTRACTID",
      quickexContractVersion: "1.0.0",
      quickexContractSchema: "quickex.v1",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractCompatibilityService,
        {
          provide: AppConfigService,
          useValue: appConfig,
        },
      ],
    }).compile();

    service = module.get<ContractCompatibilityService>(ContractCompatibilityService);
  });

  it("marks a known configured contract as compatible for read flows", () => {
    const compatibility = service.buildCompatibility("linkMetadata");
    expect(compatibility.supported).toBe(true);
    expect(compatibility.requiredVersion).toBe("1.0.0");
    expect(compatibility.currentVersion).toBe("1.0.0");
    expect(compatibility.reason).toContain("compatible");
  });

  it("returns unsupported for compose methods requiring newer versions", () => {
    const compatibility = service.validateComposeCompatibility("GTESTCONTRACTID", "initiate_payment");
    expect(compatibility.supported).toBe(false);
    expect(compatibility.requiredVersion).toBe("1.1.0");
    expect(compatibility.reason).toContain("does not meet");
  });

  it("treats unknown contract IDs as incompatible", () => {
    const compatibility = service.buildCompatibility("quote", "GOTHERCONTRACTID");
    expect(compatibility.supported).toBe(false);
    expect(compatibility.reason).toContain("not recognized");
  });
});
