import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { loadPolicy } from '../../scripts/wordpress-retirement-policy.mjs';
const policy = await loadPolicy();
const source = await fs.readFile('scripts/verify-wordpress-retirement-curl.mjs', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;

async function check({ after, deployed }) {
  const requests = [], files = new Map(), processMock = { argv: ['node', 'checker', ...(after ? ['--after-deployment'] : [])] };
  const modules = {
    'node:fs/promises': { mkdir: async () => {}, writeFile: async (file, content) => files.set(file, content) },
    'node:util': { promisify: fn => fn },
    'node:child_process': { execFile: async (program, args) => {
      assert.equal(program, 'curl.exe');
      assert.ok(args.includes('--head'));
      assert.ok(!args.includes('--location'));
      assert.ok(!args.some(arg => /authorization|cookie/i.test(arg)));
      const url = args.at(-1);
      requests.push(url);
      const decision = deployed ? policy.decide(url) : { status: 200 };
      return { stdout: `HTTP/2 ${decision.status}\r\n${decision.destination ? `Location: ${decision.destination}\r\n` : ''}Set-Cookie: test-private-value\r\n\r\n` };
    } },
    './wordpress-retirement-policy.mjs': { loadPolicy: async () => policy, origin: 'https://tuxar.co.uk' },
  };
  await vm.runInNewContext(`(async () => { ${code}\n })()`, { exports: {}, require: name => modules[name], process: processMock, URL, console: { log() {} } });
  const report = JSON.parse([...files].find(([file]) => file.endsWith('/report.json'))[1]);
  return { requests, files, report, processMock };
}

test('post-deployment curl checker stops before obsolete cart requests if server guards fail', async () => {
  const h = await check({ after: true, deployed: false });
  assert.equal(h.requests.length, 3);
  assert.equal(h.report.blocked, true);
  assert.equal(h.processMock.exitCode, 1);
  assert.ok(!h.requests.some(url => /add-to-cart/i.test(url)));
});

test('post-deployment checker verifies every saved legacy URL, pattern and exact redirect destination', async () => {
  const h = await check({ after: true, deployed: true });
  assert.equal(h.report.blocked, false);
  assert.equal(h.report.failures, 0);
  for (const row of policy.source.urls.filter(row => policy.decide(row.url).status !== 200)) assert.ok(h.requests.includes(row.url), row.url);
  for (const row of h.report.results.filter(row => row.expectedLocation)) assert.ok(h.requests.includes(row.expectedLocation), row.expectedLocation);
  assert.ok(h.report.results.some(row => row.label === 'Current route control' && row.url.includes('/en/checkout?')));
  assert.ok([...h.files].filter(([file]) => file.endsWith('.txt')).every(([, value]) => !value.includes('test-private-value')));
});

test('baseline curl collection never sends any obsolete add-to-cart query before deployment', async () => {
  const h = await check({ after: false, deployed: false });
  assert.ok(h.report.skipped > 0);
  assert.ok(!h.requests.some(url => /add.to.cart/i.test(decodeURIComponent(url))));
});
