const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-'));
const server = require('../src/server');

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => server.close());

const call = (p, method = 'GET', body) =>
  fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });

test('health endpoint works', async () => {
  assert.strictEqual((await call('/health')).status, 200);
});

test('profile rejects invalid email', async () => {
  assert.strictEqual((await call('/api/profile', 'PUT', { name: 'A', email: 'bad' })).status, 400);
});

test('skills rank internships by match', async () => {
  await call('/api/profile', 'PUT', { name: 'Asha', email: 'asha@test.com', skills: 'docker, jenkins, git, linux, yaml' });
  const list = await (await call('/api/internships')).json();
  assert.strictEqual(list[0].title, 'DevOps Intern');
  assert.strictEqual(list[0].match.score, 100);
});

test('apply, update status and block duplicates', async () => {
  const a = await (await call('/api/applications', 'POST', { internshipId: 2 })).json();
  assert.strictEqual(a.status, 'Applied');
  assert.strictEqual((await call('/api/applications', 'POST', { internshipId: 2 })).status, 409);
  const u = await (await call('/api/applications/' + a.id, 'PATCH', { status: 'Interview' })).json();
  assert.strictEqual(u.status, 'Interview');
});

test('static server serves index and blocks path traversal', async () => {
  assert.strictEqual((await call('/')).status, 200);
  assert.strictEqual((await call('/..%2fpackage.json')).status, 404);
  assert.strictEqual((await call('/../package.json')).status, 404);
});

test('unknown application id returns 404', async () => {
  assert.strictEqual((await call('/api/applications/999', 'PATCH', { status: 'Offer' })).status, 404);
});
