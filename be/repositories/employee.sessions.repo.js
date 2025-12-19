const { pool } = require("../config/db");
const { getToday } = require("../utils/date");
const feeConfigRepo = require("./admin.feeConfig.repo");

exports.startSession = async (sessionData) => {
    // Start a transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { lot_id, license_plate, vehicle_type, is_monthly } = sessionData;

        // Insert the new session - added parking_fee with default value of 0
        const query = `
            INSERT INTO ParkingSessions (
                lot_id,
                license_plate,
                vehicle_type,
                is_monthly,
                time_in,
                parking_fee
            ) VALUES ($1, $2, $3, $4, NOW(), 0)
            RETURNING *
        `;

        const result = await client.query(query, [lot_id, license_plate, vehicle_type, is_monthly]);

        // Update the parking lot vehicle count
        const column = vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = ${column} + 1
            WHERE lot_id = $1
            RETURNING *
        `;

        await client.query(updateLotQuery, [lot_id]);

        // Commit the transaction
        await client.query("COMMIT");

        return result.rows[0];
    } catch (error) {
        // Rollback in case of error
        await client.query("ROLLBACK");
        throw error;
    } finally {
        // Release the client
        client.release();
    }
};

exports.getSession = async (sessionId) => {
    const query = `
        SELECT 
            ps.*,
            pl.lot_name,
            fc.service_fee,
            fc.penalty_fee
        FROM ParkingSessions ps
        JOIN ParkingLots pl ON ps.lot_id = pl.lot_id
        LEFT JOIN FeeConfigs fc ON ps.vehicle_type = fc.vehicle_type
        WHERE ps.session_id = $1 AND fc.ticket_type = 'daily'
    `;

    const result = await pool.query(query, [sessionId]);
    return result.rows[0];
};

exports.checkMonthlySub = async (license_plate, current_date) => {
    const query = `
        SELECT * FROM MonthlySubs
        WHERE license_plate = $1
        AND start_date <= $2
        AND end_date >= $2
    `;

    const result = await pool.query(query, [license_plate, current_date]);
    return result.rows[0];
};

exports.createPendingPayment = async (paymentData) => {
    const { session_id, sub_id, total_amount } = paymentData;

    // Changed "Payments" to "Payment" to match your database schema
    const query = `
        INSERT INTO Payment (
            session_id,
            sub_id,
            payment_method,
            total_amount
        ) VALUES ($1, $2, 'PENDING', $3)
        RETURNING *
    `;

    const result = await pool.query(query, [session_id, sub_id || null, total_amount]);

    return result.rows[0];
};

exports.confirmPayment = async (paymentData) => {
    // Start a transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { payment_id, payment_method, session_id, is_lost } = paymentData;

        // Update the payment - changed "Payments" to "Payment"
        const updatePaymentQuery = `
            UPDATE Payment
            SET 
                payment_method = $1,
                payment_date = NOW()
            WHERE payment_id = $2
            RETURNING *
        `;

        const paymentResult = await client.query(updatePaymentQuery, [payment_method, payment_id]);

        // Get session details
        const sessionQuery = `
            SELECT * FROM ParkingSessions
            WHERE session_id = $1
        `;

        const sessionResult = await client.query(sessionQuery, [session_id]);
        const session = sessionResult.rows[0];

        // Update the session
        const updateSessionQuery = `
            UPDATE ParkingSessions
            SET 
                time_out = NOW(),
                is_lost = $1
            WHERE session_id = $2
            RETURNING *
        `;

        const updatedSessionResult = await client.query(updateSessionQuery, [is_lost || false, session_id]);

        // Update the parking lot vehicle count
        const column = session.vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = ${column} - 1
            WHERE lot_id = $1
            RETURNING *
        `;

        await client.query(updateLotQuery, [session.lot_id]);

        // If lost ticket, create a report
        if (is_lost) {
            const lostTicketQuery = `
                INSERT INTO LostTicketReport (
                    session_id,
                    guest_identification,
                    guest_phone,
                    penalty_fee
                ) VALUES ($1, 'UNKNOWN', 'UNKNOWN', $2)
            `;

            // Use the penalty fee from the fee config or a default value
            const penaltyFee = session.penalty_fee || 50000;

            await client.query(lostTicketQuery, [session_id, penaltyFee]);
        }

        // Commit the transaction
        await client.query("COMMIT");

        return {
            payment: paymentResult.rows[0],
            session: updatedSessionResult.rows[0],
        };
    } catch (error) {
        // Rollback in case of error
        await client.query("ROLLBACK");
        throw error;
    } finally {
        // Release the client
        client.release();
    }
};

