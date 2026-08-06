import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import('../security.js');
const security = globalThis.CardWizardSecurity;

test('HTML metacharacters are escaped', () => {
  assert.equal(
    security.escapeHtml(`<img src=x onerror="alert('x')">`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'
  );
});

test('unsafe and credential-bearing URLs are rejected', () => {
  assert.equal(security.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(security.safeHttpUrl('data:text/html,<script>alert(1)</script>'), '');
  assert.equal(security.safeHttpUrl('https://user:password@example.com/card'), '');
  assert.equal(security.safeHttpUrl('https://example.com/card'), 'https://example.com/card');
  assert.equal(security.safeImageUrl('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.match(security.safeImageUrl('data:image/png;base64,iVBORw0KGgo='), /^data:image\/png/);
});

test('protected API authentication fails closed without configuration', async () => {
  const source = await readFile(new URL('../api/_auth.js', import.meta.url), 'utf8');
  assert.match(source, /if \(!adminTokenConfigured\(\) \|\| !sql\) return false/);
  assert.doesNotMatch(source, /if \(!adminTokenConfigured\(\)\) return true/);
});

test('deployment config sets core browser security headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = new Map(config.headers[0].headers.map(({ key, value }) => [key, value]));
  assert.match(headers.get('Content-Security-Policy'), /object-src 'none'/);
  assert.match(headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'DENY');
  assert.ok(headers.has('Strict-Transport-Security'));
});

test('external windows are opened only by the noopener utility', async () => {
  const files = ['index.html', 'cardmarket-helper.js', 'price-helper.js', 'tcg-api-ui.js'];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:window\.)?open\([^\n]*['_"]_blank['"]/, file);
  }
  const utility = await readFile(new URL('../security.js', import.meta.url), 'utf8');
  assert.match(utility, /noopener,noreferrer/);
  assert.match(utility, /opened\.opener = null/);
});
