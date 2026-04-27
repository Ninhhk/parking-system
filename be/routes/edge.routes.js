const express = require("express");

const edgeEventsController = require("../controllers/edge.events.controller");
const { requireEdgeApiKey } = require("../middlewares/edge.auth.middleware");
const authMiddleware = require("../middlewares/auth.middleware");

const router = express.Router();

router.post("/events/ingest", requireEdgeApiKey, edgeEventsController.ingestEvent);
router.post(
    "/events/:eventId/retry",
    authMiddleware.isAuthenticated,
    authMiddleware.hasAnyRole(["employee", "admin"]),
    edgeEventsController.retryEvent
);
router.get(
    "/events",
    authMiddleware.isAuthenticated,
    authMiddleware.hasAnyRole(["employee", "admin"]),
    edgeEventsController.listEvents
);
router.get(
    "/events/:eventId",
    authMiddleware.isAuthenticated,
    authMiddleware.hasAnyRole(["employee", "admin"]),
    edgeEventsController.getEventDetail
);
router.get(
    "/sessions/active",
    authMiddleware.isAuthenticated,
    authMiddleware.hasAnyRole(["employee", "admin"]),
    edgeEventsController.getActiveSessions
);

module.exports = router;
