import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";

import { AppConfigService } from "../../config";
import { CursorRepository } from "../cursor.repository";
import { EscrowEventRepository } from "../escrow-event.repository";
import {
  SorobanEventParser,
  RawHorizonContractEvent,
} from "../soroban-event.parser";
import { StellarIngestionService } from "../stellar-ingestion.service";
import type { EscrowDepositedEvent } from "../types/contract-event.types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawEvent(
  overrides: Partial<RawHorizonContractEvent> = {},
): RawHorizonContractEvent {
  return {
    id: "evt-1",
    paging_token: "100-1",
    transaction_hash: "abc123",
    ledger: 100,
    created_at: "2025-01-01T00:00:00Z",
    contract_id: "CTEST",
    type: "contract",
    topic: [],
    value: { xdr: "" },
    ...overrides,
  };
}

function makeEscrowDepositedEvent(
  overrides: Partial<EscrowDepositedEvent> = {},
): EscrowDepositedEvent {
  return {
    eventType: "EscrowDeposited",
    txHash: "abc123",
    ledgerSequence: 100,
    pagingToken: "100-1",
    contractTimestamp: 1700000000n,
    commitment: "deadbeef".repeat(8),
    owner: "GABC",
    token: "CTOKEN",
    amount: 1000000n,
    expiresAt: 1800000000n,
    ...overrides,
  };
}

