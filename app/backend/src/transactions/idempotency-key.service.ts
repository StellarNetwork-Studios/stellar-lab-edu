import { Injectable, Logger } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";

/**
 * Represents a stored idempotency key result for a transaction submission
 */
export interface IdempotencyKeyRecord {
  id: string;
  idempotencyKey: string;
  transactionHash: string;
  result: Record<string, unknown>; // Serialized SubmitTransactionResponse
  createdAt: string;
  expiresAt: string;
}

/**
 * Service for managing idempotency key storage and lookup
 * Ensures duplicate submissions with the same key return consistent outcomes
 */
@Injectable()
export class IdempotencyKeyService {
  private readonly logger = new Logger(IdempotencyKeyService.name);
  private readonly tableName = "tx_idempotency_keys";
  private readonly expirationHours = 24; // Keys expire after 24 hours

  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Look up a previous submission result by idempotency key
   * Returns null if not found or expired
   */
  async findByKey(
    idempotencyKey: string,
  ): Promise<IdempotencyKeyRecord | null> {
    try {
      const supabase = this.supabaseService.getClient();
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from(this.tableName)
        .select("*")
        .eq("idempotency_key", idempotencyKey)
        .gt("expires_at", now)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found is not an error
          return null;
        }
        throw error;
      }

      return data ? this.mapFromDb(data) : null;
    } catch (err) {
      this.logger.error(
        `Failed to look up idempotency key: ${idempotencyKey}`,
        err,
      );
      // On error, don't block the operation - just log and proceed
      return null;
    }
  }

  /**
   * Store the result of a transaction submission with an idempotency key
   */
  async store(
    idempotencyKey: string,
    transactionHash: string,
    result: Record<string, unknown>,
  ): Promise<void> {
    try {
      const supabase = this.supabaseService.getClient();
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.expirationHours * 60 * 60 * 1000,
      );

      const { error } = await supabase.from(this.tableName).insert({
        idempotency_key: idempotencyKey,
        transaction_hash: transactionHash,
        result,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        throw error;
      }

      this.logger.debug(
        `Stored idempotency key: ${idempotencyKey} for tx: ${transactionHash}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to store idempotency key: ${idempotencyKey}`,
        err,
      );
      // Non-critical failure - don't throw
    }
  }

  /**
   * Map database record to internal type
   */
  private mapFromDb(dbRecord: Record<string, unknown>): IdempotencyKeyRecord {
    return {
      id: String(dbRecord.id),
      idempotencyKey: String(dbRecord.idempotency_key),
      transactionHash: String(dbRecord.transaction_hash),
      result: dbRecord.result as Record<string, unknown>,
      createdAt: String(dbRecord.created_at),
      expiresAt: String(dbRecord.expires_at),
    };
  }
}
