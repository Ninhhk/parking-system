/**
 * Property-based test for card UID validation.
 *
 * Feature: unified-checkin-kiosk, Property 1: Card UID validation
 * **Validates: Requirements 2.2, 2.3**
 *
 * Property 1: For any string, `isValidCardUid` returns true iff the string is
 * 1–100 characters composed exclusively of [A-Za-z0-9-]. Empty, whitespace-only,
 * over-100-char, or out-of-charset strings return false.
 *
 * NOTE: `fast-check` is not a dependency of the `fe/` package (and the repo's
 * conventions forbid adding new deps without need), so this test uses a small,
 * deterministic, seeded PRNG with hand-rolled generators. Each property runs
 * well over the 100-iteration minimum. Seeds are reported on failure so any
 * counterexample is reproducible.
 */

import { isValidCardUid } from "@/app/employee/checkin/components/ReaderPanel";

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
// Charsets
// ---------------------------------------------------------------------------
const VALID_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-".split("");

// Characters guaranteed NOT in [A-Za-z0-9-].
const INVALID_CHARS = " _.!@#$%^&*()+=[]{}|\\;:'\",<>/?`~\t\n\r"
    .split("")
    .concat(["é", "ñ", "空", "🚗"]);

const WHITESPACE_CHARS = [" ", "\t", "\n", "\r", "\f", "\v"];

const MIXED_CHARS = VALID_CHARS.concat(INVALID_CHARS);

// Independent oracle that mirrors the spec (Property 1), not the implementation.
const CARD_UID_REGEX = /^[A-Za-z0-9-]{1,100}$/;
const oracle = (value) =>
    typeof value === "string" && !!value && !!value.trim() && CARD_UID_REGEX.test(value);

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
// Generators
// ---------------------------------------------------------------------------
function genValidUid(rng) {
    const len = randInt(rng, 1, 100);
    let s = "";
    for (let i = 0; i < len; i++) s += pick(rng, VALID_CHARS);
    return s;
}

function genOutOfCharset(rng) {
    const len = randInt(rng, 1, 100);
    const chars = [];
    for (let i = 0; i < len; i++) chars.push(pick(rng, VALID_CHARS));
    // Force at least one out-of-charset character.
    const numInvalid = randInt(rng, 1, len);
    for (let k = 0; k < numInvalid; k++) {
        chars[randInt(rng, 0, len - 1)] = pick(rng, INVALID_CHARS);
    }
    return chars.join("");
}

function genWhitespaceOnly(rng) {
    const len = randInt(rng, 1, 20);
    let s = "";
    for (let i = 0; i < len; i++) s += pick(rng, WHITESPACE_CHARS);
    return s;
}

function genOverLength(rng) {
    const len = randInt(rng, 101, 300);
    let s = "";
    for (let i = 0; i < len; i++) s += pick(rng, VALID_CHARS);
    return s;
}

function genMixed(rng) {
    const len = randInt(rng, 0, 130);
    let s = "";
    for (let i = 0; i < len; i++) s += pick(rng, MIXED_CHARS);
    return s;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("Feature: unified-checkin-kiosk, Property 1: Card UID validation", () => {
    it("accepts any 1–100 char string drawn exclusively from [A-Za-z0-9-]", () => {
        const result = findCounterexample(
            200,
            1000,
            genValidUid,
            (v) => isValidCardUid(v) === true
        );
        assertNoCounterexample(result);
    });

    it("rejects any string containing an out-of-charset character", () => {
        const result = findCounterexample(
            200,
            2000,
            genOutOfCharset,
            (v) => isValidCardUid(v) === false
        );
        assertNoCounterexample(result);
    });

    it("rejects empty and whitespace-only strings", () => {
        expect(isValidCardUid("")).toBe(false);
        const result = findCounterexample(
            150,
            3000,
            genWhitespaceOnly,
            (v) => isValidCardUid(v) === false
        );
        assertNoCounterexample(result);
    });

    it("rejects strings longer than 100 valid characters", () => {
        const result = findCounterexample(
            150,
            4000,
            genOverLength,
            (v) => isValidCardUid(v) === false
        );
        assertNoCounterexample(result);
    });

    it("matches the spec oracle for arbitrary mixed strings (true iff valid)", () => {
        const result = findCounterexample(
            300,
            5000,
            genMixed,
            (v) => isValidCardUid(v) === oracle(v)
        );
        assertNoCounterexample(result);
    });

    // Example-based boundary checks complementing the property runs.
    it("handles boundary lengths and representative examples", () => {
        expect(isValidCardUid("-")).toBe(true);
        expect(isValidCardUid("CARD-0000")).toBe(true);
        expect(isValidCardUid("a".repeat(100))).toBe(true);
        expect(isValidCardUid("a".repeat(101))).toBe(false);
        expect(isValidCardUid("has space")).toBe(false);
        expect(isValidCardUid("under_score")).toBe(false);
    });
});
