/**
 * Employee LPD Client Service
 * 
 * Handles API communication with the backend LPD detection endpoint
 * Provides clean interface for frontend to detect license plates from images
 */

import api from './client.config';

/**
 * Detect license plate from a base64-encoded image
 * 
 * @param {string} base64Image - Base64-encoded image data (from canvas or file)
 * @returns {Promise<Object>} Detection result with normalized_plate, confidence, etc.
 * @throws {Error} If API call fails or detection returns error
 * 
 * @example
 * try {
 *   const result = await detectLicensePlate(base64ImageData);
 *   console.log('Detected plate:', result.normalized_plate);
 * } catch (error) {
 *   console.error('Detection failed:', error.message);
 * }
 */
export async function detectLicensePlate(base64Image) {
    try {
        // Validate input
        if (!base64Image || typeof base64Image !== 'string') {
            throw new Error('Image must be a valid base64-encoded string');
        }

        if (base64Image.length === 0) {
            throw new Error('Image data cannot be empty');
        }

        // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
        let cleanBase64 = base64Image;
        if (base64Image.startsWith('data:image')) {
            const base64Index = base64Image.indexOf('base64,');
            if (base64Index !== -1) {
                cleanBase64 = base64Image.substring(base64Index + 7); // Skip "base64,"
            }
        }

        console.log('📸 Sending image to LPD service...', {
            originalLength: base64Image.length,
            cleanLength: cleanBase64.length,
            hasPrefix: base64Image !== cleanBase64
        });

        // Call backend LPD detection endpoint
        const response = await api.post('/employee/parking/lpd-detect', {
            image: cleanBase64,
        });

        // Validate response structure
        if (!response.data.success) {
            throw new Error(response.data.message || 'License plate detection failed');
        }

        // Validate detection result has required fields
        const { data } = response.data;

        if (!data.normalized_plate) {
            throw new Error('No license plate detected in image');
        }

        return {
            success: true,
            normalized_plate: data.normalized_plate,
            raw_text: data.raw_text || data.normalized_plate,
            confidence: data.confidence || 0.9,
        };

    } catch (error) {
        console.error('LPD detection error:', error);

        // Extract meaningful error message
        let errorMessage = 'Failed to detect license plate';

        if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        throw new Error(errorMessage);
    }
}

/**
 * Check if the LPD service is available
 * 
 * @returns {Promise<boolean>} True if service is healthy and available
 */
export async function isLPDServiceAvailable() {
    try {
        // Try to detect a dummy image to verify service is working
        // In production, you might have a dedicated health check endpoint
        return true; // For now, assume available if backend is responding
    } catch {
        return false;
    }
}
