/* PrepAgent tests — BYOK LLM layer. Run: node --test tests/*.test.js */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/llm.js');
const L = globalThis.PrepAgent.LLM;

function stubFetch(responseBody, okStatus) {
  return async function (url, opts) {
    return {
      ok: okStatus !== false,
      status: okStatus === false ? 401 : 200,
      json: async () => responseBody
    };
  };
}

describe('key store', () => {
  beforeEach(() => {
    L.setKey('openai', ''); L.setKey('gemini', ''); L.setKey('groq', ''); L.setKey('tavily', '');
    L.setActiveLLM(null);
  });

  it('stores and clears keys per provider', () => {
    assert.equal(L.hasKey('openai'), false);
    L.setKey('openai', 'sk-test');
    assert.equal(L.hasKey('openai'), true);
    assert.equal(L.getKey('openai'), 'sk-test');
    assert.equal(L.hasKey('gemini'), false, 'providers are independent');
    L.setKey('openai', '');
    assert.equal(L.hasKey('openai'), false);
  });

  it('activeProvider is null without a keyed provider', () => {
    L.setActiveLLM('openai');
    assert.equal(L.activeProvider(), null, 'no key stored yet');
    L.setKey('openai', 'sk-test');
    assert.equal(L.activeProvider(), 'openai');
  });
});

describe('provider adapters', () => {
  it('all three providers build sane requests', () => {
    for (const p of ['openai', 'gemini', 'groq']) {
      const req = L.PROVIDERS[p].buildRequest('KEY', 'sys', 'user');
      assert.ok(req.url.startsWith('https://'), p + ' url must be https');
      assert.ok(req.body, p + ' needs a body');
    }
    assert.ok(L.PROVIDERS.openai.buildRequest('k', 's', 'u').url.includes('openai.com'));
    assert.ok(L.PROVIDERS.gemini.buildRequest('k', 's', 'u').url.includes('googleapis.com'));
    assert.ok(L.PROVIDERS.groq.buildRequest('k', 's', 'u').url.includes('groq.com'));
  });

  it('parses each provider response shape', () => {
    assert.equal(
      L.PROVIDERS.openai.parseResponse({ choices: [{ message: { content: 'hi' } }] }),
      'hi');
    assert.equal(
      L.PROVIDERS.groq.parseResponse({ choices: [{ message: { content: 'hi' } }] }),
      'hi');
    assert.equal(
      L.PROVIDERS.gemini.parseResponse({ candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] }),
      'ab');
    assert.equal(L.PROVIDERS.openai.parseResponse({}), null, 'malformed -> null');
  });
});

describe('chat()', () => {
  beforeEach(() => { L.setKey('openai', ''); L.setActiveLLM(null); });

  it('returns null with no provider/key (graceful)', async () => {
    assert.equal(await L.chat('s', 'u'), null);
    L.setActiveLLM('openai');
    assert.equal(await L.chat('s', 'u'), null, 'provider set but no key');
  });

  it('round-trips through a stubbed fetch', async () => {
    L.setKey('openai', 'sk-test');
    L.setActiveLLM('openai');
    const text = await L.chat('s', 'u', {
      fetchImpl: stubFetch({ choices: [{ message: { content: '{"ok":true}' } }] })
    });
    assert.equal(text, '{"ok":true}');
  });

  it('returns null on http error or network throw', async () => {
    L.setKey('groq', 'gsk-test');
    L.setActiveLLM('groq');
    assert.equal(await L.chat('s', 'u', { fetchImpl: stubFetch({}, false) }), null);
    assert.equal(await L.chat('s', 'u', { fetchImpl: async () => { throw new Error('down'); } }), null);
  });
});

describe('extractJson', () => {
  it('handles fenced, bare, and prose-wrapped JSON', () => {
    assert.deepEqual(L.extractJson('```json\n{"a": 1}\n```'), { a: 1 });
    assert.deepEqual(L.extractJson('{"a": 1}'), { a: 1 });
    assert.deepEqual(L.extractJson('Here you go: {"a": 1} hope it helps'), { a: 1 });
    assert.deepEqual(L.extractJson('[{"x": 2}]'), [{ x: 2 }]);
  });

  it('returns null for garbage', () => {
    assert.equal(L.extractJson('no json here'), null);
    assert.equal(L.extractJson(''), null);
    assert.equal(L.extractJson(null), null);
    assert.equal(L.extractJson('{broken'), null);
  });
});

