/**
 * Hostinger Node.js Entry Point
 * 
 * This file redirects to the actual built server code in 'dist/server/server.js'.
 * Ensure you have run 'npm run server:build' before deploying.
 */

// Check if the built server file exists
const fs = require('fs');
const path = require('path');
const serverPath = path.join(__dirname, 'dist', 'server', 'server.js');

if (!fs.existsSync(serverPath)) {
    console.error('ERROR: dist/server/server.js not found!');
    console.error('Please run "npm run server:build" to compile your TypeScript code before running.');
    process.exit(1);
}

// Import and run the actual server
// The server.js file handles app.listen() automatically
require('./dist/server/server.js');
