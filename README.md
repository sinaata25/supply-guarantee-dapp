# SupplyGuarantee

**Trustless, milestone-based escrow for international trade — on Ethereum.**

SupplyGuarantee replaces the paper-heavy, bank-intermediated workflow of trade finance
(letters of credit, supply-chain guarantees) with a transparent, programmable escrow
smart contract. The buyer never hands over the full price upfront and the seller never
ships on blind trust: at **each stage** the buyer locks exactly that stage's amount in
escrow, the work is performed and documented, and the funds are released to the seller
only after the buyer approves.

---

## Why

In cross-border B2B trade:

- The **buyer** fears paying before the goods are delivered and inspected.
- The **seller** fears shipping before being sure of payment.
- **Banks** charge high fees to sit in the middle as the trusted intermediary.
- Trade **documents** (proforma, packing list, inspection report, delivery proof) live
  off-chain and are easy to forge or dispute.

SupplyGuarantee solves this by making the **contract itself** the neutral intermediary:

- Funds are escrowed and released **per stage**, so neither side is over-exposed.
- Every document is anchored on-chain as a hash and stored on **IPFS**, so the audit
  trail is immutable and the original file is always retrievable.
- Whoever's turn it is to act gets an **SMS** automatically.

---

## How it works

### Roles (per order)

| Role | Responsibility |
|------|----------------|
| **Buyer** | Funds each stage, approves the advance & each milestone, releases payment |
| **Seller** | Requests the advance, submits shipment plans, confirms delivery |
| **Carrier** *(optional)* | May submit plans / confirm delivery on the seller's behalf |
| **Inspector** | Approves the inspection report for each milestone |
| **Owner / Admin** | Contract deployer. Resolves disputes and can cancel + refund. (No bank or arbiter role — disputes are admin-resolved.) |

### Money model — staged escrow

There is **no full upfront deposit**. `price = advance + Σ milestones`, expressed in basis
points (`advanceBps + Σ milestoneBps == 10000`). At each stage the buyer locks exactly
that stage's amount, and it is released to the seller on approval.

### Order lifecycle (`OrderStage`)

```
Created ── seller: requestAdvance ──► AdvanceRequested
        (if advance == 0, jumps straight to InMilestones)

AdvanceRequested ── buyer: fundAdvance  (locks the advance) ──► AdvanceFunded
AdvanceFunded    ── buyer: approveAdvance (releases to seller) ──► InMilestones

InMilestones  ── all milestones Paid ──► Finalized

(any active stage) ── reject ──► Disputed ── admin: resolveDisputeTo / cancelByAdmin ──► …/Cancelled
```

### Per-milestone flow (`MilestoneStage`)

```
NotStarted
  └ seller/carrier: submitShipmentPlan ─► Planned
        └ buyer: approveShipmentPlan   ─► PlanApproved
              └ buyer: fundMilestone   (locks this milestone's amount) ─► Funded
                    └ seller/carrier: confirmDelivery ─► Delivered
                          └ inspector: approveInspection ─► InspectionApproved
                                └ buyer: approveMilestonePayment (releases) ─► Paid
```

When the last milestone reaches **Paid**, the order auto-finalizes.

### Document anchoring (IPFS)

At every step that needs evidence (advance request/approval, shipment plan, delivery,
inspection, final approval) the actor can **upload a file**. The flow:

1. File is uploaded to **IPFS via Pinata** (through the backend, which holds the keys).
2. The returned CID's 32-byte SHA-256 digest is anchored on-chain as the step's `DocSlot` hash.
3. Anyone on the order can open the **Documents** panel and view every file via its IPFS link.

Typing a plain text/hash still works for actors who don't have a file.

### Notifications (SMS)

After each stage change, the app computes **who must act next** and — if that wallet has a
phone number saved in their profile — sends them a Persian SMS via **IPPanel** (pattern
SMS). Phone numbers are normalized to `+98XXXXXXXXXX`.

---

## Tech stack

