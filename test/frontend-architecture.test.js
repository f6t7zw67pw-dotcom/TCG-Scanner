import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production entrypoint is a Vite TypeScript module', () => {
  const html = read('index.html');
  assert.match(html, /type="module" src="\/src\/main\.tsx"/);
  assert.doesNotMatch(html, /<script src="[^\"]+-helper\.js"/);
});

test('modular frontend does not patch browser APIs', () => {
  const source = fs.readdirSync(path.join(root, 'src'), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => read(path.relative(root, path.join(entry.parentPath, entry.name))))
    .join('\n');
  assert.doesNotMatch(source, /window\.fetch\s*=/);
  assert.doesNotMatch(source, /Storage\.prototype/);
  assert.doesNotMatch(source, /MutationObserver/);
});

test('all required product areas have explicit components', () => {
  for (const file of ['ScannerView.tsx', 'CollectionView.tsx', 'AccountView.tsx', 'HistoryView.tsx', 'DatabaseView.tsx', 'HelpView.tsx']) {
    assert.equal(fs.existsSync(path.join(root, 'src', 'components', file)), true, `${file} fehlt`);
  }
});

test('legacy collection and cloud cursor keys remain compatible', () => {
  const source = read('src/lib/storage.ts');
  assert.match(source, /'cw_collection'/);
  assert.match(source, /'cw_cloud_cursor'/);
});

test('multi-lot scanning uses bounded concurrency', () => {
  assert.match(read('src/components/ScannerView.tsx'), /runLimited\(crops, 3,/);
});
