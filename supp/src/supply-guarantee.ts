import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  OrderCreated as OrderCreatedEvent,
  OrderStageChanged as OrderStageChangedEvent,
  SupplyGuarantee,
} from "../generated/SupplyGuarantee/SupplyGuarantee";

import { Order, OrderParticipant } from "../generated/schema";

function idOf(orderId: BigInt): string {
  return orderId.toString();
}

function participantId(orderId: BigInt, addr: Address, role: string): string {
  // چون ممکنه یک آدرس چند رول داشته باشه، role هم باید تو id باشه
  return orderId.toString() + "-" + addr.toHexString() + "-" + role;
}

function addParticipant(orderId: BigInt, addr: Address, role: string): void {
  // آدرس صفر رو ذخیره نکن
  if (addr == Address.zero()) return;

  let id = participantId(orderId, addr, role);
  let p = OrderParticipant.load(id);
  if (p == null) {
    p = new OrderParticipant(id);
    p.order = idOf(orderId);
    p.participant = addr; // schema: Bytes!  => Address قابل assign هست
    p.role = role;
    p.save();
  }
}

function upsertPartiesFromChain(order: Order, orderId: BigInt, contractAddr: Address): void {
  let sg = SupplyGuarantee.bind(contractAddr);

  let res = sg.try_getOrderParties(orderId);
  if (res.reverted) {
    // اگر revert شد، مقدارهای قبلی Order رو خراب نکن
    return;
  }

  let p = res.value;

  // ترتیب خروجی طبق ABI تو: buyer, seller, carrier, inspector
  let buyer = p.getValue0();
  let seller = p.getValue1();
  let carrier = p.getValue2();
  let inspector = p.getValue3();

  order.buyer = buyer;
  order.seller = seller;
  order.carrier = carrier;
  order.inspector = inspector;

  // participants هم برای همه رول‌ها
  addParticipant(orderId, buyer, "buyer");
  addParticipant(orderId, seller, "seller");
  addParticipant(orderId, carrier, "carrier");
  addParticipant(orderId, inspector, "inspector");
}

export function handleOrderCreated(event: OrderCreatedEvent): void {
  let id = idOf(event.params.orderId);

  let order = new Order(id);

  // اول از event پر کن (حداقل‌ها)
  order.buyer = event.params.buyer;
  order.seller = event.params.seller;

  // اینا رو فعلاً صفر نکن—از chain پر می‌کنیم
  order.carrier = Address.zero();
  order.inspector = Address.zero();

  order.token = event.params.token;
  order.price = event.params.price;
  order.advanceBps = event.params.advanceBps;

  order.stage = 0;
  order.createdAt = event.block.timestamp;
  order.createdTx = event.transaction.hash;

  // اینجا از chain مقدارهای واقعی roleها رو بگیر
  upsertPartiesFromChain(order, event.params.orderId, event.address);

  order.save();
}

export function handleOrderStageChanged(event: OrderStageChangedEvent): void {
  let id = idOf(event.params.orderId);
  let order = Order.load(id);
  if (order == null) return;

  // stage در event یک uint8 هست ولی schema Int! ـه
  order.stage = event.params.next;

  // هر بار stage عوض میشه هم parties رو sync کن
  // (چون ممکنه تو قرارداد بعداً carrier/inspector/bank/arbiter set شده باشه)
  upsertPartiesFromChain(order, event.params.orderId, event.address);

  order.save();
}
