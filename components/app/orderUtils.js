export const ROLE_LABELS = {
  buyer: "Buyer",
  seller: "Seller",
  carrier: "Carrier",
  inspector: "Inspector",
  bank: "Bank",
  arbiter: "Arbiter",
};

export function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function stageLabel(stageNum) {
  // enum OrderStage { Created, Funded, AdvanceRequested, AdvanceApproved, AdvancePaid, InMilestones, Finalized, Disputed, Cancelled }
  const m = {
    0: "Created",
    1: "Funded",
    2: "Advance Requested",
    3: "Advance Approved",
    4: "Advance Paid",
    5: "In Milestones",
    6: "Finalized",
    7: "Disputed",
    8: "Cancelled",
  };
  return m[Number(stageNum)] ?? `Stage #${stageNum}`;
}

export function stageTone(stageNum) {
  const s = Number(stageNum);
  if (s === 6) return "green"; // Finalized
  if (s === 7) return "red"; // Disputed
  if (s === 8) return "gray"; // Cancelled
  if (s === 5) return "blue"; // InMilestones
  if (s === 1 || s === 3 || s === 4) return "amber";
  return "gray";
}

export function fmtBigint(x) {
  if (x === null || x === undefined) return "—";
  return x.toString();
}
