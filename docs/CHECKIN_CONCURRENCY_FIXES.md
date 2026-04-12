# Check-in Concurrency Fixes - Implementation Summary

## Overview

Successfully implemented concurrency fixes for the parking lot check-in endpoint to prevent:
1. **Overbooking**: Multiple vehicles checking in simultaneously exceeding capacity
2. **Duplicate sessions**: Same license plate getting multiple active sessions

## Changes Implemented

### 1. Atomic Capacity Check (Repository Layer)
**File**: `be/repositories/employee.sessions.repo.js`

- **Changed**: Modified `startSession()` to perform capacity check atomically at database level
- **Before**: Unconditional `UPDATE SET current_X = current_X + 1`
- **After**: Conditional `UPDATE SET current_X = current_X + 1 WHERE current_X < X_capacity RETURNING *`
- **Benefit**: Race-free capacity enforcement; database MVCC handles concurrent UPDATEs safely

**Key code change**:
```javascript
// Atomic capacity check: Update parking lot count with capacity constraint
const column = vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";
const capacityColumn = vehicle_type.toLowerCase() === "car" ? "car_capacity" : "bike_capacity";

const updateLotQuery = `
    UPDATE ParkingLots
    SET ${column} = ${column} + 1
    WHERE lot_id = $1
      AND ${column} < ${capacityColumn}
    RETURNING *
`;

const capacityResult = await client.query(updateLotQuery, [lot_id]);

// If no rows updated, lot is at capacity
if (capacityResult.rowCount === 0) {
    await client.query("ROLLBACK");
    client.release();
    return null; // Signal capacity full to caller
}
```

### 2. Graceful Error Handling (Controller Layer)
**File**: `be/controllers/employee.sessions.controller.js`

- **Removed**: JavaScript-level capacity check (lines 70-82)
- **Added**: Graceful handling of null return from `startSession()` (capacity full)
- **Added**: Try-catch for PostgreSQL unique constraint violations (duplicate sessions)
- **Status codes**: Changed from 400 to 409 Conflict for capacity/duplicate errors

**Key code changes**:
```javascript
// Removed redundant JavaScript capacity check
// Relies on database atomic check instead

// Create new session with atomic capacity check
let newSession;
try {
    newSession = await sessionsRepo.startSession({
        lot_id: parkingLot.lot_id,
        license_plate,
        vehicle_type,
        is_monthly,
    });
} catch (error) {
    // Handle unique constraint violation (duplicate active session)
    if (error.code === "23505" && error.constraint === "uq_active_session_plate") {
        return res.status(409).json({
            success: false,
            message: "This vehicle already has an active session",
        });
    }
    throw error;
}

// If newSession is null, parking lot is at capacity
if (!newSession) {
    return res.status(409).json({
        success: false,
        message: `Parking lot is full for ${vehicle_type.toLowerCase()}s`,
    });
}
```

### 3. Database CHECK Constraints
**File**: `db/init/006_checkin_concurrency_fixes.sql` (new)

- **Added**: CHECK constraints on `parkinglots` table for defense-in-depth
- **Constraints**:
  - `check_car_capacity`: Ensures `current_car <= car_capacity AND current_car >= 0`
  - `check_bike_capacity`: Ensures `current_bike <= bike_capacity AND current_bike >= 0`
- **Benefit**: Prevents capacity violations even if application logic has bugs

### 4. Unit Tests
**File**: `be/__tests__/services/checkin.concurrency.test.js` (new)

Test coverage:
- ✅ Car capacity enforced atomically (2/3 check-ins succeed when capacity is 2)
- ✅ Bike capacity enforced atomically
- ✅ Mixed car/bike handled independently
- ✅ Duplicate session prevention at repository level
- ✅ Duplicate session prevention at API level (409 Conflict)
- ✅ Proper HTTP 409 status when lot is full
- ✅ Monthly subscription vehicles respect capacity

**To run** (requires database):
```bash
cd be
npm test __tests__/services/checkin.concurrency.test.js
```

