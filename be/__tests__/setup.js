/**
 * Jest Setup File
 * Runs before tests
 */

// Suppress console logs during tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LPD_API_URL = 'http://localhost:8000';
process.env.LPD_TIMEOUT = '30000';
