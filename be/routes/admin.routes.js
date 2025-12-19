const express = require("express");
const router = express.Router();

// Import controllers
const adminController = require("../controllers/admin.controller");
const adminUsersController = require("../controllers/admin.users.controller");
const adminLotsController = require("../controllers/admin.lots.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const adminMonthlySubsController = require("../controllers/admin.monthlysubs.controller");
const adminPaymentController = require("../controllers/admin.payment.controller");
const adminFeeConfigController = require("../controllers/admin.feeConfig.controller");
const adminNotiController = require("../controllers/admin.noti.controller");
const adminLostTicketController = require("../controllers/admin.lostticket.controller");
const adminAnalyticsController = require("../controllers/admin.analytics.controller");

// Middleware for all admin routes
router.use(authMiddleware.isAuthenticated, authMiddleware.hasRole(["admin"]));

// Dashboard
router.get("/", adminController.getDashboard);

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

// Monthly Subs Management
router.get("/monthly-subs", adminMonthlySubsController.getAllMonthlySubs);
router.post("/monthly-subs", adminMonthlySubsController.createMonthlySub);
router.delete("/monthly-subs/:id", adminMonthlySubsController.deleteMonthlySub);

// Payments Management
router.get("/payments", adminPaymentController.getAllPayments);

// Fee Configurations
router.get("/fee-config", adminFeeConfigController.getAllFeeConfigs);
router.post("/fee-config", adminFeeConfigController.setServiceFee);

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

module.exports = router;
