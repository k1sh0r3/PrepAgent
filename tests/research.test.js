/* PrepAgent tests — research (mocked fetch) + memory (shim store). Run: node --test tests/ */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/research.js');
require('../assets/memory.js');
const R = globalThis.PrepAgent.Research;
const M = globalThis.PrepAgent.Memory;

function mockFetch(payload, status) {
  return async function (url) {
    assert.ok(url.startsWith('https://en.wikipedia.org/api/rest_v1/page/summary/'), 'unexpected URL ' + url);
    return {
      ok: status >= 200 && status < 300,
      status: status,
      json: async () => payload
    };
  };
}

describe('research.parseSummary', () => {
  it('parses a good summary', () => {
    const r = R.parseSummary({
      title: 'Anthropic', extract: 'Anthropic is an AI safety company.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Anthropic' } }
    });
    assert.equal(r.ok, true);
    assert.equal(r.title, 'Anthropic');
    assert.ok(r.url.includes('Anthropic'));
  });

  it('flags disambiguation pages', () => {
    const r = R.parseSummary({ type: 'disambiguation', title: 'Nova' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'disambiguation');
  });

  it('rejects empty extracts', () => {
    assert.equal(R.parseSummary({ title: 'X' }).ok, false);
  });
});

describe('research.fetchCompanySummary (mocked)', () => {
  it('returns a summary on 200', async () => {
    const r = await R.fetchCompanySummary('Anthropic', mockFetch({
      title: 'Anthropic', extract: 'Anthropic is an AI safety company.',
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Anthropic' } }
    }, 200));
    assert.equal(r.ok, true);
    assert.equal(r.title, 'Anthropic');
  });

  it('maps 404 to not-found', async () => {
    const r = await R.fetchCompanySummary('No Such Company Xyz', mockFetch({}, 404));
    assert.deepEqual(r, { ok: false, reason: 'not-found' });
  });

  it('handles network failure gracefully', async () => {
    const r = await R.fetchCompanySummary('Anthropic', async () => { throw new Error('down'); });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'network');
  });

  it('rejects empty queries without fetching', async () => {
    let called = false;
    const r = await R.fetchCompanySummary('   ', async () => { called = true; });
    assert.equal(r.reason, 'empty-query');
    assert.equal(called, false);
  });

  it('briefingLine produces a fact + interview angle', () => {
    const bl = R.briefingLine({ ok: true, title: 'Anthropic', extract: 'Anthropic is an AI safety company. It was founded in 2021.' }, 'AI Engineer');
    assert.ok(bl.fact.startsWith('Anthropic is an AI safety company.'));
    assert.match(bl.angle, /Anthropic/);
    assert.equal(R.briefingLine({ ok: false }, 'x'), null);
  });
});

describe('memory', () => {
  beforeEach(() => { M.clearAll(); });

  it('saves and reads sessions newest-first', () => {
    M.saveSession({ roundType: 'mixed', company: 'Acme', questions: [{ id: 'b1', category: 'behavioral', score: 8 }], overall: 8 });
    M.saveSession({ roundType: 'mixed', company: 'Beta', questions: [{ id: 'f1', category: 'ml-fundamentals', score: 5 }], overall: 5 });
    const s = M.getSessions();
    assert.equal(s.length, 2);
    assert.equal(s[0].company, 'Beta');
  });

  it('caps stored sessions at 20', () => {
    for (let i = 0; i < 25; i++) M.saveSession({ questions: [], overall: 5 });
    assert.equal(M.getSessions().length, 20);
  });

  it('computes rolling weak areas per category', () => {
    M.saveSession({ questions: [{ id: 'b1', category: 'behavioral', score: 8 }, { id: 'b2', category: 'behavioral', score: 6 }], overall: 7 });
    M.saveSession({ questions: [{ id: 'g1', category: 'evals-guardrails', score: 3 }], overall: 3 });
    const w = M.getWeakAreas();
    assert.equal(w['behavioral'], 7);
    assert.equal(w['evals-guardrails'], 3);
    const weakest = M.weakestCategories(1);
    assert.equal(weakest[0].category, 'evals-guardrails');
  });

  it('returns recent question ids for exclusion', () => {
    M.saveSession({ questions: [{ id: 'b1', category: 'behavioral', score: 8 }] });
    M.saveSession({ questions: [{ id: 'f1', category: 'ml-fundamentals', score: 8 }] });
    const ids = M.getRecentQuestionIds(3);
    assert.deepEqual(ids.sort(), ['b1', 'f1']);
  });

  it('clearAll wipes history', () => {
    M.saveSession({ questions: [], overall: 5 });
    M.clearAll();
    assert.deepEqual(M.getSessions(), []);
    assert.deepEqual(M.getWeakAreas(), {});
  });
});