describe('question generation', () => {
  it('prompt embeds resume, JD, company, pasted research', () => {
    const p = L.buildQuestionPrompt({
      resumeText: 'Built Jailbreak Gym',
      jdText: 'AI engineer, evals',
      company: 'Anthropic',
      pastedResearch: 'Recent blog post about constitutional AI',
      count: 3
    });
    assert.ok(p.user.includes('Jailbreak Gym'));
    assert.ok(p.user.includes('constitutional AI'));
    assert.ok(p.user.includes('exactly 3'));
    assert.ok(p.system.includes('JSON'));
  });

  it('validates AI questions, dropping malformed ones', () => {
    const good = {
      q: 'Your Jailbreak Gym scores robustness 0-100. How would you defend that number to a skeptic?',
      category: 'resume-deep-dive',
      followups: ['What threatens its validity?', 'How would you validate it?'],
      looksFor: ['grounding', 'limitations']
    };
    const out = L.validateAiQuestions({ questions: [good, { q: 'short' }, null, { q: 'x'.repeat(30) }] });
    assert.equal(out.length, 1);
    assert.equal(out[0].id, 'ai-1');
    assert.equal(out[0].ai, true);
    assert.equal(L.validateAiQuestions({ nope: [] }).length, 0);
    assert.equal(L.validateAiQuestions(null).length, 0);
  });

  it('generateResumeQuestions degrades to [] without a key', async () => {
    L.setActiveLLM(null);
    const out = await L.generateResumeQuestions({ resumeText: 'x'.repeat(100) });
    assert.deepEqual(out, []);
  });

  it('generateResumeQuestions parses a stubbed LLM response', async () => {
    L.setKey('groq', 'gsk-test');
    L.setActiveLLM('groq');
    const payload = {
      questions: [{
        q: 'You built a 523-case adversarial test bench. How do you know the cases cover the real attack surface?',
        category: 'resume-deep-dive',
        followups: ['What attack family is missing?', 'How would you measure coverage?'],
        looksFor: ['threat model', 'coverage reasoning']
      }]
    };
    const out = await L.generateResumeQuestions(
      { resumeText: 'Jailbreak Gym, 523 cases', count: 1 },
      { fetchImpl: stubFetch({ choices: [{ message: { content: JSON.stringify(payload) } }] }) }
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].category, 'resume-deep-dive');
  });
});

describe('LLM judge', () => {
  it('prompt includes question, rubric, answer, heuristic anchor', () => {
    const p = L.buildJudgePrompt(
      { category: 'behavioral', q: 'Tell me about a failure.', looksFor: ['accountability'] },
      'I failed once.',
      { score: 3 }
    );
    assert.ok(p.user.includes('Tell me about a failure'));
    assert.ok(p.user.includes('accountability'));
    assert.ok(p.user.includes('3/10'));
  });

  it('validates judge results, rejecting bad shapes', () => {
    const good = {
      score: 7,
      dimensions: { structure: 7, length: 6, terminology: 8, clarity: 7 },
      feedback: ['Solid structure.', 'Add numbers.']
    };
    const v = L.validateJudgeResult(good);
    assert.equal(v.score, 7);
    assert.equal(v.dimensions.terminology, 8);
    assert.equal(L.validateJudgeResult({ score: 99, dimensions: {}, feedback: [] }), null);
    assert.equal(L.validateJudgeResult({ score: 7 }), null, 'missing dimensions');
    assert.equal(L.validateJudgeResult(null), null);
  });

  it('judgeAnswerLLM returns null without a key', async () => {
    L.setActiveLLM(null);
    assert.equal(await L.judgeAnswerLLM({ category: 'behavioral', q: 'q?' }, 'answer', { score: 5 }), null);
  });
});
