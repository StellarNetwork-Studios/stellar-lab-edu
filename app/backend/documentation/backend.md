# QuickEx Backend Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Setup Instructions](#setup-instructions)
4. [Environment Variables](#environment-variables)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [API Documentation](#api-documentation)
8. [Development Workflow](#development-workflow)
9. [Troubleshooting](#troubleshooting)

## Overview

The QuickEx Backend is a NestJS-based API server that powers the QuickEx Stellar exchange platform. It provides endpoints for:
- Username management (quickex.to/yourname)
- Payment link generation and validation
- Transaction history and monitoring
- Scam alert detection
- Real-time Stellar blockchain event ingestion
- User notification management

### Technology Stack
- **Framework**: NestJS 10.x
- **Runtime**: Node.js 20.x
- **Language**: TypeScript 5.x
- **Database**: Supabase (PostgreSQL)
- **Blockchain**: Stellar Network (Testnet/Mainnet)
- **Testing**: Jest
- **API Documentation**: Swagger/OpenAPI

## Architecture

### Project Structure

```
src/
├── main.ts                      # Application entry point
├── app.module.ts                # Root module
├── config/                      # Configuration management
│   ├── app-config.service.ts    # Typed config accessors
│   ├── env.schema.ts            # Joi validation schema
│   ├── stellar.config.ts        # Stellar network configuration
│   └── rate-limit.config.ts     # Rate limiting configuration
├── auth/                        # Authentication & authorization
│   └── guards/                  # API key and throttler guards
├── common/                      # Shared utilities
│   ├── filters/                 # Exception filters
│   ├── interceptors/            # Logging interceptors
│   ├── middleware/              # Correlation ID middleware
│   └── logging/                 # Winston logger configuration
├── health/                      # Health check endpoints
│   ├── health.controller.ts     # /health and /ready endpoints
│   └── health.service.ts        # Health check logic
├── usernames/                   # Username management
│   ├── usernames.controller.ts  # Username API endpoints
│   ├── usernames.service.ts     # Business logic
│   └── usernames.repository.ts  # Database operations
├── links/                       # Payment link management
│   ├── links.controller.ts      # Link validation endpoints
│   └── links.service.ts         # Link generation logic
├── transactions/                # Transaction history
│   ├── transactions.controller.ts
│   ├── horizon.service.ts       # Stellar Horizon API client
│   └── transaction.repository.ts
├── scam-alerts/                 # Fraud detection
│   ├── scam-alerts.controller.ts
│   └── scam-alerts.service.ts
├── notifications/               # User notifications
│   ├── notification.service.ts  # Event-driven notifications
│   ├── notification-preferences.repository.ts
│   └── providers/               # Email, push, webhook providers
├── ingestion/                   # Blockchain event ingestion
│   ├── stellar-ingestion.service.ts  # SSE stream handler
│   ├── soroban-event.parser.ts       # Contract event parser
│   ├── cursor.repository.ts          # Stream cursor management
│   └── escrow-event.repository.ts    # Event persistence
├── metrics/                     # Prometheus metrics
│   ├── metrics.controller.ts
│   └── metrics.service.ts
├── supabase/                    # Database integration
│   ├── supabase.service.ts
│   └── supabase.module.ts
└── dto/                         # Data Transfer Objects
    ├── validators/              # Custom validators
    └── [feature]/               # Feature-specific DTOs
```

### Key Architectural Patterns

#### 1. Module-Based Architecture
Each feature is organized as a NestJS module with clear boundaries:
- Controllers handle HTTP requests
- Services contain business logic
- Repositories manage data persistence
- DTOs define request/response schemas

#### 2. Event-Driven Architecture
The application uses NestJS EventEmitter2 for decoupled communication:
- Stellar blockchain events trigger notifications
- Username claims emit events for audit logging
- Payment events trigger notification dispatch

#### 3. Configuration Management
Environment variables are validated at startup using Joi schemas:
- Type-safe configuration access via `AppConfigService`
- Fail-fast validation prevents runtime errors
- Network-specific configurations (testnet/mainnet)

#### 4. Error Handling
Centralized error handling with custom filters:
- `GlobalHttpExceptionFilter` formats all errors consistently
- Validation errors include field-level details
- Correlation IDs for request tracing

## Setup Instructions

### Prerequisites
- Node.js 20.x or higher
- pnpm 8.x or higher (recommended) or npm
- Supabase account and project
- Stellar testnet/mainnet access

### Installation Steps

1. **Clone the repository** (if not already done)
   ```bash
   git clone <repository-url>
   cd app/backend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in the required values (see [Environment Variables](#environment-variables))

4. **Verify installation**
   ```bash
   pnpm type-check
   pnpm lint
   ```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NETWORK` | Stellar network (`testnet` or `mainnet`) | `testnet` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous API key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP server port |
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `MAX_USERNAMES_PER_WALLET` | unlimited | Maximum usernames per Stellar address |
| `STELLAR_NETWORK` | `testnet` | Stellar network configuration |
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics |
| `METRICS_ENDPOINT_PROTECTED` | `false` | Require authentication for /metrics |
| `METRICS_ENDPOINT_TOKEN` | - | Bearer token for protected metrics |

### Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Navigate to **Project Settings** > **API**
4. Copy the **Project URL** → `SUPABASE_URL`
5. Copy the **anon/public** key → `SUPABASE_ANON_KEY`

### Environment Validation

The application validates all environment variables at startup using a Joi schema (`src/config/env.schema.ts`). If required variables are missing or invalid:
- Clear error messages list all missing/invalid keys
- Application exits with non-zero code
- Actual secret values are never logged (security)

## Running the Application

### Development Mode

Start the development server with hot-reload:
```bash
pnpm dev
# or from repository root
pnpm turbo run dev --filter=@quickex/backend
```

The server will start on `http://localhost:4000` (or the configured PORT).

### Production Mode

1. Build the application:
   ```bash
   pnpm build
   ```

2. Start the production server:
   ```bash
   pnpm start
   ```

### Verify the Server

Check if the server is running:
```bash
# Liveness check
curl http://localhost:4000/health
# Response: {"status":"ok","version":"0.1.0","uptime":123}

# Readiness check (includes dependency checks)
curl http://localhost:4000/ready
# Response: {"ready":true,"checks":[...]}
```

### View API Documentation

Open your browser and navigate to:
```
http://localhost:4000/docs
```

This provides interactive Swagger UI documentation for all API endpoints.

## Testing

### Test Structure

The project uses Jest with three test configurations:
- **Unit tests** (`*.unit.spec.ts`): Test individual components in isolation
- **Integration tests** (`*.int.spec.ts`): Test module interactions
- **E2E tests** (`*.e2e-spec.ts`): Test complete request/response cycles

### Running Tests

```bash
# Run all tests
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:int

# Run E2E tests only
pnpm test:e2e

# Run tests with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test -- src/usernames/usernames.service.unit.spec.ts

# Run tests in watch mode (for development)
pnpm test -- --watch
```

### Test Environment

Tests use a separate Jest setup file (`jest.setup.ts`) that:
- Sets required environment variables for testing
- Mocks console methods to reduce noise
- Configures test timeouts

### Writing Tests

Example unit test structure:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MyService],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should perform expected operation', async () => {
    const result = await service.doSomething();
    expect(result).toEqual(expectedValue);
  });
});
```

### Test Coverage Goals

- Maintain >80% code coverage for critical paths
- All public API endpoints should have E2E tests
- Business logic should have comprehensive unit tests
- Integration tests for database operations

## API Documentation

### Interactive Documentation

The backend provides Swagger/OpenAPI documentation at `/docs` when running:
```
http://localhost:4000/docs
```

### Key Endpoints

#### Health & Monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe (is server up?) |
| GET | `/ready` | Readiness probe (are dependencies healthy?) |
| GET | `/metrics` | Prometheus metrics (if enabled) |

#### Usernames

| Method | Path | Description |
|--------|------|-------------|
| POST | `/username` | Create a new username |
| GET | `/username?publicKey=G...` | List usernames for a wallet |

**Username Rules:**
- Length: 3-32 characters
- Characters: lowercase letters, digits, underscore only (`^[a-z0-9_]+$`)
- Unique across the platform
- Optional per-wallet limit via `MAX_USERNAMES_PER_WALLET`

#### Payment Links

| Method | Path | Description |
|--------|------|-------------|
| POST | `/links/metadata` | Generate canonical link metadata |
| POST | `/links/scan` | Scan link for scam indicators |

#### Transactions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/transactions?publicKey=G...` | Get transaction history |

