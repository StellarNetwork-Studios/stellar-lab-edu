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
 * Request DTO for building an unsigned transaction
 * Similar to compose but always returns the built transaction (not just successful cases)
 */
export class BuildTransactionDto {
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

  @IsString()
  @IsOptional()
  memo?: string; // Optional memo field for the transaction
}

/**
 * Response for a successfully built transaction
 */
export interface BuildTransactionSuccess {
  success: true;
  unsignedXdr: string; // Base64-encoded unsigned transaction XDR
  hash: string; // Transaction hash (hex-encoded)
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
  buildLatencyMs: number;
  simulationLatencyMs: number;
}

/**
 * Error response when build fails
 */
export interface BuildTransactionError {
  success: false;
  error: string; // Technical error code
  userMessage: string; // User-friendly message
  details?: Record<string, unknown>;
}

export type BuildTransactionResponse = BuildTransactionSuccess | BuildTransactionError;
