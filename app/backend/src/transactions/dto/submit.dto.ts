import { IsString, IsNotEmpty, IsOptional } from "class-validator";

/**
 * Request DTO for submitting an already-signed transaction
 * Supports idempotency keys for duplicate detection
 */
export class SubmitTransactionDto {
  @IsString()
  @IsNotEmpty()
  signedXdr: string; // Base64-encoded signed transaction XDR

  @IsString()
  @IsOptional()
  networkPassphrase?: string; // Defaults to testnet

  @IsString()
  @IsOptional()
  idempotencyKey?: string; // Optional UUID/key for duplicate detection and tracking
}

/**
 * Response when transaction is successfully submitted
 */
export interface SubmitTransactionSuccess {
  success: true;
  transactionHash: string; // Hex-encoded transaction hash
  ledger: number; // Ledger sequence when included
  status: "PENDING" | "CONFIRMED"; // PENDING if submitted but not yet on ledger, CONFIRMED if included
  resultMetaXdr?: string; // Optional result metadata XDR
  submitLatencyMs: number;
  idempotencyKey?: string; // Echoed back if provided
}

/**
 * Error response when submission fails
 */
export interface SubmitTransactionError {
  success: false;
  error: string; // Technical error code (e.g., "INVALID_XDR", "DUPLICATE_TX", etc.)
  userMessage: string; // User-friendly message
  details?: Record<string, unknown>;
}

/**
 * Response when a duplicate idempotency key is detected
 * Returns the original submission result
 */
export interface SubmitTransactionDuplicate extends SubmitTransactionSuccess {
  isDuplicate: true;
  originalSubmitTime: string; // ISO 8601 timestamp of original submission
}

export type SubmitTransactionResponse = SubmitTransactionSuccess | SubmitTransactionError | SubmitTransactionDuplicate;
