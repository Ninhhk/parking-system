-- 001_schema.sql
-- Bootstrap schema for Parking Lot system.
-- Note: unquoted identifiers are intentionally lowercase so mixed-case app queries
-- (e.g., SELECT * FROM Users) keep working in PostgreSQL.

CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feeconfigs (
    ticket_type VARCHAR(50) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    service_fee DECIMAL(10, 2) NOT NULL,
    penalty_fee DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (ticket_type, vehicle_type)
);

CREATE TABLE IF NOT EXISTS parkinglots (
    lot_id SERIAL PRIMARY KEY,
    lot_name VARCHAR(255) NOT NULL UNIQUE,
    car_capacity INT NOT NULL,
    bike_capacity INT NOT NULL,
    current_car INT NOT NULL DEFAULT 0,
    current_bike INT NOT NULL DEFAULT 0,
    managed_by INT,
    CONSTRAINT fk_parkinglots_manager
        FOREIGN KEY (managed_by)
        REFERENCES users(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS monthlysubs (
    sub_id SERIAL PRIMARY KEY,
    license_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS parkingsessions (
    session_id SERIAL PRIMARY KEY,
    lot_id INT NOT NULL,
    license_plate VARCHAR(20) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL,
    time_in TIMESTAMP NOT NULL,
    time_out TIMESTAMP,
    is_lost BOOLEAN DEFAULT FALSE,
    is_monthly BOOLEAN,
    parking_fee DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_sessions_lot
        FOREIGN KEY (lot_id)
        REFERENCES parkinglots(lot_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS lostticketreport (
    reportid SERIAL PRIMARY KEY,
    session_id INT NOT NULL UNIQUE,
    guest_identification TEXT NOT NULL,
    guest_phone VARCHAR(20) NOT NULL,
    penalty_fee DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_lostticket_session
        FOREIGN KEY (session_id)
        REFERENCES parkingsessions(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS payment (
    payment_id SERIAL PRIMARY KEY,
    session_id INT,
    sub_id INT,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    CONSTRAINT fk_payment_session
        FOREIGN KEY (session_id)
        REFERENCES parkingsessions(session_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_payment_sub
        FOREIGN KEY (sub_id)
        REFERENCES monthlysubs(sub_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    noti_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at DATE NOT NULL DEFAULT CURRENT_DATE,
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_lot_timeout
    ON parkingsessions (lot_id, time_out);

CREATE INDEX IF NOT EXISTS idx_sessions_license_plate
    ON parkingsessions (license_plate);

CREATE INDEX IF NOT EXISTS idx_monthlysubs_license_plate
    ON monthlysubs (license_plate);

CREATE INDEX IF NOT EXISTS idx_payment_date
    ON payment (payment_date);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications (user_id);
