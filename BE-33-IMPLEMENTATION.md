# BE-33: Secure "Simulate + Build + Submit" Pipeline Implementation

## Overview
Implemented a complete backend-assisted transaction pipeline that enables secure transaction composition and submission without ever requiring custody of user secrets (private keys/seed phrases).

## Implementation Details

### 1. New Endpoints Added

#### POST `/transactions/simulate`
- **Purpose**: Validate parameters and return resource/fee estimates  
- **Security**: No transaction signing required, purely computational validation
- **Response**: 
  - Success: Resource estimates (CPU, memory, ledger operations), fee breakdown
  - Error: Deterministic error codes with user-actionable messages
- **Example**:
  ```json
  {
    "contractId": "C...",
    "method": "transfer",
    "params": [...],
    "sourceAccount": "G...",
    "networkPassphrase": "Test SDF Network ; September 2015"  // Optional, defaults to testnet
  }
  ```

#### POST `/transactions/build`
- **Purpose**: Create canonical unsigned transaction envelope ready for client signing
- **Security**: No private keys handled, returns base64-encoded unsigned XDR
- **Response Includes**:
  - `unsignedXdr`: Base64-encoded transaction ready for client signing
  - `hash`: Transaction hash for tracking/logging
  - `resourceEstimate`: CPU, memory, ledger operations forecast
  - `feeEstimate`: Base fee, resource fee, total fee in stroops and XLM
  - `buildLatencyMs` & `simulationLatencyMs`: Performance metrics
- **Optional Features**:
  - `memo`: Text memo field added to transaction

#### POST `/transactions/submit`
- **Purpose**: Submit pre-signed transactions to the network
- **Security**: Validates XDR signature without accessing private keys
- **Response Includes**:
  - `transactionHash`: Hex-encoded transaction hash
  - `ledger`: Ledger sequence when confirmed
  - `status`: "PENDING" or "CONFIRMED"
  - `submitLatencyMs`: Time to submit
  - `idempotencyKey`: Echoed if provided
- **Duplicate Handling** (via idempotency key):
  - `isDuplicate: true`: Returns original result with `originalSubmitTime`

### 2. Error Handling & Consistency

**Deterministic Error Codes**:
- `ACCOUNT_NOT_FOUND`: Source account missing/unfunded
- `INVALID_INPUT`: Parameter validation failure
- `AUTHORIZATION_REQUIRED`: Missing required signatures
- `MISSING_STATE_ENTRY`: Uninitialized contract state
- `BUDGET_EXCEEDED`: Computational limit exceeded
- `CONTRACT_NOT_FOUND`: Contract doesn't exist on network
- `INSUFFICIENT_BALANCE`: Not enough XLM for fees
- `TRANSACTION_TOO_LARGE`: Transaction size exceeds limits
- `RESTORE_REQUIRED`: Expired ledger entries must be restored first
- `RPC_ERROR`: Network connectivity issue
- `INVALID_XDR`: Malformed transaction envelope
- `DUPLICATE_TRANSACTION`: Already submitted to network
- `INVALID_TRANSACTION`: Network rejected invalid transaction
- `SUBMISSION_ERROR`: Generic submission failure

Each error includes:
- **`error`** (code): Machine-readable error code
- **`userMessage`**: Human-friendly, actionable message in English
- **`details`** (optional): Additional context (e.g., error types, technical details)

### 3. Idempotency Support

**Database Table**: `tx_idempotency_keys`
- `idempotency_key` (TEXT, UNIQUE): Client-provided UUID/identifier
- `transaction_hash` (TEXT): The Stellar transaction hash
- `result` (JSONB): Full submission response (serialized)
- `created_at` (TIMESTAMPTZ): First submission timestamp
- `expires_at` (TIMESTAMPTZ): Auto-expiration (24 hours)

**Behavior**:
- First submission: Stores result, returns success
- Duplicate (same key): Returns cached result with `isDuplicate: true`
- Expired key (>24h): Treated as new submission
- No key provided: No duplicate detection (stateless)

### 4. Service Architecture

**New/Updated Services**:

#### `IdempotencyKeyService`
- `findByKey(key)`: Lookup cached result, returns null if expired
- `store(key, hash, result)`: Persist submission result
- Non-critical failures don't block operations