#### Scam Alerts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/scam-alerts/report` | Report suspicious activity |
| GET | `/scam-alerts/check?address=G...` | Check if address is flagged |

### Authentication

Currently, the API uses:
- API key authentication for protected endpoints (via `ApiKeyGuard`)
- Rate limiting via `@nestjs/throttler` (configurable per endpoint)

### Rate Limiting

Default rate limits:
- 10 requests per 10 seconds per IP (global)
- Custom limits per endpoint (see `@Throttle()` decorators)

## Development Workflow

### Code Style

The project uses:
- **ESLint** for linting
- **Prettier** for formatting (via ESLint integration)
- **TypeScript** strict mode

Run linting:
```bash
pnpm lint
```

### Type Checking

Run TypeScript type checking without emitting files:
```bash
pnpm type-check
```

### Git Workflow

1. Create a feature branch from `main`
2. Make changes and commit with descriptive messages
3. Run tests and linting before pushing
4. Create a pull request for review

### Adding New Features

1. **Create module structure**
   ```bash
   nest g module features/my-feature
   nest g controller features/my-feature
   nest g service features/my-feature
   ```

2. **Add DTOs** in `src/dto/my-feature/`
3. **Write tests** alongside implementation
4. **Update documentation** (this file and Swagger decorators)
5. **Add integration tests** for new endpoints

