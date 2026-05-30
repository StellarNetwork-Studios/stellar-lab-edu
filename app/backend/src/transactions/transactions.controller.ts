import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags, ApiHeader } from "@nestjs/swagger";

import {
  GetTransactionsQueryDto,
  TransactionResponseDto,
} from "./dto/transaction.dto";
import { HorizonService } from "./horizon.service";

import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { ComposeTransactionDto } from "./dto/compose-transaction.dto";
import { SimulateTransactionDto } from "./dto/simulate.dto";
import { BuildTransactionDto } from "./dto/build.dto";
import { SubmitTransactionDto } from "./dto/submit.dto";
import { TransactionsService } from "./transaction.service";

@ApiTags("transactions")
@ApiHeader({
  name: "X-API-Key",
  description: "Optional API key for higher rate limits",
  required: false,
})
@UseGuards(ApiKeyGuard)
@Controller("transactions")
export class TransactionsController {
  constructor(
    private readonly horizonService: HorizonService,
    private readonly transactionService: TransactionsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Fetch recent Stellar transactions (payments)",
    description:
      "Fetches recent payment operations for a given account with caching and resilience. " +
      "Results are cached with configurable TTL (default 60 seconds) and support pagination via cursor. " +
      "Implements exponential backoff for Horizon API resilience and graceful degradation on failures. " +
      "This endpoint is rate-limited; API keys receive higher limits.",
  })
  @ApiResponse({
    status: 200,
    description: "List of normalized payment items",
    type: TransactionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid query parameters",
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded",
  })
  @ApiResponse({
    status: 503,
    description:
      "Horizon service rate limit exceeded, unavailable, or backoff in effect",
  })
  @ApiResponse({
    status: 502,
    description: "Bad gateway when Horizon returns server errors",
  })
  async getTransactions(
    @Query() query: GetTransactionsQueryDto,
  ): Promise<TransactionResponseDto> {
    const { accountId, asset, limit, cursor } = query;

    return this.horizonService.getPayments(accountId, asset, limit, cursor);
  }
  @Post("compose")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async compose(@Body() dto: ComposeTransactionDto) {
    return this.transactionService.composeTransaction(dto);
  }

  @Post("simulate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Simulate a contract invocation without building/submitting",
    description:
      "Validates parameters and returns resource/fee estimates with consistent, deterministic error codes. " +
      "Useful for preflight checks and user feedback before building a transaction.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Simulation result with resource estimates and fees, or user-actionable error",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters",
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async simulate(@Body() dto: SimulateTransactionDto) {
    return this.transactionService.simulateTransaction(dto);
  }

  @Post("build")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Build an unsigned transaction ready for signing",
    description:
      "Creates a canonical, unsigned transaction envelope with all necessary data for the client to sign. " +
      "Includes transaction hash for tracking and resource/fee estimates from simulation. " +
      "No private keys are ever handled by the backend.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Successfully built unsigned transaction with XDR, hash, and resource estimates",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters",
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async build(@Body() dto: BuildTransactionDto) {
    return this.transactionService.buildTransaction(dto);
  }

  @Post("submit")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Submit an already-signed transaction to the network",
    description:
      "Submits a pre-signed transaction envelope to the Stellar network via Soroban RPC. " +
      "Supports optional idempotency keys to ensure duplicate submissions return consistent outcomes. " +
      "Backend never handles private keys during submission.",
  })
  @ApiResponse({
    status: 200,
    description:
      "Successfully submitted transaction with hash, status, and optional metadata",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid XDR or request parameters",
  })
  @ApiResponse({
    status: 429,
    description: "Rate limit exceeded",
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async submit(@Body() dto: SubmitTransactionDto) {
    return this.transactionService.submitTransaction(dto);
  }
}
