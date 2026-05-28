import { Test, TestingModule } from "@nestjs/testing";
import * as StellarSdk from "@stellar/stellar-sdk";
import { TransactionsService } from "./transaction.service";
import { SorobanRpcService } from "./soroban-rpc.service";
import { ContractCompatibilityService } from "../contract/contract-compatibility.service";
import { AppConfigService } from "../config/app-config.service";

describe("TransactionsService", () => {
  let service: TransactionsService;
  let sorobanRpcService: jest.Mocked<SorobanRpcService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: SorobanRpcService,
          useValue: {
            getNetworkPassphrase: jest.fn().mockResolvedValue("Test Network Passphrase"),
            getAccount: jest.fn().mockResolvedValue(
              new StellarSdk.Account(
                StellarSdk.Keypair.random().publicKey(),
                "1",
              ),
            ),
            simulateTransaction: jest.fn(),
          },
        },
        {
          provide: ContractCompatibilityService,
          useValue: {
            validateComposeCompatibility: jest.fn().mockReturnValue({
              contractId: "GTESTCONTRACTID",
              currentVersion: "1.0.0",
              requiredVersion: "1.1.0",
              supported: false,
              schema: "quickex.v1",
              reason: "Contract version 1.0.0 does not meet the minimum required version 1.1.0 for 'initiate_payment'.",
              recommendation: "Upgrade contract GTESTCONTRACTID to at least version 1.1.0.",
              method: "initiate_payment",
            }),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            quickexContractId: "GTESTCONTRACTID",
            quickexContractVersion: "1.0.0",
            quickexContractSchema: "quickex.v1",
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    sorobanRpcService = module.get(SorobanRpcService);
  });

  it("rejects compose requests when contract version is unsupported", async () => {
    const result = await service.composeTransaction({
      contractId: "GTESTCONTRACTID",
      method: "initiate_payment",
      params: [],
      sourceAccount: "GABCDEF1234567890",
    });

    expect(result.success).toBe(false);
    expect((result as any).error).toBe("CONTRACT_VERSION_UNSUPPORTED");
    expect((result as any).contractCompatibility).toMatchObject({
      supported: false,
      requiredVersion: "1.1.0",
      currentVersion: "1.0.0",
    });
    expect(sorobanRpcService.simulateTransaction).not.toHaveBeenCalled();
  });
});
