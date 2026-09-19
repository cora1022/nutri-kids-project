import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSourceRoot = path.resolve(scriptDirectory, '../../frontend/src');
const sourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : defaultSourceRoot;
const legacyExtensions = new Set(['.js', '.jsx']);
const typedExtensions = new Set(['.ts', '.tsx']);
const sourceExtensions = new Set([...legacyExtensions, ...typedExtensions]);

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(entryPath));
    } else {
      files.push(entryPath);
    }
  }

  return files;
}

const groups = new Map();

for (const file of await collectFiles(sourceRoot)) {
  const extension = path.extname(file);
  if (!sourceExtensions.has(extension)) continue;

  const relativePath = path.relative(sourceRoot, file);
  const modulePath = relativePath.slice(0, -extension.length).split(path.sep).join('/');
  const entries = groups.get(modulePath) ?? [];
  entries.push({ extension, relativePath });
  groups.set(modulePath, entries);
}

const duplicates = [...groups.entries()].filter(([, entries]) => {
  const hasLegacy = entries.some(({ extension }) => legacyExtensions.has(extension));
  const hasTyped = entries.some(({ extension }) => typedExtensions.has(extension));
  return hasLegacy && hasTyped;
});

if (duplicates.length > 0) {
  console.error('JavaScript와 TypeScript 소스가 같은 모듈 경로에 중복되어 있습니다.');
  for (const [modulePath, entries] of duplicates) {
    console.error(`- ${modulePath}: ${entries.map(({ relativePath }) => relativePath).join(', ')}`);
  }
  process.exit(1);
}

console.log('중복된 JavaScript와 TypeScript 모듈이 없습니다.');
