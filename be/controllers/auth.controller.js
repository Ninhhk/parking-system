const bcrypt = require("bcrypt");
const authRepo = require("../repositories/auth.repo");

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username and password are required" });
        }

        // Get user data in single query
        const user = await authRepo.findUserByUsername(username);
        if (!user) {
            console.log(`Login attempt failed for username: ${username}`);
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            console.log(`Invalid password attempt for user: ${username}`);
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
            });
        }

        // Set session
        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
        };

        await new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

        console.log(`Successful login for user: ${req.session.user.username}`);
        res.status(200).json({
            success: true,
            message: "Login successful",
            data: { user: req.session.user },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.logout = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(400).json({
                success: false,
                message: "No active session found",
            });
        }
        const username = req.session.user.username;
        req.session.destroy((err) => {
            if (err) {
                console.error("Logout error:", err);
                return res.status(500).json({
                    success: false,
                    message: "Error during logout",
                });
            }

            console.log(`User ${username} logged out successfully`);
            res.status(200).json({
                success: true,
                message: "Logout successful",
            });
        });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

exports.me = (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            success: false,
            message: "Not authenticated",
        });
    }
    res.status(200).json({
        success: true,
        data: { user: req.session.user },
    });
};

exports.register = async (req, res) => {
    try {
        const { username, password, confirmPassword, full_name } = req.body;

        // --- Input validation ---
        if (!username || !password || !confirmPassword || !full_name) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({
                success: false,
                message: "Username must be between 3 and 50 characters",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
        }

        if (full_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Full name must be at least 2 characters",
            });
        }

        // --- Duplicate check ---
        const existingUser = await authRepo.findUserByUsername(username);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username already exists",
            });
        }

        // --- Create user (default role: employee) ---
        const newUser = await authRepo.createUser({
            username: username.trim(),
            password,
            full_name: full_name.trim(),
            role: "employee",
        });

        // --- Auto-login after registration ---
        req.session.user = {
            user_id: newUser.user_id,
            username: newUser.username,
            full_name: newUser.full_name,
            role: newUser.role,
        };

        await new Promise((resolve, reject) =>
            req.session.save((err) => (err ? reject(err) : resolve()))
        );

        console.log(`New user registered: ${newUser.username}`);
        res.status(201).json({
            success: true,
            message: "Registration successful",
            data: { user: req.session.user },
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
