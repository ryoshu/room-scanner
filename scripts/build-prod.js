#!/usr/bin/env node

import { build } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function buildProduction() {
  console.log('🚀 Building production version...');
  
  try {
    // Clean dist directory
    await fs.rm(resolve(rootDir, 'dist'), { recursive: true, force: true });
    console.log('✅ Cleaned dist directory');

    // Build with Vite
    await build({
      configFile: resolve(rootDir, 'vite.config.js'),
      mode: 'production'
    });

    console.log('✅ Production build complete!');
    console.log('📦 Files generated in ./dist/');
    
    // Show build stats
    await showBuildStats();
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function showBuildStats() {
  try {
    const distPath = resolve(rootDir, 'dist');
    const files = await fs.readdir(distPath, { recursive: true });
    
    console.log('\n📊 Build Statistics:');
    console.log('─'.repeat(50));
    
    for (const file of files) {
      const filePath = resolve(distPath, file);
      const stats = await fs.stat(filePath);
      
      if (stats.isFile()) {
        const sizeKB = (stats.size / 1024).toFixed(2);
        console.log(`${file.padEnd(30)} ${sizeKB.padStart(8)} KB`);
      }
    }
    
    console.log('─'.repeat(50));
    
  } catch (error) {
    console.log('Could not generate build stats:', error.message);
  }
}

// Run the build
buildProduction();