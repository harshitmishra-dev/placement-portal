const test = require('node:test');
const assert = require('node:assert');
const { matchSkills, normalize } = require('../src/match');

test('normalize trims, lowercases and removes duplicates', () => {
  assert.deepStrictEqual(normalize(' HTML, css ,html'), ['html', 'css']);
});

test('full match gives 100', () => {
  assert.strictEqual(matchSkills(['docker', 'git'], ['Docker', 'Git']).score, 100);
});

test('partial match gives correct percentage and missing skills', () => {
  const r = matchSkills(['html', 'css'], ['html', 'css', 'javascript', 'react']);
  assert.strictEqual(r.score, 50);
  assert.deepStrictEqual(r.missing, ['javascript', 'react']);
});

test('no skills gives 0', () => {
  assert.strictEqual(matchSkills([], ['java']).score, 0);
});
