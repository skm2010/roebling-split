export type Item = {
  id: string;
  name: string;
  category: "wine" | "beer" | "cocktail" | "spirit" | "food";
  price: number;
};

export type Person = {
  id: string;
  name: string;
};

export const DEFAULT_PEOPLE: Person[] = [
  { id: "sanjit", name: "Sanjit" },
  { id: "vimal", name: "Vimal" },
  { id: "yash", name: "Yash" },
  { id: "george", name: "George" },
  { id: "luis", name: "Luis" },
  { id: "daniel", name: "Daniel" },
];

// Payer for the Venmo deep link
export const PAYER = {
  id: "sanjit",
  name: "Sanjit",
  venmoHandle: "Sanjit-Misra",
};

// Receipt metadata
export const RECEIPT = {
  venue: "Roebling Sporting Club",
  address: "225 N 8th St · Brooklyn",
  check: "#102",
  date: "April 4, 2026",
  subtotal: 410.99,
  tax: 37.55,
  tip: 82.20,
  ccSurcharge: 12.33,
  get total() {
    return this.subtotal + this.tax + this.tip + this.ccSurcharge;
  },
};

// Build item list — modifiers folded in, multi-qty expanded
function buildItems(): Item[] {
  const out: Item[] = [];
  let counter = 0;
  const add = (name: string, category: Item["category"], price: number, qty = 1) => {
    for (let i = 0; i < qty; i++) {
      counter++;
      out.push({ id: `i${counter.toString().padStart(3, "0")}`, name, category, price });
    }
  };

  add("Pinot Noir", "wine", 12.0, 3);
  add("Espresso Martini", "cocktail", 13.0);
  add("16 pc Traditional Wings — hot (w/ blue cheese + ranch)", "food", 39.99);
  add("RSC Pilz", "beer", 8.0, 12);
  add("Old Bay Fries", "food", 10.0);
  add("Guinness Stout", "beer", 10.0, 8);
  add("Modelo", "beer", 6.0, 7);
  add("8 pc Traditional Wings (w/ hoisin sesame)", "food", 20.0);
  add("Sloop Juice Bomb IPA", "beer", 9.0);
  add("Don Julio Silver (2 oz)", "spirit", 18.0);
  add("Kale Caesar Salad (add chicken)", "food", 21.0);
  add("Mozzarella Sticks", "food", 14.0);
  add("Malbec", "wine", 12.0);

  return out;
}

export const ITEMS: Item[] = buildItems();

// Sanity check — should equal receipt subtotal
export const ITEMS_SUM = ITEMS.reduce((s, i) => s + i.price, 0);

export const BILL_ID = "roebling-apr4";