| Layer | Stack |
|-------|-------|
| Smart contract | Solidity `0.8.24`, self-contained (custom `SafeERC20Lite` / `OwnableLite` / `PausableLite` / `ReentrancyGuardLite`, no OpenZeppelin) |
| Contract tooling | Hardhat (deploy script auto-wires addresses into the app + subgraph) |
| Frontend | Next.js 16, React 19, ethers v6, Tailwind CSS 4 |
| Backend | Django 6 + DRF + SimpleJWT, web3.py (SIWE auth), Pillow |
| Indexing | The Graph (subgraph in AssemblyScript) |
| Storage | IPFS via Pinata |
| Notifications | IPPanel pattern SMS |
| Auth | Sign-In With Ethereum (EIP-4361) — wallet signature, no passwords |

---

## Repository layout

```
contracts/            SupplyGuarantee.sol, MockUSD.sol  (the source of truth)
hardhat/              Hardhat project — compile & deploy to Sepolia
app/                  Next.js routes (dashboard, new order, order detail, profile, marketing pages)
components/           React components (web3 provider, order card, layout)
lib/                  web3 helpers, ABI, IPFS helpers, API client
supp/                 The Graph subgraph (schema, mappings, generated code)
backend/centralize/   Django project (accounts app: auth, profile, SMS, IPFS)
public/               static assets
```

---

## Deployed addresses (Sepolia, chainId 11155111)

| Contract | Address |
|----------|---------|
| SupplyGuarantee | `0xAA187d38D0226e1A4869ca596Fe43DcF3CaeE7D2` (startBlock `11038536`) |
| MockUSD (test ERC-20) | `0x64EA9317c8185BC85b3E7C7BDEC6fcfBdAaa53A1` |

> These are the current dev deployments. When you redeploy (see below), the Hardhat
> script updates `.env.local`, `supp/subgraph.yaml`, and `supp/networks.json` for you.

---

## Setup — from zero to running

There are **three** runnable pieces: the **backend** (Django), the **frontend** (Next.js),
and the **subgraph** (The Graph). The smart contract is already deployed on Sepolia, so for
a quick start you only need the backend + frontend. Redeploying the contract and subgraph is
optional and covered at the end.

### 0. Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.12+
- **Git**
- **MetaMask** (browser extension) with the **Sepolia** test network and some Sepolia ETH
  (from any Sepolia faucet)
- Commands below use **PowerShell** (Windows). On macOS/Linux, swap path separators and use
  `source venv/bin/activate` instead of the `Activate.ps1` line.

```powershell
git clone <your-repo-url> supply-guarantee-dapp
cd supply-guarantee-dapp
```

### 1. Backend (Django) — terminal #1

```powershell
cd backend\centralize

# create & activate a virtualenv (first time only)
python -m venv ..\venv
..\venv\Scripts\Activate.ps1            # macOS/Linux: source ../venv/bin/activate
#  If PowerShell blocks the script:  Set-ExecutionPolicy -Scope Process -Bypass

pip install -r ..\requirements.txt      # first time only
python manage.py migrate                # first time only
python manage.py runserver 127.0.0.1:8000
```

Backend is now at **http://127.0.0.1:8000** (Swagger UI on `/`, admin on `/admin/`).

**Backend secrets** (Pinata IPFS, IPPanel SMS) have working dev defaults baked into
`backend/centralize/centralize/settings.py`, but for anything real you should override them
with environment variables before `runserver`:

```powershell
$env:PINATA_JWT       = "<your pinata JWT with pinFileToIPFS scope>"
$env:IPPANEL_API_KEY  = "<your ippanel api key>"
$env:IPPANEL_PATTERN_CODE = "<your pattern code>"
$env:IPPANEL_FROM_NUMBER  = "+98xxxxxxxxxx"
```

### 2. Frontend (Next.js) — terminal #2

```powershell
cd supply-guarantee-dapp
npm install                              # first time only
npm run dev
```

Frontend is now at **http://localhost:3000**.

The frontend reads `.env.local` (already present for the current Sepolia deployment):

