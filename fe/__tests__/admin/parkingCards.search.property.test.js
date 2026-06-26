/**
 * Property-based test for the card pool search filter.
 *
 * Feature: card-pool-management, Property 2: Card pool search returns exactly
 * the matching cards.
 * **Validates: Requirements 1.4**
 *
 * Property 2: For any list of Pool_Card records and any query string,
 * `filterCards(cards, query)` returns exactly the subset of cards whose
 * `card_uid` or `lot_name` contains the query (case-insensitive) — nothing
 * added, nothing dropped — preserving the relative order of the input list.
 * An empty/whitespace-only query returns the full list unchanged.
 *
 * NOTE: `fast-check` is not a dependency of the `fe/` package (and the repo's
 * conventions forbid adding new deps without need), so this test mirrors the
 * existing `cardUid.property.test.js` style: a small deterministic seeded PRNG
 * with hand-rolled generators and an independent oracle. The oracle performs
 * substring matching with a hand-rolled scan (not `String.includes`) so it does
 * not merely re-implement the function under test. Each property runs well over
 * the 100-iteration minimum and reports its seed on failure for reproducibility.
 */

import { filterCards } from "@/app/components/admin/hooks/useParkingCards";

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — reproducible property runs.
// ---------------------------------------------------------------------------
function makeRng(seed) {
    let a = seed >>> 0;
    return function next() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Independent oracle — mirrors the spec (Req 1.4), not the implementation.
//
// `containsCI` is a hand-rolled case-insensitive substring scan so the oracle
// does not lean on `String.includes` like `filterCards` does.
// ---------------------------------------------------------------------------
function containsCI(haystack, needle) {
    const h = String(haystack || "").toLowerCase();
    const n = String(needle || "").toLowerCase();
    if (n.length === 0) return true;
    for (let i = 0; i + n.length <= h.length; i++) {
        let match = true;
        for (let j = 0; j < n.length; j++) {
            if (h[i + j] !== n[j]) {
                match = false;
                break;
            }
        }
        if (match) return true;
    }
    return false;
}

function matchesQuery(card, query) {
    return containsCI(card.card_uid, query) || containsCI(card.lot_name, query);
}

function oracle(cards, query) {
    // The implementation only trims to decide the empty-query short-circuit;
    // the needle itself is the raw (untrimmed) query. Mirror that exactly.
    if (!query || !query.trim()) {
        return cards.slice();
    }
    return cards.filter((card) => matchesQuery(card, query));
}

// ---------------------------------------------------------------------------
// Reference-equality helpers. `filterCards` returns the same object references
// as the input (Array.prototype.filter), so structural invariants can be
// checked by identity.
// ---------------------------------------------------------------------------
function sameRefSequence(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function isSubsequenceByRef(result, input) {
    let i = 0;
    for (let j = 0; j < input.length && i < result.length; j++) {
        if (result[i] === input[j]) i++;
    }
    return i === result.length;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
const UID_CHARS = "ABCDEFabcdef0123456789-".split("");
const TOKENS = ["POOL", "CARD", "Lot", "Main", "north", "VIP", "A", "B", "001", "002"];
const WHITESPACE_CHARS = [" ", "\t", "\n", "\r", "\f", "\v"];

function recase(rng, s) {
    let out = "";
    for (const ch of s) {
        out += rng() < 0.5 ? ch.toLowerCase() : ch.toUpperCase();
    }
    return out;
}

function genCardUid(rng) {
    // Sometimes seed with a known token to make substring queries land.
    let s = rng() < 0.6 ? pick(rng, TOKENS) + "-" : "";
    const extra = randInt(rng, 1, 8);
    for (let i = 0; i < extra; i++) s += pick(rng, UID_CHARS);
    return recase(rng, s);
}

function genLotName(rng) {
    if (rng() < 0.3) return null; // Shared_Card has lot_name null
    const tokenCount = randInt(rng, 1, 2);
    const parts = [];
    for (let i = 0; i < tokenCount; i++) parts.push(pick(rng, TOKENS));
    return parts.join(" ");
}

function genCards(rng) {
    const len = randInt(rng, 0, 12);
    const cards = [];
    for (let i = 0; i < len; i++) {
        cards.push({ card_uid: genCardUid(rng), lot_name: genLotName(rng) });
    }
    return cards;
}

function randomSubstring(rng, s) {
    if (!s || s.length === 0) return "";
    const start = randInt(rng, 0, s.length - 1);
    const end = randInt(rng, start, s.length - 1);
    return s.slice(start, end + 1);
}

function genQuery(rng, cards) {
    const mode = randInt(rng, 0, 5);
    switch (mode) {
        case 0:
            return ""; // empty
        case 1: {
            // whitespace-only
            let s = "";
            const len = randInt(rng, 1, 4);
            for (let i = 0; i < len; i++) s += pick(rng, WHITESPACE_CHARS);
            return s;
        }
        case 2: {
            // arbitrary short string (mixed charset, may or may not match)
            let s = "";
            const len = randInt(rng, 1, 5);
            const charset = UID_CHARS.concat([" ", "z", "Z", "x"]);
            for (let i = 0; i < len; i++) s += pick(rng, charset);
            return s;
        }
        case 3: {
            // substring of a card's uid, re-cased (forces a case-insensitive hit)
            if (cards.length === 0) return "POOL";
            const card = pick(rng, cards);
            const sub = randomSubstring(rng, card.card_uid) || "POOL";
            return recase(rng, sub);
        }
        case 4: {
            // substring of a card's lot_name, re-cased
            const withLot = cards.filter((c) => c.lot_name);
            if (withLot.length === 0) return pick(rng, TOKENS);
            const card = pick(rng, withLot);
            const sub = randomSubstring(rng, card.lot_name) || "Lot";
            return recase(rng, sub);
        }
        default:
            return pick(rng, TOKENS); // a known token
    }
}

function genCardsAndQuery(rng) {
    const cards = genCards(rng);
    const query = genQuery(rng, cards);
    return { cards, query };
}

function genCardsAndBlankQuery(rng) {
    const cards = genCards(rng);
    const mode = randInt(rng, 0, 1);
    if (mode === 0) return { cards, query: "" };
    let q = "";
    const len = randInt(rng, 1, 5);
    for (let i = 0; i < len; i++) q += pick(rng, WHITESPACE_CHARS);
    return { cards, query: q };
}

// ---------------------------------------------------------------------------
// Property runner — returns the first counterexample (with its seed) or null.
// ---------------------------------------------------------------------------
function findCounterexample(runs, seedBase, gen, predicate) {
    for (let i = 0; i < runs; i++) {
        const seed = seedBase + i;
        const value = gen(makeRng(seed));
        if (!predicate(value)) {
            return { value, seed, run: i };
        }
    }
    return null;
}

function assertNoCounterexample(result) {
    if (result) {
        throw new Error(
            `Counterexample found (seed=${result.seed}, run=${result.run}): ${JSON.stringify(
                result.value
            )}`
        );
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Feature: card-pool-management, Property 2: Card pool search returns exactly the matching cards", () => {
    it("matches the independent oracle for arbitrary card lists and queries", () => {
        const result = findCounterexample(300, 10000, genCardsAndQuery, ({ cards, query }) =>
            sameRefSequence(filterCards(cards, query), oracle(cards, query))
        );
        assertNoCounterexample(result);
    });

    it("includes exactly the cards whose uid or lot_name contains the query (none added, none dropped)", () => {
        const result = findCounterexample(300, 20000, genCardsAndQuery, ({ cards, query }) => {
            const out = filterCards(cards, query);
            const isBlank = !query || !query.trim();
            return cards.every((card) => {
                const included = out.includes(card);
                const expected = isBlank ? true : matchesQuery(card, query);
                return included === expected;
            });
        });
        assertNoCounterexample(result);
    });

    it("always returns a subset of the input preserving the original order", () => {
        const result = findCounterexample(300, 30000, genCardsAndQuery, ({ cards, query }) =>
            isSubsequenceByRef(filterCards(cards, query), cards)
        );
        assertNoCounterexample(result);
    });

    it("returns the full list unchanged for empty or whitespace-only queries", () => {
        const result = findCounterexample(200, 40000, genCardsAndBlankQuery, ({ cards, query }) =>
            sameRefSequence(filterCards(cards, query), cards)
        );
        assertNoCounterexample(result);
    });

    it("is case-insensitive: re-casing a matching query yields the same membership", () => {
        const result = findCounterexample(200, 50000, genCardsAndQuery, ({ cards, query }) => {
            if (!query || !query.trim()) return true; // covered elsewhere
            const lower = filterCards(cards, query.toLowerCase());
            const upper = filterCards(cards, query.toUpperCase());
            return sameRefSequence(lower, upper);
        });
        assertNoCounterexample(result);
    });

    // Example-based checks complementing the property runs.
    it("handles representative examples", () => {
        const cards = [
            { card_uid: "POOL-001", lot_name: "Lot A" },
            { card_uid: "POOL-002", lot_name: "Lot B" },
            { card_uid: "SHARED-9", lot_name: null },
        ];

        // Empty / whitespace → full list.
        expect(filterCards(cards, "")).toEqual(cards);
        expect(filterCards(cards, "   ")).toEqual(cards);

        // Case-insensitive uid match.
        expect(filterCards(cards, "pool")).toEqual([cards[0], cards[1]]);

        // lot_name match.
        expect(filterCards(cards, "Lot A")).toEqual([cards[0]]);

        // Shared card (null lot_name) still matched by uid.
        expect(filterCards(cards, "shared")).toEqual([cards[2]]);

        // No match → empty result.
        expect(filterCards(cards, "zzz")).toEqual([]);

        // Order is preserved.
        expect(filterCards(cards, "POOL")).toEqual([cards[0], cards[1]]);
    });
});
