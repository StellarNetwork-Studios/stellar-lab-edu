# 🔭 Stellar Foundry — The On-Chain Web3 & Rust Sandbox

An open, incentivized development hub and decentralized educational ecosystem built on the Stellar network. Master Rust programming, build on Soroban smart contracts, and earn XLM in a gamified, peer-to-peer sandbox guided by interactive AI.

---

## 🌐 What is Stellar Foundry?

Stellar Foundry is a next-generation decentralized learning workspace designed to accelerate the growth of Rust and Soroban developers globally. By bridging technical education with transparent on-chain mechanics, the platform matches ambitious learners with experienced technical mentors.

   ┌────────────────────────┐      ┌────────────────────────┐
   │     Learners (XLM)     │ ────>│    AI-Guided Mentor    │
   │  Build courses & earn  │ <────│ Debug, analyze & grade │
   └────────────────────────┘      └────────────────────────┘
                │                               │
                ▼                               ▼
   ┌────────────────────────┐      ┌────────────────────────┐
   │   Verified Educators   │ <────│ On-Chain Soroban Engine│
   │   Design & curate labs │ ────>│ Secure escrows & mints │
   └────────────────────────┘      └────────────────────────┘

Unlike passive, text-heavy academies, Stellar Foundry is a self-referential ecosystem: developers write the smart contracts that coordinate their learning, using native gas and logic engines deployed directly to Stellar.

---

## ✨ Primary Features

### 🎓 The Engineering Sandbox
* **Curated Curriculums:** A structured trajectory taking you from absolute baseline Rust syntax to production-ready Soroban protocols.
* **WebAssembly Compiler:** Compile and test your Rust projects directly in your browser with our built-in sandbox editor.
* **Interactive Challenges:** Hands-on milestones, algorithmic puzzles, and mock smart contract audits.
* **Cryptographic Badging:** Complete coursework to earn on-chain certificate NFTs verified by native Soroban contracts.

### 💰 Trustless Incentive Protocol
* **Learn-to-Earn (L2E):** Earn direct XLM micro-incentives from modular reward pools upon verified task completion.
* **Educator Monetization:** Earn recurring XLM yields as your custom modules and templates are consumed and highly rated.
* **Smart Contract Escrows:** Reward allocation and payouts are handled trustlessly via automated escrow mechanisms.
* **Sybil & Farm Defenses:** Proprietary machine-learning evaluation engines analyze submitted code ASTs (Abstract Syntax Trees) to prevent automated solution farming.

### 🤖 Built-In AI Tutor (Claude-Powered)
* **Real-Time Assistant:** Chat contextually about borrow-checking, lifetime errors, and Soroban state storage.
* **Automated Code Grader:** Instant code validation, inline debugging suggestions, and semantic profiling.
* **Voice-Enabled Learning:** Native TTS (text-to-speech) and speech recognition engines for accessible learning.

### 🗣️ Decentralized Developer Hub
* **Social Activity Feed:** Share smart contract gas optimizations, community memes, and active updates.
* **Collaborative Channels:** Topic-centered workspace rooms (e.g., `#soroban-beginners`, `#rust-performance`).
* **Weekly Hack-Sprints:** Community-generated coding sprints with bonus XLM reward distributions.

---

## 🛠️ Deep Tech Stack

### Client Side
| Utility | Tech Selection | Integration Role |
| :--- | :--- | :--- |
| **Framework** | Next.js 15 (App Router) | High-performance Server Components (RSC) and server-side rendering. |
| **Language** | TypeScript | Strong typing across client payloads and contract wrappers. |
| **Styling** | Tailwind CSS v4 & shadcn/ui | Modern, fluid design principles and accessible component skeletons. |
| **Code Editor** | Monaco Editor | Embeds an enterprise-grade IDE with Rust syntax processing in-browser. |
| **Realtime** | Socket.io & WebRTC (LiveKit) | Drives immediate social interactions, messaging, and live workspace sessions. |

### Blockchain Architecture
| Utility | Tech Selection | Integration Role |
| :--- | :--- | :--- |
| **Core JS SDK** | Stellar SDK (JS) | Queries network state, serializes payloads, and posts transactions. |
| **Execution Engine** | Soroban Smart Contracts | Governs trustless logic, mints achievement badges, and executes logic pools. |
| **Query Layer** | Horizon API | Pulls network-level histories, asset metadata, and address states. |
| **Key Management** | Freighter Wallet API | Initiates connection requests and requests cryptographic payload signing. |