// Flush all microtasks/promises in the queue
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockCursorRepo = (): jest.Mocked<CursorRepository> =>
  ({
    getCursor: jest.fn().mockResolvedValue(null),
    saveCursor: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<CursorRepository>;

const mockEscrowRepo = (): jest.Mocked<EscrowEventRepository> =>
  ({
    upsertEvent: jest.fn().mockResolvedValue(undefined),
  }) as unknown as jest.Mocked<EscrowEventRepository>;

const mockParser = (): jest.Mocked<SorobanEventParser> =>
  ({
    parse: jest.fn().mockReturnValue(null),
  }) as unknown as jest.Mocked<SorobanEventParser>;

const mockConfig = (): Partial<AppConfigService> => ({
  network: "testnet",
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StellarIngestionService", () => {
  let service: StellarIngestionService;
  let cursorRepo: jest.Mocked<CursorRepository>;
  let escrowRepo: jest.Mocked<EscrowEventRepository>;
  let parser: jest.Mocked<SorobanEventParser>;
  let eventEmitter: EventEmitter2;
  let module: TestingModule;

  let capturedOnError: ((err: unknown) => void) | null = null;
  const mockStop = jest.fn();

  // Helper to trigger a message and wait for all async processing to complete
  const triggerMessage = async (raw: RawHorizonContractEvent) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).handleRecord(raw, "contract:CTEST");
  };

  beforeEach(async () => {
    cursorRepo = mockCursorRepo();
    escrowRepo = mockEscrowRepo();
    parser = mockParser();
    capturedOnError = null;
    mockStop.mockClear();

    module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot({ wildcard: true, delimiter: "." })],
      providers: [
        StellarIngestionService,
        { provide: AppConfigService, useValue: mockConfig() },
        { provide: CursorRepository, useValue: cursorRepo },
        { provide: EscrowEventRepository, useValue: escrowRepo },
        { provide: SorobanEventParser, useValue: parser },
      ],
    }).compile();

    service = module.get(StellarIngestionService);
    eventEmitter = module.get(EventEmitter2);

    // Stub the Horizon.Server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any).server = {
      contractEvents: jest.fn().mockImplementation(() => ({
        cursor: jest.fn().mockReturnThis(),
        stream: jest.fn().mockImplementation(({ onerror }) => {
          capturedOnError = onerror as (err: unknown) => void;
          return mockStop;
        }),
      })),
    };
  });

  afterEach(async () => {
    service.onModuleDestroy();
    await module.close();
  });

  // -------------------------------------------------------------------------
  // Cursor resumption
  // -------------------------------------------------------------------------

  describe("cursor resumption", () => {
    it('starts from "now" when no cursor exists', async () => {
      cursorRepo.getCursor.mockResolvedValue(null);
      await service.startStreaming("CTEST");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const server = (service as any).server;
      expect(server.contractEvents).toHaveBeenCalledWith("CTEST");
    });

    it("resumes from stored cursor when one exists", async () => {
      cursorRepo.getCursor.mockResolvedValue("99-5");
      await service.startStreaming("CTEST");
      expect(cursorRepo.getCursor).toHaveBeenCalledWith("contract:CTEST");
    });
  });

  // -------------------------------------------------------------------------
  // Event processing
  // -------------------------------------------------------------------------

  describe("event processing", () => {
    beforeEach(async () => {
      await service.startStreaming("CTEST");
    });

    it("advances cursor even for unrecognised events", async () => {
      parser.parse.mockReturnValue(null);
      const raw = makeRawEvent({ paging_token: "101-1", ledger: 101 });
      await triggerMessage(raw);

      expect(cursorRepo.saveCursor).toHaveBeenCalledWith(
        "contract:CTEST",
        "101-1",
        101,
      );
      expect(escrowRepo.upsertEvent).not.toHaveBeenCalled();
    });

    it("persists EscrowDeposited and advances cursor", async () => {
      const event = makeEscrowDepositedEvent();
      parser.parse.mockReturnValue(event);

      await triggerMessage(makeRawEvent());

      expect(escrowRepo.upsertEvent).toHaveBeenCalledWith(event);
      expect(cursorRepo.saveCursor).toHaveBeenCalledWith(
        "contract:CTEST",
        "100-1",
        100,
      );
    });

    it("emits a domain event via EventEmitter2", async () => {
      const event = makeEscrowDepositedEvent();
      parser.parse.mockReturnValue(event);

      const listener = jest.fn();
      eventEmitter.on("stellar.EscrowDeposited", listener);

      await triggerMessage(makeRawEvent());
      await flushPromises();

      expect(listener).toHaveBeenCalledWith(event);
    });

    it("does NOT throw when cursor save fails (non-fatal)", async () => {
      parser.parse.mockReturnValue(null);
      cursorRepo.saveCursor.mockRejectedValue(new Error("DB down"));

      await expect(triggerMessage(makeRawEvent())).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  describe("idempotency", () => {
    it("calls upsertEvent (ON CONFLICT DO NOTHING) on duplicate events", async () => {
      const event = makeEscrowDepositedEvent();
      parser.parse.mockReturnValue(event);
      escrowRepo.upsertEvent.mockResolvedValue(undefined);

      await service.startStreaming("CTEST");

      const raw = makeRawEvent();
      await triggerMessage(raw);
      await triggerMessage(raw); // replay same event

      expect(escrowRepo.upsertEvent).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Stream disconnection and reconnection
  // -------------------------------------------------------------------------

  describe("reconnection", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("schedules a reconnect when stream emits an error", async () => {
      await service.startStreaming("CTEST");
      const openStreamSpy = jest.spyOn(
        service as unknown as { openStream: () => Promise<void> },
        "openStream" as never,
      );

      capturedOnError!(new Error("Connection reset"));
      jest.advanceTimersByTime(1_100);

      expect(openStreamSpy).toHaveBeenCalledTimes(1);
    });

    it("uses exponential back-off on repeated failures", async () => {
      await service.startStreaming("CTEST");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svc = service as any;

      capturedOnError!(new Error("disconnect 1"));
      expect(svc.currentBackoffMs).toBe(2_000);

      jest.advanceTimersByTime(2_100);
      capturedOnError!(new Error("disconnect 2"));
      expect(svc.currentBackoffMs).toBe(4_000);

      capturedOnError!(new Error("disconnect 3"));
      expect(svc.currentBackoffMs).toBe(8_000);
    });

    it("caps backoff at MAX_BACKOFF_MS (60 s)", async () => {
      await service.startStreaming("CTEST");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svc = service as any;
      svc.currentBackoffMs = 32_000;

      capturedOnError!(new Error("disconnect"));
      expect(svc.currentBackoffMs).toBe(60_000);
    });

    it("does not reconnect after onModuleDestroy()", async () => {
      await service.startStreaming("CTEST");
      service.onModuleDestroy();

      const openStreamSpy = jest.spyOn(
        service as unknown as { openStream: () => Promise<void> },
        "openStream" as never,
      );
      capturedOnError!(new Error("late error"));

      jest.advanceTimersByTime(2_000);
      expect(openStreamSpy).not.toHaveBeenCalled();
    });
  });
});
