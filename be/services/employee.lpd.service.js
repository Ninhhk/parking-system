const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LPD_SERVICE_URL = process.env.LPD_API_URL || 'http://localhost:8000';
const LPD_DETECT_ENDPOINT = '/api/detect';
const LPD_TIMEOUT = parseInt(process.env.LPD_TIMEOUT || '30000', 10);

/**
 * Employee LPD Service
 * Handles communication with Python LPD (License Plate Detection) service
 */

/**
 * Detects license plate from a base64-encoded image
 * 
 * @param {string} base64Image - Base64-encoded image data
 * @returns {Promise<{success: boolean, normalized_plate: string, raw_text: string, confidence: number}>}
 * @throws {Error} If image is invalid or plate detection fails
 */
exports.detectPlateFromImage = async (base64Image) => {
    try {
        // Validate base64 format
        if (!isValidBase64(base64Image)) {
            throw new Error('Invalid base64 format');
        }

        // Convert base64 to buffer to validate it's actual image data
        const buffer = Buffer.from(base64Image, 'base64');
        
        if (buffer.length === 0) {
            throw new Error('Image data is empty');
        }

        // Call Python LPD service
        const response = await axios.post(
            `${LPD_SERVICE_URL}${LPD_DETECT_ENDPOINT}`,
            {
                image: base64Image,
            },
            {
                timeout: LPD_TIMEOUT,
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        );

        // Validate response structure
        if (!response.data || !response.data.success) {
            const errorMessage = response.data?.error || 'Plate detection failed';
            throw new Error(errorMessage);
        }

        // Extract detection result
        const { normalized_plate, raw_text, confidence } = response.data;

        if (!normalized_plate) {
            throw new Error('No license plate detected in image');
        }

        return {
            success: true,
            normalized_plate,
            raw_text: raw_text || normalized_plate,
            confidence: confidence || 0.9,
        };

    } catch (error) {
        console.error('LPD Service error:', error.message);

        // Surface HTTP errors from the Python service with its message
        if (error.response) {
            const status = error.response.status;
            const serviceMessage =
                error.response.data?.error ||
                error.response.data?.message ||
                `LPD service responded with status ${status}`;

            const wrappedError = new Error(serviceMessage);
            wrappedError.status = status;
            throw wrappedError;
        }

        // Re-throw with more context
        if (error.code === 'ECONNREFUSED') {
            throw new Error(
                'LPD service unavailable. Please ensure the Python service is running.'
            );
        }

        if (error.code === 'ENOTFOUND') {
            throw new Error(
                'Cannot reach LPD service. Check LPD_SERVICE_URL configuration.'
            );
        }

        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new Error('LPD service request timed out');
        }

        // Pass through detection-specific errors
        throw error;
    }
};

/**
 * Validates if a string is in valid base64 format
 * 
 * @param {string} str - String to validate
 * @returns {boolean} True if valid base64
 */
function isValidBase64(str) {
    try {
        if (typeof str !== 'string') return false;
        
        // Base64 regex pattern
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        
        if (!base64Regex.test(str)) {
            return false;
        }

        // Additional validation: try to decode
        Buffer.from(str, 'base64');
        return true;
    } catch {
        return false;
    }
}

/**
 * Health check for LPD service
 * 
 * @returns {Promise<boolean>} True if service is healthy
 */
exports.healthCheck = async () => {
    try {
        const response = await axios.get(
            `${LPD_SERVICE_URL}/health`,
            {
                timeout: 5000,
            }
        );

        return response.status === 200;
    } catch {
        return false;
    }
};
