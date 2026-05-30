import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ContractParamDto } from "./compose-transaction.dto";

/**
 * Request DTO for simulating a contract invocation without building/submitting
 * This endpoint returns deterministic failure reasons for user-actionable errors
 */
export class SimulateTransactionDto {
  @IsString()
  @IsNotEmpty()
  contractId: string; // C... Strkey contract address

  @IsString()
  @IsNotEmpty()
  method: string; // Contract function name

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractParamDto)
  params: ContractParamDto[];

  @IsString()
  @IsNotEmpty()
  sourceAccount: string; // G... Strkey public key (no private key)

  @IsString()
  @IsOptional()
  networkPassphrase?: string; // Defaults to testnet
}

/**
 * Simulation result with consistent error classification
 */
export interface SimulationResult {
  success: true;
  resourceEstimate: {
    cpuInstructions: number;
    memoryBytes: number;
    ledgerReads: number;
    ledgerWrites: number;
    eventBytes: number;
    returnValueBytes: number;
  };
  feeEstimate: {
    baseFee: string; // in stroops
    inclusionFee: string; // in stroops
    totalFee: string; // in stroops
    totalFeeXLM: string; // human-readable XLM
  };
  simulationLatencyMs: number;
}

/**
 * Consistent simulation error with user-actionable message
 */
export interface SimulationError {
  success: false;
  error: string; // Technical error code (e.g., "ACCOUNT_NOT_FOUND", "INSUFFICIENT_BALANCE", etc.)
  userMessage: string; // User-friendly message in English
  details?: Record<string, unknown>; // Additional context (e.g., required amount, available balance)
}

export type SimulateTransactionResponse = SimulationResult | SimulationError;
