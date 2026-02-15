import { newMockEvent } from "matchstick-as"
import { ethereum, BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import {
  Cancelled,
  DisputeRaised,
  DisputeResolved,
  DocSubmitted,
  Funded,
  MilestoneAdded,
  MilestoneStageChanged,
  MilestonesLocked,
  OrderCreated,
  OrderStageChanged,
  OwnershipTransferred,
  PaidAdvance,
  PaidMilestone,
  Paused,
  Refunded,
  Rejected,
  Unpaused
} from "../generated/SupplyGuarantee/SupplyGuarantee"

export function createCancelledEvent(
  orderId: BigInt,
  note: string,
  by: Address
): Cancelled {
  let cancelledEvent = changetype<Cancelled>(newMockEvent())

  cancelledEvent.parameters = new Array()

  cancelledEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  cancelledEvent.parameters.push(
    new ethereum.EventParam("note", ethereum.Value.fromString(note))
  )
  cancelledEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return cancelledEvent
}

export function createDisputeRaisedEvent(
  orderId: BigInt,
  reason: string,
  by: Address
): DisputeRaised {
  let disputeRaisedEvent = changetype<DisputeRaised>(newMockEvent())

  disputeRaisedEvent.parameters = new Array()

  disputeRaisedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  disputeRaisedEvent.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  )
  disputeRaisedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return disputeRaisedEvent
}

export function createDisputeResolvedEvent(
  orderId: BigInt,
  nextStage: i32,
  note: string,
  by: Address
): DisputeResolved {
  let disputeResolvedEvent = changetype<DisputeResolved>(newMockEvent())

  disputeResolvedEvent.parameters = new Array()

  disputeResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  disputeResolvedEvent.parameters.push(
    new ethereum.EventParam(
      "nextStage",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(nextStage))
    )
  )
  disputeResolvedEvent.parameters.push(
    new ethereum.EventParam("note", ethereum.Value.fromString(note))
  )
  disputeResolvedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return disputeResolvedEvent
}

export function createDocSubmittedEvent(
  orderId: BigInt,
  t: i32,
  idx: i32,
  hash32: Bytes,
  by: Address
): DocSubmitted {
  let docSubmittedEvent = changetype<DocSubmitted>(newMockEvent())

  docSubmittedEvent.parameters = new Array()

  docSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  docSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "t",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(t))
    )
  )
  docSubmittedEvent.parameters.push(
    new ethereum.EventParam(
      "idx",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(idx))
    )
  )
  docSubmittedEvent.parameters.push(
    new ethereum.EventParam("hash32", ethereum.Value.fromFixedBytes(hash32))
  )
  docSubmittedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return docSubmittedEvent
}

export function createFundedEvent(
  orderId: BigInt,
  by: Address,
  amount: BigInt,
  total: BigInt
): Funded {
  let fundedEvent = changetype<Funded>(newMockEvent())

  fundedEvent.parameters = new Array()

  fundedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  fundedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )
  fundedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  fundedEvent.parameters.push(
    new ethereum.EventParam("total", ethereum.Value.fromUnsignedBigInt(total))
  )

  return fundedEvent
}

export function createMilestoneAddedEvent(
  orderId: BigInt,
  idx: i32,
  name: Bytes,
  bps: i32,
  planBy: BigInt,
  deliveryBy: BigInt,
  inspectionBy: BigInt,
  buyerApprovalBy: BigInt
): MilestoneAdded {
  let milestoneAddedEvent = changetype<MilestoneAdded>(newMockEvent())

  milestoneAddedEvent.parameters = new Array()

  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "idx",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(idx))
    )
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam("name", ethereum.Value.fromFixedBytes(name))
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "bps",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(bps))
    )
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam("planBy", ethereum.Value.fromUnsignedBigInt(planBy))
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "deliveryBy",
      ethereum.Value.fromUnsignedBigInt(deliveryBy)
    )
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "inspectionBy",
      ethereum.Value.fromUnsignedBigInt(inspectionBy)
    )
  )
  milestoneAddedEvent.parameters.push(
    new ethereum.EventParam(
      "buyerApprovalBy",
      ethereum.Value.fromUnsignedBigInt(buyerApprovalBy)
    )
  )

  return milestoneAddedEvent
}

export function createMilestoneStageChangedEvent(
  orderId: BigInt,
  idx: i32,
  prev: i32,
  next: i32
): MilestoneStageChanged {
  let milestoneStageChangedEvent =
    changetype<MilestoneStageChanged>(newMockEvent())

  milestoneStageChangedEvent.parameters = new Array()

  milestoneStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  milestoneStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "idx",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(idx))
    )
  )
  milestoneStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "prev",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(prev))
    )
  )
  milestoneStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "next",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(next))
    )
  )

  return milestoneStageChangedEvent
}

