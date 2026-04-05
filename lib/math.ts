import { ITEMS, PEOPLE, RECEIPT, Item } from "./bill";
import { ClaimsState } from "./store";

export type PersonTotal = {
  id: string;
  name: string;
  itemsSubtotal: number;
  tax: number;
  tip: number;
  cc: number;
  total: number;
  itemCount: number; // number of item claims (counting shares as 1)
};

export type Totals = {
  people: PersonTotal[];
  claimedSubtotal: number;
  unclaimedSubtotal: number;
  billTotal: number;
};

export function computeTotals(claims: ClaimsState): Totals {
  const perPerson: Record<string, PersonTotal> = {};
  for (const p of PEOPLE) {
    perPerson[p.id] = {
      id: p.id,
      name: p.name,
      itemsSubtotal: 0,
      tax: 0,
      tip: 0,
      cc: 0,
      total: 0,
      itemCount: 0,
    };
  }

  let claimedSubtotal = 0;
  for (const item of ITEMS) {
    const claimants = claims[item.id] || [];
    if (claimants.length === 0) continue;
    const share = item.price / claimants.length;
    for (const pid of claimants) {
      if (perPerson[pid]) {
        perPerson[pid].itemsSubtotal += share;
        perPerson[pid].itemCount += 1;
      }
    }
    claimedSubtotal += item.price;
  }

  // Proportional tax/tip/cc based on each person's share of CLAIMED subtotal
  for (const p of PEOPLE) {
    const pp = perPerson[p.id];
    const ratio = claimedSubtotal > 0 ? pp.itemsSubtotal / claimedSubtotal : 0;
    // Tax/tip/cc are on the full bill, distributed among claimants proportionally
    pp.tax = ratio * RECEIPT.tax;
    pp.tip = ratio * RECEIPT.tip;
    pp.cc = ratio * RECEIPT.ccSurcharge;
    pp.total = pp.itemsSubtotal + pp.tax + pp.tip + pp.cc;
  }

  return {
    people: Object.values(perPerson),
    claimedSubtotal,
    unclaimedSubtotal: RECEIPT.subtotal - claimedSubtotal,
    billTotal: RECEIPT.total,
  };
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}
