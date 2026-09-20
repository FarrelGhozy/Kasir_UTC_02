module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 60000,
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'bot/**/*.js',
    'routes/**/*.js',
    'config/**/*.js',
    '!node_modules/**',
    '!tests/**',
    '!test_*.js',
    '!seed*.js'
  ],
  coverageThreshold: {
    global: {
      statements: 80,
      lines: 80
    }
  }
};
