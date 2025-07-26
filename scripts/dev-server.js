#!/usr/bin/env node

import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function startDevServer() {
  console.log('🛠️  Starting Vite development server...');
  
  try {
    const server = await createServer({
      configFile: resolve(rootDir, 'vite.config.js'),
      server: {
        port: 3000,
        host: true,
        open: true
      }
    });

    await server.listen();
    
    console.log('✅ Development server started!');
    console.log('🌐 Local:   http://localhost:3000');
    console.log('🌐 Network: http://[your-ip]:3000');
    console.log('');
    console.log('💡 Press Ctrl+C to stop the server');
    
  } catch (error) {
    console.error('❌ Failed to start development server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down development server...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  process.exit(0);
});

// Start the server
startDevServer();