// orderUtils.js

export const ROLE_LABELS = {
  buyer: "Buyer",
  seller: "Seller",
  carrier: "Carrier",
  inspector: "Inspector",
};

// Matches the enum inside the smart contract
export const ORDER_STAGE = {
  Created: 0,
  Funded: 1,
  AdvanceRequested: 2,
  InMilestones: 3,
  Finalized: 4,
  Disputed: 5,
  Cancelled: 6,
};

// Matches the enum inside the smart contract
export const MILESTONE_STAGE = {
  NotStarted: 0,
  Planned: 1,
  PlanApproved: 2,
  Delivered: 3,
  InspectionApproved: 4,
  Paid: 5,
};

export function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function stageLabel(stageNum) {
  // enum OrderStage { Created, Funded, AdvanceRequested, InMilestones, Finalized, Disputed, Cancelled }
  const m = {
    0: "Created",
    1: "Funded",
    2: "Advance Requested",
    3: "In Milestones",
    4: "Finalized",
    5: "Disputed",
    6: "Cancelled",
  };
  return m[Number(stageNum)] ?? `Stage #${stageNum}`;
}

export function stageTone(stageNum) {
  const s = Number(stageNum);
  if (s === ORDER_STAGE.Finalized) return "green";
  if (s === ORDER_STAGE.Disputed) return "red";
  if (s === ORDER_STAGE.Cancelled) return "gray";
  if (s === ORDER_STAGE.InMilestones) return "blue";
  if (s === ORDER_STAGE.Funded || s === ORDER_STAGE.AdvanceRequested) return "amber";
  return "gray";
}

export function fmtBigint(x) {
  if (x === null || x === undefined) return "—";
  return x.toString();
}

// ---------- Next: Next action / who should do what ----------

/** Normalize role strings for comparisons (case-insensitive). */
function normRole(r) {
  return String(r || "").toLowerCase();
}

/**
 * Returns true if `userRoles` contains at least one role in `neededRoles`.
 * Useful to determine whether it is the current user's turn to act.
 */
function hasAnyRole(userRoles, neededRoles) {
  if (!neededRoles?.length) return false;
  const set = new Set((userRoles || []).map(normRole));
  return neededRoles.some((r) => set.has(normRole(r)));
}

/**
 * Determines the next action for the given order object.
 *
 * Returns:
 * {
 *   title: string,
 *   detail: string,
 *   tone: "gray"|"blue"|"green"|"red"|"amber",
 *   requiredRoles: string[],
 *   isMyTurn: boolean,
 * }
 *
 * Notes:
 * - For milestone guidance, you should pass:
 *   o.nextMsIdx, o.nextMsStage, o.nextMsName
 *   which you fetch from the contract:
 *   getMilestone(orderId, nextIdx)
 */
export function nextActionForOrder(o) {
  const st = Number(o?.stage);

  const base = {
    title: "No action",
    detail: "—",
    tone: "gray",
    requiredRoles: [],
    isMyTurn: false,
  };

  // Dispute flow (resolved by the admin/owner only)
  if (st === ORDER_STAGE.Disputed) {
    return {
      title: "Dispute needs resolution",
      detail: "The admin must resolve the dispute.",
      tone: "red",
      requiredRoles: [],
      isMyTurn: false,
    };
  }

  // Terminal states
  if (st === ORDER_STAGE.Finalized) {
    return { ...base, title: "Finalized", detail: "The order has been finalized.", tone: "green" };
  }
  if (st === ORDER_STAGE.Cancelled) {
    return { ...base, title: "Cancelled", detail: "The order has been cancelled.", tone: "red" };
  }

  // Created
  if (st === ORDER_STAGE.Created) {
    // If milestones are not locked yet => buyer/seller should configure and lock them
    if (!o?.mLocked) {
      const requiredRoles = ["buyer", "seller"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: "Configure & lock milestones",
        detail: isMyTurn
          ? "It's your turn: add/configure milestones and lock them."
          : "Buyer/Seller must configure milestones and lock them.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    // If locked => buyer funds the order
    const requiredRoles = ["buyer"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Fund the order",
      detail: isMyTurn ? "It's your turn: fund the order." : "Buyer must deposit the order funds.",
      tone: isMyTurn ? "blue" : "gray",
      requiredRoles,
      isMyTurn,
    };
  }

  // Funded => seller requests advance
  if (st === ORDER_STAGE.Funded) {
    const requiredRoles = ["seller"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Seller requests advance",
      detail: isMyTurn ? "It's your turn: submit an advance request." : "Seller must submit an advance request.",
      tone: isMyTurn ? "blue" : "gray",
      requiredRoles,
      isMyTurn,
    };
  }

  // AdvanceRequested => buyer approves & pays advance
  if (st === ORDER_STAGE.AdvanceRequested) {
    const requiredRoles = ["buyer"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Buyer approves & pays advance",
      detail: isMyTurn
        ? "It's your turn: approve the advance (the payment is sent automatically)."
        : "Buyer must approve and pay the advance.",
      tone: isMyTurn ? "blue" : "gray",
      requiredRoles,
      isMyTurn,
    };
  }

  // InMilestones => use nextMsStage to determine the next step
  if (st === ORDER_STAGE.InMilestones) {
    const idx = Number(o?.nextMsIdx ?? 0);
    const ms = o?.nextMsStage;

    // If next milestone stage is not provided, we can't decide the next step
    if (ms === null || ms === undefined) {
      return {
        title: "Milestones in progress",
        detail: "To show the next step, the next milestone stage must be read from the contract.",
        tone: "amber",
        requiredRoles: [],
        isMyTurn: false,
      };
    }

    const msStage = Number(ms);
    const msName = o?.nextMsName
      ? `Milestone #${idx + 1} (${o.nextMsName})`
      : `Milestone #${idx + 1}`;

    if (msStage === MILESTONE_STAGE.NotStarted) {
      const requiredRoles = ["seller", "carrier"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Submit shipment plan`,
        detail: isMyTurn ? "It's your turn: submit the plan." : "Seller/Carrier must submit the plan.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    if (msStage === MILESTONE_STAGE.Planned) {
      const requiredRoles = ["buyer"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Approve plan`,
        detail: isMyTurn ? "It's your turn: approve the plan." : "Buyer must approve the plan.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    if (msStage === MILESTONE_STAGE.PlanApproved) {
      const requiredRoles = ["seller", "carrier"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Confirm delivery`,
        detail: isMyTurn ? "It's your turn: confirm delivery." : "Seller/Carrier must confirm delivery.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    if (msStage === MILESTONE_STAGE.Delivered) {
      const requiredRoles = ["inspector"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Approve inspection`,
        detail: isMyTurn
          ? "It's your turn: approve the inspection report."
          : "Inspector must approve the inspection.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    if (msStage === MILESTONE_STAGE.InspectionApproved) {
      const requiredRoles = ["buyer"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Buyer approves & pays`,
        detail: isMyTurn
          ? "It's your turn: approve the milestone (the payment is sent automatically)."
          : "Buyer must approve and pay this milestone.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    // Paid or unknown stage
    return {
      title: `${msName}: Processing`,
      detail: "Updating milestone status…",
      tone: "gray",
      requiredRoles: [],
      isMyTurn: false,
    };
  }

  return base;
}
