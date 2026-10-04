/* PrepAgent tests — P2: Tavily research. Run: node --test tests/*.test.js */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/research.js');
const R = globalThis.PrepAgent.Research;

function stubTavily(results) {
  return async function (url, opts) {
    assert.ok(url.includes('api.tavily.ai'), 'must hit Tavily endpoint');
    const body = JSON.parse(opts.body);
    assert.ok(body.api_key, 'api key sent');
    assert.ok(body.query, 'query sent');
    return { ok: true, status: 200, json: async () => ({ results }) };
  };
}

describe('fetchTavilySearch', () => {
  it('returns null-key as no-key without fetching', async () => {
    let called = false;
    const out = await R.fetchTavilySearch('x', '', async () => { called = true; });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'no-key');
    assert.equal(called, false, 'no network without a key');
  });

  it('normalizes results', async () => {
    const out = await R.fetchTavilySearch('Anthropic news', 'tvly-test', stubTavily([
      { title: 'Anthropic raises', url: 'https://x.test/1', content: 'a'.repeat(500) },
      { title: '', url: '', content: 'junk' }
    ]));
    assert.equal(out.ok, true);
    assert.equal(out.results.length, 1, 'drops empty results');
    assert.ok(out.results[0].snippet.length <= 280, 'snippet truncated');
  });

  it('degrades gracefully on failure', async () => {
    const bad = await R.fetchTavilySearch('x', 'k', async () => ({ ok: false, status: 500 }));
    assert.equal(bad.ok, false);
    const down = await R.fetchTavilySearch('x', 'k', async () => { throw new Error('down'); });
    assert.equal(down.ok, false);
    assert.equal(down.reason, 'network');
  });
});

describe('fetchCompanyIntel', () => {
  it('merges news + interview queries, tolerating partial failure', async () => {
    let n = 0;
    const impl = async (url, opts) => {
      n++;
      const q = JSON.parse(opts.body).query;
      if (q.includes('interview')) throw new Error('flaky');
      return { ok: true, status: 200, json: async () => ({ results: [{ title: 'News!', url: 'https://x.test', content: 'c' }] }) };
    };
    const out = await R.fetchCompanyIntel('Anthropic', 'tvly-test', impl);
    assert.equal(n, 2, 'both queries attempted');
    assert.equal(out.ok, true, 'partial success still ok');
    assert.equal(out.news.length, 1);
    assert.equal(out.interviews.length, 0);
  });

  it('no key -> not ok, no fetch', async () => {
    let called = false;
    const out = await R.fetchCompanyIntel('x', '', async () => { called = true; });
    assert.equal(out.ok, false);
    assert.equal(called, false);
  });
});
