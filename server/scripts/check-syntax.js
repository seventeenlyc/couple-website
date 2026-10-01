import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...getJsFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

const targetDirs = ['src', 'scripts'].map(d => path.join(rootDir, d));
let totalChecked = 0;
let errors = 0;

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) continue;
  const files = getJsFiles(dir);
  for (const file of files) {
    totalChecked++;
    const res = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
    if (res.status !== 0) {
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`Syntax check failed: ${errors} error(s) found across ${totalChecked} files.`);
  process.exit(1);
} else {
  console.log(`✔ All ${totalChecked} JavaScript files passed syntax check.`);
}
