const express = require("express");
const router = express.Router();
const { login, logout, me, register } = require("../controllers/auth.controller");
const { isAuthenticated, isNotAuthenticated } = require("../middlewares/auth.middleware");

// Public routes
router.post("/login", isNotAuthenticated, login);
router.post("/register", isNotAuthenticated, register);

// Protected routes
router.post("/logout", isAuthenticated, logout);
router.get("/me", isAuthenticated, me);

module.exports = router;
