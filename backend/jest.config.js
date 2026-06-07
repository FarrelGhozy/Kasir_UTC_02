module.exports = {
  testEnvironment: 'node',
  setupFilesAfterSetup: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  verbose: true,
  testTimeout: 60000,
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    'services/**/*.js',
    '!node_modules/**'
  ]
};
