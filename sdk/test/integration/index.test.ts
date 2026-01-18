/**
 * Integration Test Suite Entry Point
 *
 * These tests make REAL API calls and require OPENROUTER_API_KEY.
 *
 * Run with: bun test test/integration/index.test.ts
 * Or: bun run test:integration
 */

import './content-creator.integration.test.js';
import './scriptwriter.integration.test.js';

console.log('✅ Integration test suites loaded');
console.log('⚠️  Tests will be skipped if OPENROUTER_API_KEY is not set');
