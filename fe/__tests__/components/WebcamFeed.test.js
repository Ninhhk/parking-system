import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WebcamFeed from '@/app/components/common/WebcamFeed';

// Mock getUserMedia
const mockGetUserMedia = jest.fn();
Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
        getUserMedia: mockGetUserMedia,
    },
    writable: true,
});

describe('WebcamFeed Component', () => {
    let mockOnCapture;
    let mockOnError;
    let mockStream;
    let mockTracks;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        mockOnCapture = jest.fn();
        mockOnError = jest.fn();

        // Mock media stream
        mockTracks = [
            { stop: jest.fn() },
            { stop: jest.fn() },
        ];

        mockStream = {
            getTracks: jest.fn(() => mockTracks),
        };

        // Mock canvas context
        HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
            drawImage: jest.fn(),
        }));

        HTMLCanvasElement.prototype.toDataURL = jest.fn(() =>
            'data:image/jpeg;base64,iVBORw0KG...'
        );

        HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const triggerVideoReady = async () => {
        await waitFor(() => {
            expect(document.querySelector('video')).toBeInTheDocument();
        });
        const video = document.querySelector('video');
        await waitFor(() => {
            expect(typeof video?.onloadedmetadata).toBe('function');
        });
        if (video && typeof video.onloadedmetadata === 'function') {
            await video.onloadedmetadata();
        }
    };

    it('should render component with title', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        expect(screen.getByText('Live Camera Feed')).toBeInTheDocument();
    });

    it('should request camera access on mount', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await waitFor(() => {
            expect(mockGetUserMedia).toHaveBeenCalledWith({
                video: expect.objectContaining({ facingMode: 'user' }),
                audio: false,
            });
        });
    });

    it('should show camera feed when permission is granted', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await triggerVideoReady();
        expect(document.querySelector('video')).toBeInTheDocument();
    });

    it('should show error when camera access is denied', async () => {
        const error = new Error('Permission denied');
        error.name = 'NotAllowedError';
        mockGetUserMedia.mockRejectedValue(error);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
        });

        expect(mockOnError).toHaveBeenCalled();
    });

    it('should show error when camera is unavailable', async () => {
        mockGetUserMedia.mockRejectedValue(
            new Error('Camera not found')
        );

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await waitFor(() => {
            expect(screen.getByText(/Unable to access camera/i)).toBeInTheDocument();
        });
    });

    it('should call onCapture with base64 image when capture button is clicked', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await triggerVideoReady();

        await waitFor(() => {
            const captureButton = screen.getByText('Capture License Plate');
            expect(captureButton).toBeEnabled();
        });

        const captureButton = screen.getByText('Capture License Plate');
        fireEvent.click(captureButton);

        await waitFor(() => {
            expect(mockOnCapture).toHaveBeenCalledWith(expect.stringContaining('data:image/jpeg'));
        });
    });

    it('should disable capture button when loading', () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        const { rerender } = render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        rerender(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={true}
                onError={mockOnError}
            />
        );

        const captureButton = screen.getByText(/Processing/i);
        expect(captureButton).toBeDisabled();
    });

    it('should stop camera stream when close button is clicked', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await triggerVideoReady();

        await waitFor(() => {
            const closeButton = screen.getByText('Close Camera');
            expect(closeButton).toBeInTheDocument();
        });

        const closeButton = screen.getByText('Close Camera');
        fireEvent.click(closeButton);

        expect(mockTracks[0].stop).toHaveBeenCalled();
        expect(mockTracks[1].stop).toHaveBeenCalled();
    });

    it('should cleanup streams on unmount', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        const { unmount } = render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await waitFor(() => {
            expect(mockGetUserMedia).toHaveBeenCalled();
        });

        unmount();

        expect(mockTracks[0].stop).toHaveBeenCalled();
        expect(mockTracks[1].stop).toHaveBeenCalled();
    });

    it('should show helpful tip about camera positioning', async () => {
        mockGetUserMedia.mockResolvedValue(mockStream);

        render(
            <WebcamFeed
                onCapture={mockOnCapture}
                isLoading={false}
                onError={mockOnError}
            />
        );

        await triggerVideoReady();

        await waitFor(() => {
            expect(screen.getByText(/Position the camera to clearly see/i)).toBeInTheDocument();
        });
    });
});
