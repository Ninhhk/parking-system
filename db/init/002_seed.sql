-- 002_seed.sql
-- Minimal baseline data. Keep this deterministic and idempotent.

INSERT INTO feeconfigs (ticket_type, vehicle_type, service_fee, penalty_fee)
VALUES
	('daily', 'car', 10000, 50000),
	('daily', 'bike', 5000, 30000),
	('monthly', 'car', 300000, 50000),
	('monthly', 'bike', 150000, 30000)
ON CONFLICT (ticket_type, vehicle_type) DO NOTHING;

-- Default admin user (password: admin123)
INSERT INTO users (username, password_hash, full_name, role)
VALUES (
    'admin',
    '$2b$10$OTA8tOUpwoo.PKKfNa0Z5ueKMnJJ.toL4Zq5aeoHv4yjTy5zst9FW',
    'System Admin',
    'admin'
)
ON CONFLICT (username) DO NOTHING;

-- Default parking lot
INSERT INTO parkinglots (lot_name, car_capacity, bike_capacity)
VALUES ('Main Lot', 100, 200)
ON CONFLICT (lot_name) DO NOTHING;
