# Load Testing for Parking Lot Check-in

This directory contains k6 load testing scripts for verifying concurrency fixes in the check-in endpoint.

## Prerequisites

1. **Install k6**: Download from https://k6.io/docs/getting-started/installation/
   - Windows: `choco install k6` or download binary
   - Linux: `sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69 && echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list && sudo apt-get update && sudo apt-get install k6`
   - macOS: `brew install k6`

2. **Start the backend server**: 
   ```bash
   cd be
   npm run dev
   ```

3. **Ensure test data exists**:
   - Test employee user with username `test_employee` and password `password123`
   - Test parking lot with lot_id = 1 (or adjust in script)

## Running Load Tests

### Basic Load Test
```bash
k6 run load-tests/checkin-load.js
```

### Custom VUs and Duration
```bash
k6 run --vus 50 --duration 20s load-tests/checkin-load.js
```

### High Load Test (Stress Test)
```bash
k6 run --vus 200 --duration 60s load-tests/checkin-load.js
```

## Test Scenarios

The `checkin-load.js` script tests:

1. **Capacity Enforcement**: Verifies that capacity limits are strictly enforced even under high concurrent load
2. **Duplicate Prevention**: Ensures no duplicate active sessions are created for the same license plate
3. **HTTP Status Codes**: Validates correct response codes:
   - `201`: Successful check-in
   - `409`: Capacity full or duplicate session
   - `422`: Validation errors

## Metrics

Custom metrics tracked:
- `successful_checkins`: Number of successful check-ins
- `capacity_full_errors`: Number of requests rejected due to capacity
- `duplicate_errors`: Number of requests rejected due to duplicate plates
- `checkin_duration`: Response time trend
- `error_rate`: Overall error rate

## Post-Test Verification

After running the load test, verify database consistency:

```sql
-- Check for duplicate active sessions (should return 0 rows)
SELECT license_plate, COUNT(*) 
FROM parkingsessions 
WHERE time_out IS NULL 
GROUP BY license_plate 
HAVING COUNT(*) > 1;

-- Verify capacity enforcement
SELECT current_car, car_capacity, current_bike, bike_capacity
FROM parkinglots 
WHERE lot_id = 1;

-- Should satisfy: current_car <= car_capacity AND current_bike <= bike_capacity
```

## Expected Results

- **No duplicate sessions**: Query above should return 0 rows
- **Capacity respected**: current_car/bike should never exceed capacity
- **Proper error handling**: 409 status codes for conflicts, no 500 errors
- **Good performance**: p95 latency < 2s under 100 VUs

## Troubleshooting

- **Login failed**: Ensure backend is running and test employee exists
- **Connection refused**: Check backend is accessible at http://localhost:5000
- **k6 not found**: Install k6 following instructions above
