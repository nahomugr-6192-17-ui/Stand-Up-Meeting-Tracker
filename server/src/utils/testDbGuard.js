/**
 * Test Database Safety Guard
 * Prevents automated tests from ever running against production or remote databases (such as Neon).
 */

export function validateTestDatabaseUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error(
      '[TEST SECURITY ERROR] No test database URL is configured. ' +
      'Please set TEST_DATABASE_URL to a dedicated local test database before running tests.'
    );
  }

  const trimmed = url.trim().toLowerCase();

  // Strict check: Refuse if target appears to be Neon or any remote cloud database
  const productionIndicators = [
    'neon.tech',
    'aws.neon.tech',
    'neondb',
    '.render.com',
    '.supabase.co',
    '.supabase.com',
    '.railway.app',
    'rds.amazonaws.com'
  ];

  for (const indicator of productionIndicators) {
    if (trimmed.includes(indicator)) {
      throw new Error(
        `[TEST SECURITY ERROR] Tests refused to run: database URL contains production indicator "${indicator}". ` +
        'Tests are strictly forbidden from running against production Neon or remote cloud databases.'
      );
    }
  }

  // Refuse if process.env.NODE_ENV is already set to production at invocation
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_TESTS) {
    throw new Error(
      '[TEST SECURITY ERROR] Tests refused to run: process.env.NODE_ENV is set to "production". ' +
      'Automated tests must never be invoked in production mode.'
    );
  }

  // Ensure target is local or explicitly contains a test database identifier
  const isLocalTarget = (
    trimmed.includes('localhost') ||
    trimmed.includes('127.0.0.1') ||
    trimmed.includes('::1') ||
    trimmed.includes('test')
  );

  if (!isLocalTarget) {
    throw new Error(
      '[TEST SECURITY ERROR] Tests refused to run: database URL does not target localhost or a dedicated test instance. ' +
      'Tests must only run against dedicated local test databases.'
    );
  }

  return true;
}

export default validateTestDatabaseUrl;

