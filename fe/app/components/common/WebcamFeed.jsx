/**
 * WebcamFeed Component
 * 
 * Displays a live webcam feed with capture functionality
 * Uses native browser getUserMedia API for camera access
 * 
 * Props:
 * - onCapture: callback function called with base64 image data
 * - isLoading: boolean to disable capture during processing
 * - onError: callback function called on camera errors
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { FaCamera, FaTimes } from 'react-icons/fa';

export default function WebcamFeed({ onCapture, isLoading, onError }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [isCameraReady, setIsCameraReady] = useState(false);
    const [error, setError] = useState(null);
    const [cameraPermission, setCameraPermission] = useState('requesting');
    const streamRef = useRef(null);

    useEffect(() => {
        let mounted = true;

        const startCamera = async () => {
            try {
                console.log('🎥 Requesting camera access...');
                if (mounted) {
                    setError(null);
                    setCameraPermission('requesting');
                }

                // Check if getUserMedia is supported
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error('Camera API not supported in this browser');
                }

                // Request camera access
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user', // Use front camera for desktop
                    },
                    audio: false,
                });

                console.log('✅ Camera stream obtained:', stream.active);

                if (!mounted) {
                    console.log('⚠️ Component unmounted, cleaning up stream');
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                streamRef.current = stream;

                // Video element is now always in DOM, safe to access
                if (!videoRef.current) {
                    console.error('❌ Video element ref not available');
                    if (mounted) {
                        setError('Video element not ready. Please try again.');
                        setCameraPermission('denied');
                    }
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                const video = videoRef.current;
                video.srcObject = stream;
                console.log('📹 Video srcObject set');
                
                // Wait for metadata to be loaded before playing
                video.onloadedmetadata = async () => {
                    console.log('📊 Video metadata loaded');
                    if (!mounted) return;
                    
                    try {
                        await video.play();
                        console.log('▶️ Video playing');
                        
                        if (mounted) {
                            setIsCameraReady(true);
                            setCameraPermission('granted');
                        }
                    } catch (playError) {
                        console.error('❌ Video play error:', playError);
                        if (mounted) {
                            setError('Failed to start video. Please try again.');
                            setCameraPermission('denied');
                        }
                    }
                };
            } catch (err) {
                console.error('❌ Camera access error:', err);
                const errorMessage = err.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access to use this feature.'
                    : `Unable to access camera: ${err.message}`;

                if (mounted) {
                    setError(errorMessage);
                    setCameraPermission('denied');
                    onError?.(errorMessage);
                }
            }
        };

        // Start camera after a brief delay to ensure component is fully mounted
        const timer = setTimeout(() => {
            if (mounted) {
                startCamera();
            }
        }, 100);

        return () => {
            console.log('🧹 Cleanup running...');
            clearTimeout(timer);
            mounted = false;
            
            // Cleanup: stop camera stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                console.log('🛑 Camera stopped');
                streamRef.current = null;
            }
            
            // Clear video source
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [onError]);

    const captureImage = () => {
        if (!videoRef.current || !canvasRef.current || !isCameraReady) {
            setError('Camera is not ready. Please wait...');
            return;
        }

        try {
            const context = canvasRef.current.getContext('2d');

            // Set canvas dimensions to match video
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;

            // Draw video frame to canvas
            context.drawImage(
                videoRef.current,
                0,
                0,
                canvasRef.current.width,
                canvasRef.current.height
            );

            // Convert canvas to base64 image
            const base64Image = canvasRef.current.toDataURL('image/jpeg', 0.95);

            onCapture(base64Image);
        } catch (err) {
            console.error('Capture error:', err);
            setError('Failed to capture image. Please try again.');
            onError?.('Failed to capture image');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setIsCameraReady(false);
        setCameraPermission('requesting');
        setError(null);
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-blue-600 text-white px-6 py-4">
                <h2 className="text-xl font-semibold flex items-center">
                    <FaCamera className="mr-3" />
                    Live Camera Feed
                </h2>
                <p className="text-blue-100 text-sm">Point at the license plate and capture</p>
            </div>

            <div className="p-6">
                {/* Error State */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start">
                        <div className="flex-1">
                            <p className="text-red-800 font-medium">Camera Error</p>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-600 hover:text-red-800 ml-4"
                        >
                            <FaTimes />
                        </button>
                    </div>
                )}

                {/* Permission Denied State */}
                {cameraPermission === 'denied' && !error && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                        <p className="text-yellow-800 font-medium">Camera Access Required</p>
                        <p className="text-yellow-700 text-sm mt-1">
                            Please enable camera permissions in your browser settings to use plate detection.
                        </p>
                    </div>
                )}

                {/* Video Container - Always rendered */}
                <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ aspectRatio: '16/9' }}>
                    {/* Video element - always in DOM */}
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        style={{ opacity: cameraPermission === 'granted' ? 1 : 0 }}
                    />

                    {/* Loading Overlay */}
                    {cameraPermission === 'requesting' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                                <p className="text-white font-medium">Requesting camera access...</p>
                            </div>
                        </div>
                    )}

                    {/* Permission Denied Overlay */}
                    {cameraPermission === 'denied' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                            <div className="text-center px-4">
                                <FaTimes className="text-red-500 text-5xl mx-auto mb-4" />
                                <p className="text-white font-medium">Camera Access Denied</p>
                            </div>
                        </div>
                    )}

                    {/* Success State - Frame Overlays */}
                    {cameraPermission === 'granted' && (
                        <>
                            {/* Frame Overlay */}
                            <div className="absolute inset-0 border-4 border-green-400 pointer-events-none rounded-lg opacity-50" />

                            {/* License Plate Area Indicator */}
                            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 w-4/5 h-20 border-4 border-yellow-300 rounded-lg pointer-events-none opacity-40" />
                        </>
                    )}
                </div>

                {/* Capture Button */}
                <button
                    onClick={captureImage}
                    disabled={!isCameraReady || isLoading}
                    className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center transition ${
                        isCameraReady && !isLoading
                            ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                            Processing...
                        </>
                    ) : (
                        <>
                            <FaCamera className="mr-2" />
                            Capture License Plate
                        </>
                    )}
                </button>

                {/* Close Camera Button */}
                <button
                    onClick={stopCamera}
                    disabled={isLoading}
                    className="w-full mt-2 py-2 px-4 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition disabled:opacity-50"
                >
                    Close Camera
                </button>

                {/* Camera Info */}
                {cameraPermission === 'granted' && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                            <span className="font-medium">Tip:</span> Position the camera to clearly see the entire license plate. The yellow box indicates the ideal plate area.
                        </p>
                    </div>
                )}

                {/* Hidden Canvas for image capture */}
                <canvas ref={canvasRef} className="hidden" />
            </div>
        </div>
    );
}
