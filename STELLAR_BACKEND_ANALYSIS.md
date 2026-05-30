# Stellar Backend Analysis - QuickEx (Soter)

## Project Overview
- **No separate "Soter" repository exists** - "Soter" is the mobile app name (com.pulsefy.soter)
- **This workspace contains the unified QuickEx monorepo** with integrated Stellar support
- Workspace root: `/workspaces/QiuckEx`

---

## 1. Location of Stellar Backend Code

**Primary Stellar module:** `/app/backend/src/stellar/`

### Stellar Module Structure:
```
app/backend/src/stellar/
├── stellar.controller.ts          # Main API endpoints
├── stellar.module.ts              # Module definition
├── horizon.service.ts             # Horizon API client
├── link.service.ts                # Link validation service
├── path-preview.service.ts        # Path preview calculations
├── quote.service.ts               # Quote service
├── recurring-payment-processor.ts # Payment processing
├── verified-assets.constant.ts    # Asset whitelist
└── dto/
    ├── path-preview.dto.ts        # Path preview DTOs
    ├── quote.dto.ts               # Quote request/response
    └── soroban-preflight.dto.ts   # Soroban simulation
```

### Related Stellar Integration Points:
- **Config:** `/app/backend/src/config/`
  - `stellar.config.ts` - Asset & network configuration
  - `network.config.ts` - Network endpoints & explorer URLs
  
- **Transactions:** `/app/backend/src/transactions/`
  - `transaction.service.ts` - Transaction composition
  - `soroban-rpc.service.ts` - Soroban RPC integration

- **Links:** `/app/backend/src/links/`
  - Payment link generation & validation
  - Metadata generation for links

---

## 2. Backend Project Structure

### Architecture Overview:
```
app/backend/
├── src/
│   ├── config/              # Network & stellar configuration
│   ├── auth/                # API key & auth guards
│   ├── stellar/             # ⭐ Main Stellar module
│   ├── transactions/        # TX composition & soroban
│   ├── links/               # Payment links
│   ├── asset-metadata/      # Asset branding & metadata
│   ├── common/              # Utilities, filters, middleware
│   ├── ingestion/           # Soroban event indexing
│   ├── notifications/       # Webhooks & notifications
│   ├── payments/            # Payment processing
│   └── ...other modules
├── jest.config.ts           # Unit test configuration
├── jest.e2e.config.ts       # E2E test configuration
├── nest-cli.json            # NestJS CLI config
└── package.json             # Dependencies
```

### Technology Stack:
- **Framework:** NestJS with TypeScript
- **Stellar SDK:** `stellar-sdk` ^13.3.0, `@stellar/stellar-base` ^13.1.0
- **Horizon:** Official Stellar Horizon API
- **Soroban RPC:** Smart contract interactions
- **Database:** Supabase (PostgreSQL)
- **API Docs:** Swagger/OpenAPI

---

## 3. Current API Response Patterns

### Network Configuration Response
**Endpoint:** `GET /config/network`

```json
{
  "network": "testnet",
  "passphrase": "Test SDF Network ; September 2015",
  "horizonUrl": "https://horizon-testnet.stellar.org",
  "sorobanRpcUrl": "https://soroban-testnet.stellar.org",
  "explorerUrl": "https://stellar.expert/explorer/testnet"
}
```

### Verified Assets Response
**Endpoint:** `GET /stellar/verified-assets`

```json
{
  "assets": [
    {
      "code": "XLM",
      "type": "native",
      "issuer": null,
      "verified": true,
      "decimals": 7,
      "branding": {
        "name": "Stellar Lumens",
        "description": "The native currency of the Stellar network",
        "icon": "https://assets.stellar.org/images/logos/xlm-icon.svg",
        "logo": "https://assets.stellar.org/images/logos/xlm-logo.svg"
      }
    },
    {
      "code": "USDC",
      "type": "credit_alphanum4",
      "issuer": "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      "verified": true,
      "decimals": 7,
      "branding": { ... }
    }
  ]
}
```

### Path Preview Response
**Endpoint:** `POST /stellar/path-preview`

```json
{
  "destination_amount": "10.0000000",
  "destination_asset_type": "native",
  "source_amount": "50.0000000",
  "source_asset_type": "credit_alphanum4",
  "source_asset_code": "USDC",
  "source_asset_issuer": "...",
  "path": [
    {
      "asset_type": "native"
    },
    {
      "asset_type": "credit_alphanum4",
      "asset_code": "USDC",
      "asset_issuer": "..."
    }
  ]
}
```

### Quote Response
**Endpoint:** `POST /stellar/quote`

```json
{
  "destination_amount": "10.5000000",
  "destination_asset": { ... },
  "source_amount": "52.6315789",
  "source_asset": { ... },
  "fee_breakdown": {
    "network_fee": "0.0000100",
    "platform_fee": "0.1000000",
    "total_fee": "0.1000100"
  },
  "expires_at": "2026-05-30T12:15:30Z",
  "quote_id": "uuid-123"
}
```

---

## 4. Explorer Link Utilities & Configuration

### Current Explorer URL Configuration

**Environment Variables:**
```env
# Network selection
STELLAR_NETWORK=testnet  # or mainnet

# Optional: override default explorer
STELLAR_EXPLORER_URL=https://stellar.expert/explorer/testnet
```

