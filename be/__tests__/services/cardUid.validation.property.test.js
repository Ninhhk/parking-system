const fc = require("fast-check");
const { isValidCardUid } = require("../../utils/cardUid");

// Feature: card-pool-management, Property 3: Card UID validation accepts exactly the well-formed UIDs
// Validates: Requirements 2.3
//
// Property 3: For any input string, isValidCardUid(s) returns true iff s matches
// ^[A-Za-z0-9-]{1,100}$. Every non-matching string (empty, whitespace-only,
// out-of-charset, or longer than 100 chars) is rejected.

// Independent oracle that mirrors the spec, not the implementation.
const CARD_UID_REGEX = /^[A-Za-z0-9-]{1,100}$/;
const oracle = (s) => typeof s === "string" && CARD_UID_REGEX.test(s);

const VALID_CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-".split("");
// Characters guaranteed NOT in [A-Za-z0-9-].
const INVALID_CHARS = " _.!@#$%^&*()+=[]{}|\\;:'\",<>/?`~\t\n\r"
    .split("")
    .concat(["é", "ñ", "空", "🚗"]);
const WHITESPACE_CHARS = [" ", "\t", "\n", "\r", "\f", "\v"];

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------
// Well-formed UID: 1-100 chars drawn exclusively from [A-Za-z0-9-].
const validUidArb = fc
    .array(fc.constantFrom(...VALID_CHARS), { minLength: 1, maxLength: 100 })
    .map((arr) => arr.join(""));

// Whitespace-only strings (never match the charset).
const whitespaceOnlyArb = fc
    .array(fc.constantFrom(...WHITESPACE_CHARS), { minLength: 1, maxLength: 20 })
    .map((arr) => arr.join(""));

// Strings containing at least one out-of-charset character.
const outOfCharsetArb = fc
    .tuple(
        fc.array(fc.constantFrom(...VALID_CHARS), { minLength: 0, maxLength: 50 }),
        fc.constantFrom(...INVALID_CHARS),
        fc.array(fc.constantFrom(...VALID_CHARS), { minLength: 0, maxLength: 50 })
    )
    .map(([pre, bad, post]) => pre.join("") + bad + post.join(""));

// Over-length strings: 101-300 valid characters.
const overLengthArb = fc
    .array(fc.constantFrom(...VALID_CHARS), { minLength: 101, maxLength: 300 })
    .map((arr) => arr.join(""));

// Arbitrary strings spanning the full input space.
const anyStringArb = fc.string({ minLength: 0, maxLength: 130 });

describe("Feature: card-pool-management, Property 3: Card UID validation accepts exactly the well-formed UIDs", () => {
    it("accepts any 1-100 char string drawn exclusively from [A-Za-z0-9-]", () => {
        fc.assert(
            fc.property(validUidArb, (s) => isValidCardUid(s) === true),
            { numRuns: 100 }
        );
    });

    it("rejects the empty string", () => {
        expect(isValidCardUid("")).toBe(false);
    });

    it("rejects whitespace-only strings", () => {
        fc.assert(
            fc.property(whitespaceOnlyArb, (s) => isValidCardUid(s) === false),
            { numRuns: 100 }
        );
    });

    it("rejects strings containing an out-of-charset character", () => {
        fc.assert(
            fc.property(outOfCharsetArb, (s) => isValidCardUid(s) === false),
            { numRuns: 100 }
        );
    });

    it("rejects strings longer than 100 characters", () => {
        fc.assert(
            fc.property(overLengthArb, (s) => isValidCardUid(s) === false),
            { numRuns: 100 }
        );
    });

    it("matches the spec oracle for arbitrary input strings (true iff well-formed)", () => {
        fc.assert(
            fc.property(anyStringArb, (s) => isValidCardUid(s) === oracle(s)),
            { numRuns: 100 }
        );
    });
});
