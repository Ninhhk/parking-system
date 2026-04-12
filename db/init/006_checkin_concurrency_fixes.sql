-- 006_checkin_concurrency_fixes.sql
-- Adds CHECK constraints for parking lot capacity enforcement
-- Provides defense-in-depth safety net to prevent capacity violations at database level

-- Add CHECK constraint for car capacity
-- Ensures current_car never exceeds car_capacity and never goes negative
ALTER TABLE parkinglots
    ADD CONSTRAINT check_car_capacity
    CHECK (current_car <= car_capacity AND current_car >= 0);

-- Add CHECK constraint for bike capacity
-- Ensures current_bike never exceeds bike_capacity and never goes negative
ALTER TABLE parkinglots
    ADD CONSTRAINT check_bike_capacity
    CHECK (current_bike <= bike_capacity AND current_bike >= 0);

-- Note: These constraints complement the atomic capacity checks in the application layer
-- They provide an additional safety layer in case of:
-- 1. Direct database updates
-- 2. Application logic bugs
-- 3. Race conditions that somehow slip through
-- 4. Manual interventions by database administrators