**Default Explorers (by network):**
- **Testnet:** `https://stellar.expert/explorer/testnet`
- **Mainnet:** `https://stellar.expert/explorer/public`

### Network Configuration Service
**File:** `/app/backend/src/config/network.config.ts`

```typescript
// Network-based explorer URLs
const DEFAULT_ENDPOINTS: Record<Network, Omit<NetworkSnapshot, 'network'>> = {
  testnet: {
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    // ... other config
  },
  mainnet: {
    explorerUrl: 'https://stellar.expert/explorer/public',
    // ... other config
  },
};

// Available at runtime:
export type NetworkSnapshot = {
  network: StellarNetwork;
  passphrase: string;
  horizonUrl: string;
  sorobanRpcUrl: string;
  explorerUrl: string;  // ⭐ Explorer URL
};
```

### Accessing Explorer URL in Services

**File:** `/app/backend/src/config/app-config.service.ts`

```typescript
// Services can access via config injection:
constructor(
  @Inject(stellarConfig.KEY)
  private readonly config: ConfigType<typeof stellarConfig>,
) {}

// Usage:
const explorerUrl = this.config.explorerUrl;
// Result: "https://stellar.expert/explorer/testnet" (or mainnet)
```

### NO EXISTING Explorer Link Generator Utility

**Finding:** There is NO dedicated utility for generating explorer links (e.g., `getExplorerLink()`, `buildExplorerUrl()`)

**Current Usage Pattern:**
```typescript
// In horizon.service.ts - manual URL construction:
const url = `${this.config.horizonBaseUrl}/accounts/${accountId}`;

// For explorer links - would need to be manually built:
// Example needed format:
// - Account: https://stellar.expert/explorer/testnet/account/{accountId}
// - Transaction: https://stellar.expert/explorer/testnet/tx/{txHash}
// - Operation: https://stellar.expert/explorer/testnet/op/{opId}
```

---

## 5. Key Files Reference

| File | Purpose |
|------|---------|
| [stellar.config.ts](app/backend/src/config/stellar.config.ts) | Asset types, normalization, validation |
| [network.config.ts](app/backend/src/config/network.config.ts) | Network endpoints including explorerUrl |
| [stellar.controller.ts](app/backend/src/stellar/stellar.controller.ts) | API endpoints for verified-assets, paths, quotes |
| [horizon.service.ts](app/backend/src/stellar/horizon.service.ts) | Horizon API client wrapper |
| [verified-assets.constant.ts](app/backend/src/stellar/verified-assets.constant.ts) | Whitelisted assets with branding |
| [network.controller.ts](app/backend/src/config/network.controller.ts) | Exposes network config via API |

---

## 6. Response Pattern Conventions

### Standard Success Response:
- Uses NestJS `@ApiResponse()` decorator
- Returns typed DTOs
- Includes metadata for UI consumption

### Error Handling:
- Custom exception filters in `/common/filters/`
- Standardized error codes
- Sensitive value redaction (see [redaction.util.ts](app/backend/src/common/utils/redaction.util.ts))

### Redaction Pattern:
```typescript
// Sensitive values are masked in logs:
// Input: "SA1234567890ABCDEF...XYZABC"
// Output: "SA12****...YZAB"
```

---

## 7. Integration Points for Explorer Links

**Recommended Integration Locations:**

1. **Transaction Service** (`src/transactions/transaction.service.ts`)
   - After TX submission, generate explorer link for hash
   
2. **Link Service** (`src/links/links.service.ts`)
   - Include explorer link in payment link metadata

3. **Notification Templates** (`src/notifications/templates/`)
   - Include explorer links in webhook payloads or email notifications

4. **Common Utils** (`src/common/utils/`)
   - Create new `explorer-link.util.ts` for centralized URL generation

---

## 8. Summary Table

| Item | Status | Details |
|------|--------|---------|
| **Soter Backend** | N/A | Soter is mobile app; backend is QuickEx unified repo |
| **Stellar Integration** | ✅ Implemented | Full SDK integration via `stellar-sdk` ^13.3.0 |
| **Explorer URLs** | ✅ Configured | Default stellar.expert URLs per network |
| **API Endpoints** | ✅ Available | /stellar/* endpoints documented |
| **Response DTOs** | ✅ Typed | Full Swagger/OpenAPI integration |
| **Explorer Link Utility** | ❌ Missing | Needs creation for centralized link generation |
| **Network Config Access** | ✅ Available | Via `stellarConfig` injection |

---

## Quick Start

To generate explorer links in any service:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { stellarConfig } from '../config/stellar.config';

@Injectable()
export class MyService {
  constructor(
    @Inject(stellarConfig.KEY)
    private readonly stellar: ConfigType<typeof stellarConfig>,
  ) {}

  getAccountExplorerLink(accountId: string): string {
    return `${this.stellar.explorerUrl}/account/${accountId}`;
  }

  getTxExplorerLink(txHash: string): string {
    return `${this.stellar.explorerUrl}/tx/${txHash}`;
  }
}
```

This would resolve to:
- Testnet: `https://stellar.expert/explorer/testnet/account/{id}`
- Mainnet: `https://stellar.expert/explorer/public/account/{id}`
