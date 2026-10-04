/* PrepAgent tests — P2: difficulty weighting, flagging exclusion, follow-up sharpness.
 * Run: node --test tests/*.test.js */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/questions.js');
const Q = globalThis.PrepAgent.Questions;

describe('difficulty levels', () => {
  it('every question carries a level 1-3', () => {
    for (const [cat, bank] of Object.entries(Q.BANKS)) {
      for (const q of bank) {
        assert.ok([1, 2, 3].includes(q.level), q.id + ' needs level 1-3, got ' + q.level);
      }
    }
  });

  it('senior selects harder questions than junior', () => {
    const jr = Q.selectQuestions({ roundType: 'mixed', difficulty: 'junior', count: 10 });
    const sr = Q.selectQuestions({ roundType: 'mixed', difficulty: 'senior', count: 10 });
    const avg = qs => qs.reduce((a, q) => a + q.level, 0) / qs.length;
    assert.ok(avg(sr) > avg(jr), 'senior avg level ' + avg(sr) + ' should exceed junior ' + avg(jr));
  });

  it('defaults to mid on unknown difficulty', () => {
    const a = Q.selectQuestions({ difficulty: 'nonsense', count: 5 }).map(q => q.id);
    const b = Q.selectQuestions({ difficulty: 'mid', count: 5 }).map(q => q.id);
    assert.deepEqual(a, b);
  });

  it('selected questions expose their level', () => {
    const qs = Q.selectQuestions({ count: 3 });
    qs.forEach(q => assert.ok([1, 2, 3].includes(q.level), q.id + ' missing level'));
  });
});

describe('flagged exclusion', () => {
  it('flaggedIds are excluded like recent ids', () => {
    const flagged = ['b1', 'f1', 's1'];
    const qs = Q.selectQuestions({ count: 10, flaggedIds: flagged });
    const overlap = qs.filter(q => flagged.includes(q.id));
    assert.equal(overlap.length, 0, 'flagged questions must not be selected');
  });

  it('flagged + excluded combined still returns count', () => {
    const many = Object.values(Q.BANKS).flat().slice(0, 40).map(q => q.id);
    const qs = Q.selectQuestions({ count: 8, excludeIds: many.slice(0, 20), flaggedIds: many.slice(20) });
    assert.equal(qs.length, 8);
  });
});

describe('pickFollowup', () => {
  const q = Q.getQuestionById('b4'); // 2 followups

  it('junior/mid take follow-ups in order', () => {
    assert.equal(Q.pickFollowup(q, 0, 'junior'), q.followups[0]);
    assert.equal(Q.pickFollowup(q, 1, 'mid'), q.followups[1]);
  });

  it('senior takes the sharpest remaining follow-up first', () => {
    assert.equal(Q.pickFollowup(q, 0, 'senior'), q.followups[q.followups.length - 1]);
    assert.equal(Q.pickFollowup(q, 1, 'senior'), q.followups[q.followups.length - 2]);
  });

  it('clamps gracefully and handles empty lists', () => {
    assert.equal(Q.pickFollowup(q, 99, 'junior'), q.followups[q.followups.length - 1]);
    assert.equal(Q.pickFollowup({ followups: [] }, 0, 'senior'), null);
  });
});
