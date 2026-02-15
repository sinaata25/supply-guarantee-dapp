import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts"
import { Cancelled } from "../generated/schema"
import { Cancelled as CancelledEvent } from "../generated/SupplyGuarantee/SupplyGuarantee"
import { handleCancelled } from "../src/supply-guarantee"
import { createCancelledEvent } from "./supply-guarantee-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#tests-structure

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let orderId = BigInt.fromI32(234)
    let note = "Example string value"
    let by = Address.fromString("0x0000000000000000000000000000000000000001")
    let newCancelledEvent = createCancelledEvent(orderId, note, by)
    handleCancelled(newCancelledEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#write-a-unit-test

  test("Cancelled created and stored", () => {
    assert.entityCount("Cancelled", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "Cancelled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "orderId",
      "234"
    )
    assert.fieldEquals(
      "Cancelled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "note",
      "Example string value"
    )
    assert.fieldEquals(
      "Cancelled",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "by",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/#asserts
  })
})