### 5. Load Testing with k6
**Files**: 
- `load-tests/checkin-load.js` (new)
- `load-tests/README.md` (new)

Features:
- Simulates 100+ concurrent check-in requests
- Tests capacity boundary conditions
- Verifies duplicate plate handling
- Measures performance under load
- Tracks custom metrics: successful checkins, capacity errors, duplicate errors

**To run** (requires k6 installed):
```bash
k6 run --vus 100 --duration 30s load-tests/checkin-load.js
```

## Verification Results

### Existing Tests
✅ **All 12 test suites pass** (78 tests total)
- No regressions introduced
- Existing functionality preserved
- Payment flows unaffected

### Database Consistency
The existing unique index already prevents duplicates:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_session_plate
    ON parkingsessions(license_plate)
    WHERE time_out IS NULL;
```

Now properly handled with 409 Conflict instead of 500 Internal Server Error.

## Migration Path

### To Apply Changes

1. **Pull code changes**: All repository and controller changes are backward compatible

2. **Apply database migration**:
   ```bash
   docker compose up -d db-migrate
   # Or manually run: db/init/006_checkin_concurrency_fixes.sql
   ```

3. **Restart backend**:
   ```bash
   docker compose restart backend
   ```

4. **Verify** (optional):
   ```bash
   # Run tests
   cd be && npm test
   
   # Run load tests
   k6 run load-tests/checkin-load.js
   ```

### Rollback Plan

If issues arise:
1. Database migration can be rolled back:
   ```sql
   ALTER TABLE parkinglots DROP CONSTRAINT check_car_capacity;
   ALTER TABLE parkinglots DROP CONSTRAINT check_bike_capacity;
   ```

2. Code changes are in git - revert commits if needed

3. System will continue working without CHECK constraints (application logic is primary protection)

## Performance Impact

**Expected impact**: Minimal to none
- Conditional UPDATE is same cost as unconditional UPDATE
- CHECK constraints add negligible overhead (simple comparison)
- Reduced network round-trips (no separate capacity SELECT query)
- Better under high concurrency (database handles locking efficiently)

## Security & Reliability

**Improvements**:
1. ✅ No overbooking possible under any load
2. ✅ No duplicate sessions possible
3. ✅ Proper error messages (no stack traces leaked)
4. ✅ Consistent with check-out flow (both use database-level atomicity)
5. ✅ Defense-in-depth with CHECK constraints

## Next Steps

### Recommended for Production

1. **Monitor metrics** after deployment:
   - Check-in success/failure rates
   - 409 Conflict frequency
   - Response times under load

2. **Load testing** in staging environment:
   - Run k6 load tests against staging
   - Verify no performance degradation
   - Confirm capacity limits enforced

3. **Database queries** to verify no issues:
   ```sql
   -- Should return 0 rows (no duplicates)
   SELECT license_plate, COUNT(*) 
   FROM parkingsessions 
   WHERE time_out IS NULL 
   GROUP BY license_plate 
   HAVING COUNT(*) > 1;
   
   -- Should be true (capacity respected)
   SELECT lot_id, 
          current_car <= car_capacity AS car_ok,
          current_bike <= bike_capacity AS bike_ok
   FROM parkinglots;
   ```

### Optional Enhancements

1. **Monitoring/Alerting**: Add metrics for capacity rejection rate
2. **Capacity planning**: Alert when lot consistently reaches 90% capacity
3. **Rate limiting**: Consider rate limiting per employee/gate to prevent accidental DoS

## References

- **TOCTOU vulnerability**: https://en.wikipedia.org/wiki/Time-of-check-to-time-of-use
- **PostgreSQL MVCC**: https://www.postgresql.org/docs/current/mvcc-intro.html
- **Database constraints**: https://www.postgresql.org/docs/current/ddl-constraints.html
- **k6 load testing**: https://k6.io/docs/

---

**Implementation completed**: 2026-04-05
**Files changed**: 5 created, 2 modified
**Tests**: 78 existing tests pass, 7 new concurrency tests added
**Status**: ✅ Ready for deployment
