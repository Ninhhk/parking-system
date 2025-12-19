const profileRepo = require('../repositories/employee.profile.repo');
const { hashPassword, verifyPassword } = require('../utils/pw');

exports.getMyProfile = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const profile = await profileRepo.getMyProfile(userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }
        res.status(200).json(profile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const userId = req.session.user.user_id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ message: 'Current and new passwords are required' });
        }

        const profile = await profileRepo.getMyProfile(userId);
        if (!profile) {
            return res.status(404).json({ message: 'Profile not found' });
        }        const isPasswordValid = await verifyPassword(current_password, profile.password_hash);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        const hashedNewPassword = await hashPassword(new_password);
        await profileRepo.changePassword(userId, hashedNewPassword);

        res.status(200).json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}