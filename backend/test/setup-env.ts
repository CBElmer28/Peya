process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://bankhub:bankhub_dev@localhost:5432/bankhub_test?schema=public';
process.env.JWT_SECRET = 'test-secret';
process.env.TRANSFER_LIMIT_PER_OPERATION = '20000';
process.env.TRANSFER_LIMIT_DAILY = '50000';
process.env.MAX_ACCOUNTS_PER_CLIENT = '4';
