/* PrepAgent tests — question bank integrity + selection logic. Run: node --test tests/ */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/questions.js');
const Q = globalThis.PrepAgent.Questions;

const EXPECTED_COUNTS = {
  'behavioral': 12,
  'ml-fundamentals': 12,
  'ml-system-design': 10,
  'resume-deep-dive': 10,
  'evals-guardrails': 8
};

describe('question bank integrity', () => {
  it('has all five categories with the spec\u2019d counts', () => {
    assert.deepEqual(Object.keys(Q.BANKS).sort(), Object.keys(EXPECTED_COUNTS).sort());
    for (const [cat, n] of Object.entries(EXPECTED_COUNTS)) {
      assert.equal(Q.BANKS[cat].length, n, cat + ' should have ' + n + ' questions');
    }
  });

  it('every question has id, text, 2+ followups, 1+ looksFor', () => {
    const ids = new Set();
    for (const [cat, bank] of Object.entries(Q.BANKS)) {
      for (const q of bank) {
        assert.ok(q.id && typeof q.id === 'string', 'missing id');
        assert.ok(!ids.has(q.id), 'duplicate id ' + q.id);
        ids.add(q.id);
        assert.ok(q.q && q.q.length > 20, q.id + ' text too short');
        assert.ok(Array.isArray(q.followups) && q.followups.length >= 2, q.id + ' needs 2+ followups');
        q.followups.forEach(f => assert.ok(f.length > 10, q.id + ' followup too short'));
        assert.ok(Array.isArray(q.looksFor) && q.looksFor.length >= 1, q.id + ' needs looksFor');
        assert.equal(Q.categoryOf(q.id), cat);
      }
    }
    assert.equal(ids.size, 52, 'bank should hold 52 questions total');
  });

  it('getQuestionById resolves every id', () => {
    assert.equal(Q.getQuestionById('r1').id, 'r1');
    assert.equal(Q.getQuestionById('g8').id, 'g8');
    assert.equal(Q.getQuestionById('nope'), null);
  });
});

describe('selectQuestions', () => {
  it('returns the requested count with unique ids', () => {
    const qs = Q.selectQuestions({ count: 8 });
    assert.equal(qs.length, 8);
    assert.equal(new Set(qs.map(q => q.id)).size, 8);
  });

  it('is deterministic for the same inputs', () => {
    const a = Q.selectQuestions({ roundType: 'behavioral', count: 6 }).map(q => q.id);
    const b = Q.selectQuestions({ roundType: 'behavioral', count: 6 }).map(q => q.id);
    assert.deepEqual(a, b);
  });

  it('roundType concentrates the matching category', () => {
    const qs = Q.selectQuestions({ roundType: 'ml-fundamentals', count: 8 });
    const n = qs.filter(q => q.category === 'ml-fundamentals').length;
    assert.ok(n >= 4, 'expected >=4 ml-fundamentals, got ' + n);
  });

  it('JD keywords boost the matching category', () => {
    const jd = 'We need system design for LLM inference at scale, plus red-teaming.';
    const qs = Q.selectQuestions({ roundType: 'mixed', jdText: jd, count: 8 });
    const cats = qs.map(q => q.category);
    assert.ok(cats.includes('ml-system-design') || cats.includes('evals-guardrails'),
      'JD keywords should surface system-design/evals, got ' + cats.join(','));
  });

  it('weak areas get boosted', () => {
    const weak = { 'evals-guardrails': 3.2 };
    const qs = Q.selectQuestions({ roundType: 'mixed', weakAreas: weak, count: 10 });
    const n = qs.filter(q => q.category === 'evals-guardrails').length;
    assert.ok(n >= 2, 'weak category should be boosted, got ' + n);
  });

  it('never repeats questions from recent sessions', () => {
    const recent = Q.BANKS['behavioral'].slice(0, 6).map(q => q.id);
    const qs = Q.selectQuestions({ roundType: 'behavioral', count: 6, excludeIds: recent });
    const overlap = qs.filter(q => recent.includes(q.id));
    assert.equal(overlap.length, 0, 'should exclude recent ids, got ' + overlap.map(q => q.id).join(','));
  });

  it('falls back gracefully when everything is excluded', () => {
    const all = [];
    Object.values(Q.BANKS).forEach(b => b.forEach(q => all.push(q.id)));
    const qs = Q.selectQuestions({ count: 5, excludeIds: all });
    assert.equal(qs.length, 5, 'should still return questions via fallback');
  });
});
