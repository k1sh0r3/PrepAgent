/* PrepAgent P1 GATE — full mock session end-to-end with ZERO api keys.
 * Exercises only deterministic paths: sample data -> Wikipedia (stubbed fetch)
 * -> template selection -> heuristic scoring -> follow-ups -> report -> memory.
 * Run: node --test tests/ */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/questions.js');
require('../assets/judge.js');
require('../assets/memory.js');
require('../assets/research.js');
require('../assets/resume.js');
require('../assets/app.js');

const PA = globalThis.PrepAgent;
const { Questions, Judge, Memory, Research, Resume, App } = PA;

/* Canned answers: good STAR behavioral, solid technical, thin (triggers follow-up). */
const ANSWERS = {
  behavioral: 'The situation was that our nightly ETL pipeline started failing silently, with stale dashboards every morning. My task as pipeline owner was to find the root cause within a day. I built a dead-man\'s-switch row-count check between source and warehouse and traced it to a swallowed upstream schema change. The result was detection time dropping from 8 hours to under 10 minutes, and the check caught two more incidents that quarter.',
  technical: 'The core problem is embedding dilution: a long chunk about many topics averages into a blurry vector nothing retrieves strongly. My approach would be to benchmark chunking strategies — fixed, recursive, semantic — with retrieval scoring on real queries, and pick by hit rate rather than vibes. I would evaluate with a golden set of questions and track precision at k before and after any change.',
  thin: 'I think it is like, basically important stuff. Um, you just need to be careful.'
};

function answerFor(category, attempt) {
  if (attempt > 0) return ANSWERS.technical; // recovery answer on follow-up
  if (category === 'behavioral') return ANSWERS.behavioral;
  if (attempt === 0 && category === 'evals-guardrails') return ANSWERS.thin; // force one follow-up path
  return ANSWERS.technical;
}

function stubWiki() {
  return async function () {
    return {
      ok: true, status: 200,
      json: async () => ({
        title: 'Anthropic',
        extract: 'Anthropic is an American AI safety and research company.',
        content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Anthropic' } }
      })
    };
  };
}

describe('P1 gate: full no-key mock session', () => {
  beforeEach(() => { Memory.clearAll(); });

  it('runs setup -> research -> interview -> report with zero keys', async () => {
    /* --- setup: sample data, no keys anywhere --- */
    const resume = Resume.parseResumeText(App.SAMPLE_RESUME);
    const jd = Resume.extractSignals(App.SAMPLE_JD);
    assert.ok(resume.skills.length > 0, 'sample resume should yield skills');
    assert.ok(jd.roundHints.length > 0, 'sample JD should yield round hints');

    /* --- research: stubbed Wikipedia, no network, no key --- */
    const info = await Research.fetchCompanySummary('Anthropic', stubWiki());
    assert.equal(info.ok, true);
    assert.ok(Research.briefingLine(info, 'AI Software Engineer').angle.length > 0);

    /* --- generate: deterministic template selection --- */
    const weak = Memory.getWeakAreas();
    const exclude = Memory.getRecentQuestionIds(3);
    const questions = Questions.selectQuestions({
      roundType: 'mixed', jdText: jd.text, weakAreas: weak, excludeIds: exclude, count: 5
    });
    assert.equal(questions.length, 5);

    /* --- interview loop: ask -> answer -> score -> follow-up if < 6 (max 2) --- */
    const scored = [];
    let followupsTriggered = 0;
    for (const q of questions) {
      let best = null, followupsUsed = 0;
      for (let attempt = 0; attempt <= 2; attempt++) {
        const text = attempt === 0 ? q.q : q.followups[Math.min(followupsUsed, q.followups.length - 1)];
        const result = Judge.scoreAnswer(
          { category: q.category, looksFor: q.looksFor }, answerFor(q.category, attempt));
        if (!best || result.score > best.result.score) best = { result };
        if (result.score >= 6 || followupsUsed >= 2 || followupsUsed >= q.followups.length) break;
        followupsUsed++;
        followupsTriggered++;
      }
      scored.push({ question: q, result: best.result, followupsUsed });
    }
    assert.ok(followupsTriggered > 0, 'expected at least one follow-up path exercised, got none');

    /* --- report --- */
    const report = App.buildReport(scored);
    assert.equal(report.perQuestion.length, 5);
    assert.ok(report.overall >= 1 && report.overall <= 10);
    assert.ok(report.signal.label.length > 0, 'signal label present');
    assert.ok(report.weakAreas.length > 0 && report.weakAreas.length <= 3);
    assert.ok(report.drills.length >= 1 && report.drills.length <= 3, 'drills present');
    report.perQuestion.forEach(p => {
      assert.ok(p.score >= 1 && p.score <= 10);
      assert.ok(p.feedback.length >= 4, 'each question needs explainable feedback');
    });

    /* --- memory: session saved, weak areas feed next session --- */
    const saved = Memory.saveSession({
      roundType: 'mixed', company: 'Anthropic',
      questions: report.perQuestion, overall: report.overall
    });
    assert.equal(Memory.getSessions().length, 1);
    assert.ok(Object.keys(Memory.getWeakAreas()).length > 0);
    const again = Questions.selectQuestions({
      roundType: 'mixed', jdText: jd.text,
      weakAreas: Memory.getWeakAreas(),
      excludeIds: Memory.getRecentQuestionIds(3), count: 5
    });
    const overlap = again.filter(x => scored.some(s => s.question.id === x.id));
    assert.equal(overlap.length, 0, 'second session must not repeat questions');
    assert.ok(saved.date, 'session timestamped');
  });
});
