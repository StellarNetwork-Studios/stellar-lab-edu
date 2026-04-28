# QuickEx Backend Architecture Exploration

**Date**: April 28, 2026  
**Focus**: Multi-tenancy design understanding  
**Scope**: Thorough analysis of database schema, authentication, API patterns, user/org handling, and permission logic

---

## Table of Contents

1. [Database Schema & Entities](#1-database-schema--entities)
2. [Authentication & Middleware Patterns](#2-authentication--middleware-patterns)
3. [API Request/Response Structure](#3-api-requestresponse-structure)
4. [User/Organization Context Handling](#4-userorganization-context-handling)
5. [Role/Permission Logic](#5-rolepermission-logic)
6. [Key Services & Architecture](#6-key-services--architecture)
7. [Multi-Tenancy Readiness Analysis](#7-multi-tenancy-readiness-analysis)

---

## 1. Database Schema & Entities

### 1.1 Current Core Tables

#### **usernames** (`20250219000000_create_usernames_table.sql`)
Stores Stellar username registrations for `quickex.to/username` URLs.

```sql
CREATE TABLE usernames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,                           -- Normalized (lowercase)
  public_key TEXT NOT NULL,                         -- Stellar public key (owner)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT usernames_username_unique UNIQUE (username),
  CONSTRAINT usernames_username_lowercase CHECK (username = lower(username))
);

CREATE INDEX usernames_public_key_idx ON usernames (public_key);
```

**Key Points:**
- One-to-many: one public_key can own multiple usernames (if quota allows)
- Uniqueness enforced at DB level to prevent race conditions
- Identifier: public_key (Stellar account)

---

#### **api_keys** (`20260328000000_create_api_keys_table.sql`)
API key management for developer authentication.

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,                           -- bcrypt hash
  key_prefix TEXT NOT NULL,                         -- first 11 chars (for fast lookup)
  scopes TEXT[] NOT NULL DEFAULT '{}',              -- Granular permissions
  owner_id TEXT,                                    -- Optional: wallet or user ID
  is_active BOOLEAN NOT NULL DEFAULT true,
  request_count INTEGER NOT NULL DEFAULT 0,
  monthly_quota INTEGER NOT NULL DEFAULT 10000,
  last_used_at TIMESTAMPTZ,
  
  -- Rotation support (24-hour overlap)
  key_hash_old TEXT,                                -- Old hash during rotation
  rotated_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_prefix ON api_keys (key_prefix) WHERE is_active = true;
CREATE INDEX idx_api_keys_owner_id ON api_keys (owner_id) WHERE is_active = true;
```

**Scopes:**
```
'links:read'       -- Query link metadata
'links:write'      -- Create/manage links
'transactions:read'-- Query transactions
'usernames:read'   -- Search usernames
'refunds:write'    -- Initiate refunds
'admin'            -- Administrative operations
```

**Key Points:**
- Quota reset monthly
- Soft-delete via `is_active` flag
- Rotation with 24-hour overlap period
- Usage tracking (requests per month)

---

#### **notification_preferences** (`20250225000001_create_notification_tables.sql`)
Per-user, per-channel notification subscription settings.

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key TEXT NOT NULL,                         -- Stellar public key (subscriber)
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'webhook', 'telegram')),
  
  -- Channel-specific destination
  email TEXT,                                       -- For email channel
  push_token TEXT,                                  -- Expo token for push
  webhook_url TEXT,                                 -- For webhook delivery
  
  events TEXT[] DEFAULT NULL,                       -- Subscribed event types (null=all)
  min_amount_stroops BIGINT DEFAULT 0,              -- Amount threshold filter
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT notification_preferences_unique UNIQUE (public_key, channel)
);

CREATE INDEX notification_preferences_public_key_idx ON notification_preferences (public_key);
```

**Example Events:**
- `EscrowDeposited` (contract event)
- `payment.received` (transaction event)

---

#### **notification_log** (`20250225000001_create_notification_tables.sql`)
Append-only delivery audit trail for notifications.

```sql
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_key TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'webhook', 'telegram')),
  event_type TEXT NOT NULL,                         -- Event name
  event_id TEXT NOT NULL,                           -- paging_token or tx_hash
  
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  provider_message_id TEXT,                         -- Provider's message ID
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT notification_log_unique UNIQUE (public_key, channel, event_id, event_type)
);

CREATE INDEX notification_log_public_key_idx ON notification_log (public_key);
CREATE INDEX notification_log_status_idx ON notification_log (status);
```

---

#### **telegram_user_mappings** (`20260328000001_create_telegram_bot_tables.sql`)
Telegram bot integration for notifications.

```sql
CREATE TABLE telegram_user_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL,
  username TEXT,                                    -- Telegram username
  public_key TEXT NOT NULL,                         -- Stellar public key
  
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_code TEXT,                           -- One-time code
  
  enabled BOOLEAN NOT NULL DEFAULT true,
  min_amount_stroops BIGINT DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ...
);
```

---

#### **refund_attempts** & **refund_audit_log** (`20260425000000_create_refund_tables.sql`)
Refund workflow with idempotency and audit trail.

```sql
CREATE TABLE refund_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,             -- For idempotency
  entity_type TEXT NOT NULL 
    CHECK (entity_type IN ('payment', 'escrow', 'link')),
  entity_id TEXT NOT NULL,
  reason_code TEXT NOT NULL 
    CHECK (reason_code IN ('DUPLICATE', 'FRAUD', 'CUSTOMER_REQUEST', 'TECHNICAL_ERROR')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'failed')),
  actor_id TEXT NOT NULL,                           -- Who initiated refund
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refund_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_id UUID NOT NULL REFERENCES refund_attempts (id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,                           -- Who made the change
  action TEXT NOT NULL,
  reason_code TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

#### **feature_flags** (`20260428000000_create_feature_flags_and_admin_audit.sql`)
Feature flag management system.

```sql
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER NOT NULL DEFAULT 0,    -- 0-100 for gradual rollouts
  allowed_users JSONB NOT NULL DEFAULT '[]'::jsonb, -- Allowlist
  environments JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Environment-specific
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

---

#### **admin_audit_logs** (`20260428000000_create_feature_flags_and_admin_audit.sql`)
Admin action audit trail.

```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX admin_audit_logs_action_created_at_idx
  ON admin_audit_logs (action, created_at DESC);
CREATE INDEX admin_audit_logs_actor_created_at_idx
  ON admin_audit_logs (actor, created_at DESC);
```

---

### 1.2 Critical Observation: NO Organizations/Tenants

**Current Architecture is Single-Tenant:**

- ✗ No `organization_id` column in any table
- ✗ All data keyed by **Stellar public key** as the only identifier
- ✗ No multi-tenant isolation at the database layer
- ✓ `api_keys.owner_id` is optional and used for tracking, not enforcing tenant context
- ✗ Webhook/notification subscriptions tied directly to public_key

**Implications:**

- Currently: 1 Stellar account = 1 "user" in the system
- To support multi-tenancy: Need to introduce organizations as first-class entities
- All queries must be updated to filter by `organization_id`

---

## 2. Authentication & Middleware Patterns

### 2.1 API Key Guard

**Location:** `src/auth/guards/api-key.guard.ts`

```typescript
@Injectable()
export class ApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey: string | undefined = request.headers["x-api-key"];

    if (!rawKey) return true; // Public access allowed

    const result = await this.apiKeysService.validateKey(rawKey);

    if (!result) {
      throw new UnauthorizedException({
        error: "INVALID_API_KEY",
        message: "API key is invalid",
      });
    }

    const { record, hasScope } = result;

    if (this.apiKeysService.isOverQuota(record)) {
      throw new ForbiddenException({
        error: "QUOTA_EXCEEDED",
        message: "Monthly request quota exceeded",
      });
    }

    // Check required scopes
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()]
    ) ?? [];

    for (const scope of requiredScopes) {
      if (!hasScope(scope)) {
        throw new ForbiddenException({
          error: "INSUFFICIENT_SCOPE",
          message: `API key missing required scope: ${scope}`,
        });
      }
    }

    // Attach to request
    request.apiKey = {
      id: record.id,
      name: record.name,
      scopes: record.scopes,
      rateLimit: throttlerConfig.groups.authenticated.sustained.limit,
    };

    return true;
  }
}
```

**Flow:**
1. Extract `X-API-Key` header (optional)
2. If present, validate against bcrypt hash (prefix lookup, then full comparison)
3. Check quota (monthly reset)
4. Check required scopes via `@RequireScopes()` decorator
5. Attach API key record to `request.apiKey`

**Validation Logic** (`src/api-keys/api-keys.service.ts`):

```typescript
async validateKey(rawKey: string) {
  const prefix = rawKey.slice(0, 11); // "qx_" + 8 chars
  const candidates = await this.repo.findByPrefix(prefix);

  for (const record of candidates) {
    // Try current hash
    const isCurrentMatch = await bcrypt.compare(rawKey, record.key_hash);

    // Try old hash within 24-hour overlap window
    let isOldMatch = false;
    if (!isCurrentMatch && record.key_hash_old && record.rotated_at) {
      const overlapMs = 24 * 60 * 60 * 1000;
      if (now - rotatedAt < overlapMs) {
        isOldMatch = await bcrypt.compare(rawKey, record.key_hash_old);
      }
    }

    if (isCurrentMatch || isOldMatch) {
      // Fire-and-forget usage increment
      this.repo.incrementUsage(record.id).catch(err => 
        this.logger.warn(`Failed to increment usage: ${err}`)
      );
      
      return {
        record,
        hasScope: (scope: ApiKeyScope) => record.scopes.includes(scope)
      };
    }
  }

  return null;
}
```

**Key Points:**
- Prefix-based lookup for performance (B-tree index)
- bcrypt comparison (expensive, but only on candidates)
- 24-hour rotation overlap for zero-downtime key rotation
- Usage tracking is async (fire-and-forget)

---

### 2.2 Custom Throttler Guard

**Location:** `src/auth/guards/custom-throttler.guard.ts`

Extends NestJS `ThrottlerGuard` with custom logic.

```typescript
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest
  ): Promise<boolean> {
    const { context, throttler } = requestProps;
    const req = context.switchToHttp().getRequest();

    // Resolve rate limit group
    const group = this.resolveGroup(context, req);
    // 'public' | 'authenticated' | 'webhooks'

    // Resolve identity key
    const window = throttler.name === THROTTLER_BURST_NAME ? 'burst' : 'sustained';
    const windowConfig = throttlerConfig.groups[group][window];

    // Store context for later inspection
    req.rateLimitContext = {
      group,
      keyType: this.resolveIdentity(req).keyType,
    };

    try {
      return await super.handleRequest({
        ...requestProps,
        limit: windowConfig.limit,
        ttl: windowConfig.ttlMs,
        throttler: {
          ...throttler,
          limit: windowConfig.limit,
          ttl: windowConfig.ttlMs,
        },
      });
    } catch (error) {
      if (error instanceof ThrottlerException) {
        const retryAfterSeconds = Math.ceil(windowConfig.ttlMs / 1000);
        response.setHeader('Retry-After', retryAfterSeconds.toString());
        // ... handle error
      }
    }
  }

  private resolveGroup(context, req): RateLimitGroup {
    const rateLimitGroupMeta = this.reflector.get(
      RATE_LIMIT_GROUP_METADATA_KEY,
      context.getHandler()
    );
    
    if (rateLimitGroupMeta) return rateLimitGroupMeta;
    if (req.apiKey) return 'authenticated';
    return 'public';
  }

  private resolveIdentity(req) {
    if (req.apiKey?.id) {
      return { keyType: 'api_key', key: req.apiKey.id };
    }
    if (req.user?.id) {
      return { keyType: 'user_id', key: req.user.id };
    }
    return { keyType: 'ip', key: req.ip };
  }
}
```

**Rate Limit Groups:**

```typescript
{
  public: {
    burst: { limit: 20, ttlMs: 60_000 },      // 20 req/min
    sustained: { limit: 100, ttlMs: 3_600_000 } // 100 req/hour
  },
  authenticated: {
    burst: { limit: 120, ttlMs: 60_000 },     // 120 req/min
    sustained: { limit: 600, ttlMs: 3_600_000 } // 600 req/hour
  },
  webhooks: {
    burst: { limit: 50, ttlMs: 60_000 },
    sustained: { limit: 300, ttlMs: 3_600_000 }
  }
}
```

**Key Points:**
- Two-window throttling: burst (1 min) + sustained (1 hour)
- Identity resolution: API key > user ID > IP
- Rate limit group can be customized per endpoint via `@RateLimitGroupTag()`
- `Retry-After` header on 429 response

---

### 2.3 Request Context & Middleware

#### **CorrelationIdMiddleware**

```typescript
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = 
      req.header('x-request-id') || 
      req.header('x-correlation-id') || 
      uuidv4();
    
    res.setHeader('x-request-id', correlationId);
    res.setHeader('x-correlation-id', correlationId);
    req['correlationId'] = correlationId;
    next();
  }
}
```

Ensures all requests have a unique correlation ID for logging/tracing.

---

#### **MetricsMiddleware**

Collects request metrics (status, latency, method, path).

---

### 2.4 Request Object Structure

After guards/middleware, `request` contains:

```typescript
{
  // From ApiKeyGuard
  apiKey?: {
    id: string,
    name: string,
    scopes: ApiKeyScope[],
    rateLimit: number
  },

  // From CorrelationIdMiddleware
  correlationId: string,

  // From CustomThrottlerGuard
  rateLimitContext: {
    group: RateLimitGroup,
    keyType: RateLimitKeyType
  },

  // Standard Express properties
  headers: Record<string, string>,
  params: Record<string, string>,
  query: Record<string, any>,
  body: Record<string, any>,
  method: string,
  path: string,
  ip: string,
  // ... etc
}
```

**Key Observation:** No built-in user/subject principal beyond API key.

---

## 3. API Request/Response Structure

### 3.1 Standard Response Envelope

All successful API responses follow this pattern:

```typescript
{
  success: boolean,
  data: T,                          // Response payload
  pagination?: {                    // Optional (for list endpoints)
    next_cursor: string | null,
    has_more: boolean,
    limit: number
  }
}
```

**Example (Link Metadata):**

```json
{
  "success": true,
  "data": {
    "amount": "50.5000000",
    "memo": "Payment for service",
    "memoType": "text",
    "asset": "XLM",
    "privacy": false,
    "expiresAt": "2026-05-28T12:00:00.000Z",
    "canonical": "amount=50.5000000&asset=XLM&memo=Payment%20for%20service",
    "username": "john_doe",
    "destination": "GABCD...XYZ",
    "referenceId": "INV-12345",
    "acceptedAssets": ["XLM", "USDC"],
    "swapOptions": [
      {
        "destinationAsset": "USDC:GA...",
        "path": ["XLM", "USDC"],
        "rate": 0.95
      }
    ],
    "metadata": {
      "normalized": false,
      "warnings": []
    }
  }
}
```

---

### 3.2 Pagination: Cursor-Based

Used for all list endpoints (no offset/limit).

```typescript
export interface CursorPaginationQueryDto {
  cursor?: string;      // Opaque base64url-encoded JSON
  limit?: number;       // Clamped to 1-100, default 20
}

export interface CursorPayload {
  pk: string;           // Primary sort column value
  id: string;           // UUID tiebreaker
}

// Encoded: Buffer.from(JSON.stringify({pk, id}), 'utf-8').toString('base64url')
// Example: "eyJwayI6IjIwMjYtMDQtMjgiLCJpZCI6IjEyMzQ1Njc4In0"
```

**Response with pagination:**

```json
{
  "success": true,
  "data": [
    { "id": "...", "name": "..." }
  ],
  "pagination": {
    "next_cursor": "eyJwayI6IjIwMjYtMDQtMjgiLCJpZCI6IjEyMzQ1Njc4In0",
    "has_more": true,
    "limit": 20
  }
}
```

**Benefits:**
- Deterministic: handles inserts/deletes between requests
- No count overhead
- Efficient: B-tree index on sort column

---

### 3.3 Error Response

```typescript
{
  statusCode: number,
  message: string,
  error: {
    code: string,           // Machine-readable error code
    message: string,        // Human-readable message
    field?: string,         // Field that failed validation (optional)
  }
}
```

**Examples:**

```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be at least 0.0000001 XLM",
    "field": "amount"
  }
}
```

```json
{
  "statusCode": 403,
  "message": "Forbidden",
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "API key missing required scope: links:write"
  }
}
```

---

### 3.4 Key API Endpoints

#### **Links**

```
POST /links/metadata
  Headers: X-API-Key (optional)
  Body: LinkMetadataRequestDto
  Response: { success: true, data: LinkMetadataResponseDto }
```

**LinkMetadataRequestDto:**
```typescript
{
  amount: number,              // 0.0000001 - 1,000,000
  asset?: string,              // XLM, USDC, AQUA, yXLM
  memo?: string,               // Up to 28 chars (sanitized)
  memoType?: 'text' | 'hash' | 'return',
  privacy?: boolean,           // Default: false
  expirationDays?: number,     // 1-365
  username?: string,           // Owner username
  destination?: string,        // Destination public key
  referenceId?: string,        // Custom ref for tracking
  acceptedAssets?: string[]    // Multi-asset support
}
```

#### **Transactions**

```
GET /transactions?accountId=G...&asset=XLM&limit=20&cursor=...
  Headers: X-API-Key (optional)
  Response: { success: true, data: TransactionResponseDto[] }
```

#### **API Keys**

```
POST /api-keys
  Body: CreateApiKeyDto
  Response: { id, name, scopes, key } (key shown only once)

GET /api-keys?owner_id=...&limit=20&cursor=...
  Response: Paginated list (key_prefix shown, not full key)

POST /api-keys/:id/rotate
  Response: { id, name, scopes, key }

DELETE /api-keys/:id
  Response: { success: true }

GET /api-keys/usage?owner_id=...
  Response: { totalRequests, quotaRemaining, resetAt }
```

#### **Webhooks**

```
POST /webhooks/:publicKey
  Body: CreateWebhookDto
  Response: { id, webhookUrl, events, enabled }

GET /webhooks/:publicKey?cursor=...&limit=...
  Response: Paginated list of webhooks

PUT /webhooks/:publicKey/:id
  Body: UpdateWebhookDto
  Response: Updated webhook

DELETE /webhooks/:publicKey/:id
  Response: { success: true }

POST /webhooks/:publicKey/:id/regenerate-secret
  Response: { secret }
```

---

## 4. User/Organization Context Handling

### 4.1 Current State: Single Identifier

The system uses **Stellar public key** as the sole user identifier:

```typescript
// Everywhere in the codebase:
const publicKey: string = "GABC...XYZ";  // G + 56 alphanumeric chars

// All queries look like:
const usernames = await db
  .from('usernames')
  .select('*')
  .eq('public_key', publicKey);

const webhooks = await db
  .from('notification_preferences')
  .select('*')
  .eq('public_key', publicKey)
  .eq('channel', 'webhook');

const refunds = await db
  .from('refund_attempts')
  .select('*')
  .eq('actor_id', publicKey);
```

### 4.2 API Key Association

API keys have an optional `owner_id` field, but it's **not enforced**:

```typescript
// Current behavior
{
  id: "uuid",
  name: "My API Key",
  owner_id: "GABC...XYZ",  // Optional - metadata only
  scopes: ['links:read', 'transactions:read'],
  is_active: true
}

// No automatic filtering - a key can be used by anyone
// The owner_id is purely informational for the developer
```

**Implication:** API keys are **not scoped to organizations** currently.

### 4.3 Request-to-Context Flow

When a request arrives:

```typescript
// 1. ApiKeyGuard extracts X-API-Key header
// 2. Validates key against bcrypt hash
// 3. Attaches to request:
request.apiKey = {
  id: "key-uuid",
  name: "Key Name",
  scopes: ['links:read'],
  rateLimit: 120
};

// 4. Service/controller can then:
const apiKeyId = request.apiKey.id;
const scopes = request.apiKey.scopes;

// 5. But NO organization/tenant context is extracted!
// Services must ask the client for the public_key:
async getWebhooks(@Param('publicKey') publicKey: string) {
  return this.webhookService.listWebhooks(publicKey);
}
```

**Current Pattern:**

```typescript
// Webhook Controller
@Get(':publicKey')
async listWebhooks(@Param('publicKey') publicKey: string) {
  // publicKey comes from URL parameter
  // We trust the client to provide it (no validation)
  return this.webhookService.listWebhooks(publicKey);
}

// API Key Controller
@Get()
async list(@Query('owner_id') ownerId?: string) {
  // ownerId is optional query param
  // No validation that it matches the authenticated user
  return this.service.list(ownerId);
}
```

**Security Risk:** Nothing prevents user A from accessing user B's webhooks or API keys if they know the public key/owner_id.

---

### 4.4 Multi-User/Multi-Org Requirements

To support multi-tenancy, we need:

1. **Organization Entity** (new table)
   ```sql
   CREATE TABLE organizations (
     id UUID PRIMARY KEY,
     name TEXT NOT NULL,
     slug TEXT NOT NULL UNIQUE,
     public_key TEXT NOT NULL,         -- Primary owner
     created_at TIMESTAMPTZ,
     updated_at TIMESTAMPTZ
   );
   ```

2. **Membership Table** (new table)
   ```sql
   CREATE TABLE organization_members (
     id UUID PRIMARY KEY,
     organization_id UUID NOT NULL REFERENCES organizations (id),
     user_public_key TEXT NOT NULL,    -- Member's Stellar public key
     role TEXT NOT NULL                -- 'owner' | 'admin' | 'developer' | 'viewer'
       CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
     created_at TIMESTAMPTZ,
     CONSTRAINT unique_member UNIQUE (organization_id, user_public_key)
   );
   ```

3. **Context Extraction** in API Key Guard
   ```typescript
   // Extract organization_id from API key
   const org = await this.orgsService.findByApiKey(record.id);
   request.organization = org;
   ```

4. **Middleware for Org Filtering**
   ```typescript
   // Automatically scope queries
   const webhooks = await db
     .from('notification_preferences')
     .select('*')
     .eq('organization_id', request.organization.id)
     .eq('channel', 'webhook');
   ```

---

## 5. Role/Permission Logic

### 5.1 API Key Scopes (Fine-Grained Permissions)

**Scope Definition:**

```typescript
export const API_KEY_SCOPES = [
  'links:read',       // Query link metadata
  'links:write',      // Create/modify links
  'transactions:read', // Query transactions
  'usernames:read',   // Search usernames
  'refunds:write',    // Initiate refunds
  'admin',            // Administrative operations
] as const;
```

**Enforcement via Decorator:**

```typescript
// In controller
@Post('refunds')
@RequireScopes('refunds:write')
async initiateRefund(@Body() dto: InitiateRefundDto) {
  // Only executed if API key has 'refunds:write' scope
}

// In ApiKeyGuard
const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[]>(
  REQUIRED_SCOPES_KEY,
  [context.getHandler(), context.getClass()]
) ?? [];

for (const scope of requiredScopes) {
  if (!hasScope(scope)) {
    throw new ForbiddenException({
      error: "INSUFFICIENT_SCOPE",
      message: `API key missing required scope: ${scope}`,
    });
  }
}
```

**Scope-to-Resource Mapping:**

| Scope | Endpoints | Actions |
|-------|-----------|---------|
| `links:read` | `POST /links/metadata` | Generate link metadata |
| `links:write` | (Future) Create/edit links | Store links, update settings |
| `transactions:read` | `GET /transactions` | Fetch account transactions |
| `usernames:read` | `GET /usernames/search`, `/trending` | Search, discover usernames |
| `refunds:write` | `POST /refunds` | Initiate refund requests |
| `admin` | `/admin/*` | Feature flags, audit logs |

### 5.2 Admin Features

#### **Feature Flags** (`/admin/feature-flags`)

```typescript
@Controller()
export class FeatureFlagsController {
  @Get('admin/feature-flags')
  async listFlags() { }

  @Patch('admin/feature-flags/:key')
  async updateFlag(
    @Param('key') key: string,
    @Body() body: UpdateFeatureFlagDto,
    @Headers('x-admin-actor') actorHeader?: string  // Optional actor tracking
  ) {
    const actor = actorHeader?.trim() || 'admin-ui';
    return this.featureFlagsService.updateFlag(key, body, actor);
  }

  @Get('feature-flags/:key/evaluate')
  async evaluateFlag(
    @Param('key') key: string,
    @Query() query: FeatureFlagQueryDto
  ) {
    // Unauthenticated evaluation endpoint
  }
}
```

**Feature Flag Model:**
```typescript
{
  key: 'new_payment_flow',
  enabled: true,
  kill_switch: false,
  rollout_percentage: 25,                    // Gradual rollout
  allowed_users: ['GABC...', 'GDEF...'],     // Allowlist
  environments: { production: true, staging: false },
  metadata: { launched_at: '2026-04-28' }
}
```

#### **Audit Logs** (`/admin/audit`)

```typescript
@Controller('admin/audit')
export class AuditController {
  @Get()
  queryLogs(@Query() query: QueryAuditLogsDto) {
    // No auth check currently - open endpoint!
  }

  @Get('export')
  async exportCsv(@Res() res: Response) {
    // Export to CSV for analysis
  }

  @Delete('retention')
  applyRetentionStrategy() {
    // Delete logs older than 90 days
  }
}
```

**No RBAC:** Currently no role-based access control for admin endpoints.

---

### 5.3 Rate Limit Groups

Rate limiting is used as a form of quality-of-service (not authorization):

```typescript
// public (unauthenticated)
- Burst: 20 req/min
- Sustained: 100 req/hour

// authenticated (API key + valid scopes)
- Burst: 120 req/min
- Sustained: 600 req/hour

// webhooks (delivering events)
- Burst: 50 req/min
- Sustained: 300 req/hour
```

Not granular per-user permissions, but rather traffic prioritization.

---

## 6. Key Services & Architecture

### 6.1 Service Structure

```
src/
├── api-keys/
│   ├── api-keys.controller.ts
│   ├── api-keys.service.ts
│   ├── api-keys.repository.ts
│   ├── api-keys.types.ts
│   ├── api-keys.module.ts
│   └── dto/
│
├── auth/
│   ├── guards/
│   │   ├── api-key.guard.ts
│   │   ├── custom-throttler.guard.ts
│   ├── decorators/
│   │   ├── require-scopes.decorator.ts
│   │   └── rate-limit-group.decorator.ts
│   └── auth.module.ts
│
├── notifications/
│   ├── webhook.service.ts
│   ├── webhooks.controller.ts
│   ├── notification.service.ts
│   ├── notification-preferences.repository.ts
│   ├── notification-log.repository.ts
│   ├── telegram/
│   └── notifications.module.ts
│
├── links/
│   ├── links.service.ts
│   ├── links.controller.ts
│   ├── link-state-machine.ts
│   ├── payment-link.service.ts
│   └── links.module.ts
│
├── transactions/
│   ├── horizon.service.ts
│   ├── transaction.service.ts
│   ├── transactions.controller.ts
│   └── transactions.module.ts
│
├── supabase/
│   ├── supabase.service.ts
│   ├── supabase.errors.ts
│   └── supabase.module.ts
│
├── common/
│   ├── middleware/
│   │   ├── correlation-id.middleware.ts
│   │   └── (others)
│   ├── pagination/
│   │   └── cursor.util.ts
│   ├── decorators/
│   ├── filters/
│   ├── interceptors/
│   └── (etc)
│
├── audit/
│   ├── audit.service.ts
│   ├── audit.controller.ts
│   └── audit.model.ts
│
├── feature-flags/
│   ├── feature-flags.service.ts
│   ├── feature-flags.controller.ts
│   └── feature-flags.dto.ts
│
└── app.module.ts
```

### 6.2 Key Services

#### **ApiKeysService**
- Generate/validate API keys
- Rotate keys with 24-hour overlap
- Track usage and enforce quotas
- Scope validation

#### **SupabaseService**
- Wraps Supabase client
- Error handling (unique constraints, network errors)
- Query builder for repositories

#### **WebhookService**
- CRUD for webhooks per public_key
- Secret generation and regeneration
- Delivery retry scheduling

#### **NotificationService**
- Multi-channel delivery (email, push, webhook, Telegram)
- Event subscription management
- Rate limiting per user

#### **HorizonService**
- Fetch Stellar transactions from Horizon API
- Caching with TTL (default 60s)
- Exponential backoff for resilience

#### **LinksService**
- Generate link metadata
- Validate Stellar amounts, assets, memos
- Support multi-asset swaps

#### **AuditService**
- Query audit logs with filters
- Export to CSV
- Apply retention policies

#### **FeatureFlagsService**
- Load flags from database
- Evaluate flags (with rollout%, allowlist)
- Cache with TTL

---

### 6.3 Repository Pattern

Some services use repositories for database access:

```typescript
// Example: ApiKeysRepository
export class ApiKeysRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async insert(data: CreateApiKeyData): Promise<ApiKeyRecord> {
    const { data: inserted, error } = await this.supabase
      .getClient()
      .from('api_keys')
      .insert([data])
      .select()
      .single();

    if (error) throw new SupabaseError(...);
    return inserted;
  }

  async findByPrefix(prefix: string): Promise<ApiKeyRecord[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('api_keys')
      .select('*')
      .eq('key_prefix', prefix)
      .eq('is_active', true);

    if (error) throw new SupabaseError(...);
    return data;
  }

  async incrementUsage(keyId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .rpc('increment_api_key_usage', { key_id: keyId });

    if (error) throw new SupabaseError(...);
  }
}
```

**Advantages:**
- Centralized data access
- Easy to test (mock repository)
- Reusable across services

---

## 7. Multi-Tenancy Readiness Analysis

### 7.1 Current State: NOT Ready

**Blocking Issues:**

| Issue | Impact | Severity |
|-------|--------|----------|
| No `organization_id` column | Can't isolate tenants at DB level | Critical |
| All data keyed by public_key | No multi-user organization concept | Critical |
| Request context = API key only | Can't extract org from request | High |
| No org ownership validation | Users can access other users' data | Critical |
| Admin endpoints have no auth | Open to all callers | High |
| Feature flags global | Can't enable per-org | Medium |
| Audit logs not org-scoped | Can't filter per tenant | Medium |

---

### 7.2 Migration Plan

#### **Phase 1: Database Schema** (Essential Tables)

```sql
-- 1. Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  primary_owner_public_key TEXT NOT NULL,  -- Creator
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create organization_members table
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_public_key TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member'
    CHECK (role IN ('owner', 'admin', 'developer', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_member UNIQUE (organization_id, user_public_key)
);

-- 3. Add organization_id to api_keys
ALTER TABLE api_keys
ADD COLUMN organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

-- 4. Add organization_id to notification_preferences
ALTER TABLE notification_preferences
ADD COLUMN organization_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

-- 5. Create indexes
CREATE INDEX idx_organization_members_org_id ON organization_members (organization_id);
CREATE INDEX idx_organization_members_user_key ON organization_members (user_public_key);
CREATE INDEX idx_api_keys_organization_id ON api_keys (organization_id);
CREATE INDEX idx_notification_preferences_organization_id 
  ON notification_preferences (organization_id);
```

#### **Phase 2: API Key & Guard Enhancement**

```typescript
// api-keys.types.ts
export interface ApiKeyRecord {
  id: string;
  organization_id: string;    // NEW: Which org owns this key
  name: string;
  scopes: ApiKeyScope[];
  // ... rest
}

// api-key.guard.ts
async canActivate(context: ExecutionContext): Promise<boolean> {
  const request = context.switchToHttp().getRequest();
  const rawKey = request.headers["x-api-key"];

  if (!rawKey) return true; // Public access

  const result = await this.apiKeysService.validateKey(rawKey);
  if (!result) {
    throw new UnauthorizedException({ error: "INVALID_API_KEY" });
  }

  const { record } = result;

  // NEW: Extract organization
  const org = await this.orgsService.findById(record.organization_id);
  if (!org || !org.active) {
    throw new ForbiddenException({ error: "ORGANIZATION_INACTIVE" });
  }

  // Attach to request
  request.apiKey = record;
  request.organization = org;
  request.organizationId = org.id;

  return true;
}
```

#### **Phase 3: Middleware for Org Filtering**

```typescript
// org-context.middleware.ts
@Injectable()
export class OrganizationContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // If no org (public endpoint), continue
    if (!req.organizationId) return next();

    // Attach to request for services to use
    req.orgContext = {
      organizationId: req.organizationId,
      userId: req.apiKey?.owner_id || 'anonymous',
      role: req.member?.role || 'guest',
    };

    next();
  }
}
```

#### **Phase 4: Service Updates**

```typescript
// webhooks.service.ts (before)
async listWebhooks(publicKey: string) {
  return db.from('notification_preferences')
    .select('*')
    .eq('public_key', publicKey);
}

// webhooks.service.ts (after)
async listWebhooks(
  publicKey: string,
  organizationId: string,
  orgContext: OrgContext
) {
  // Verify membership
  const member = await this.orgsService.getMember(organizationId, publicKey);
  if (!member) {
    throw new ForbiddenException('Not a member of this organization');
  }

  return db.from('notification_preferences')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('public_key', publicKey);
}

// webhooks.controller.ts (after)
@Get(':publicKey')
async listWebhooks(
  @Param('publicKey') publicKey: string,
  @Request() req
) {
  return this.webhookService.listWebhooks(
    publicKey,
    req.organizationId,
    req.orgContext
  );
}
```

#### **Phase 5: Role-Based Access Control**

```typescript
// role-based.guard.ts
@Injectable()
export class RoleBasedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'requiredRoles',
      context.getHandler()
    );

    if (!requiredRoles) return true; // No roles specified

    const req = context.switchToHttp().getRequest();
    const { role } = req.orgContext || {};

    return requiredRoles.includes(role);
  }
}

// Usage in controller
@Post('refunds')
@UseGuards(RoleBasedGuard)
@RequireRoles('owner', 'admin')
async initiateRefund(@Body() dto: InitiateRefundDto) {
  // Only org owners/admins can initiate refunds
}
```

---

### 7.3 Backward Compatibility Considerations

```typescript
// For endpoints currently scoped to public_key, 
// we need to decide: support both or migrate?

// Option A: Detect if org_id present, else single-user mode
async listWebhooks(
  @Param('publicKey') publicKey: string,
  @Query('organizationId') organizationId?: string,
  @Request() req
) {
  if (organizationId) {
    // New multi-org flow
    return this.webhookService.listWebhooks(publicKey, organizationId, req.orgContext);
  } else {
    // Legacy single-user flow (direct public_key)
    return this.webhookService.listWebhooksLegacy(publicKey);
  }
}

// Option B: Deprecate old endpoints, force migration
// /v1/webhooks/:publicKey  → Deprecated
// /v2/organizations/:id/webhooks/:publicKey → New
```

---

## Summary

### Key Findings:

1. **Single-Tenant Database**: All entities scoped to `public_key`; no org concept
2. **API Key Authentication**: Bcrypt-hashed, scope-based, with 24-hour rotation overlap
3. **Rate Limiting**: Two-window (burst + sustained) with identity resolution (key > user > IP)
4. **Request Context**: Minimal (apiKey + correlationId); no user principal
5. **Cursor Pagination**: Deterministic, offset-free pagination
6. **Scope-Based Permissions**: Fine-grained (links:read, links:write, etc.)
7. **Admin Features**: Feature flags + audit logs, but no RBAC
8. **Notification System**: Multi-channel (email, push, webhook, Telegram) per public_key
9. **Refund Workflow**: Idempotency-keyed with audit trail

### Multi-Tenancy Gaps:

| Gap | Required Action |
|-----|-----------------|
| No organizations | Create org table + membership table |
| No org context in request | Extract from API key; add middleware |
| No access control | Add org membership validation + RBAC |
| No org filtering | Add organization_id to all queries |
| Admin endpoints unprotected | Add auth decorator + org check |
| Data isolation at DB | Add organization_id foreign keys + indexes |

---

**Next Steps:**
1. Create organization and membership tables
2. Migrate API key model to link to organization
3. Update guards to extract organization context
4. Add org membership validation to all services
5. Implement RBAC guards for admin operations
6. Add organization_id filtering to all queries
