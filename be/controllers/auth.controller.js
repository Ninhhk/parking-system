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
