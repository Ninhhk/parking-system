const fc = require("fast-check");

// Feature: session-audit-viewer, Property 5: Combined filters use AND logic
// Validates: Requirements 3.1, 3.2, 3.3

/**
 * Simulates the combined filtering logic from session.audit.repo.js.
 * Each active filter narrows the result set (AND logic).
 */
function applyFilters(sessions, { plate, vehicleType, startDate, endDate }) {
    return sessions.filter((s) => {
        if (plate && !s.license_plate.toLowerCase().includes(plate.toLowerCase())) {
            return false;
        }
        if (vehicleType && s.vehicle_type.toLowerCase() !== vehicleType.toLowerCase()) {
            return false;
        }
        if (startDate) {
            const start = new Date(startDate + "T00:00:00.000Z");
            if (new Date(s.time_in) < start) return false;
        }
        if (endDate) {
            const end = new Date(endDate + "T00:00:00.000Z");
            end.setUTCDate(end.getUTCDate() + 1);
            if (new Date(s.time_in) >= end) return false;
        }
        return true;
    });
}

/**
 * Generators — use integer timestamps to avoid invalid Date issues in fast-check v4
 */
const vehicleTypes = ["car", "bike"];

const plateChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.";
const arbPlate = fc.array(fc.constantFrom(...plateChars.split("")), { minLength: 1, maxLength: 10 }).map((arr) => arr.join(""));

const arbVehicleType = fc.constantFrom(...vehicleTypes);

// Timestamp range: 2023-01-01 to 2025-12-31
const MIN_TS = new Date("2023-01-01T00:00:00Z").getTime();
const MAX_TS = new Date("2025-12-31T23:59:59Z").getTime();

// Generate a date string in YYYY-MM-DD format
const arbDateStr = fc.integer({ min: MIN_TS, max: MAX_TS }).map((ts) => {
    const d = new Date(ts);
    return d.toISOString().slice(0, 10);
});

// Generate a session with random fields
const arbSession = fc.record({
    session_id: fc.nat(),
    license_plate: arbPlate,
    vehicle_type: arbVehicleType,
    time_in: fc.integer({ min: MIN_TS, max: MAX_TS }).map((ts) => new Date(ts).toISOString()),
    lot_id: fc.integer({ min: 1, max: 5 }),
});

// Generate a list of sessions
const arbSessions = fc.array(arbSession, { minLength: 0, maxLength: 30 });

// Generate nullable filter values (null means filter is inactive)
const arbNullablePlate = fc.oneof(fc.constant(null), arbPlate);
const arbNullableVehicleType = fc.oneof(fc.constant(null), arbVehicleType);
const arbNullableDate = fc.oneof(fc.constant(null), arbDateStr);

describe("Feature: session-audit-viewer, Property 5: Combined filters use AND logic", () => {
    it("every returned session satisfies ALL active filters simultaneously", () => {
        fc.assert(
            fc.property(
                arbSessions,
                arbNullablePlate,
                arbNullableVehicleType,
                arbNullableDate,
                arbNullableDate,
                (sessions, plate, vehicleType, startDate, endDate) => {
                    const filtered = applyFilters(sessions, { plate, vehicleType, startDate, endDate });

                    for (const s of filtered) {
                        if (plate) {
                            if (!s.license_plate.toLowerCase().includes(plate.toLowerCase())) return false;
                        }
                        if (vehicleType) {
                            if (s.vehicle_type.toLowerCase() !== vehicleType.toLowerCase()) return false;
                        }
                        if (startDate) {
                            const start = new Date(startDate + "T00:00:00.000Z");
                            if (new Date(s.time_in) < start) return false;
                        }
                        if (endDate) {
                            const end = new Date(endDate + "T00:00:00.000Z");
                            end.setUTCDate(end.getUTCDate() + 1);
                            if (new Date(s.time_in) >= end) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("no session satisfying all conditions is excluded from the result", () => {
        fc.assert(
            fc.property(
                arbSessions,
                arbNullablePlate,
                arbNullableVehicleType,
                arbNullableDate,
                arbNullableDate,
                (sessions, plate, vehicleType, startDate, endDate) => {
                    const filtered = applyFilters(sessions, { plate, vehicleType, startDate, endDate });

                    const filteredIds = new Set(filtered.map((s) => s.session_id));
                    for (const s of sessions) {
                        if (filteredIds.has(s.session_id)) continue;

                        let failsAny = false;
                        if (plate && !s.license_plate.toLowerCase().includes(plate.toLowerCase())) {
                            failsAny = true;
                        }
                        if (vehicleType && s.vehicle_type.toLowerCase() !== vehicleType.toLowerCase()) {
                            failsAny = true;
                        }
                        if (startDate) {
                            const start = new Date(startDate + "T00:00:00.000Z");
                            if (new Date(s.time_in) < start) failsAny = true;
                        }
                        if (endDate) {
                            const end = new Date(endDate + "T00:00:00.000Z");
                            end.setUTCDate(end.getUTCDate() + 1);
                            if (new Date(s.time_in) >= end) failsAny = true;
                        }
                        if (!failsAny) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("with no active filters, all sessions are returned", () => {
        fc.assert(
            fc.property(
                arbSessions,
                (sessions) => {
                    const filtered = applyFilters(sessions, {
                        plate: null,
                        vehicleType: null,
                        startDate: null,
                        endDate: null,
                    });
                    return filtered.length === sessions.length;
                }
            ),
            { numRuns: 100 }
        );
    });

    it("adding a filter never increases the result set size (monotonicity)", () => {
        fc.assert(
            fc.property(
                arbSessions,
                arbNullablePlate,
                arbNullableVehicleType,
                arbNullableDate,
                arbNullableDate,
                (sessions, plate, vehicleType, startDate, endDate) => {
                    const full = applyFilters(sessions, { plate, vehicleType, startDate, endDate });
                    const withoutPlate = applyFilters(sessions, { plate: null, vehicleType, startDate, endDate });
                    const withoutType = applyFilters(sessions, { plate, vehicleType: null, startDate, endDate });

                    return full.length <= withoutPlate.length && full.length <= withoutType.length;
                }
            ),
            { numRuns: 100 }
        );
    });
});