### Smart Contract Suite (Soroban/Rust)
* `reward_pool`: Coordinates available XLM reserves and handles secure releases.
* `course_registry`: On-chain directory of active course IDs, curriculum metadata, and author copyrights.
* `reputation`: Stores dynamic cryptographic ratings for both students and instructors.
* `certificate_nft` / `badge_nft`: Handles ERC-721 equivalent mints for completions and key milestones.
* `escrow_payout`: Escrow logic holding pending tutor rewards until dispute-free clearance.
* `governance`: Simple multi-sig polling modules to settle developer dispute actions.

### API & Data Infrastructure
* **Server Framework:** NestJS with full REST support and WS gateway architectures.
* **Core Database:** PostgreSQL with Supabase integration for structured state caching.
* **Caching & Queue:** Redis cluster processing job queues and session locks.
* **Sandboxed Execution:** Custom WebAssembly runner parsing code submissions in insulated environments.

---

## 📁 Monorepo Workspace Structure

```text
stellar-foundry/
├── apps/
│   ├── web/                          # Next.js 15 App Workspace
│   │   ├── src/
│   │   │   ├── app/                  # Route handlers & structures
│   │   │   │   ├── (auth)/           # Portal security
│   │   │   │   ├── (dashboard)/      # Student UI
│   │   │   │   ├── (tutor)/          # Instructor workspaces
│   │   │   │   ├── academy/          # Workspace players & content
│   │   │   │   ├── ai-mentor/        # Copilot prompt chats
│   │   │   │   ├── social/           # Microblog feeds
│   │   │   │   ├── chat/             # WS Message threads
│   │   │   │   ├── wallet/           # Ledger connection states
│   │   │   │   └── leaderboard/      # XP ranking listings
│   │   │   ├── components/           # Extensible React nodes
│   │   │   │   ├── ui/               # Core design atoms (shadcn)
│   │   │   │   ├── academy/          # Class & compiler UI
│   │   │   │   ├── social/           # Activity feed UI
│   │   │   │   ├── chat/             # Message UI elements
│   │   │   │   ├── wallet/           # Freighter interfaces
│   │   │   │   └── ai/               # Chat UI elements
│   │   │   ├── context/              # State context structures
│   │   │   ├── hooks/                # React utility state wrappers
│   │   │   ├── lib/                  # Helpers and API client definitions
│   │   │   └── styles/               # Main layout style rules
│   │   ├── public/                   # Asset maps
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── backend/                      # NestJS REST/WS Engine
│       ├── src/
│       │   ├── contracts/            # Ledger contract mapping
│       │   ├── ingestion/            # Blockchain event processing
│       │   ├── stellar/              # SDK setup instances
│       │   ├── soroban-tooling/      # Soroban command helpers
│       │   ├── job-queue/            # Custom queuing mechanisms
│       │   ├── supabase/             # DB adapter layer
│       │   └── common/               # Shared TS decorators
│       └── package.json
│
├── packages/
│   ├── contracts/                    # Soroban smart contracts (Rust)
│   │   ├── reward_pool/
│   │   │   ├── src/lib.rs
│   │   │   └── Cargo.toml
│   │   ├── course_registry/
│   │   ├── reputation/
│   │   ├── certificate_nft/
│   │   ├── badge_nft/
│   │   ├── escrow_payout/
│   │   ├── governance/
│   │   └── Cargo.toml               # Cargo workspaces manifest
│   │
│   ├── shared/                       # Shared type registries
│   │   ├── src/
│   │   │   ├── types/                # Reusable interfaces
│   │   │   ├── constants/            # Common network parameters
│   │   │   └── utils/                # Standard shared script nodes
│   │   └── package.json
│   │
│   ├── stellar-client/               # Customized wrapper clients
│   │   ├── src/
│   │   │   ├── wallet.ts             # Wallet APIs
│   │   │   ├── contracts.ts          # Contract API wrappers
│   │   │   ├── horizon.ts            # Network querying
│   │   │   └── payments.ts           # XLM transactional utilities
│   │   └── package.json
│   │
│   └── ai-client/                    # AI Integration client
│       ├── src/
│       │   ├── mentor.ts             # Custom conversational structures
│       │   ├── grader.ts             # Evaluation logic parameters
│       │   └── reviewer.ts           # Structural analysis scripts
│       └── package.json
│
├── scripts/
│   ├── deploy-contracts.sh           # Main network deployment script
│   ├── seed-db.ts                    # Local mock database seeder
│   └── setup-reward-pool.ts          # Distributes primary XLM balances
│
└── README.md
```

