const dotenv = require("dotenv");

// Load environment variables before importing modules that read process.env at require-time
dotenv.config();

// Fail fast if critical secrets are missing
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET env var is required");
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const morgan = require("morgan");
const { pool, connectDB } = require("./config/db");
const { SESSION_MAX_AGE_MS } = require("./config/constants");

// Import routes
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const employeeRoutes = require("./routes/employee.routes");
const paymentRoutes = require("./routes/payment.routes");
const edgeRoutes = require("./routes/edge.routes");

// Initialize express app
const app = express();

// Connect to database
connectDB();

// Middleware
const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];
if (process.env.CLIENT_URL) {
    allowedOrigins.push(process.env.CLIENT_URL);
}

app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "x-edge-api-key"],
    })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Session configuration
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "lax",
            maxAge: SESSION_MAX_AGE_MS,
        },
    })
);

// Health check endpoint
app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(503).json({ status: "degraded", db: "unreachable", timestamp: new Date().toISOString() });
    }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/employee", employeeRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/edge", edgeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(JSON.stringify({
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.originalUrl,
        userId: req.session?.user?.id || null,
    }));
    res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
});

// Start server
if (require.main === module) {
    const PORT = process.env.PORT;
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
