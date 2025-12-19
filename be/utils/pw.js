const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const saltRounds = 10; // You can adjust the number of salt rounds as needed
    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        return hashedPassword;
    } catch (error) {
        console.error('Error hashing password:', error);
        throw error;
    }
}

async function verifyPassword(password, hashedPassword) {
    if (!password || !hashedPassword) {
        throw new Error('Both password and hashedPassword are required');
    }
    try {
        const match = await bcrypt.compare(password, hashedPassword);
        return match;
    } catch (error) {
        console.error('Error verifying password:', error);
        throw error;
    }
}

module.exports = {
    hashPassword,
    verifyPassword
};