-- 002_seed.sql
-- Minimal baseline data. Keep this deterministic and idempotent.

INSERT INTO feeconfigs (ticket_type, vehicle_type, service_fee, penalty_fee)
VALUES
	('daily', 'car', 10000, 50000),
	('daily', 'bike', 5000, 30000),
	('monthly', 'car', 300000, 50000),
	('monthly', 'bike', 150000, 30000)
ON CONFLICT (ticket_type, vehicle_type) DO NOTHING;
