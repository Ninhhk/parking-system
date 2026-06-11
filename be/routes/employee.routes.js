const express = require("express");
const router = express.Router();

const employeeController = require("../controllers/employee.controller");
const notiController = require("../controllers/admin.noti.controller");
const sessionsController = require("../controllers/employee.sessions.controller");
const lotsController = require("../controllers/admin.lots.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const monitorController = require("../controllers/employee.monitor.controller");
const profileController = require("../controllers/employee.profile.controller");
const lpdController = require("../controllers/employee.lpd.controller");
const employeePaymentController = require("../controllers/employee.payment.controller");
const edgeController = require("../controllers/employee.edge.controller");
const gatewayController = require("../controllers/employee.gateway.controller");
const sessionAuditController = require("../controllers/session.audit.controller");
const subscriptionController = require("../controllers/employee.subscription.controller");
const gateSettingsController = require("../controllers/admin.gateSettings.controller");

// Audit route — accessible by both employee and admin roles
router.get(
    "/audit/sessions",
    authMiddleware.isAuthenticated,
    authMiddleware.hasRole(["employee", "admin"]),
    sessionAuditController.getAuditSessions
);

// Gate settings — accessible by authenticated employees (and admin)
router.get(
    "/gate-settings",
    authMiddleware.isAuthenticated,
    authMiddleware.hasRole(["employee", "admin"]),
    gateSettingsController.getGateSettings
);

router.use(authMiddleware.isAuthenticated, authMiddleware.hasRole(["employee"]));

router.get("/", employeeController.getDashboard);

router.get("/monitor", monitorController.getMyLot);
router.get("/monitor/sessions", monitorController.getMyParkingSessions);

router.get("/notifications", notiController.getAllNotifications);
router.get("/notifications/:id", notiController.getNotificationById);

// Parking lots route
router.get("/parking-lots", lotsController.getAllParkingLots);

// Parking sessions routes
router.get("/parking-sessions", sessionsController.getActiveSessions);
router.post("/parking-sessions", sessionsController.checkInVehicle);
router.post("/lost-tickets", sessionsController.reportLostTicket);
router.delete("/lost-tickets/:session_id", sessionsController.deleteLostTicket);

// New entry/exit API endpoints
router.post("/parking/entry", sessionsController.checkInVehicle);
router.post("/parking/entry/rfid", sessionsController.checkInByRfid);
router.get("/parking/exit/by-card/:card_uid", sessionsController.findActiveSessionByCard);
router.get("/parking/exit/:session_id", sessionsController.initiateCheckout);
router.post("/parking/exit/confirm", sessionsController.confirmCheckout);
router.post("/parking/exit/:session_id/payment-intents", employeePaymentController.createIntent);
router.post(
    "/parking/exit/:session_id/payment-intents/regenerate",
    employeePaymentController.regenerateIntent
);
router.get("/parking/exit/:session_id/payment-status", employeePaymentController.getPaymentStatus);
router.post("/parking/exit/:session_id/exit-image", sessionsController.uploadExitImage);
router.post("/parking/edge/checkin-event", edgeController.ingestCheckinEvent);
router.get("/sessions/:session_id/image-presigned", sessionsController.getImagePresignedUrl);

// Profile routes
router.get("/profile", profileController.getMyProfile);
router.put("/profile", profileController.changePassword);

// Gateway config route
router.get("/gateway-config/:lane_id", gatewayController.getLaneConfig);

// Subscription lookup route
router.get("/subscription/by-card/:card_uid", subscriptionController.getByCard);

// License Plate Detection routes
router.post("/parking/lpd-detect", lpdController.detectLicensePlate);

module.exports = router;
