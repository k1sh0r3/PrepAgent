/* PrepAgent tests — P2: flag storage + category trends.
 * Run: node --test tests/*.test.js */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/memory.js');
const M = globalThis.PrepAgent.Memory;

describe('question flagging', () => {
  beforeEach(() => { M.clearAll(); M.unflagQuestion('b1'); M.unflagQuestion('f2'); });

  it('flags, queries, and unflags', () => {
    assert.deepEqual(M.getFlaggedIds(), []);
    M.flagQuestion('b1');
    M.flagQuestion('f2');
    assert.ok(M.isFlagged('b1'));
    assert.ok(!M.isFlagged('b3'));
    assert.deepEqual(M.getFlaggedIds().sort(), ['b1', 'f2']);
    M.flagQuestion('b1');
    assert.equal(M.getFlaggedIds().length, 2, 'no duplicates');
    M.unflagQuestion('b1');
    assert.deepEqual(M.getFlaggedIds(), ['f2']);
  });

  it('flags survive clearAll (they are question judgments, not session data)', () => {
    M.flagQuestion('b1');
    M.clearAll();
    assert.ok(M.isFlagged('b1'), 'flags persist across history clears');
    M.unflagQuestion('b1');
  });
});

describe('getCategoryTrends', () => {
  beforeEach(() => { M.clearAll(); });

  function sess(scoresByCat) {
    const questions = Object.entries(scoresByCat).map(([category, score], i) => ({
      id: 't' + category + i, category, score
    }));
    return { roundType: 'mixed', company: '', questions, overall: 5 };
  }

  it('returns empty with no sessions', () => {
    assert.deepEqual(M.getCategoryTrends(), {});
  });

  it('computes current vs previous with deltas', () => {
    M.saveSession(sess({ behavioral: 4, 'ml-fundamentals': 8 })); // older
    M.saveSession(sess({ behavioral: 8, 'ml-fundamentals': 6 })); // older
    M.saveSession(sess({ behavioral: 9, 'ml-fundamentals': 7 })); // latest
    const t = M.getCategoryTrends();
    assert.equal(t.behavioral.current, 9);
    assert.equal(t.behavioral.previous, 6, '(4+8)/2');
    assert.equal(t.behavioral.delta, 3);
    assert.equal(t['ml-fundamentals'].current, 7);
    assert.equal(t['ml-fundamentals'].delta, 0);
  });

  it('single session has null previous/delta', () => {
    M.saveSession(sess({ behavioral: 7 }));
    const t = M.getCategoryTrends();
    assert.equal(t.behavioral.current, 7);
    assert.equal(t.behavioral.previous, null);
    assert.equal(t.behavioral.delta, null);
  });
});
