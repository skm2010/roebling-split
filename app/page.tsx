"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ITEMS, RECEIPT, PAYER, Item, Person } from "@/lib/bill";
import { computeTotals, formatUSD } from "@/lib/math";
import { ClaimsState } from "@/lib/store";

const ACTIVE_PERSON_KEY = "roebling:activePerson";

// ----- Category glyphs (small unicode, not emoji) -----
const CATEGORY_GLYPH: Record<Item["category"], string> = {
  wine: "◆",
  beer: "◈",
  cocktail: "✦",
  spirit: "❋",
  food: "●",
};

const CATEGORY_LABEL: Record<Item["category"], string> = {
  wine: "Wine",
  beer: "Beer",
  cocktail: "Cocktail",
  spirit: "Spirit",
  food: "Kitchen",
};

export default function HomePage() {
  const [claims, setClaims] = useState<ClaimsState>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Restore active person from localStorage once people load
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  useEffect(() => {
    if (restoredFromStorage || people.length === 0) return;
    const stored = localStorage.getItem(ACTIVE_PERSON_KEY);
    if (stored && people.find((p) => p.id === stored)) {
      setActivePersonId(stored);
    }
    setRestoredFromStorage(true);
  }, [people, restoredFromStorage]);

  // Initial fetch
  useEffect(() => {
    fetch("/api/claims")
      .then((r) => r.json())
      .then((d) => {
        setClaims(d.claims || {});
        if (d.people) setPeople(d.people);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Poll every 4s so people see each other's claims
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/claims")
        .then((r) => r.json())
        .then((d) => {
          setClaims(d.claims || {});
          if (d.people) setPeople(d.people);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleClaim = useCallback(
    async (itemId: string) => {
      if (!activePersonId) return;
      const currentClaimants = claims[itemId] || [];
      const isMine = currentClaimants.includes(activePersonId);
      const action = isMine ? "unclaim" : "claim";

      // Optimistic
      const optimistic = { ...claims };
      if (action === "claim") {
        optimistic[itemId] = [...currentClaimants, activePersonId];
      } else {
        const next = currentClaimants.filter((p) => p !== activePersonId);
        if (next.length === 0) delete optimistic[itemId];
        else optimistic[itemId] = next;
      }
      setClaims(optimistic);

      setPending((s) => new Set(s).add(itemId));
      try {
        const res = await fetch("/api/claims", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, personId: activePersonId, action }),
        });
        const data = await res.json();
        if (data.claims) setClaims(data.claims);
      } catch {
        // revert on error
        setClaims(claims);
      } finally {
        setPending((s) => {
          const next = new Set(s);
          next.delete(itemId);
          return next;
        });
      }
    },
    [activePersonId, claims]
  );

  const bulkAssign = useCallback(
    async (itemId: string, personIds: string[]) => {
      // Optimistic
      const optimistic = { ...claims };
      if (personIds.length === 0) delete optimistic[itemId];
      else optimistic[itemId] = personIds;
      setClaims(optimistic);

      setPending((s) => new Set(s).add(itemId));
      try {
        const res = await fetch("/api/claims", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId, personIds }),
        });
        const data = await res.json();
        if (data.claims) setClaims(data.claims);
      } catch {
        setClaims(claims);
      } finally {
        setPending((s) => {
          const next = new Set(s);
          next.delete(itemId);
          return next;
        });
      }
    },
    [claims]
  );

  const selectPerson = (id: string) => {
    setActivePersonId(id);
    localStorage.setItem(ACTIVE_PERSON_KEY, id);
  };

  const clearPerson = () => {
    setActivePersonId(null);
    localStorage.removeItem(ACTIVE_PERSON_KEY);
  };

  const handleAddPerson = async (name: string) => {
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.people) setPeople(data.people);
    // Auto-select the newly added person
    if (data.people && !data.error) {
      const newPerson = data.people.find(
        (p: Person) => p.name.toLowerCase() === name.trim().toLowerCase()
      );
      if (newPerson) selectPerson(newPerson.id);
    }
  };

  const totals = useMemo(() => computeTotals(claims, people), [claims, people]);
  const myTotal = useMemo(
    () => totals.people.find((p) => p.id === activePersonId),
    [totals, activePersonId]
  );

  const percentClaimed =
    RECEIPT.subtotal > 0
      ? Math.min(100, (totals.claimedSubtotal / RECEIPT.subtotal) * 100)
      : 0;

  // Group items by category for the list
  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = {};
    for (const item of ITEMS) {
      if (!g[item.category]) g[item.category] = [];
      g[item.category].push(item);
    }
    return g;
  }, []);

  const categoryOrder: Item["category"][] = [
    "cocktail",
    "wine",
    "beer",
    "spirit",
    "food",
  ];

  // Group identical items for display (e.g. 12 Pilz -> one header, 12 rows)
  const groupIdentical = (items: Item[]) => {
    const groups: { name: string; price: number; items: Item[] }[] = [];
    for (const item of items) {
      const last = groups[groups.length - 1];
      if (last && last.name === item.name && last.price === item.price) {
        last.items.push(item);
      } else {
        groups.push({ name: item.name, price: item.price, items: [item] });
      }
    }
    return groups;
  };

  if (!activePersonId) {
    return (
      <NamePicker
        people={people}
        claims={claims}
        loaded={loaded}
        onSelect={selectPerson}
        onAddPerson={handleAddPerson}
      />
    );
  }

  const activePerson = people.find((p) => p.id === activePersonId);
  if (!activePerson) {
    return (
      <NamePicker
        people={people}
        claims={claims}
        loaded={loaded}
        onSelect={selectPerson}
        onAddPerson={handleAddPerson}
      />
    );
  }

  // Venmo deep link
  const venmoAmount = myTotal ? myTotal.total.toFixed(2) : "0.00";
  const venmoNote = encodeURIComponent(
    `Roebling Sporting Club — Apr 4 (${activePerson.name})`
  );
  const venmoUrl = `https://venmo.com/${PAYER.venmoHandle}?txn=pay&amount=${venmoAmount}&note=${venmoNote}`;
  const isPayer = activePersonId === PAYER.id;

  return (
    <main className="min-h-screen pb-48">
      {/* ---------- Header ---------- */}
      <header className="relative mx-auto max-w-2xl px-5 pt-10 sm:pt-16">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-glow/80">
              ◆ The Tab ◆
            </div>
            <h1 className="font-display text-[44px] sm:text-[56px] leading-[0.95] font-light text-paper mt-2 tracking-tight">
              Roebling
              <br />
              <em className="italic font-normal text-amber-glow">
                Sporting Club
              </em>
            </h1>
            <div className="mt-3 font-mono text-[11px] uppercase tracking-widest text-paper/50">
              {RECEIPT.date} · Check {RECEIPT.check}
            </div>
          </div>

          {/* Active person badge */}
          <button
            onClick={clearPerson}
            className="group shrink-0 rounded-full border border-paper/15 bg-ink-800/60 backdrop-blur px-4 py-2 text-left transition hover:border-amber-glow/40"
          >
            <div className="font-mono text-[9px] uppercase tracking-widest text-paper/40">
              You are
            </div>
            <div className="font-display text-lg text-paper leading-none mt-0.5">
              {activePerson.name}
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-paper/30 mt-1 group-hover:text-amber-glow/80 transition">
              tap to switch
            </div>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-10">
          <div className="flex items-end justify-between mb-2">
            <div className="font-mono text-[10px] uppercase tracking-widest text-paper/50">
              Tab claimed
            </div>
            <div className="font-mono text-[11px] text-paper/80">
              {formatUSD(totals.claimedSubtotal)}
              <span className="text-paper/30"> / {formatUSD(RECEIPT.subtotal)}</span>
            </div>
          </div>
          <div className="relative h-[3px] bg-paper/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-deep via-amber-glow to-amber-glow rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percentClaimed}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
      </header>

      {/* ---------- Items ---------- */}
      <section className="relative mx-auto max-w-2xl px-5 mt-12">
        {categoryOrder.map((cat) => {
          const catItems = grouped[cat];
          if (!catItems || catItems.length === 0) return null;
          const groups = groupIdentical(catItems);
          return (
            <div key={cat} className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-amber-glow text-sm">
                  {CATEGORY_GLYPH[cat]}
                </span>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/50">
                  {CATEGORY_LABEL[cat]}
                </div>
                <div className="flex-1 h-px bg-paper/10" />
              </div>

              <ul className="space-y-1.5">
                {groups.map((group, gi) => (
                  <div key={gi}>
                    {group.items.length > 1 && (
                      <div className="font-display italic text-paper/40 text-xs pl-1 pb-1">
                        {group.items.length}× {group.name} ·{" "}
                        {formatUSD(group.price)} ea
                      </div>
                    )}
                    {group.items.map((item, ii) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        claimants={claims[item.id] || []}
                        activePersonId={activePersonId}
                        pending={pending.has(item.id)}
                        onToggle={() => toggleClaim(item.id)}
                        compactLabel={
                          group.items.length > 1 ? `#${ii + 1}` : item.name
                        }
                        showFullName={group.items.length === 1}
                        people={people}
                        expanded={expandedItem === item.id}
                        onExpand={() =>
                          setExpandedItem(
                            expandedItem === item.id ? null : item.id
                          )
                        }
                        onBulkAssign={(personIds) =>
                          bulkAssign(item.id, personIds)
                        }
                      />
                    ))}
                  </div>
                ))}
              </ul>
            </div>
          );
        })}

        {/* Receipt totals breakdown */}
        <div className="mt-16 border-t border-dashed border-paper/15 pt-8">
          <div className="font-mono text-[10px] uppercase tracking-widest text-paper/40 mb-4">
            ◆ Receipt ◆
          </div>
          <ReceiptRow label="Subtotal" value={RECEIPT.subtotal} />
          <ReceiptRow label="Tax" value={RECEIPT.tax} />
          <ReceiptRow label="Tip (20%)" value={RECEIPT.tip} />
          <ReceiptRow label="CC Surcharge (3%)" value={RECEIPT.ccSurcharge} />
          <div className="h-px bg-paper/15 my-3" />
          <ReceiptRow label="Total" value={RECEIPT.total} bold />
        </div>
      </section>

      {/* ---------- Sticky bottom bar ---------- */}
      <AnimatePresence>
        {loaded && myTotal && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="fixed inset-x-0 bottom-0 z-50"
          >
            <div className="mx-auto max-w-2xl px-3 pb-3 sm:pb-5">
              <div className="torn-top h-3 bg-paper" />
              <div className="bg-paper text-ink rounded-b-2xl shadow-card">
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-ink/50">
                        {activePerson.name}'s tab
                      </div>
                      <div className="font-display text-[38px] leading-none font-semibold text-ink mt-1">
                        {formatUSD(myTotal.total)}
                      </div>
                      <div className="font-mono text-[10px] text-ink/50 mt-1.5">
                        {formatUSD(myTotal.itemsSubtotal)} items ·{" "}
                        {formatUSD(myTotal.tax + myTotal.tip + myTotal.cc)} tax/tip/fees
                      </div>
                    </div>
                    {!isPayer ? (
                      <a
                        href={venmoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group relative shrink-0 inline-flex items-center gap-2 bg-ink text-paper px-5 py-4 rounded-xl font-body font-semibold text-sm tracking-tight shadow-lg transition hover:bg-ink-700 active:scale-[0.98]"
                      >
                        <span>Venmo</span>
                        <span className="font-display italic text-amber-glow">
                          Sanjit
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          fill="none"
                          className="transition group-hover:translate-x-0.5"
                        >
                          <path
                            d="M3 11L11 3M11 3H5M11 3V9"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    ) : (
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-ink/50">
                          You paid
                        </div>
                        <div className="font-display italic text-amber-deep text-sm mt-0.5">
                          the house
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ================= Name Picker =================

function NamePicker({
  people,
  claims,
  loaded,
  onSelect,
  onAddPerson,
}: {
  people: Person[];
  claims: ClaimsState;
  loaded: boolean;
  onSelect: (id: string) => void;
  onAddPerson: (name: string) => Promise<void>;
}) {
  const [showInput, setShowInput] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);

  const totals = useMemo(() => computeTotals(claims, people), [claims, people]);
  const percentClaimed =
    RECEIPT.subtotal > 0
      ? Math.min(100, (totals.claimedSubtotal / RECEIPT.subtotal) * 100)
      : 0;

  const handleAdd = async () => {
    if (!newName.trim() || adding) return;
    setAdding(true);
    try {
      await onAddPerson(newName.trim());
    } finally {
      setAdding(false);
      setNewName("");
      setShowInput(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber-glow/80 mb-3">
            ◆ The Tab ◆
          </div>
          <h1 className="font-display text-5xl leading-[0.95] font-light text-paper">
            Roebling
            <br />
            <em className="italic font-normal text-amber-glow">
              Sporting Club
            </em>
          </h1>
          <div className="font-mono text-[10px] uppercase tracking-widest text-paper/40 mt-4">
            Friday · Apr 4 · Check #102
          </div>
        </div>

        {/* Unclaimed tab summary */}
        {loaded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mb-8 rounded-xl border border-paper/10 bg-ink-800/40 backdrop-blur px-5 py-4"
          >
            <div className="flex items-end justify-between mb-2.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-paper/50">
                Tab status
              </div>
              <div className="font-mono text-[11px] text-paper/60">
                {Math.round(percentClaimed)}% claimed
              </div>
            </div>
            <div className="relative h-[3px] bg-paper/10 rounded-full overflow-hidden mb-4">
              <motion.div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-deep via-amber-glow to-amber-glow rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${percentClaimed}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <div className="flex justify-between">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-paper/40">
                  Claimed
                </div>
                <div className="font-mono text-sm text-paper/70 mt-0.5">
                  {formatUSD(totals.claimedSubtotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-widest text-amber-glow/70">
                  Unclaimed
                </div>
                <div className="font-mono text-sm text-amber-glow mt-0.5">
                  {formatUSD(totals.unclaimedSubtotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[9px] uppercase tracking-widest text-paper/40">
                  Total
                </div>
                <div className="font-mono text-sm text-paper/70 mt-0.5">
                  {formatUSD(RECEIPT.total)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mb-5 text-center">
          <div className="font-display text-lg italic text-paper/70">
            who are you?
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {people.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.4 }}
              onClick={() => onSelect(p.id)}
              className="group relative rounded-xl border border-paper/15 bg-ink-800/60 backdrop-blur px-4 py-5 text-left transition hover:border-amber-glow/50 hover:bg-ink-700/60"
            >
              <div className="font-mono text-[9px] uppercase tracking-widest text-paper/30 group-hover:text-amber-glow/70 transition">
                {(i + 1).toString().padStart(2, "0")}
              </div>
              <div className="font-display text-2xl text-paper mt-0.5">
                {p.name}
              </div>
            </motion.button>
          ))}

          {/* Add person tile */}
          {!showInput ? (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + people.length * 0.05, duration: 0.4 }}
              onClick={() => setShowInput(true)}
              className="group relative rounded-xl border border-dashed border-paper/20 bg-ink-800/30 backdrop-blur px-4 py-5 text-left transition hover:border-amber-glow/50 hover:bg-ink-700/40"
            >
              <div className="font-mono text-[9px] uppercase tracking-widest text-paper/30 group-hover:text-amber-glow/70 transition">
                +
              </div>
              <div className="font-display text-xl text-paper/50 mt-0.5 group-hover:text-paper/80 transition">
                Add yourself
              </div>
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-amber-glow/40 bg-ink-800/60 backdrop-blur px-4 py-4"
            >
              <input
                autoFocus
                type="text"
                placeholder="Your name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setShowInput(false);
                    setNewName("");
                  }
                }}
                className="w-full bg-transparent border-b border-paper/20 pb-2 font-display text-xl text-paper placeholder:text-paper/30 outline-none focus:border-amber-glow/60"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAdd}
                  disabled={!newName.trim() || adding}
                  className="flex-1 rounded-lg bg-amber-glow/90 text-ink font-mono text-[11px] uppercase tracking-wider py-2 transition hover:bg-amber-glow disabled:opacity-40"
                >
                  {adding ? "..." : "Join"}
                </button>
                <button
                  onClick={() => {
                    setShowInput(false);
                    setNewName("");
                  }}
                  className="rounded-lg border border-paper/15 text-paper/50 font-mono text-[11px] uppercase tracking-wider px-3 py-2 transition hover:border-paper/30"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <div className="text-center mt-8 font-mono text-[10px] text-paper/30 uppercase tracking-widest">
          your pick saves locally · you can switch later
        </div>
      </motion.div>
    </main>
  );
}

// ================= Item Row =================

function ItemRow({
  item,
  claimants,
  activePersonId,
  pending,
  onToggle,
  compactLabel,
  showFullName,
  people,
  expanded,
  onExpand,
  onBulkAssign,
}: {
  item: Item;
  claimants: string[];
  activePersonId: string;
  pending: boolean;
  onToggle: () => void;
  compactLabel: string;
  showFullName: boolean;
  people: Person[];
  expanded: boolean;
  onExpand: () => void;
  onBulkAssign: (personIds: string[]) => void;
}) {
  const isMine = claimants.includes(activePersonId);
  const isShared = claimants.length > 1;
  const isUnclaimed = claimants.length === 0;
  const myShare = claimants.length > 0 ? item.price / claimants.length : 0;

  const claimantNames = claimants
    .map((id) => people.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  const togglePerson = (personId: string) => {
    const current = new Set(claimants);
    if (current.has(personId)) current.delete(personId);
    else current.add(personId);
    onBulkAssign(Array.from(current));
  };

  return (
    <motion.li
      layout
      initial={false}
      animate={{
        backgroundColor: isMine
          ? "rgba(244,166,74,0.08)"
          : "rgba(255,255,255,0)",
      }}
      transition={{ duration: 0.25 }}
      className="relative"
    >
      <div
        className={`rounded-lg transition ${
          isMine
            ? "border border-amber-glow/40"
            : expanded
            ? "border border-paper/20"
            : "border border-transparent hover:border-paper/10"
        }`}
      >
        <div className="flex items-center gap-4 py-3 px-3">
          {/* Checkbox — tap to toggle yourself */}
          <button
            onClick={onToggle}
            className="shrink-0"
          >
            <div
              className={`w-5 h-5 rounded border-[1.5px] flex items-center justify-center transition ${
                isMine
                  ? "bg-amber-glow border-amber-glow"
                  : "border-paper/25 hover:border-paper/40"
              } ${pending ? "animate-pulse" : ""}`}
            >
              {isMine && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6L5 8.5L9.5 3.5"
                    stroke="#0B0F1A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </button>

          {/* Label — tap to expand people picker */}
          <button
            onClick={onExpand}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-baseline gap-2">
              <span
                className={`font-body text-[15px] truncate ${
                  isMine ? "text-paper" : "text-paper/85"
                }`}
              >
                {showFullName ? item.name : compactLabel}
              </span>
            </div>
            {claimantNames.length > 0 && (
              <div className="font-mono text-[10px] text-paper/40 mt-0.5 truncate">
                {isShared ? (
                  <>
                    <span className="text-amber-glow/70">shared</span> ·{" "}
                    {claimantNames.join(", ")}
                  </>
                ) : (
                  claimantNames[0]
                )}
              </div>
            )}
          </button>

          {/* Price */}
          <div className="shrink-0 text-right">
            <div
              className={`font-mono text-sm ${
                isMine ? "text-amber-glow" : "text-paper/60"
              }`}
            >
              {formatUSD(item.price)}
            </div>
            {isMine && isShared && (
              <div className="font-mono text-[10px] text-amber-glow/60 mt-0.5">
                you: {formatUSD(myShare)}
              </div>
            )}
            {isUnclaimed && (
              <div className="font-mono text-[9px] text-paper/25 mt-0.5 uppercase tracking-wider">
                open
              </div>
            )}
          </div>

          {/* Expand arrow */}
          <button
            onClick={onExpand}
            className="shrink-0 w-6 h-6 flex items-center justify-center text-paper/30 hover:text-paper/60 transition"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Expanded people picker */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 pt-1 border-t border-paper/10 mx-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-paper/40 mb-2">
                  Who had this?
                  {claimants.length > 0 && (
                    <span className="text-amber-glow/60 ml-2">
                      {formatUSD(item.price / claimants.length)}/person
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => {
                    const isSelected = claimants.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePerson(p.id)}
                        className={`rounded-full px-3 py-1.5 font-mono text-[11px] transition ${
                          isSelected
                            ? "bg-amber-glow/90 text-ink font-medium"
                            : "bg-paper/8 text-paper/50 hover:bg-paper/15 hover:text-paper/70"
                        }`}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

// ================= Receipt row =================

function ReceiptRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-1 ${
        bold ? "font-display text-lg" : "font-body text-sm"
      }`}
    >
      <span className={bold ? "text-paper" : "text-paper/60"}>{label}</span>
      <span
        className={`font-mono ${
          bold ? "text-amber-glow text-lg" : "text-paper/70"
        }`}
      >
        {formatUSD(value)}
      </span>
    </div>
  );
}
