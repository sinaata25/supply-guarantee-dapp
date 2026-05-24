# SupplyGuarantee dApp

<div align="center">

![Solidity](https://img.shields.io/badge/Solidity-^0.8.24-363636?style=for-the-badge&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=for-the-badge&logo=next.js)
![Django](https://img.shields.io/badge/Django-6.0.2-092E20?style=for-the-badge&logo=django)
![Ethereum](https://img.shields.io/badge/Ethereum-Sepolia-3C3C3D?style=for-the-badge&logo=ethereum)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A decentralized, trustless escrow platform for international trade — powered by Ethereum smart contracts, milestone-based payment release, and SIWE authentication.**

[Live Demo](#) · [Smart Contract on Sepolia](https://sepolia.etherscan.io/address/0xfDCfA5454053db2Fc94D7568bE6e8854a3Cd8C28) · [Subgraph](#) · [API Docs](#)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Smart Contract Deep Dive](#smart-contract-deep-dive)
  - [Order Lifecycle](#order-lifecycle)
  - [Milestone Lifecycle](#milestone-lifecycle)
  - [Roles & Access Control](#roles--access-control)
  - [Document Anchoring](#document-anchoring)
  - [Security Patterns](#security-patterns)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Frontend Setup](#frontend-setup)
  - [Backend Setup](#backend-setup)
  - [Subgraph Setup](#subgraph-setup)
- [Environment Variables](#environment-variables)
- [Contracts](#contracts)
- [API Reference](#api-reference)
- [Subgraph](#subgraph)
- [Authentication Flow](#authentication-flow)
- [Contributing](#contributing)

---

## Overview

**SupplyGuarantee** is a full-stack decentralized application that brings the logic of international trade finance (letters of credit, supply chain guarantees) on-chain. It replaces paper-heavy, bank-intermediated trade workflows with transparent, programmable escrow contracts.

### What Problem Does It Solve?

In traditional B2B trade:
- Buyers must pay upfront or trust sellers blindly.
- Sellers fear non-payment after delivering goods.
- Banks charge high fees to act as intermediaries.
- Documents (inspection reports, delivery confirmations) are off-chain and unverifiable.

**SupplyGuarantee** solves this by:
- Locking the full purchase price in a smart contract escrow.
- Releasing funds **milestone by milestone** only after each stage is verified on-chain.
- Anchoring every document (advance request, inspection report, delivery proof) as a `bytes32` hash directly in the contract — creating an immutable audit trail.
- Enabling a **bank** to authorize payments, an **inspector** to certify delivery quality, and an **arbiter** (or contract owner) to resolve disputes — all without custodial control of the funds.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js 16 Frontend (React 19)              │   │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │ Web3Provider│  │ Order Pages  │  │ Profile / Auth  │  │   │
│  │  │ (ethers.js) │  │ (new/detail) │  │ (SIWE + JWT)    │  │   │
│  │  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  │   │
│  └────────┼────────────────┼───────────────────┼───────────┘   │
│           │ EIP-1193        │ ethers.js          │ REST API      │
└───────────┼────────────────┼───────────────────┼───────────────┘
            │                │                    │
            ▼                ▼                    ▼
┌───────────────────┐  ┌───────────────┐  ┌──────────────────────┐
│  Ethereum Network │  │  The Graph    │  │  Django Backend      │
│  (Sepolia)        │  │  (Subgraph)   │  │  (DRF + SimpleJWT)   │
│                   │  │               │  │                      │
│  ┌─────────────┐  │  │  Order index  │  │  SIWE Authentication │
│  │SupplyGuaran-│  │  │  Stage sync   │  │  Profile management  │
│  │tee.sol      │◄─┼──┤  Participant  │  │  Wallet-based login  │
│  │             │  │  │  tracking     │  │                      │
│  │MockUSD.sol  │  │  └───────────────┘  └──────────────────────┘
│  └─────────────┘  │
└───────────────────┘
```

The system has four independent layers:

| Layer | Technology | Responsibility |
|---|---|---|
| **Smart Contracts** | Solidity 0.8.24 | Escrow, payment logic, document hashing |
| **Frontend** | Next.js 16 / React 19 / ethers.js 6 | UI, wallet interaction, contract calls |
| **Indexer** | The Graph (AssemblyScript) | Real-time order/stage indexing via events |
| **Backend** | Django 6 / DRF / SimpleJWT | SIWE auth, profile storage, JWT issuance |

---

## Smart Contract Deep Dive

The core contract is `SupplyGuarantee.sol`. It is entirely self-contained — no OpenZeppelin dependencies — implementing its own `SafeERC20Lite`, `OwnableLite`, `PausableLite`, and `ReentrancyGuardLite` to minimize attack surface and external dependencies.

### Order Lifecycle

An order progresses through a strict finite-state machine. Each transition emits `OrderStageChanged`.

```
Created
   │
   │  buyer funds escrow (full price)
   ▼
Funded
   │
   │  seller calls requestAdvance()
   ▼
AdvanceRequested
   │
   │  buyer calls approveAdvance()
   ▼
AdvanceApproved
   │
   │  bank calls bankPayAdvance()  ──► advance sent to seller
   ▼
InMilestones  ◄──────────────────────────────────────────────┐
   │                                                          │
   │  all milestones completed & paid                        │ resolveDisputeTo()
   ▼                                                          │
Finalized                                          Disputed ──┘
                                                      │
                                               cancelByArbiter()
                                                      │
                                                  Cancelled
```

| Stage | Description |
|---|---|
| `Created` | Order header and milestones defined, milestones locked |
| `Funded` | Buyer has deposited the full `price` amount |
| `AdvanceRequested` | Seller submitted advance request document hash |
| `AdvanceApproved` | Buyer approved the advance (with optional deadline check) |
| `AdvancePaid` | Bank executed the advance transfer to seller |
| `InMilestones` | Active execution phase — milestones proceed in parallel |
| `Finalized` | All milestones paid — order complete |
| `Disputed` | Any authorized party triggered a dispute |
| `Cancelled` | Arbiter or admin cancelled; remaining balance refunded to buyer |

### Milestone Lifecycle

Each milestone independently tracks its own state:

```
NotStarted
    │
    │  seller/carrier: submitShipmentPlan()
    ▼
Planned
    │
    │  buyer: approveShipmentPlan()
    ▼
PlanApproved
    │
    │  seller/carrier: confirmDelivery()
    ▼
Delivered
    │
    │  inspector: approveInspection()
    ▼
InspectionApproved
    │
    │  buyer: approveMilestonePayment()
    ▼
BuyerApproved
    │
    │  bank: bankPayMilestone()  ──► milestone amount sent to seller
    ▼
Paid
```

When every milestone reaches `Paid`, the order automatically transitions to `Finalized`.

### Roles & Access Control

Every order assigns six distinct roles at creation time. Each role has strictly scoped permissions:

| Role | Address | Key Permissions |
|---|---|---|
| **Buyer** | `o.buyer` | Fund, approve advance, approve shipment plans, approve milestone payments, reject in AdvanceRequested stage |
| **Seller** | `o.seller` | Request advance, submit shipment plans, confirm delivery |
| **Carrier** | `o.carrier` | Submit shipment plans, confirm delivery |
| **Inspector** | `o.inspector` | Approve inspection reports |
| **Bank** | `o.bank` | Execute advance payment, execute milestone payments, reject in AdvanceApproved stage |
| **Arbiter** | `o.arbiter` | Resolve disputes, cancel orders |
| **Owner (Admin)** | `owner` | Pause/unpause contract, resolve disputes, cancel orders |

The `onlyConfigurator` modifier (owner OR buyer OR seller) governs order setup: adding milestones and locking them.

### Document Anchoring

Every critical document in the trade workflow is anchored on-chain as a `bytes32` SHA-256 hash in a `DocSlot` struct:

```solidity
struct DocSlot {
    bytes32 hash32;   // SHA-256 of the off-chain document
    uint64  at;       // block.timestamp at submission
    address by;       // who submitted it
}
```

Documents tracked per order:

| `DocType` | Stage | Who Submits |
|---|---|---|
| `AdvanceRequest` | → `AdvanceRequested` | Seller |
| `AdvanceApproval` | → `AdvanceApproved` | Buyer |
| `AdvancePayment` | → `InMilestones` | Bank |
| `M_Plan` | → `Planned` | Seller / Carrier |
| `M_PlanApproval` | → `PlanApproved` | Buyer |
| `M_Delivery` | → `Delivered` | Seller / Carrier |
| `M_InspectionReport` | → `InspectionApproved` | Inspector |
| `M_BuyerFinalApproval` | → `BuyerApproved` | Buyer |

Every submission emits `DocSubmitted(orderId, DocType, milestoneIdx, hash32, by)`.

### Milestone BPS (Basis Points) System

The contract enforces that `advanceBps + sum(milestone.bps) == 10_000` before milestones can be locked. This guarantees 100% of the purchase price is always accounted for:

```
advanceBps (e.g. 2000) + M1.bps (3000) + M2.bps (3000) + M3.bps (2000) = 10,000
```

Each milestone's `amount` is computed as `(price * bps) / 10_000` at lock time.

### Security Patterns

| Pattern | Implementation |
|---|---|
| **Reentrancy Guard** | Custom `ReentrancyGuardLite` with `_status` flag on all `fund()`, `bankPayAdvance()`, `bankPayMilestone()`, and `_refund()` |
| **Safe ERC20** | `SafeERC20Lite` wraps `transfer`/`transferFrom` with low-level call + return data check |
| **Pause / Unpause** | `PausableLite` — owner can halt all state-changing functions in an emergency |
| **Role Modifiers** | Every function is gated by a specific role modifier — no "general admin" bypass |
| **Deadline Enforcement** | Optional `uint256` deadlines on advance approval and each milestone stage |
| **Replay Prevention** | SIWE nonce rotated on every request and immediately after use |

---

## Tech Stack

### Frontend
- **Next.js 16.1.6** (App Router) with **React 19**
- **ethers.js 6** — wallet interaction, contract calls, event parsing
- **Tailwind CSS 4** — utility-first styling
- **lucide-react** — icons
- **clsx** — conditional class names

### Backend
- **Django 6.0.2** + **Django REST Framework 3.16**
- **djangorestframework-simplejwt 5.5** — JWT access/refresh tokens
- **drf-spectacular 0.29** — OpenAPI 3 schema & Swagger UI
- **eth-account / web3.py** — SIWE message reconstruction and signature recovery
- **Pillow** — profile photo handling

### Blockchain & Indexing
- **Solidity ^0.8.24** — smart contracts
- **The Graph** (AssemblyScript) — event-driven order indexing
- **Graph Node** + **IPFS** + **PostgreSQL** — local subgraph stack via Docker Compose
- **Sepolia testnet** — deployment target

---

## Project Structure

```
supply-guarantee-dapp/
│
├── contracts/                     # Solidity smart contracts
│   ├── SupplyGuarantee.sol        # Main escrow contract
│   └── MockUSD.sol                # ERC-20 test token (owner-mintable)
│
├── lib/                           # Frontend shared utilities
│   ├── abi/
│   │   ├── SupplyGuarantee.json   # Contract ABI
│   │   └── MockUSD.json           # Token ABI
│   ├── web3/
│   │   ├── index.js               # Wallet connect, provider, signer helpers
│   │   ├── config.js              # Env-based chain/address config
│   │   ├── abi.js                 # Typed ABI exports
│   │   ├── bytes.js               # bytes32 ↔ string helpers
│   │   └── getLogsChunked.js      # Chunked log fetching (rate-limit safe)
│   ├── graph/
│   │   └── client.ts              # GraphQL client for The Graph
│   ├── api.js                     # REST API calls (nonce, verify, profile)
│   └── site.js                    # App-wide constants
│
├── app/                           # Next.js App Router pages
│   ├── layout.js                  # Root layout (Web3Provider wrapper)
│   ├── page.js                    # Home redirect
│   ├── app/
│   │   ├── page.jsx               # Dashboard — lists all orders for connected wallet
│   │   └── orders/
│   │       ├── new/
│   │       │   ├── page.jsx       # Create new order wizard
│   │       │   └── NewOrderPage.module.css
│   │       └── [orderId]/
│   │           └── page.jsx       # Order detail — full lifecycle management
│   ├── features/page.jsx          # Features landing page
│   ├── how-it-works/page.jsx      # Explainer page
│   ├── profile/page.jsx           # User profile editor
│   └── security/page.jsx          # Security overview page
│
├── components/
│   ├── web3/
│   │   └── Web3Provider.jsx       # Global wallet + auth context (React Context)
│   ├── app/
│   │   ├── OrderCard.jsx          # Order summary card component
│   │   └── orderUtils.js          # Stage/role display utilities
│   ├── home/
│   │   ├── Hero.jsx               # Landing hero section
│   │   └── HowItWorks.jsx         # Step-by-step explainer
│   └── layout/
│       ├── Header.jsx             # Navigation bar
│       └── Footer.jsx             # Footer
│
├── backend/                       # Django REST API
│   └── centralize/
│       ├── accounts/
│       │   ├── models.py          # Profile model (wallet-based identity)
│       │   ├── views.py           # NonceView, VerifyView, MeView, ProfileListView
│       │   ├── serializers.py     # DRF serializers
│       │   ├── urls.py            # Auth + profile URL routing
│       │   └── admin.py           # Django admin registration
│       └── centralize/
│           └── settings.py        # Django settings (CORS, JWT, Spectacular)
│
├── supp/                          # The Graph subgraph
│   ├── subgraph.yaml              # Subgraph manifest (Sepolia, startBlock 10200000)
│   ├── schema.graphql             # GraphQL schema (Order, OrderParticipant)
│   ├── src/
│   │   └── supply-guarantee.ts    # Event handlers (AssemblyScript)
│   ├── abis/
│   │   └── SupplyGuarantee.json   # ABI for code generation
│   ├── tests/                     # Matchstick unit tests
│   ├── docker-compose.yml         # Local Graph Node + IPFS + Postgres
│   └── package.json
│
├── package.json                   # Frontend dependencies
└── next.config.mjs
```

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Python** >= 3.11
- **MetaMask** (or any EIP-1193 compatible wallet)
- **Docker + Docker Compose** (for local subgraph)
- Sepolia ETH for gas ([faucet](https://sepoliafaucet.com/))

---

### Frontend Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/supply-guarantee-dapp.git
cd supply-guarantee-dapp

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your values (see Environment Variables section)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Backend Setup

```bash
cd backend/centralize

# 1. Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 2. Install Python dependencies
pip install -r ../requirements.txt

# 3. Set up environment variables
export DJANGO_SECRET_KEY="your-secret-key-here"
export DJANGO_DEBUG=True
export DJANGO_ALLOWED_HOSTS="localhost,127.0.0.1"
export CORS_ALLOWED_ORIGINS="http://localhost:3000"

# 4. Run migrations
python manage.py migrate

# 5. (Optional) Create a superuser
python manage.py createsuperuser

# 6. Start the development server
python manage.py runserver
```

API available at [http://localhost:8000](http://localhost:8000).
Swagger UI at [http://localhost:8000/api/schema/swagger-ui/](http://localhost:8000/api/schema/swagger-ui/).

---

### Subgraph Setup

#### Option A: Deploy to The Graph hosted service / Subgraph Studio

```bash
cd supp

# Install dependencies
npm install

# Authenticate
graph auth --studio YOUR_DEPLOY_KEY

# Generate types from ABI
npm run codegen

# Build
npm run build

# Deploy
graph deploy --studio supply-guarantee
```

#### Option B: Run locally with Docker

```bash
cd supp

# Start Graph Node, IPFS, and Postgres
docker-compose up -d

# Wait for services to start, then create the subgraph
curl -X POST http://localhost:8020 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"subgraph_create","params":{"name":"supply-guarantee"},"id":"1"}'

# Deploy
npm run deploy-local
```

GraphQL playground: [http://localhost:8000/subgraphs/name/supply-guarantee](http://localhost:8000/subgraphs/name/supply-guarantee)

---

## Environment Variables

### Frontend (`.env.local`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_CHAIN_ID` | Target EVM chain ID | `11155111` (Sepolia) |
| `NEXT_PUBLIC_SG_ADDRESS` | Deployed `SupplyGuarantee` contract address | `0xfDCfA5454...` |
| `NEXT_PUBLIC_TOKEN_ADDRESS` | ERC-20 token address (MockUSD or real USDC) | `0xabc123...` |
| `NEXT_PUBLIC_API_BASE_URL` | Django backend base URL | `http://127.0.0.1:8000/` |
| `NEXT_PUBLIC_GRAPH_URL` | The Graph query endpoint | `http://localhost:8000/subgraphs/name/supply-guarantee` |

### Backend

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key (keep private!) |
| `DJANGO_DEBUG` | `True` for dev, `False` for production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `CORS_ALLOWED_ORIGINS` | Frontend origins allowed for CORS |
| `DATABASE_URL` | (Optional) External DB URL; defaults to SQLite |

---

## Contracts

### SupplyGuarantee

**Sepolia address:** `0xfDCfA5454053db2Fc94D7568bE6e8854a3Cd8C28`

| Function | Access | Description |
|---|---|---|
| `createOrderHeader(...)` | Anyone | Create a new order with all parties and pricing |
| `addMilestone(id, name, bps, dl)` | Configurator | Add a milestone (before lock) |
| `lockMilestones(id)` | Configurator | Lock milestones; validates bps sum = 10,000 |
| `fund(id, amt)` | Buyer | Deposit tokens into escrow |
| `requestAdvance(id, h)` | Seller | Submit advance request doc hash |
| `approveAdvance(id, h)` | Buyer | Approve advance with approval doc hash |
| `bankPayAdvance(id, h)` | Bank | Transfer advance to seller |
| `submitShipmentPlan(id, idx, h)` | Seller / Carrier | Submit shipment plan for milestone |
| `approveShipmentPlan(id, idx, h)` | Buyer | Approve shipment plan |
| `confirmDelivery(id, idx, h)` | Seller / Carrier | Confirm milestone delivery |
| `approveInspection(id, idx, h)` | Inspector | Submit inspection report |
| `approveMilestonePayment(id, idx, h)` | Buyer | Final approval for milestone payment |
| `bankPayMilestone(id, idx)` | Bank | Transfer milestone amount to seller |
| `rejectCurrent(id, reason)` | Role-dependent | Reject current stage → triggers dispute |
| `resolveDisputeTo(id, stage, note)` | Arbiter / Owner | Resolve dispute to any valid stage |
| `cancelByArbiter(id, note)` | Arbiter / Owner | Cancel and refund buyer |

**View functions:**

| Function | Returns |
|---|---|
| `orderStageOf(id)` | Current `OrderStage` |
| `getOrderParties(id)` | `(buyer, seller, carrier, inspector, bank, arbiter)` |
| `getOrderMoney(id)` | Price, advance, deposited, milestone counts |
| `getMilestone(id, idx)` | Full milestone data including all `DocSlot`s |

### MockUSD

A simple mintable ERC-20 token for testnet use. The deployer (owner) can call `mint(to, amount)` to issue tokens. Decimals are configurable at deployment.

---

## API Reference

The Django backend exposes a SIWE-based authentication API and profile management endpoints.

### Base URL
```
http://localhost:8000/api/accounts/
```

### Endpoints

#### `POST /auth/nonce/`
Generate a SIWE-style login message for a wallet address.

**Request:**
```json
{
  "address": "0xYourWalletAddress",
  "chain_id": 11155111
}
```

**Response:**
```json
{
  "address": "0x...",
  "nonce": "abc123def456",
  "message": "localhost:8000 wants you to sign in with your Ethereum account:\n0x...\n\nSign in to your dashboard.\n\nURI: http://localhost:8000/\nVersion: 1\nChain ID: 11155111\nNonce: abc123def456\nIssued At: 2024-01-01T00:00:00Z",
  "expires_at": "2024-01-01T00:05:00Z"
}
```

> Sign the `message` field with MetaMask using `personal_sign`.

---

#### `POST /auth/verify/`
Verify the signed message and receive a JWT token pair.

**Request:**
```json
{
  "address": "0xYourWalletAddress",
  "signature": "0xSignedMessageHex"
}
```

**Response:**
```json
{
  "access": "eyJhbGci...",
  "refresh": "eyJhbGci..."
}
```

---

#### `GET /me/` *(Auth required)*
Retrieve your profile.

**Header:** `Authorization: Bearer <access_token>`

---

#### `PATCH /me/` *(Auth required)*
Update profile fields. Supports `multipart/form-data` for photo upload.

**Fields:** `first_name`, `last_name`, `email`, `phone_number`, `bio`, `photo`

---

#### `GET /profiles/`
List all registered wallet addresses (public info only).

---

## Subgraph

The Graph subgraph indexes two events from `SupplyGuarantee`:

- **`OrderCreated`** → creates an `Order` entity, calls `getOrderParties()` on-chain to populate all role addresses, and creates `OrderParticipant` entries for each non-zero role.
- **`OrderStageChanged`** → updates the `Order.stage` and re-syncs party addresses (in case roles were configured after creation).

### GraphQL Schema

```graphql
type Order @entity {
  id: ID!
  buyer: Bytes!
  seller: Bytes!
  carrier: Bytes!
  inspector: Bytes!
  bank: Bytes!
  arbiter: Bytes!
  token: Bytes!
  price: BigInt!
  advanceBps: Int!
  stage: Int!
  createdAt: BigInt!
  createdTx: Bytes!
}

type OrderParticipant @entity(immutable: true) {
  id: ID!
  order: Order!
  participant: Bytes!
  role: String!
}
```

### Example Queries

**Get all active orders for a participant:**
```graphql
{
  orderParticipants(where: { participant: "0xYourAddress" }) {
    role
    order {
      id
      stage
      price
      buyer
      seller
    }
  }
}
```

**Get orders in `InMilestones` stage:**
```graphql
{
  orders(where: { stage: 5 }) {
    id
    buyer
    seller
    price
    createdAt
  }
}
```

---

## Authentication Flow

The app uses **Sign-In with Ethereum (SIWE)** — a standard (EIP-4361) that lets users authenticate using their wallet signature instead of a password:

```
1. User connects wallet (MetaMask)
           │
           ▼
2. Frontend calls POST /auth/nonce/  with wallet address
           │
           ▼
3. Backend generates a random nonce (expires in 5 min)
   and returns a SIWE-formatted message
           │
           ▼
4. Frontend asks MetaMask to sign the message
   (personal_sign — shows human-readable text to user)
           │
           ▼
5. Frontend calls POST /auth/verify/ with address + signature
           │
           ▼
6. Backend recovers the signer address from the signature,
   checks it matches the stored nonce (replay-safe),
   rotates the nonce immediately, and issues JWT pair
           │
           ▼
7. Frontend stores access token, uses it as Bearer token
   for all subsequent API calls
```

Key security properties:
- Nonce expires after **5 minutes**
- Nonce is **immediately rotated** after successful verification (prevents replay)
- Backend **independently rebuilds** the exact SIWE message to verify — it does not trust the frontend to provide the message text
- Wallet address is stored **checksummed and lowercased** for consistency

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with clear commit messages
4. Test your changes thoroughly
5. Open a Pull Request with a description of what changed and why

### Development Notes

- Smart contract changes require re-generating the ABI (`lib/abi/SupplyGuarantee.json`) and redeploying
- After redeployment, update `NEXT_PUBLIC_SG_ADDRESS` and the `address` field in `supp/subgraph.yaml`, then redeploy the subgraph
- Backend API changes should be reflected in the OpenAPI schema (`python manage.py spectacular --file schema.yaml`)

---

## License

This project is licensed under the MIT License.

---

<div align="center">

Built with ❤️ on Ethereum · Trustless Trade Finance for Everyone

</div>