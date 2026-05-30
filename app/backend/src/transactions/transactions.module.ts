import { Module } from "@nestjs/common";
import { TransactionsController } from "./transactions.controller";
import { HorizonService } from "./horizon.service";
import { AppConfigModule } from "../config";
import { TransactionsService } from "./transaction.service";
import { SorobanRpcService } from "./soroban-rpc.service";
import { ApiKeysModule } from "../api-keys/api-keys.module";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { SupabaseModule } from "../supabase/supabase.module";
import { IdempotencyKeyService } from "./idempotency-key.service";

@Module({
  imports: [AppConfigModule, ApiKeysModule, SupabaseModule],
  controllers: [TransactionsController],
  providers: [
    HorizonService,
    TransactionsService,
    SorobanRpcService,
    IdempotencyKeyService,
    ApiKeyGuard,
  ],
  exports: [
    HorizonService,
    TransactionsService,
    SorobanRpcService,
    IdempotencyKeyService,
  ],
})
export class TransactionsModule {}
