const sessionsRepo = require("../repositories/employee.sessions.repo");
const feeConfigRepo = require("../repositories/admin.feeConfig.repo");
const lotsRepo = require("../repositories/admin.lots.repo");
const { getToday } = require("../utils/date");
const { calculateAndValidateFee } = require("../services/feeCalculation.service");
const { LICENSE_PLATE_REGEX, VALID_PAYMENT_METHODS } = require("../config/constants");
const checkoutService = require("../services/checkout.service");

// Vehicle Entry - Create a new parking session
exports.checkInVehicle = async (req, res) => {
    try {
        const {
            license_plate: raw_license_plate,
            card_uid,
            etag_epc,
            entry_lane_id,
            image_in_url,
            metadata_in,
            vehicle_type,
            lot_id, // We still accept this but will verify against employee's assigned lot
        } = req.body;

        const { sanitizePlate } = require("../utils/licensePlate");
        const license_plate = sanitizePlate(raw_license_plate);

        const hasIdentity = !!(license_plate || card_uid || etag_epc);

        // Validate required fields
        if (!vehicle_type || !hasIdentity) {
            return res.status(422).json({
                success: false,
                message: "Missing required fields",
            });
        }

        // Validate license plate format (alphanumeric with optional hyphen)
        if (license_plate && !LICENSE_PLATE_REGEX.test(license_plate)) {
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

        // Check if vehicle has a monthly subscription
        let is_monthly = false;
        if (license_plate) {
            const today = getToday();
            const monthlyPass = await sessionsRepo.checkMonthlySub(license_plate, today);
            is_monthly = !!monthlyPass;
        }

        // Create new session with the employee's assigned lot
        // Atomic capacity check happens at database level
        let newSession;
        try {
            const startSessionPayload = {
                lot_id: parkingLot.lot_id,
                license_plate: license_plate || null,
                vehicle_type,
                is_monthly,
            };

            if (card_uid !== undefined) {
                startSessionPayload.card_uid = card_uid;
            }
            if (etag_epc !== undefined) {
                startSessionPayload.etag_epc = etag_epc;
            }
            if (entry_lane_id !== undefined) {
                startSessionPayload.entry_lane_id = entry_lane_id;
            }
            if (image_in_url !== undefined) {
                startSessionPayload.image_in_url = image_in_url;
            }
            if (metadata_in !== undefined) {
                startSessionPayload.metadata_in = metadata_in;
            }

            newSession = await sessionsRepo.startSession(startSessionPayload);
        } catch (error) {
            // Handle unique constraint violation (duplicate active session)
            if (
                error.code === "23505" &&
                [
                    "uq_active_session_plate",
                    "uq_active_session_card_uid",
                    "uq_active_session_etag_epc",
                ].includes(error.constraint)
            ) {
                return res.status(409).json({
                    success: false,
                    message: "This vehicle already has an active session",
                });
            }
            if (error.code === "LOT_NOT_FOUND") {
                return res.status(404).json({
                    success: false,
                    message: error.message || "Parking lot not found",
                });
            }
            throw error; // Re-throw other errors
        }

        // If newSession is null, parking lot is at capacity
        if (!newSession) {
            return res.status(409).json({
                success: false,
                message: `Parking lot is full for ${vehicle_type.toLowerCase()}s`,
            });
        }

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

        // Use centralized fee calculation service
        const feeResult = calculateAndValidateFee(session);

        if (!feeResult.success) {
            return res.status(400).json({
                success: false,
                message: feeResult.error,
                hours: feeResult.hours,
                totalAmount: feeResult.totalAmount,
            });
        }

        // Don't create a pending payment yet - just return the calculated info
        res.status(200).json({
            success: true,
            message: "Checkout information retrieved",
            amount: feeResult.totalAmount,
            hours: feeResult.hours,
            serviceFee: feeResult.serviceFee,
            penaltyFee: feeResult.penaltyFee,
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

        // Validate payment method using constants
        if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
            return res.status(422).json({
                success: false,
                message: "Invalid payment method",
            });
        }

        if (payment_method === "CARD") {
            return res.status(409).json({
                success: false,
                message: "CARD payment must be completed via QR and webhook",
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

        // Use centralized fee calculation service (same as initiateCheckout)
        const feeResult = calculateAndValidateFee(session);

        if (!feeResult.success) {
            return res.status(400).json({
                success: false,
                message: feeResult.error,
                hours: feeResult.hours,
                totalAmount: feeResult.totalAmount,
            });
        }

        const cashResult = await checkoutService.confirmCashCheckout({
            sessionId: Number(session_id),
            totalAmount: feeResult.totalAmount,
            isLost: session.is_lost,
            paymentMethod: payment_method,
        });

        res.status(200).json({
            success: true,
            message: "Checkout completed successfully",
            payment: {
                session_id: Number(session_id),
                amount: feeResult.totalAmount,
                method: payment_method,
                paid_at: new Date().toISOString(),
            },
            session: {
                session_id: Number(session_id),
                time_out: cashResult.finalized ? new Date().toISOString() : session.time_out,
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
        // Use repository method instead of direct pool access (DIP compliance)
        await sessionsRepo.clearLostTicketStatus(session_id);
        res.status(200).json({ success: true, message: "Lost ticket report deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