## 🚀 Setting Up the Repository

### Prerequisites
- **Runtime:** Node.js v20+
- **Package Manager:** pnpm v9+ (`npm install -g pnpm`)
- **Rust Toolchain:** Stable rustc and cargo configurations
- **Blockchain CLI:** Stellar CLI (`cargo install --locked stellar-cli`)
- **Infrastructure:** Docker & Docker Compose (for local database/caching runtimes)
- **Browser Sandbox Extensions:** Freighter Wallet Extension

### Local Configuration Steps

```bash
# Clone the repository
git clone https://github.com/stellar-network-studio/stellar-foundry.git
cd stellar-foundry

# Lock down node workspace dependencies
pnpm install

# Copy local testing parameters
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env

# Spin up support infrastructure (Database & Cache instances)
docker-compose up -d

# Execute database setup scripts
pnpm --filter backend db:migrate

# Seed sandbox courses
pnpm --filter backend db:seed

# Build out workspace library dependencies
pnpm build --filter ./packages/*
```

## ⚙️ Environment Variables

### Frontend Setup (`apps/web/.env.local`)

```ini
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_REWARD_POOL_CONTRACT_ID=<your-contract-id>
NEXT_PUBLIC_CERTIFICATE_CONTRACT_ID=<your-contract-id>
```

### Backend Setup (`apps/api/.env`)

```ini
DATABASE_URL=postgresql://postgres:password@localhost:5432/stellar-foundry
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=<your-anthropic-api-key>
JWT_SECRET=<your-jwt-secret>
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
REWARD_POOL_SECRET_KEY=<stellar-secret-key-for-reward-pool>
```

## 💻 Running the Environment

### Startup Local Run

```bash
# Run all workspace apps concurrently (Recommended)
pnpm dev

# Or launch processes individually:
pnpm --filter web dev       # Client Portal -> http://localhost:3000
pnpm --filter backend dev   # Backend Engine -> http://localhost:4000
```

### Compilation of Soroban Smart Contracts

```bash
cd packages/contracts

# Build targeted WASM binaries
cargo build --target wasm32-unknown-unknown --release

# Run smart contract unit tests
cargo test

# Deploy to testnet
cd ../../
./scripts/deploy-contracts.sh --network testnet
```

## 🧪 Testing Modules

```bash
# Run global suite across modules
pnpm test

# Client-side component tests
pnpm --filter web test

# Backend structural tests
pnpm --filter backend test

# Smart contract verification
cd packages/contracts && cargo test

# End-to-End integration tests
pnpm --filter web test:e2e
```

## 🔗 Transaction Flow & Design Architecture

The transactional logic inside Stellar Foundry ensures no payout occurs without on-chain or off-chain cryptographic proofs:

```text
 🧑‍🎓 Student finishes task
          │
          ▼
 🤖 AI Sandbox verifies AST solutions (Secure Sandbox)
          │
          ▼
 🧑‍🏫 Tutor validates the AI-scored outputs
          │
          ▼
 ⚡ API server requests payouts to 'reward_pool'
          │
          ▼
 🔒 Soroban Contract validates signatures & payload checks
          │
          ▼
 💸 XLM is distributed directly to the student address
```

## 🎯 Curriculum Map

🟢 **LEVEL 1 — Foundational Forge:** Basic types, structural patterns, ownership architectures, borrowing rules.

🟡 **LEVEL 2 — Advanced Rust Systems:** Trait parameters, advanced generics, async/await with Tokio runtimes, testing strategies.

🔴 **LEVEL 3 — Enterprise Rust Engineering:** Unsafe scopes, performance benchmarks, procedural and declarative macros.

🔵 **LEVEL 4 — Soroban Mastery:** Soroban environment configuration, building decentralized token protocols, secure code design.

## 🤝 Contributing

We welcome contributions to our codebase! Follow these guidelines to maintain a clean history:

1. Fork this repository.
2. Spin up a new branch: `git checkout -b feat/your-feature-name`
3. Save structured changes: `git commit -m "feat: your descriptive change"`
4. Push code upwards: `git push origin feat/your-feature-name`
5. Open a Pull Request targeting our workspace root.

## 📜 Licensing & Acknowledgements

**License:** Licensed under the MIT License terms.

**Special Thanks:** The Stellar Development Foundation for providing the infrastructure and tools behind the Soroban smart contract framework.