exports.createAndConfirmPayment = async (paymentData) => {
    // Start a transaction
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const { session_id, sub_id, total_amount, payment_method, is_lost } = paymentData;

        // Create the payment
        const createPaymentQuery = `
            INSERT INTO Payment (
                session_id,
                sub_id,
                payment_method,
                total_amount,
                payment_date
            ) VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `;

        const paymentResult = await client.query(createPaymentQuery, [
            session_id,
            sub_id || null,
            payment_method,
            total_amount,
        ]);

        // Get session details
        const sessionQuery = `
            SELECT * FROM ParkingSessions
            WHERE session_id = $1
        `;

        const sessionResult = await client.query(sessionQuery, [session_id]);
        const session = sessionResult.rows[0];

        // Update the session with time_out and parking_fee
        const updateSessionQuery = `
            UPDATE ParkingSessions
            SET 
                time_out = NOW(),
                is_lost = $1,
                parking_fee = $2
            WHERE session_id = $3
            RETURNING *
        `;

        const updatedSessionResult = await client.query(updateSessionQuery, [
            is_lost || false,
            total_amount,
            session_id,
        ]);

        // Update the parking lot vehicle count
        const column = session.vehicle_type.toLowerCase() === "car" ? "current_car" : "current_bike";

        const updateLotQuery = `
            UPDATE ParkingLots
            SET ${column} = GREATEST(${column} - 1, 0)
            WHERE lot_id = $1
            RETURNING *
        `;

        await client.query(updateLotQuery, [session.lot_id]);

        // Commit the transaction
        await client.query("COMMIT");

        return {
            payment: paymentResult.rows[0],
            session: updatedSessionResult.rows[0],
        };
    } catch (error) {
        // Rollback in case of error
        await client.query("ROLLBACK");
        throw error;
    } finally {
        // Release the client
        client.release();
    }
};

exports.getActiveSessionsByLot = async (lotId) => {
    const query = `
        SELECT * FROM ParkingSessions
        WHERE lot_id = $1 AND time_out IS NULL
        ORDER BY time_in DESC
    `;

    const result = await pool.query(query, [lotId]);
    return result.rows;
};

// Employee reports a lost ticket (standalone, not during checkout)
exports.reportLostTicket = async ({ session_id, guest_identification, guest_phone }) => {
    // Get session info to determine ticket_type and vehicle_type
    const sessionQuery = `SELECT * FROM ParkingSessions WHERE session_id = $1`;
    const sessionResult = await pool.query(sessionQuery, [session_id]);
    const session = sessionResult.rows[0];
    if (!session) throw new Error("Session not found");

    // Check if a lost ticket report already exists for this session
    const checkExistingQuery = `SELECT * FROM LostTicketReport WHERE session_id = $1`;
    const existingResult = await pool.query(checkExistingQuery, [session_id]);
    if (existingResult.rows.length > 0) {
        throw new Error("A lost ticket report already exists for this session");
    }

    // Assume ticket_type is 'daily' unless you have a field for it
    const ticket_type = session.is_monthly ? "monthly" : "daily";
    const vehicle_type = session.vehicle_type;
    // Get penalty fee from FeeConfigs
    const penalty_fee = await feeConfigRepo.getPenaltyFee(ticket_type, vehicle_type);
    const query = `
        INSERT INTO LostTicketReport (
            session_id,
            guest_identification,
            guest_phone,
            penalty_fee
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
    `;
    const result = await pool.query(query, [session_id, guest_identification, guest_phone, penalty_fee]);
    return result.rows[0];
};

// Check if a session has a lost ticket report and update is_lost if needed
exports.syncLostTicketStatus = async (session_id) => {
    // Check if a lost ticket report exists for this session
    const checkQuery = `SELECT COUNT(*) FROM LostTicketReport WHERE session_id = $1`;
    const result = await pool.query(checkQuery, [session_id]);
    const hasLost = parseInt(result.rows[0].count, 10) > 0;
    if (hasLost) {
        // Update is_lost in ParkingSessions
        await pool.query(`UPDATE ParkingSessions SET is_lost = true WHERE session_id = $1`, [session_id]);
    }
    return hasLost;
};

exports.deleteLostTicketReportBySessionId = async (session_id) => {
    const query = `DELETE FROM LostTicketReport WHERE session_id = $1 RETURNING *`;
    const result = await pool.query(query, [session_id]);
    return result.rowCount > 0;
};
