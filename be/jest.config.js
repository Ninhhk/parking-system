module.exports = {
    testEnvironment: 'node',
    collectCoverageFrom: [
        'controllers/**/*.js',
        'services/**/*.js',
        'repositories/**/*.js',
        'routes/**/*.js',
        '!**/__tests__/**',
        '!**/node_modules/**',
    ],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/tests/',
        '__tests__',
    ],
    testMatch: [
        '**/__tests__/**/*.test.js',
        '**/?(*.)+(spec|test).js',
    ],
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
    verbose: true,
    testTimeout: 10000,
};
