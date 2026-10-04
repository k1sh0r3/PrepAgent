/* PrepAgent tests — heuristic judge. Run: node --test tests/ */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/questions.js');
require('../assets/judge.js');
const J = globalThis.PrepAgent.Judge;
const Q = globalThis.PrepAgent.Questions;

const GOOD_STAR = `The situation was that our nightly ETL pipeline started failing silently — no alerts, just stale dashboards each morning. My task as the pipeline owner was to find the root cause and stop the bleeding within a day. I built a dead-man's-switch check that compared row counts between source and warehouse, and I traced the failure to a schema change in the upstream API that our parser swallowed. The result was detection time dropping from 8 hours to under 10 minutes, and the check caught two more incidents that quarter.`;

const THIN = `I think regularization is like, basically when you um add a penalty to the model so it doesn't overfit. It's pretty useful stuff.`;

function q(cat, looksFor) {
  return { id: 't1', category: cat, q: 'test', followups: [], looksFor: looksFor || ['regularization', 'overfitting', 'penalty'] };
}

describe('judge basics', () => {
  it('scores are bounded 1-10 and deterministic', () => {
    for (const a of [GOOD_STAR, THIN, '', '   ']) {
      const r1 = J.scoreAnswer(q('behavioral'), a);
      const r2 = J.scoreAnswer(q('behavioral'), a);
      assert.ok(r1.score >= 1 && r1.score <= 10, 'score out of bounds: ' + r1.score);
      assert.deepEqual(r1, r2, 'scoring must be deterministic');
    }
  });

  it('a strong STAR answer outscores a thin one', () => {
    const good = J.scoreAnswer(q('behavioral'), GOOD_STAR).score;
    const thin = J.scoreAnswer(q('behavioral'), THIN).score;
    assert.ok(good > thin, `expected ${good} > ${thin}`);
    assert.ok(good >= 7, 'strong STAR answer should score >= 7, got ' + good);
  });

  it('empty answer scores 1', () => {
    assert.equal(J.scoreAnswer(q('behavioral'), '').score, 1);
  });
});

describe('structure analysis', () => {
  it('detects all four STAR beats', () => {
    const r = J.analyzeStructure(GOOD_STAR, 'behavioral');
    assert.equal(r.score, 10);
    assert.match(r.feedback[0], /all four beats/);
  });

  it('flags missing beats', () => {
    const r = J.analyzeStructure('I built a thing with Python. It was hard.', 'behavioral');
    assert.ok(r.score < 10);
    assert.match(r.feedback[0], /Missing/);
  });

  it('rewards problem->approach->outcome flow for technical answers', () => {
    const txt = 'The problem was embedding dilution in long chunks. My approach was to test six chunking strategies with retrieval scoring. The outcome was a 12-point hit-rate gain in production.';
    const r = J.analyzeStructure(txt, 'ml-system-design');
    assert.ok(r.score >= 9, 'expected high flow score, got ' + r.score);
  });
});

describe('length bands', () => {
  const cases = [
    ['', 0], ['too short', 2],
    [new Array(60).join('word '), 6],
    [new Array(180).join('word '), 10],
    [new Array(300).join('word '), 8],
    [new Array(500).join('word '), 5]
  ];
  for (const [txt, expected] of cases) {
    it(`band: ${J.wordCount(txt)} words -> ${expected}`, () => {
      assert.equal(J.analyzeLength(txt).score, expected);
    });
  }
});

describe('terminology overlap', () => {
  it('counts expected terms from looksFor', () => {
    const r = J.analyzeTerminology(
      'I used L2 regularization to fight overfitting by adding a penalty term.',
      ['regularization', 'overfitting', 'penalty', 'sparsity']);
    assert.ok(r.score >= 7, 'expected high term score, got ' + r.score);
    assert.ok(r.missed.includes('sparsity'));
  });

  it('scores 0 when nothing matches', () => {
    const r = J.analyzeTerminology('I like turtles.', ['regularization', 'overfitting', 'penalty']);
    assert.equal(r.score, 0);
  });
});

describe('clarity / filler words', () => {
  it('clean text scores 10', () => {
    assert.equal(J.analyzeClarity('The model overfits because capacity exceeds the signal in the data.').score, 10);
  });

  it('filler-heavy text is penalized with specifics', () => {
    const txt = 'So like, basically the model um just memorizes stuff, you know, and like it fails on new data basically.';
    const r = J.analyzeClarity(txt);
    assert.ok(r.score < 7, 'expected penalty, got ' + r.score);
    assert.ok(r.fillerCount > 0);
    assert.match(r.feedback[0], /filler words/);
  });
});

describe('per-dimension feedback', () => {
  it('every score returns four dimension scores + feedback lines', () => {
    const r = J.scoreAnswer(q('ml-fundamentals'), THIN);
    assert.deepEqual(Object.keys(r.dimensions).sort(), ['clarity', 'length', 'structure', 'terminology']);
    assert.ok(r.feedback.length >= 4);
    assert.ok(typeof r.words === 'number');
  });
});
