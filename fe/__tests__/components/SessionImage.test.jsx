import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SessionImage from '@/app/components/common/SessionImage';

// Mock the api module
jest.mock('@/app/api/client.config', () => ({
    __esModule: true,
    default: {
        get: jest.fn(),
    },
}));

import api from '@/app/api/client.config';

describe('SessionImage Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders "No image available" when objectKey is null', () => {
        render(
            <SessionImage objectKey={null} type="in" sessionId="sess-1" />
        );

        expect(screen.getByText('No image available')).toBeInTheDocument();
    });

    it('shows loading indicator while fetching presigned URL', async () => {
        // Never resolve the API call so it stays in loading state
        api.get.mockReturnValue(new Promise(() => {}));

        render(
            <SessionImage objectKey="lot-1/2024-01-01/sess-1_in.jpg" type="in" sessionId="sess-1" />
        );

        // The spinner has animate-spin class
        await waitFor(() => {
            expect(document.querySelector('.animate-spin')).toBeInTheDocument();
        });
    });

    it('renders image on successful presigned URL load', async () => {
        api.get.mockResolvedValue({
            data: { data: { url: 'http://localhost:9000/parking-images/signed-url' } },
        });

        render(
            <SessionImage objectKey="lot-1/2024-01-01/sess-1_in.jpg" type="in" sessionId="sess-1" />
        );

        await waitFor(() => {
            const img = screen.getByAltText('Check-in image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'http://localhost:9000/parking-images/signed-url');
        });
    });

    it('shows retry button when image fails to load', async () => {
        api.get.mockResolvedValue({
            data: { data: { url: 'http://localhost:9000/parking-images/signed-url' } },
        });

        render(
            <SessionImage objectKey="lot-1/2024-01-01/sess-1_in.jpg" type="in" sessionId="sess-1" />
        );

        // Wait for image to render
        await waitFor(() => {
            expect(screen.getByAltText('Check-in image')).toBeInTheDocument();
        });

        // Simulate image load error
        const img = screen.getByAltText('Check-in image');
        fireEvent.error(img);

        await waitFor(() => {
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });
    });

    it('shows permanent error after 3 failures', async () => {
        api.get.mockResolvedValue({
            data: { data: { url: 'http://localhost:9000/parking-images/signed-url' } },
        });

        render(
            <SessionImage objectKey="lot-1/2024-01-01/sess-1_in.jpg" type="in" sessionId="sess-1" />
        );

        // Wait for image to render
        await waitFor(() => {
            expect(screen.getByAltText('Check-in image')).toBeInTheDocument();
        });

        // First error → shows retry (retryCount becomes 1)
        const img = screen.getByAltText('Check-in image');
        fireEvent.error(img);

        await waitFor(() => {
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });

        // Click retry → retryCount becomes 2, fetches again
        fireEvent.click(screen.getByText('Retry'));

        await waitFor(() => {
            expect(screen.getByAltText('Check-in image')).toBeInTheDocument();
        });

        // Second error → shows retry (retryCount becomes 3 → failed)
        fireEvent.error(screen.getByAltText('Check-in image'));

        await waitFor(() => {
            expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
        });

        // No retry button should be present
        expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('uses correct alt text for type="out"', async () => {
        api.get.mockResolvedValue({
            data: { data: { url: 'http://localhost:9000/parking-images/signed-url' } },
        });

        render(
            <SessionImage objectKey="lot-1/2024-01-01/sess-1_out.jpg" type="out" sessionId="sess-1" />
        );

        await waitFor(() => {
            expect(screen.getByAltText('Check-out image')).toBeInTheDocument();
        });
    });
});
