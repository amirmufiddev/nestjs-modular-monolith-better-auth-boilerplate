// Setup environment variables untuk testing
process.env.NODE_ENV = 'test';
process.env.PORT = '2001';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.BETTER_AUTH_SECRET =
  'test-secret-min-32-chars-here-for-testing-only';
process.env.BETTER_AUTH_URL = 'http://localhost:2001';
process.env.BETTER_AUTH_CLIENT_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_PATH = '/api/v1/auth';
process.env.FALLBACK_LANGUAGE = 'id';
process.env.CORS_ORIGINS = '*';
process.env.SMTP_HOST = 'smtp.example.com';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASSWORD = 'test-password';
process.env.SMTP_FROM = 'test@example.com';
process.env.SMTP_FROM_NAME = 'Test';
process.env.SMTP_FROM_EMAIL = 'test@example.com';
process.env.SMTP_FROM_PASSWORD = 'test-password';
process.env.SMTP_FROM_NAME = 'Test';
process.env.SMTP_FROM_EMAIL = 'test@example.com';
