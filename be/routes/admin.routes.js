const express = require("express");
const router = express.Router();

// Import controllers
const adminController = require("../controllers/admin.controller");
const adminUsersController = require("../controllers/admin.users.controller");
const adminLotsController = require("../controllers/admin.lots.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminPaymentController = require("../controllers/admin.payment.controller");
const adminFeeConfigController = require("../controllers/admin.feeConfig.controller");
const adminNotiController = require("../controllers/admin.noti.controller");
const adminLostTicketController = require("../controllers/admin.lostticket.controller");
const adminAnalyticsController = require("../controllers/admin.analytics.controller");
const adminCameraController = require("../controllers/admin.camera.controller");
const adminParkingCardsController = require("../controllers/admin.parkingCards.controller");
const gateSettingsController = require("../controllers/admin.gateSettings.controller");
const checkoutSettingsController = require("../controllers/admin.checkoutSettings.controller");
const sessionAuditController = require("../controllers/session.audit.controller");
const adminBatchController = require("../controllers/admin.batch.controller");
const upload = require("../middlewares/upload.middleware");

const { hasPermission } = require("../middlewares/auth.middleware");

// Middleware for all admin routes
router.use(authMiddleware.isAuthenticated, authMiddleware.hasRole(["admin"]));

// Dashboard
router.get("/", adminController.getDashboard);

// Session Audit — read-only historical session viewer
router.get("/audit/sessions", sessionAuditController.getAuditSessions);

// Users Management
router.get("/users", adminUsersController.getAllUsers);
router.get("/users/free-employees", adminUsersController.getAllFreeEmployees);
router.get("/users/:id", adminUsersController.getUserById);
router.post("/users", adminUsersController.createUser);
router.put("/users/:id", adminUsersController.updateUser);
router.delete("/users/:id", adminUsersController.deleteUser);
router.get("/employees/available", adminUsersController.getAvailableEmployees);

// Parking Lots Management
router.get("/parking-lots", adminLotsController.getAllParkingLots);
router.get("/parking-lots/:id", adminLotsController.getParkingLotById);
router.get("/parking-lots/:id/sessions", adminLotsController.getLotParkingSessions);
router.post("/parking-lots", adminLotsController.createParkingLot);
router.put("/parking-lots/:id", adminLotsController.updateParkingLot);
router.delete("/parking-lots/:id", adminLotsController.deleteParkingLot);

// Lost Tickets Management
router.get("/lost-tickets", adminLostTicketController.getAllLostTicketReports);
router.get("/lost-tickets/:id", adminLostTicketController.getLostTicketReportById);
router.delete("/lost-tickets/:id", adminLostTicketController.deleteLostTicketReport);

// Payments Management
router.get("/payments", adminPaymentController.getAllPayments);

// Fee Configurations (legacy — unchanged)
router.get("/fee-config", adminFeeConfigController.getAllFeeConfigs);
router.post("/fee-config", adminFeeConfigController.setServiceFee);

// Fee Config v2 — versioned engine endpoints
router.get("/fee-config/versions", adminFeeConfigController.listVersions);
router.get("/fee-config/active", adminFeeConfigController.getActive);
router.post("/fee-config/versions", hasPermission("can_edit_fees"), adminFeeConfigController.createVersion);

// Notifications Management
router.get("/notifications", adminNotiController.getAllNotifications);
router.get("/notifications/:id", adminNotiController.getNotificationById);
router.post("/notifications", adminNotiController.createNotification);
router.delete("/notifications/:id", adminNotiController.deleteNotification);
router.put("/notifications/:id", adminNotiController.updateNotification);

// Analytics
router.get("/analytics/stats", adminAnalyticsController.getOverallStats);
router.get("/analytics/revenue", adminAnalyticsController.getRevenueData);
router.get("/analytics/occupancy", adminAnalyticsController.getParkingLotOccupancy);
router.get("/analytics/popular-times", adminAnalyticsController.getPopularTimes);
router.get("/analytics/vehicle-usage", adminAnalyticsController.getVehicleUsage);
router.get("/analytics/parking-duration", adminAnalyticsController.getParkingDuration);

// Cameras Management
router.get("/cameras", adminCameraController.listCameras);
router.get("/cameras/lanes", adminCameraController.getAvailableLanes);
router.post("/cameras", adminCameraController.createCamera);
router.get("/cameras/status", adminCameraController.getCameraStatus);
router.get("/cameras/:camera_id", adminCameraController.getCameraById);
router.put("/cameras/:camera_id", adminCameraController.updateCamera);
router.delete("/cameras/:camera_id", adminCameraController.deleteCamera);
router.post("/cameras/:camera_id/modules", adminCameraController.enableModule);
router.delete("/cameras/:camera_id/modules/:module_type", adminCameraController.disableModule);

// Gate Settings
router.get("/gate-settings", gateSettingsController.getGateSettings);
router.put("/gate-settings", gateSettingsController.updateGateSettings);

// Checkout Settings
router.get("/checkout-settings", checkoutSettingsController.getCheckoutSettings);
router.put("/checkout-settings", checkoutSettingsController.updateCheckoutSettings);

// Card Pool Management
router.get("/parking-cards", adminParkingCardsController.listCards);
router.get("/parking-cards/inventory", adminParkingCardsController.getInventory);
router.post("/parking-cards", adminParkingCardsController.createCard);
router.patch("/parking-cards/:card_uid/status", adminParkingCardsController.setStatus);
router.delete("/parking-cards/:card_uid", adminParkingCardsController.deleteCard);
router.patch("/parking-cards/:card_uid/monthly", adminParkingCardsController.updateMonthly);
router.get("/parking-cards/:card_uid/holder", adminParkingCardsController.getHolder);
router.put("/parking-cards/:card_uid/holder", adminParkingCardsController.upsertHolder);
router.delete("/parking-cards/:card_uid/holder", adminParkingCardsController.deleteHolder);

// Batch Import/Export
router.get("/import/:entity/template", adminBatchController.downloadTemplate);

function handleUpload(req, res, next) {
    upload.single("file")(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(422).json({ success: false, message: "File exceeds the 5 MB size limit" });
            }
            return res.status(422).json({ success: false, message: err.message || "File upload error" });
        }
        next();
    });
}

router.post("/import/cards/preview", handleUpload, adminBatchController.previewCards);
router.post("/import/cards/commit", handleUpload, adminBatchController.commitCards);
router.post("/import/subs/preview", handleUpload, adminBatchController.previewSubs);
router.post("/import/subs/commit", handleUpload, adminBatchController.commitSubs);

router.get("/export/cards", adminBatchController.exportCards);
router.get("/export/subs", adminBatchController.exportSubs);
router.get("/export/sessions", adminBatchController.exportSessions);
router.get("/export/payments", adminBatchController.exportPayments);

module.exports = router;
