const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const { login, logout, me, register } = require("../controllers/auth.controller");
const { isAuthenticated, isNotAuthenticated } = require("../middlewares/auth.middleware");

// Rate limit: 10 attempts per 15 minutes per IP for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public routes
router.post("/login", authLimiter, isNotAuthenticated, login);
router.post("/register", authLimiter, isNotAuthenticated, register);

// Protected routes
router.post("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, me);

module.exports = router;