### Database Migrations

Supabase migrations are managed separately. Coordinate with the database team for schema changes.

## Troubleshooting

### Common Issues

#### 1. Server Won't Start - Environment Variable Errors

**Symptom**: Application exits immediately with validation errors

**Solution**:
- Check `.env` file exists and has all required variables
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
- Ensure `NETWORK` is either `testnet` or `mainnet`

#### 2. Tests Failing

**Symptom**: Tests fail with timeout or connection errors

**Solution**:
- Ensure `jest.setup.ts` sets test environment variables
- Check that mocks are properly configured
- Increase test timeout if needed: `jest.setTimeout(10000)`

#### 3. Supabase Connection Errors

**Symptom**: `/ready` endpoint returns unhealthy status

**Solution**:
- Verify Supabase credentials are correct
- Check network connectivity to Supabase
- Ensure Supabase project is active (not paused)

#### 4. Stellar Network Errors

**Symptom**: Transaction endpoints return errors

**Solution**:
- Verify `NETWORK` matches your Stellar configuration
- Check Horizon API availability
- Ensure public keys are valid for the selected network

#### 5. Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::4000`

**Solution**:
- Change `PORT` in `.env` to a different value
- Or stop the process using port 4000:
  ```bash
  # Windows
  netstat -ano | findstr :4000
  taskkill /PID <PID> /F
  
  # Linux/Mac
  lsof -ti:4000 | xargs kill -9
  ```

### Debug Mode

Enable detailed logging:
```bash
# Set in .env
NODE_ENV=development
LOG_LEVEL=debug
```

### Getting Help

- Check the [README.md](../README.md) for quick start guide
- Review [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
- Check existing issues in the repository
- Review Swagger documentation at `/docs` for API details

---

**Last Updated**: February 26, 2026
**Version**: 0.1.0
