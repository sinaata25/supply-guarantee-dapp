// orderUtils.js

export const ROLE_LABELS = {
  buyer: "Buyer",
  seller: "Seller",
  carrier: "Carrier",
  inspector: "Inspector",
  bank: "Bank",
  arbiter: "Arbiter",
};

export const ORDER_STAGE = {
  Created: 0,
  Funded: 1,
  AdvanceRequested: 2,
  AdvanceApproved: 3,
  AdvancePaid: 4,
  InMilestones: 5,
  Finalized: 6,
  Disputed: 7,
  Cancelled: 8,
};

// Matches the enum inside the smart contract
export const MILESTONE_STAGE = {
  NotStarted: 0,
  Planned: 1,
  PlanApproved: 2,
  Delivered: 3,
  InspectionApproved: 4,
  BuyerApproved: 5,
  Paid: 6,
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

  // Dispute flow
  if (st === ORDER_STAGE.Disputed) {
    const requiredRoles = ["arbiter"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Dispute needs resolution",
      detail: isMyTurn
        ? "It's your turn: resolve the dispute."
        : "The Arbiter/Admin must submit the final decision.",
      tone: isMyTurn ? "amber" : "red",
      requiredRoles,
      isMyTurn,
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

  // AdvanceRequested => buyer approves
  if (st === ORDER_STAGE.AdvanceRequested) {
    const requiredRoles = ["buyer"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Buyer approves advance",
      detail: isMyTurn ? "It's your turn: approve the advance." : "Buyer must approve the advance.",
      tone: isMyTurn ? "blue" : "gray",
      requiredRoles,
      isMyTurn,
    };
  }

  // AdvanceApproved => bank pays advance
  if (st === ORDER_STAGE.AdvanceApproved) {
    const requiredRoles = ["bank"];
    const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
    return {
      title: "Bank pays advance",
      detail: isMyTurn ? "It's your turn: pay the advance." : "Bank must pay the advance.",
      tone: isMyTurn ? "blue" : "gray",
      requiredRoles,
      isMyTurn,
    };
  }

  // (AdvancePaid exists in the enum, but the contract may jump to InMilestones after bankPayAdvance)
  if (st === ORDER_STAGE.AdvancePaid) {
    return {
      title: "Advance paid",
      detail: "Transitioning into milestones…",
      tone: "amber",
      requiredRoles: [],
      isMyTurn: false,
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
        title: `${msName}: Buyer final approval`,
        detail: isMyTurn
          ? "It's your turn: submit the buyer’s final approval."
          : "Buyer must submit the final approval.",
        tone: isMyTurn ? "blue" : "gray",
        requiredRoles,
        isMyTurn,
      };
    }

    if (msStage === MILESTONE_STAGE.BuyerApproved) {
      const requiredRoles = ["bank"];
      const isMyTurn = hasAnyRole(o?.roles, requiredRoles);
      return {
        title: `${msName}: Bank pays milestone`,
        detail: isMyTurn ? "It's your turn: pay the milestone." : "Bank must pay the milestone amount.",
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