export function createMilestonesLockedEvent(
  orderId: BigInt,
  totalBps: i32,
  advanceAmount: BigInt
): MilestonesLocked {
  let milestonesLockedEvent = changetype<MilestonesLocked>(newMockEvent())

  milestonesLockedEvent.parameters = new Array()

  milestonesLockedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  milestonesLockedEvent.parameters.push(
    new ethereum.EventParam(
      "totalBps",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(totalBps))
    )
  )
  milestonesLockedEvent.parameters.push(
    new ethereum.EventParam(
      "advanceAmount",
      ethereum.Value.fromUnsignedBigInt(advanceAmount)
    )
  )

  return milestonesLockedEvent
}

export function createOrderCreatedEvent(
  orderId: BigInt,
  buyer: Address,
  seller: Address,
  token: Address,
  price: BigInt,
  advanceBps: i32
): OrderCreated {
  let orderCreatedEvent = changetype<OrderCreated>(newMockEvent())

  orderCreatedEvent.parameters = new Array()

  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("buyer", ethereum.Value.fromAddress(buyer))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("seller", ethereum.Value.fromAddress(seller))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("token", ethereum.Value.fromAddress(token))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam("price", ethereum.Value.fromUnsignedBigInt(price))
  )
  orderCreatedEvent.parameters.push(
    new ethereum.EventParam(
      "advanceBps",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(advanceBps))
    )
  )

  return orderCreatedEvent
}

export function createOrderStageChangedEvent(
  orderId: BigInt,
  prev: i32,
  next: i32
): OrderStageChanged {
  let orderStageChangedEvent = changetype<OrderStageChanged>(newMockEvent())

  orderStageChangedEvent.parameters = new Array()

  orderStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  orderStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "prev",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(prev))
    )
  )
  orderStageChangedEvent.parameters.push(
    new ethereum.EventParam(
      "next",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(next))
    )
  )

  return orderStageChangedEvent
}

export function createOwnershipTransferredEvent(
  prev: Address,
  next: Address
): OwnershipTransferred {
  let ownershipTransferredEvent =
    changetype<OwnershipTransferred>(newMockEvent())

  ownershipTransferredEvent.parameters = new Array()

  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("prev", ethereum.Value.fromAddress(prev))
  )
  ownershipTransferredEvent.parameters.push(
    new ethereum.EventParam("next", ethereum.Value.fromAddress(next))
  )

  return ownershipTransferredEvent
}

export function createPaidAdvanceEvent(
  orderId: BigInt,
  to: Address,
  amount: BigInt,
  byBank: Address
): PaidAdvance {
  let paidAdvanceEvent = changetype<PaidAdvance>(newMockEvent())

  paidAdvanceEvent.parameters = new Array()

  paidAdvanceEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  paidAdvanceEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  paidAdvanceEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  paidAdvanceEvent.parameters.push(
    new ethereum.EventParam("byBank", ethereum.Value.fromAddress(byBank))
  )

  return paidAdvanceEvent
}

export function createPaidMilestoneEvent(
  orderId: BigInt,
  idx: i32,
  to: Address,
  amount: BigInt,
  byBank: Address
): PaidMilestone {
  let paidMilestoneEvent = changetype<PaidMilestone>(newMockEvent())

  paidMilestoneEvent.parameters = new Array()

  paidMilestoneEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  paidMilestoneEvent.parameters.push(
    new ethereum.EventParam(
      "idx",
      ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(idx))
    )
  )
  paidMilestoneEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  paidMilestoneEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )
  paidMilestoneEvent.parameters.push(
    new ethereum.EventParam("byBank", ethereum.Value.fromAddress(byBank))
  )

  return paidMilestoneEvent
}

export function createPausedEvent(by: Address): Paused {
  let pausedEvent = changetype<Paused>(newMockEvent())

  pausedEvent.parameters = new Array()

  pausedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return pausedEvent
}

export function createRefundedEvent(
  orderId: BigInt,
  to: Address,
  amount: BigInt
): Refunded {
  let refundedEvent = changetype<Refunded>(newMockEvent())

  refundedEvent.parameters = new Array()

  refundedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  refundedEvent.parameters.push(
    new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
  )
  refundedEvent.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  )

  return refundedEvent
}

export function createRejectedEvent(
  orderId: BigInt,
  reason: string,
  by: Address
): Rejected {
  let rejectedEvent = changetype<Rejected>(newMockEvent())

  rejectedEvent.parameters = new Array()

  rejectedEvent.parameters.push(
    new ethereum.EventParam(
      "orderId",
      ethereum.Value.fromUnsignedBigInt(orderId)
    )
  )
  rejectedEvent.parameters.push(
    new ethereum.EventParam("reason", ethereum.Value.fromString(reason))
  )
  rejectedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return rejectedEvent
}

export function createUnpausedEvent(by: Address): Unpaused {
  let unpausedEvent = changetype<Unpaused>(newMockEvent())

  unpausedEvent.parameters = new Array()

  unpausedEvent.parameters.push(
    new ethereum.EventParam("by", ethereum.Value.fromAddress(by))
  )

  return unpausedEvent
}
