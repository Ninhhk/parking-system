const userRepo = require('../repositories/admin.users.repo');

exports.getAllUsers = async (req, res) => {
    try {
        const users = await userRepo.getAllUsers();
        res.status(200).json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.getAllFreeEmployees = async (req, res) => {
    try {
        const employees = await userRepo.getEmployees();
        res.status(200).json({
            success: true,
            data: employees
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await userRepo.getUserById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { username, password, full_name, role } = req.body;

        // Validate required fields
        if (!username || !password || !full_name || !role) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate role
        const validRoles = ['admin', 'employee'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const newUser = await userRepo.createUser({
            username,
            password,
            full_name,
            role
        });

        res.status(201).json({
            success: true,
            data: newUser
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, password, full_name, role } = req.body;

        // Validate required fields
        if (!username || !full_name || !role) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Validate role
        const validRoles = ['admin', 'employee'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        const updatedUser = await userRepo.updateUser(id, {
            username,
            password, // Optional
            full_name,
            role
        });

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await userRepo.deleteUser(id);

        if (!deletedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            data: deletedUser
        });
    } catch (error) {
        console.error('Delete user error:', error);
        if (error.message === 'Cannot delete user who is managing parking lots') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

exports.getAvailableEmployees = async (req, res) => {
    try {
        const employees = await userRepo.getEmployees();
        res.status(200).json({
            success: true,
            data: employees
        });
    } catch (error) {
        console.error('Get employees error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}; 