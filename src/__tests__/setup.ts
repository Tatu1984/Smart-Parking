import '@testing-library/jest-dom'

// Mock environment variables for tests
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-characters-long'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.DETECTION_API_KEY = 'test-detection-api-key'
process.env.NODE_ENV = 'test'
