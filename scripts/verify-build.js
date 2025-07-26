#!/usr/bin/env node

import fs from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

async function verifyBuild() {
  console.log('🔍 Verifying build integrity...');
  
  const distDir = resolve(rootDir, 'dist');
  const requiredFiles = [
    'index.html',
    'assets', // Directory containing bundled assets
  ];
  
  const requiredDirs = [
    'models',
    'data'
  ];

  try {
    // Check if dist directory exists
    await fs.access(distDir);
    console.log('✅ dist/ directory exists');

    // Check required files
    for (const file of requiredFiles) {
      const filePath = resolve(distDir, file);
      try {
        await fs.access(filePath);
        console.log(`✅ ${file} exists`);
      } catch {
        console.error(`❌ Missing: ${file}`);
        return false;
      }
    }

    // Check required directories
    for (const dir of requiredDirs) {
      const dirPath = resolve(distDir, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          console.log(`✅ ${dir}/ directory exists`);
        } else {
          console.error(`❌ ${dir} is not a directory`);
          return false;
        }
      } catch {
        console.error(`❌ Missing directory: ${dir}/`);
        return false;
      }
    }

    // Check ONNX models
    const modelsDir = resolve(distDir, 'models');
    const modelFiles = await fs.readdir(modelsDir);
    const onnxFiles = modelFiles.filter(f => f.endsWith('.onnx'));
    
    if (onnxFiles.length > 0) {
      console.log(`✅ Found ${onnxFiles.length} ONNX model files`);
    } else {
      console.error('❌ No ONNX model files found');
      return false;
    }

    // Check index.html content
    const indexPath = resolve(distDir, 'index.html');
    const indexContent = await fs.readFile(indexPath, 'utf-8');
    
    if (indexContent.includes('type="module"')) {
      console.log('✅ index.html contains module scripts');
    } else {
      console.error('❌ index.html missing module scripts');
      return false;
    }

    // Get build size
    const stats = await getBuildStats(distDir);
    console.log(`\n📊 Build Statistics:`);
    console.log(`Total files: ${stats.fileCount}`);
    console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

    console.log('\n✅ Build verification passed!');
    return true;

  } catch (error) {
    console.error('❌ Build verification failed:', error.message);
    return false;
  }
}

async function getBuildStats(distDir) {
  let fileCount = 0;
  let totalSize = 0;

  async function scanDirectory(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      
      if (entry.isDirectory()) {
        await scanDirectory(fullPath);
      } else {
        fileCount++;
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }
  }

  await scanDirectory(distDir);
  return { fileCount, totalSize };
}

// Run verification
verifyBuild().then(success => {
  process.exit(success ? 0 : 1);
});