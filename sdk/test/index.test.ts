/**
 * Test Suite Entry Point
 *
 * This file runs all SDK tests
 */

// Import all test files to register them with bun test
import './utils/detect.test.js';
import './utils/config.test.js';
import './utils/video-storage.test.js';
import './utils/content-generator.test.js';
import './ai/config.test.js';
import './ai/openrouter.test.js';
import './ai/agents.test.js';

console.log('✅ All test suites loaded for @screenwright/sdk');
