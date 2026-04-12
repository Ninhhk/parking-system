# Check-in Concurrency Test Suite

This test suite verifies that the concurrency fixes for the check-in endpoint work correctly.

## Prerequisites

1. **Database must be running**: Start PostgreSQL via Docker Compose:
   ```bash
   docker compose up -d db
   ```

2. **Database must be initialized**: Ensure migrations have run:
   ```bash
   docker compose up -d db-migrate
   ```

3. **Environment variables**: Ensure `.env` file in `be/` directory has correct database connection settings:
   ```env
   DB_HOST=localhost
   DB_PORT=55432
   DB_USER=parking_user
   DB_PASSWORD=parking_pass
   DB_NAME=parkingdb
   ```

## Running the Tests

### Run concurrency tests only:
```bash
cd be
npm test __tests__/services/checkin.concurrency.test.js
```

### Run all backend tests:
```bash
cd be
npm test
```

## What the Tests Verify

### Capacity Enforcement Tests
- ✅ **Car capacity enforced atomically**: When lot has capacity for 2 cars, exactly 2 out of 3 concurrent check-ins succeed
- ✅ **Bike capacity enforced atomically**: Same for bikes
- ✅ **Mixed car/bike handled independently**: Car capacity doesn't affect bikes and vice versa

### Duplicate Session Prevention Tests
- ✅ **Duplicate prevention at repository level**: Second check-in with same plate throws constraint error
- ✅ **Duplicate prevention at API level**: Concurrent API requests with same plate return 409 Conflict
- ✅ **Only one session in database**: Verification query confirms no duplicates exist

### API Response Tests
- ✅ **409 Conflict when lot is full**: Proper HTTP status returned
- ✅ **Error message is clear**: Message indicates lot is full for specific vehicle type

### Monthly Subscription Tests
- ✅ **Monthly vehicles respect capacity**: Even monthly pass holders can't exceed capacity

## Test Database State

Tests create:
- Test employee user: `test_employee_concurrency`
- Test parking lot: `Test Lot Concurrency` with capacity 2 cars / 2 bikes
- Test sessions for each scenario

All test data is cleaned up after tests complete.

## Troubleshooting

### Error: `getaddrinfo ENOTFOUND postgres`
- **Cause**: Database is not running
- **Fix**: Start database with `docker compose up -d db`

### Error: `relation "parkinglots" does not exist`
- **Cause**: Database not initialized
- **Fix**: Run migrations with `docker compose up -d db-migrate`

### Tests timeout
- **Cause**: Database connection issue or slow queries
- **Fix**: Check database logs with `docker compose logs db`

### Jest doesn't exit
- **Cause**: Database connections not properly closed
- **Fix**: Tests should call `pool.end()` in `afterAll()` - this is already implemented
