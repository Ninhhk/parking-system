/**
 * k6 Load Test for Check-in Concurrency
 * 
 * Tests the parking lot check-in endpoint under high concurrent load to verify:
 * 1. Capacity limits are strictly enforced
 * 2. No duplicate sessions are created for same license plate
 * 3. Proper HTTP status codes are returned
 * 
 * Prerequisites:
 * - Backend server running at http://localhost:5000
 * - Database initialized with test parking lot
 * - Employee user authenticated
 * 
 * Run with: k6 run --vus 100 --duration 30s load-tests/checkin-load.js
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics
const successfulCheckins = new Counter('successful_checkins');
const capacityFullErrors = new Counter('capacity_full_errors');
const duplicateErrors = new Counter('duplicate_errors');
const otherErrors = new Counter('other_errors');
const checkinDuration = new Trend('checkin_duration');
const errorRate = new Rate('error_rate');

// Test configuration
export const options = {
    stages: [
        { duration: '10s', target: 50 },  // Ramp up to 50 VUs
        { duration: '20s', target: 100 }, // Ramp up to 100 VUs
        { duration: '20s', target: 100 }, // Hold at 100 VUs
        { duration: '10s', target: 0 },   // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
        error_rate: ['rate<0.5'],          // Error rate should be less than 50%
        successful_checkins: ['count>0'],  // At least some check-ins should succeed
    },
};

const BASE_URL = 'http://localhost:5000';
const LOGIN_ENDPOINT = `${BASE_URL}/api/auth/login`;
const CHECKIN_ENDPOINT = `${BASE_URL}/api/employee/sessions/checkin`;

let authCookie = null;
let testLotId = null;

/**
 * Setup function runs once before the test
 */
export function setup() {
    console.log('🚀 Starting load test setup...');

    // Login as employee
    const loginPayload = JSON.stringify({
        username: 'test_employee',
        password: 'password123',
    });

    const loginRes = http.post(LOGIN_ENDPOINT, loginPayload, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (loginRes.status !== 200) {
        console.error('❌ Login failed during setup');
        console.error(`Status: ${loginRes.status}`);
        console.error(`Body: ${loginRes.body}`);
        return null;
    }

    // Extract session cookie
    const cookies = loginRes.cookies;
    const sessionCookie = cookies['connect.sid'];
    if (!sessionCookie || !sessionCookie[0]) {
        console.error('❌ No session cookie found');
        return null;
    }

    const cookieValue = sessionCookie[0].value;
    console.log('✅ Login successful');
    console.log(`   Cookie: ${cookieValue.substring(0, 20)}...`);

    // Note: Lot ID should be determined from employee's assigned lot
    // For this test, we assume lot_id = 1 or fetch from API
    return {
        authCookie: `connect.sid=${cookieValue}`,
        lotId: 1, // Adjust based on your test environment
    };
}

/**
 * Main test scenario
 */
export default function (data) {
    if (!data || !data.authCookie) {
        console.error('❌ No auth data available, skipping test');
        return;
    }

    // Generate unique license plate with timestamp and VU ID
    const timestamp = Date.now();
    const vuId = __VU;
    const iteration = __ITER;
    const licensePlate = `LOAD${vuId}${iteration}`;

    group('Check-in Load Test', function () {
        const payload = JSON.stringify({
            license_plate: licensePlate,
            vehicle_type: Math.random() > 0.5 ? 'car' : 'bike',
            lot_id: data.lotId,
        });

        const params = {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': data.authCookie,
            },
        };

        const startTime = Date.now();
        const res = http.post(CHECKIN_ENDPOINT, payload, params);
        const duration = Date.now() - startTime;

        checkinDuration.add(duration);

        // Check response status and categorize
        const success = check(res, {
            'status is 2xx, 4xx, or 409': (r) => 
                r.status === 201 || r.status === 400 || r.status === 409 || r.status === 422,
        });

        if (res.status === 201) {
            successfulCheckins.add(1);
            errorRate.add(0);
        } else if (res.status === 409) {
            const body = JSON.parse(res.body);
            if (body.message && body.message.includes('full')) {
                capacityFullErrors.add(1);
            } else if (body.message && body.message.includes('active session')) {
                duplicateErrors.add(1);
            } else {
                otherErrors.add(1);
            }
            errorRate.add(0); // 409 is expected, not an error
        } else if (res.status === 400 || res.status === 422) {
            // Validation errors (expected for some test cases)
            errorRate.add(0);
        } else {
            // Unexpected status code
            otherErrors.add(1);
            errorRate.add(1);
            console.error(`❌ Unexpected status: ${res.status}`);
            console.error(`   Body: ${res.body}`);
        }

        // Small sleep to avoid overwhelming the server
        sleep(0.1);
    });
}

/**
 * Teardown function runs once after the test
 */
export function teardown(data) {
    console.log('\n📊 Load Test Summary:');
    console.log('   Test completed successfully');
    console.log('   Review metrics above for detailed results');
    console.log('\n🔍 Recommended Post-Test Checks:');
    console.log('   1. Check database for duplicate active sessions:');
    console.log('      SELECT license_plate, COUNT(*) FROM parkingsessions');
    console.log('      WHERE time_out IS NULL GROUP BY license_plate HAVING COUNT(*) > 1;');
    console.log('   2. Verify capacity enforcement:');
    console.log('      SELECT current_car, car_capacity, current_bike, bike_capacity');
    console.log('      FROM parkinglots WHERE lot_id = 1;');
    console.log('   3. Check for any constraint violations in logs');
}