#### `TransactionsService` Extensions
```typescript
async simulateTransaction(dto): Promise<SimulateTransactionResponse>
async buildTransaction(dto): Promise<BuildTransactionResponse>
async submitTransaction(dto): Promise<SubmitTransactionResponse>
```

#### `SorobanRpcService` Extensions
```typescript
async submitTransaction(tx): Promise<SendTransactionResponse>
```

### 5. Data Flow & Security Guarantees

```
Client                          Backend                     Stellar Network
  |                               |                              |
  |--1. POST /simulate----------->|                              |
  |<----Resource Estimates--------|                              |
  |                               |---Simulate (no sign)-------->|
  |                               |<---Estimates, Fees----------|
  |                               |                              |
  |--2. POST /build------------>|                              |
  |<----Unsigned XDR------------|                              |
  |                               |---Simulate (no sign)-------->|
  |                               |<---Assembly Data-----------|
  |                               |                              |
  | [Client Signs Locally]         |                              |
  |                               |                              |
  |--3. POST /submit----------->|                              |
  |   (signed XDR + idempotency)   |                              |
  |                               |---Submit Signed Tx--------->|
  |<----Success/Error------------|                              |
  |                               |<---Confirmed/Pending--------|
```

**Security Properties**:
- ✅ Backend **never** requests private keys
- ✅ Backend **never** stores private keys  
- ✅ Backend **never** signs transactions
- ✅ All signing happens client-side
- ✅ XDR validation ensures integrity
- ✅ Idempotency prevents double-submission issues

### 6. Database Migration

File: `20260603000000_create_tx_idempotency_keys_table.sql`
- Creates `tx_idempotency_keys` table
- Indexes on: `idempotency_key`, `expires_at`, `transaction_hash`
- 24-hour expiration prevents unbounded growth

### 7. Testing

File: `transaction.service.integration.spec.ts`
- ✅ Successful simulation with resource/fee estimates
- ✅ Account not found error handling
- ✅ Simulation failure classification
- ✅ Build with optional memo
- ✅ Successful transaction submission
- ✅ Idempotency key duplicate detection
- ✅ Result storage with idempotency keys
- ✅ Invalid XDR error handling
- ✅ Error classification (already included, invalid, too large)
- ✅ Error code consistency

## Acceptance Criteria Met

✅ **"Backend never requests or stores private keys/seed phrases"**
- No constructor parameters for keys
- No database columns for secrets
- All operations use public account IDs only
- Signing happens exclusively on client

✅ **"Simulation errors are consistent and user-actionable across clients"**
- Deterministic error code mapping (9+ error types covered)
- User-friendly English messages (no raw RPC errors)
- Consistent structure: `{ error, userMessage, details }`
- Pattern-based classification for common failures

✅ **"Duplicate submits with same idempotency key return the same outcome"**
- Database-backed idempotency key store
- 24-hour retention prevents unbounded growth
- Returns original response with `isDuplicate: true` flag
- Includes `originalSubmitTime` for audit trail

## Usage Examples

### Simulate Before Build
```bash
curl -X POST http://localhost:3000/transactions/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "C...",
    "method": "transfer",
    "params": [...],
    "sourceAccount": "G..."
  }'
```

### Build Unsigned Transaction
```bash
curl -X POST http://localhost:3000/transactions/build \
  -H "Content-Type: application/json" \
  -d '{
    "contractId": "C...",
    "method": "transfer",
    "params": [...],
    "sourceAccount": "G...",
    "memo": "payment-id-123"
  }'
```

### Submit with Idempotency
```bash
curl -X POST http://localhost:3000/transactions/submit \
  -H "Content-Type: application/json" \
  -d '{
    "signedXdr": "AAAAAgAAAA...",
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

## Deployment Notes

1. **Run database migration**: Apply `20260603000000_create_tx_idempotency_keys_table.sql`
2. **Update API documentation**: OpenAPI/Swagger specs auto-generated from annotations
3. **Rate limiting**: All endpoints protected by API key guard (existing)
4. **Monitoring**: Latency metrics logged for simulate/build/submit operations

## Future Enhancements

- Batch submission support for multiple transactions
- Webhook callbacks for transaction confirmation
- Advanced memo types (hash, return value)
- Transaction preview/cost estimation cache
- Rate-limiting per idempotency key to prevent abuse
