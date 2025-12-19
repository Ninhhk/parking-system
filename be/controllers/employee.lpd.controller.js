const lpdService = require('../services/employee.lpd.service');

/**
 * Detects license plate from a base64-encoded image
 * 
 * Request body:
 * {
 *   image: string (base64-encoded image data)
 * }
 * 
 * Response on success (200):
 * {
 *   success: true,
 *   data: {
 *     normalized_plate: string,
 *     raw_text: string,
 *     confidence: number (0-1),
 *     success: boolean
 *   }
 * }
 */
exports.detectLicensePlate = async (req, res) => {
    try {
        // Validate authentication
        if (!req.session || !req.session.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized: User not authenticated',
            });
        }

        // Validate request body
        const { image } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Image data is required',
            });
        }

        // Validate image is a string
        if (typeof image !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Image must be a base64-encoded string',
            });
        }

        // Call LPD service
        const detectionResult = await lpdService.detectPlateFromImage(image);

        return res.status(200).json({
            success: true,
            data: detectionResult,
        });

    } catch (error) {
        console.error('LPD detection error:', error);

        // Handle specific error types
        if (error.message.includes('Invalid base64')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image format or encoding',
            });
        }

        if (error.message.includes('Image data is empty')) {
            return res.status(400).json({
                success: false,
                message: 'Image data is empty or unreadable',
            });
        }

        if (error.message.includes('No license plate detected')) {
            return res.status(422).json({
                success: false,
                message: error.message,
            });
        }

        if (
            error.message.includes('LPD service unavailable') ||
            error.message.includes('Cannot reach LPD service')
        ) {
            return res.status(503).json({
                success: false,
                message: error.message,
            });
        }

        if (error.message.includes('LPD service request timed out')) {
            return res.status(504).json({
                success: false,
                message: error.message,
            });
        }

        // Pass through service-provided status codes when available
        if (error.status) {
            return res.status(error.status).json({
                success: false,
                message: error.message || 'LPD service error',
            });
        }

        // Generic error handling
        return res.status(500).json({
            success: false,
            message: 'Failed to process license plate detection',
        });
    }
};
