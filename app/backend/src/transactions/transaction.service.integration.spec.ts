import { Logger } from "@nestjs/common";
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { TransactionsService } from "./transaction.service";
import { SorobanRpcService } from "./soroban-rpc.service";
import { IdempotencyKeyService } from "./idempotency-key.service";
import { SimulateTransactionDto } from "./dto/simulate.dto";
import { BuildTransactionDto } from "./dto/build.dto";
import { SubmitTransactionDto } from "./dto/submit.dto";

describe("TransactionsService - Simulate, Build, Submit Pipeline", () => {
  let service: TransactionsService;
  let sorobanRpcService: jest.Mocked<SorobanRpcService>;
  let idempotencyKeyService: jest.Mocked<IdempotencyKeyService>;

  const testAccount = {
    accountId: () => "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXhofixwjbee5DCINVJUCHskf",
    sequenceNumber: () => "1234567890",
    incrementSequenceNumber: jest.fn(),
  } as any;

  const testNetworkPassphrase = "Test SDF Network ; September 2015";

  beforeEach(() => {
    // Mock Soroban RPC Service
    sorobanRpcService = {
      getNetworkPassphrase: jest.fn().mockResolvedValue(testNetworkPassphrase),
      getAccount: jest.fn().mockResolvedValue(testAccount),
      simulateTransaction: jest.fn(),
      submitTransaction: jest.fn(),
    } as unknown as jest.Mocked<SorobanRpcService>;

    // Mock Idempotency Key Service
    idempotencyKeyService = {
      findByKey: jest.fn(),
      store: jest.fn(),
    } as unknown as jest.Mocked<IdempotencyKeyService>;

    service = new TransactionsService(sorobanRpcService, idempotencyKeyService);

    // Suppress logger output
    jest.spyOn(service["logger"], "debug").mockImplementation();
    jest.spyOn(service["logger"], "info").mockImplementation();
    jest.spyOn(service["logger"], "warn").mockImplementation();
    jest.spyOn(service["logger"], "error").mockImplementation();
    jest.spyOn(service["logger"], "log").mockImplementation();
  });

  describe("simulateTransaction", () => {
    it("should successfully simulate a transaction and return resource/fee estimates", async () => {
      const dto: SimulateTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [
          { type: "address", value: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF" },
          { type: "address", value: "GDZST3XVCDTUJ76ZAV2HA72KYABU5AAEA3GNRGXYUV2SQP4HRJ5JJL5" },
          { type: "int128", value: "1000000" },
        ],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
      };

      // Mock successful simulation response
      const mockSimResult = {
        transactionData: {
          build: () => ({
            resources: () => ({
              instructions: () => BigInt(100000),
              footprint: () => ({
                readOnly: () => [1, 2],
                readWrite: () => [3],
              }),
              writeBytes: () => 1024,
            }),
          }),
        },
        minResourceFee: "5000",
        result: { retval: { toXDR: () => Buffer.from("abc", "hex") } },
      } as any;

      sorobanRpcService.simulateTransaction.mockResolvedValue(mockSimResult);

      const result = await service.simulateTransaction(dto);

      expect(result.success).toBe(true);
      expect(result.feeEstimate).toBeDefined();
      expect(result.feeEstimate.totalFee).toBe("5100"); // BASE_FEE (100) + minResourceFee (5000)
      expect(result.resourceEstimate).toBeDefined();
      expect(result.simulationLatencyMs).toBeGreaterThan(0);
    });

    it("should return error when account not found", async () => {
      const dto: SimulateTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
      };

      sorobanRpcService.getAccount.mockRejectedValue(new Error("Account not found"));

      const result = await service.simulateTransaction(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe("ACCOUNT_NOT_FOUND");
      expect(result.userMessage).toContain("does not exist on the network");
    });

    it("should return error when simulation fails", async () => {
      const dto: SimulateTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
      };

      const mockError = {
        error: "HostError: error(0, 0)",
      } as any;

      sorobanRpcService.simulateTransaction.mockResolvedValue(mockError);

      const result = await service.simulateTransaction(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("buildTransaction", () => {
    it("should successfully build an unsigned transaction", async () => {
      const dto: BuildTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [
          { type: "address", value: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF" },
        ],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
        memo: "test-memo",
      };

      const mockSimResult = {
        transactionData: {
          build: () => ({
            resources: () => ({
              instructions: () => BigInt(100000),
              footprint: () => ({
                readOnly: () => [1],
                readWrite: () => [],
              }),
              writeBytes: () => 512,
            }),
          }),
        },
        minResourceFee: "3000",
        result: { retval: { toXDR: () => Buffer.from("xyz", "hex") } },
      } as any;

      sorobanRpcService.simulateTransaction.mockResolvedValue(mockSimResult);

      const result = await service.buildTransaction(dto);

      expect(result.success).toBe(true);
      expect(result.unsignedXdr).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.feeEstimate).toBeDefined();
      expect(result.resourceEstimate).toBeDefined();
    });

    it("should include optional memo in built transaction", async () => {
      const dto: BuildTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
        memo: "custom-memo",
      };

      const mockSimResult = {
        transactionData: {
          build: () => ({
            resources: () => ({
              instructions: () => BigInt(100000),
              footprint: () => ({
                readOnly: () => [],
                readWrite: () => [],
              }),
              writeBytes: () => 0,
            }),
          }),
        },
        minResourceFee: "100",
        result: { retval: { toXDR: () => Buffer.from("", "hex") } },
      } as any;

      sorobanRpcService.simulateTransaction.mockResolvedValue(mockSimResult);

      const result = await service.buildTransaction(dto);

      expect(result.success).toBe(true);
      expect(result.unsignedXdr).toBeDefined();
    });
  });

  describe("submitTransaction", () => {
    it("should successfully submit a signed transaction", async () => {
      const signedXdr = StellarSdk.TransactionBuilder.buildFeeBumpTransaction(
        "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
        "100",
        new StellarSdk.TransactionBuilder(testAccount, {
          fee: "100",
          networkPassphrase: testNetworkPassphrase,
        })
          .addOperation(
            new StellarSdk.Operation.Payment({
              destination: "GDZST3XVCDTUJ76ZAV2HA72KYABU5AAEA3GNRGXYUV2SQP4HRJ5JJL5",
              asset: StellarSdk.Asset.native(),
              amount: "10",
            }),
          )
          .setTimeout(30)
          .build(),
        testNetworkPassphrase,
      ).toEnvelope().toXDR("base64");

      const dto: SubmitTransactionDto = {
        signedXdr,
        networkPassphrase: testNetworkPassphrase,
      };

      const mockSubmitResult = {
        status: "PENDING",
        hash: "abc123",
        ledger: 123,
      } as any;

      sorobanRpcService.submitTransaction.mockResolvedValue(mockSubmitResult);

      const result = await service.submitTransaction(dto);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBeDefined();
      expect(result.submitLatencyMs).toBeGreaterThan(0);
    });

    it("should return cached result for duplicate idempotency key", async () => {
      const signedXdr = "base64encodedxdr";
      const idempotencyKey = "test-idempotency-key-123";

      const cachedResult = {
        id: "rec-id",
        idempotencyKey,
        transactionHash: "cached-hash",
        result: {
          success: true,
          transactionHash: "cached-hash",
          ledger: 100,
          status: "CONFIRMED",
          submitLatencyMs: 5000,
        },
        createdAt: "2026-03-30T12:00:00Z",
        expiresAt: "2026-04-01T12:00:00Z",
      };

      idempotencyKeyService.findByKey.mockResolvedValue(cachedResult);

      const dto: SubmitTransactionDto = {
        signedXdr,
        networkPassphrase: testNetworkPassphrase,
        idempotencyKey,
      };

      // Mock XDR parsing
      jest
        .spyOn(StellarSdk.TransactionEnvelope, "fromXDR")
        .mockReturnValue({
          hash: () => Buffer.from("abc123", "hex"),
        } as any);

      const result = await service.submitTransaction(dto);

      expect(result.isDuplicate).toBe(true);
      expect(result.originalSubmitTime).toBe(cachedResult.createdAt);
      expect(idempotencyKeyService.findByKey).toHaveBeenCalledWith(idempotencyKey);
    });

    it("should store successful submission with idempotency key", async () => {
      const signedXdr = "base64encodedxdr";
      const idempotencyKey = "test-idempotency-key-456";

      const dto: SubmitTransactionDto = {
        signedXdr,
        networkPassphrase: testNetworkPassphrase,
        idempotencyKey,
      };

      idempotencyKeyService.findByKey.mockResolvedValue(null);

      const mockSubmitResult = {
        status: "PENDING",
        hash: "tx-hash-123",
        ledger: 200,
      } as any;

      sorobanRpcService.submitTransaction.mockResolvedValue(mockSubmitResult);

      // Mock XDR parsing
      jest
        .spyOn(StellarSdk.TransactionEnvelope, "fromXDR")
        .mockReturnValue({
          hash: () => Buffer.from("abc123", "hex"),
        } as any);

      const result = await service.submitTransaction(dto);

      expect(result.success).toBe(true);
      expect(idempotencyKeyService.store).toHaveBeenCalledWith(
        idempotencyKey,
        expect.any(String),
        expect.objectContaining({
          success: true,
          transactionHash: expect.any(String),
        }),
      );
    });

    it("should return error for invalid XDR", async () => {
      const dto: SubmitTransactionDto = {
        signedXdr: "invalid-xdr",
        networkPassphrase: testNetworkPassphrase,
      };

      jest
        .spyOn(StellarSdk.TransactionEnvelope, "fromXDR")
        .mockImplementation(() => {
          throw new Error("Invalid XDR");
        });

      const result = await service.submitTransaction(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_XDR");
    });

    it("should classify submission errors appropriately", async () => {
      const signedXdr = "base64encodedxdr";

      const dto: SubmitTransactionDto = {
        signedXdr,
        networkPassphrase: testNetworkPassphrase,
      };

      // Mock XDR parsing
      jest
        .spyOn(StellarSdk.TransactionEnvelope, "fromXDR")
        .mockReturnValue({
          hash: () => Buffer.from("abc123", "hex"),
        } as any);

      sorobanRpcService.submitTransaction.mockRejectedValue(
        new Error("transaction already included in ledger"),
      );

      const result = await service.submitTransaction(dto);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DUPLICATE_TRANSACTION");
      expect(result.userMessage).toContain("already been submitted");
    });
  });

  describe("Error Code Consistency", () => {
    it("should return consistent error codes for predictable failures", async () => {
      const dto: SimulateTransactionDto = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        method: "transfer",
        params: [],
        sourceAccount: "GBZVMB74Z7THQGSQ52GQCQVLBALCJD5XVXOFIXWJBEE5DCINVJUCHSKF",
      };

      // Test insufficient balance error
      sorobanRpcService.getAccount.mockRejectedValue(
        new Error("insufficient balance"),
      );

      const result1 = await service.simulateTransaction(dto);
      expect(result1.error).toBeDefined();

      // Test contract not found error
      sorobanRpcService.getAccount.mockResolvedValue(testAccount);
      sorobanRpcService.simulateTransaction.mockResolvedValue({
        error: "contract does not exist on this network",
      } as any);

      const result2 = await service.simulateTransaction(dto);
      expect(result2.error).toBeDefined();
    });
  });
});