```ini
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SG_ADDRESS=0xAA187d38D0226e1A4869ca596Fe43DcF3CaeE7D2
NEXT_PUBLIC_TOKEN_ADDRESS=0x64EA9317c8185BC85b3E7C7BDEC6fcfBdAaa53A1
NEXT_PUBLIC_GRAPH_URL="https://api.studio.thegraph.com/query/1741967/supp/version/latest"
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/
NEXT_PUBLIC_SG_START_BLOCK=11038536
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs
```

### 3. Use the app

1. Open http://localhost:3000 and **Connect Wallet** (MetaMask on Sepolia).
2. Click **Login** and sign the SIWE message — this is what issues the session token
   needed for IPFS upload and SMS (Connect alone is not enough).
3. Go to **Profile** and save your details, including a **phone number** (`+989...`) if you
   want to receive SMS notifications.
4. Make sure the buyer wallet holds some **MockUSD** to fund stages (see minting below).
5. Create a **New Order**, then walk the staged flow on the order page.

---

## Optional — redeploy the contract (Hardhat)

Only needed if you change `contracts/SupplyGuarantee.sol`. The deploy script verifies the new
bytecode and rewires `.env.local`, `supp/subgraph.yaml`, and `supp/networks.json` automatically.

```powershell
cd hardhat
npm install                              # first time only

# create hardhat\.env (gitignored) from the example, then put your key in it:
#   DEPLOYER_PRIVATE_KEY=0x<key of a wallet with Sepolia ETH>
#   SEPOLIA_RPC_URL=<optional custom RPC>
copy .env.example .env

npm run deploy:sepolia
```

On success it prints the new address and confirms the staged-escrow functions
(`fundAdvance`, `fundMilestone`, `cancelByAdmin`) are present. Restart `npm run dev` afterward.

### Minting MockUSD (to fund test orders)

The buyer wallet needs MockUSD. If you control the MockUSD owner, call `mint(buyer, amount)`
on `0x64EA…53A1` (via Etherscan's "Write Contract", Remix, or Hardhat). Otherwise redeploy
`contracts/MockUSD.sol` and set `NEXT_PUBLIC_TOKEN_ADDRESS` to the new address.

---

## Optional — redeploy the subgraph (The Graph Studio)

Needed after a contract redeploy so the dashboard can list orders.

```powershell
cd supp
npm install                              # first time only
npx graph codegen
npx graph build
npx graph auth <YOUR_STUDIO_DEPLOY_KEY>  # from your subgraph page on thegraph.com/studio
npm run deploy                           # deploys to slug "supp"; enter a version label
```

Because `.env.local` uses `.../supp/version/latest`, the query URL keeps working after each
new version. If Studio gives you a different query URL, update `NEXT_PUBLIC_GRAPH_URL`.

---

## Backend API (prefix `/api/accounts/`)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/nonce/` | public | Get a SIWE nonce + message to sign |
| POST | `/auth/verify/` | public | Verify the signature → JWT access/refresh |
| GET / PATCH | `/me/` | JWT | Read / update own profile (incl. phone, photo) |
| GET | `/me/all/` | public | List profiles (wallet + email) for the autocomplete |
| POST | `/notify/order-stage/` | JWT | SMS the next actor about a stage change |
| POST | `/ipfs/upload/` | JWT | Pin a file to IPFS via Pinata, return CID + gateway URL |

JWT access tokens are valid for 12 hours (refresh 30 days).

---

## Security notes

- **Custom "Lite" primitives** instead of OpenZeppelin keep the contract small and
  dependency-free; `nonReentrant` guards every fund/transfer path.
- **Per-stage escrow** caps exposure: at most one stage's value is at risk at a time, and
  cancellation refunds whatever is still escrowed (`escrowed`) to the buyer.
- **SIWE**: the backend rebuilds the exact signed message from a server-stored nonce
  (5-minute TTL, rotated immediately after use) — the frontend is never trusted.
- **Secrets** (Pinata JWT, IPPanel key) live only on the backend. The dev defaults in
  `settings.py` are for local testing — override them via environment variables and rotate
  any key that has been shared, before deploying anywhere real.
