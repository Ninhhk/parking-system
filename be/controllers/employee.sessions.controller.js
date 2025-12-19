const sessionsRepo = require("../repositories/employee.sessions.repo");
const feeConfigRepo = require("../repositories/admin.feeConfig.repo");
const lotsRepo = require("../repositories/admin.lots.repo");
const { pool } = require("../config/db"); // Import the pool
const { getToday, calculateHoursDifference } = require("../utils/date");

// Vehicle Entry - Create a new parking session
exports.checkInVehicle = async (req, res) => {
    try {
        const {
            license_plate: raw_license_plate,
            vehicle_type,
            lot_id, // We still accept this but will verify against employee's assigned lot
        } = req.body;

        const { sanitizePlate } = require("../utils/licensePlate");
        const license_plate = sanitizePlate(raw_license_plate);

        // Validate required fields
        if (!license_plate || !vehicle_type) {
            return res.status(422).json({
                success: false,
                message: "Missing required fields",
            });
        }

        // Validate license plate format (alphanumeric with optional hyphen)
        const licensePlateRegex = /^[A-Z0-9-]+$/i;
        if (!licensePlateRegex.test(license_plate)) {
            return res.status(422).json({
                success: false,
                message: "Invalid license plate format",
            });
        }

        // Get the parking lot managed by this employee
        const userId = req.session.user.user_id;
        const assignedLot = await lotsRepo.getParkingLotByManager(userId);

        // Check if the employee is assigned to any lot
        let parkingLot;
        let isAssignedLot = true;

        if (assignedLot) {
            // Use the employee's assigned lot regardless of what was provided
            parkingLot = assignedLot;
        } else {
            // Employee is not assigned to any lot - try to find any lot
            isAssignedLot = false;
            const allLots = await lotsRepo.getAllParkingLots();
            if (allLots && allLots.length > 0) {
                parkingLot = allLots[0];
            } else {
                return res.status(404).json({
                    success: false,
                    message: "No parking lots available",
                });
            }
        }

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "No parking lot found for the employee",
            });
        }

        // Check if lot is full for this vehicle type
        if (vehicle_type.toLowerCase() === "car" && parkingLot.current_car >= parkingLot.car_capacity) {
            return res.status(400).json({
                success: false,
                message: "Parking lot is full for cars",
            });
        }

        if (vehicle_type.toLowerCase() === "bike" && parkingLot.current_bike >= parkingLot.bike_capacity) {
            return res.status(400).json({
                success: false,
                message: "Parking lot is full for bikes",
            });
        }

        // Check if there's an active session for this license plate
        const activeSessions = await sessionsRepo.getActiveSessionsByLot(parkingLot.lot_id);
        const hasActiveSession = activeSessions.some((session) => session.license_plate === license_plate);

        if (hasActiveSession) {
            return res.status(400).json({
                success: false,
                message: "This vehicle already has an active session",
            });
        }

        // Check if vehicle has a monthly subscription
        const today = getToday();
        const monthlyPass = await sessionsRepo.checkMonthlySub(license_plate, today);
        const is_monthly = !!monthlyPass;

        // Create new session with the employee's assigned lot
        const newSession = await sessionsRepo.startSession({
            lot_id: parkingLot.lot_id,
            license_plate,
            vehicle_type,
            is_monthly,
        });

        // Generate ticket with QR/barcode data
        // In a real system, you might use a library to generate actual QR/barcode
        const ticket = {
            session_id: newSession.session_id,
            license_plate: newSession.license_plate,
            vehicle_type: newSession.vehicle_type,
            time_in: newSession.time_in,
            is_monthly: newSession.is_monthly,
            lot_id: newSession.lot_id,
            lot_name: parkingLot.lot_name,
            //qr_code: `PK-${newSession.session_id}-${Date.now()}`, // Simplified QR code data
        };

        res.status(201).json({
            success: true,
            message: "Vehicle checked in successfully",
            ticket,
        });
    } catch (error) {
        console.error("Check-in vehicle error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Vehicle Exit - Stage 1: Get session info for checkout (READ-ONLY)
// Vehicle Exit - Stage 1: Get session info for checkout (READ-ONLY)
exports.initiateCheckout = async (req, res) => {
    try {
        const session_id = req.params.session_id;

        if (!session_id) {
            return res.status(422).json({
                success: false,
                message: "Session ID is required",
            });
        }

        // Sync lost ticket status
        await sessionsRepo.syncLostTicketStatus(session_id);

        // Get session information
        const session = await sessionsRepo.getSession(session_id);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Parking session not found",
            });
        }

        // Check if session is already completed
        if (session.time_out) {
            return res.status(400).json({
                success: false,
                message: "This parking session is already completed",
            });
        }

        // Calculate parking duration and fee - using Math.ceil for rounding up
        const currentTime = new Date();
        const checkInTime = new Date(session.time_in);
        // Round up to the next hour for better UX and simpler calculations
        let hours = Math.ceil(calculateHoursDifference(checkInTime, currentTime));

        // Validate reasonable parking duration (max 30 days = 720 hours)
        const MAX_PARKING_HOURS = 720;
        if (hours > MAX_PARKING_HOURS) {
            return res.status(400).json({
                success: false,
                message: `Parking duration exceeds maximum allowed (${MAX_PARKING_HOURS} hours / 30 days). Please contact administrator.`,
                hours: hours,
            });
        }

        let totalAmount = 0;
        let penaltyFee = parseFloat(session.penalty_fee);
        let serviceFee = parseFloat(session.service_fee);

        if (!session.is_lost) {
            penaltyFee = 0;
        }
        // Check if is_monthly is true from the session
        if (session.is_monthly) {
            // No charge for monthly subscribers
            serviceFee = 0;
        }

        // Calculate payment based on hours
        if (hours > 1) {
            serviceFee = serviceFee * hours;
        }

        totalAmount = serviceFee + penaltyFee;
        
        // Validate total amount doesn't exceed database limit
        const MAX_AMOUNT = 99999999.99; // NUMERIC(10,2) limit
        if (totalAmount > MAX_AMOUNT) {
            return res.status(400).json({
                success: false,
                message: `Calculated amount (${totalAmount.toFixed(2)}) exceeds maximum allowed (${MAX_AMOUNT}). Please contact administrator.`,
                hours: hours,
                totalAmount: totalAmount,
            });
        }

        // Don't create a pending payment yet - just return the calculated info
        res.status(200).json({
            success: true,
            message: "Checkout information retrieved",
            amount: totalAmount,
            hours: hours,
            serviceFee: serviceFee,
            penaltyFee: penaltyFee,
            session_details: session,
        });
    } catch (error) {
        console.error("Initiate checkout error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Vehicle Exit - Stage 2: Confirm payment and complete checkout
exports.confirmCheckout = async (req, res) => {
    try {
        const { session_id, payment_method } = req.body;

        if (!session_id || !payment_method) {
            return res.status(422).json({
                success: false,
                message: "Session ID and payment method are required",
            });
        }

        // Sync lost ticket status
        await sessionsRepo.syncLostTicketStatus(session_id);

        // Valid payment methods
        const validPaymentMethods = ["CASH", "CARD"];
        if (!validPaymentMethods.includes(payment_method)) {
            return res.status(422).json({
                success: false,
                message: "Invalid payment method",
            });
        }

        // Get session information
        const session = await sessionsRepo.getSession(session_id);
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Parking session not found",
            });
        }
        // Normalize is_lost to boolean
        session.is_lost =
            session.is_lost === true || session.is_lost === 1 || session.is_lost === "t" || session.is_lost === "true";

        // Check if session is already completed
        if (session.time_out) {
            return res.status(400).json({
                success: false,
                message: "This parking session is already completed",
            });
        }

        // Calculate parking duration and fee
        const currentTime = new Date();
        const checkInTime = new Date(session.time_in);
        let hours = Math.ceil(calculateHoursDifference(checkInTime, currentTime));
        
        // Validate reasonable parking duration (max 30 days = 720 hours)
        const MAX_PARKING_HOURS = 720;
        if (hours > MAX_PARKING_HOURS) {
            return res.status(400).json({
                success: false,
                message: `Parking duration exceeds maximum allowed (${MAX_PARKING_HOURS} hours / 30 days). Please contact administrator.`,
                hours: hours,
            });
        }
        
        let totalAmount = 0;
        let sub_id = null;
        if (session.is_monthly) {
            if (session.is_lost) {
                totalAmount = session.penalty_fee;
            } else totalAmount = 0;
        } else {
            serviceFee = parseFloat(session.service_fee);
            if (hours <= 1) {
                totalAmount = serviceFee;
            } else {
                totalAmount = serviceFee * hours;
            }
            if (session.is_lost && session.penalty_fee) {
                totalAmount += parseFloat(session.penalty_fee);
            }
        }
        
        // Final validation: ensure total amount doesn't exceed database limit
        const MAX_AMOUNT = 99999999.99; // NUMERIC(10,2) limit
        if (totalAmount > MAX_AMOUNT) {
            return res.status(400).json({
                success: false,
                message: `Calculated amount (${totalAmount.toFixed(2)}) exceeds maximum allowed (${MAX_AMOUNT}). Please contact administrator.`,
                hours: hours,
                totalAmount: totalAmount,
            });
        }

        // NOW create the payment record and update the session in one transaction
        const { payment, session: updatedSession } = await sessionsRepo.createAndConfirmPayment({
            session_id,
            sub_id: null,
            total_amount: totalAmount,
            payment_method,
            is_lost: session.is_lost,
        });

        res.status(200).json({
            success: true,
            message: "Checkout completed successfully",
            payment: {
                payment_id: payment.payment_id,
                session_id: payment.session_id,
                amount: payment.total_amount,
                method: payment.payment_method,
                paid_at: payment.payment_date,
            },
            session: {
                session_id: updatedSession.session_id,
                time_out: updatedSession.time_out,
            },
        });
    } catch (error) {
        console.error("Confirm checkout error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Get all active sessions for employee's parking lot
exports.getActiveSessions = async (req, res) => {
    try {
        // Get the parking lot managed by this employee
        const userId = req.session.user.user_id;
        const parkingLot = await lotsRepo.getParkingLotByManager(userId);

        if (!parkingLot) {
            return res.status(404).json({
                success: false,
                message: "You are not assigned to manage any parking lot",
            });
        }

        // Get active sessions for this lot
        const activeSessions = await sessionsRepo.getActiveSessionsByLot(parkingLot.lot_id);

        res.status(200).json({
            success: true,
            data: {
                lot_id: parkingLot.lot_id,
                lot_name: parkingLot.lot_name,
                sessions: activeSessions,
            },
        });
    } catch (error) {
        console.error("Get active sessions error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// Employee reports a lost ticket (standalone, not during checkout)
exports.reportLostTicket = async (req, res) => {
    const { session_id, guest_identification, guest_phone } = req.body;
    if (!session_id || !guest_identification || !guest_phone) {
        return res.status(400).json({
            success: false,
            message: "Missing required fields",
        });
    }
    try {
        const report = await sessionsRepo.reportLostTicket({ session_id, guest_identification, guest_phone });
        await sessionsRepo.syncLostTicketStatus(session_id); // Ensure is_lost is updated immediately
        return res.status(201).json({
            success: true,
            data: report,
            penalty_fee: report.penalty_fee,
        });
    } catch (error) {
        console.error("Report lost ticket error:", error);
        if (error.message === "A lost ticket report already exists for this session") {
            return res.status(409).json({
                success: false,
                message: error.message,
            });
        }
        if (error.message === "Session not found") {
            return res.status(404).json({
                success: false,
                message: error.message,
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.deleteLostTicket = async (req, res) => {
    const { session_id } = req.params;
    try {
        const deleted = await sessionsRepo.deleteLostTicketReportBySessionId(session_id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Lost ticket report not found" });
        }
        await pool.query(`UPDATE ParkingSessions SET is_lost = false WHERE session_id = $1`, [session_id]);
        res.status(200).json({ success: true, message: "Lost ticket report deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
