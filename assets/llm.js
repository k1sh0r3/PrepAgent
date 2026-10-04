/* PrepAgent BYOK LLM layer — browser-stored keys, zero-key graceful.
 * Providers: OpenAI / Gemini / Groq (chat) + Tavily key reuse (research).
 * Keys live in localStorage only (same pattern as SeevForge's BYOK).
 * Every network call degrades to null on failure — callers fall back to
 * deterministic paths and show "add a key to unlock" states, never errors.
 * Pure helpers (prompts, JSON extraction, validators) are exported for tests. */
(function (root) {
  'use strict';

  var KEY = 'prepagent.keys.v1';

  function makeShim() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  function store() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* private mode */ }
    if (!root.__prepagentKeyShim) root.__prepagentKeyShim = makeShim();
    return root.__prepagentKeyShim;
  }

  function readState() {
    try {
      var raw = store().getItem(KEY);
      var p = raw ? JSON.parse(raw) : null;
      if (p && typeof p === 'object') return p;
    } catch (e) { /* corrupted */ }
    return { activeLLM: null, keys: {} };
  }

  function writeState(s) {
    try { store().setItem(KEY, JSON.stringify(s)); } catch (e) { /* blocked */ }
  }

  function setKey(provider, key) {
    var s = readState();
    s.keys = s.keys || {};
    if (key) s.keys[provider] = key;
    else delete s.keys[provider];
    writeState(s);
  }

  function getKey(provider) {
    var s = readState();
    return (s.keys && s.keys[provider]) || '';
  }

  function hasKey(provider) { return !!getKey(provider); }

  function setActiveLLM(provider) {
    var s = readState();
    s.activeLLM = provider || null;
    writeState(s);
  }

  function getActiveLLM() { return readState().activeLLM || null; }

  /* Active provider with a stored key, or null (=> deterministic fallbacks). */
  function activeProvider() {
    var p = getActiveLLM();
    if (p && hasKey(p)) return p;
    return null;
  }

  /* ---------- provider adapters ---------- */

  var PROVIDERS = {
    openai: {
      label: 'OpenAI',
      model: 'gpt-4o-mini',
      placeholder: 'sk-…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://api.openai.com/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          }
        };
      },
      parseResponse: function (data) {
        try { return data.choices[0].message.content; } catch (e) { return null; }
      }
    },
    gemini: {
      label: 'Google Gemini',
      model: 'gemini-2.0-flash',
      placeholder: 'AIza…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + encodeURIComponent(key),
          headers: { 'Content-Type': 'application/json' },
          body: {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ parts: [{ text: user }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.7 }
          }
        };
      },
      parseResponse: function (data) {
        try { return data.candidates[0].content.parts.map(function (p) { return p.text; }).join(''); }
        catch (e) { return null; }
      }
    },
    groq: {
      label: 'Groq',
      model: 'llama-3.3-70b-versatile',
      placeholder: 'gsk_…',
      buildRequest: function (key, system, user) {
        return {
          url: 'https://api.groq.com/openai/v1/chat/completions',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: {
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          }
        };
      },
      parseResponse: function (data) {
        try { return data.choices[0].message.content; } catch (e) { return null; }
      }
    }
  };

  function defaultFetch() {
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('No fetch implementation available.');
  }

  /**
   * Unified chat call. Returns the raw text response, or null on any failure.
   * fetchImpl injectable for tests.
   */
  async function chat(system, user, opts) {
    opts = opts || {};
    var provider = opts.provider || activeProvider();
    if (!provider || !PROVIDERS[provider]) return null;
    var key = getKey(provider);
    if (!key) return null;
    var impl;
    try { impl = opts.fetchImpl || defaultFetch(); }
    catch (e) { return null; }
    var req = PROVIDERS[provider].buildRequest(key, system, user);
    var res;
    try {
      res = await impl(req.url, {
        method: 'POST',
        headers: req.headers,
        body: JSON.stringify(req.body)
      });
    } catch (e) { return null; }
    if (!res.ok) return null;
    var data;
    try { data = await res.json(); } catch (e) { return null; }
    return PROVIDERS[provider].parseResponse(data);
  }

  /* ---------- JSON extraction ---------- */

  /* LLMs wrap JSON in fences or prose — find the outermost object/array. */
  function extractJson(text) {
    if (!text || typeof text !== 'string') return null;
    var t = text.replace(/```(?:json)?/gi, '').trim();
    var start = t.search(/[\[{]/);
    if (start === -1) return null;
    var endObj = t.lastIndexOf('}');
    var endArr = t.lastIndexOf(']');
    var end = Math.max(endObj, endArr);
    if (end <= start) return null;
    try { return JSON.parse(t.slice(start, end + 1)); }
    catch (e) { return null; }
  }

  /* ---------- resume-specific question generation ---------- */

  var VALID_CATS = ['behavioral', 'ml-fundamentals', 'ml-system-design', 'resume-deep-dive', 'evals-guardrails'];

  function buildQuestionPrompt(ctx) {
    var resume = (ctx.resumeText || '').slice(0, 3000);
    var jd = (ctx.jdText || '').slice(0, 1500);
    var company = ctx.companyInfo && ctx.companyInfo.ok
      ? 'Company: ' + ctx.companyInfo.title + ' — ' + (ctx.companyInfo.extract || '').slice(0, 600)
      : 'Company: ' + (ctx.company || 'unspecified');
    var research = ctx.pastedResearch
      ? 'Extra research provided by the candidate:\n' + ctx.pastedResearch.slice(0, 1500)
      : '';
    return {
      system: 'You write interview questions for an AI Software Engineer candidate. ' +
        'Return ONLY a JSON object: {"questions": [{"q": "...", "category": "<one of: ' + VALID_CATS.join(', ') + '>", "followups": ["...", "..."], "looksFor": ["...", "..."]}]}. ' +
        'Questions must be specific to THIS resume — reference their actual projects and skills. ' +
        'Follow-ups should dig one level deeper. looksFor lists 2-3 concrete things a strong answer contains. No prose outside the JSON.',
      user: 'Candidate resume:\n' + resume + '\n\nJob description:\n' + jd + '\n\n' + company + '\n' + research +
        '\n\nWrite exactly ' + (ctx.count || 3) + ' sharp, resume-specific interview questions.'
    };
  }

  function validateAiQuestions(parsed) {
    if (!parsed || !Array.isArray(parsed.questions)) return [];
    var out = [];
    parsed.questions.forEach(function (q, i) {
      if (!q || typeof q.q !== 'string' || q.q.length < 20) return;
      if (VALID_CATS.indexOf(q.category) === -1) q.category = 'resume-deep-dive';
      var followups = (Array.isArray(q.followups) ? q.followups : []).filter(function (f) {
        return typeof f === 'string' && f.length > 10;
      }).slice(0, 3);
      var looksFor = (Array.isArray(q.looksFor) ? q.looksFor : []).filter(function (l) {
        return typeof l === 'string' && l.length > 2;
      }).slice(0, 4);
      if (!followups.length || !looksFor.length) return;
      out.push({
        id: 'ai-' + (i + 1),
        category: q.category,
        q: q.q,
        level: 2,
        followups: followups,
        looksFor: looksFor,
        ai: true
      });
    });
    return out;
  }

  async function generateResumeQuestions(ctx, opts) {
    var p = buildQuestionPrompt(ctx || {});
    var text = await chat(p.system, p.user, opts);
    if (!text) return [];
    return validateAiQuestions(extractJson(text)).slice(0, ctx.count || 3);
  }

  /* ---------- LLM judge ---------- */

  function buildJudgePrompt(question, answerText, heuristic) {
    return {
      system: 'You are a strict but fair interview judge. Return ONLY a JSON object: ' +
        '{"score": <1-10 integer>, "dimensions": {"structure": <1-10>, "length": <1-10>, "terminology": <1-10>, "clarity": <1-10>}, ' +
        '"feedback": ["...", "..."]}. Feedback must be specific and actionable, 2-4 bullets. No prose outside the JSON.',
      user: 'Question (' + question.category + '): ' + question.q +
        '\nWhat a strong answer contains: ' + (question.looksFor || []).join('; ') +
        '\n\nCandidate answer:\n' + (answerText || '').slice(0, 3000) +
        '\n\nA heuristic pre-score gave ' + (heuristic && heuristic.score) + '/10 — use it as a sanity anchor, not gospel.'
    };
  }

  function validateJudgeResult(parsed) {
    if (!parsed || typeof parsed !== 'object') return null;
    var score = parseInt(parsed.score, 10);
    if (!(score >= 1 && score <= 10)) return null;
    var dims = {}, ok = true;
    ['structure', 'length', 'terminology', 'clarity'].forEach(function (d) {
      var v = parsed.dimensions && parseFloat(parsed.dimensions[d]);
      if (!(v >= 0 && v <= 10)) { ok = false; return; }
      dims[d] = Math.round(v * 10) / 10;
    });
    if (!ok) return null;
    var feedback = (Array.isArray(parsed.feedback) ? parsed.feedback : []).filter(function (f) {
      return typeof f === 'string' && f.length > 3;
    }).slice(0, 5);
    return { score: score, dimensions: dims, feedback: feedback.length ? feedback : ['AI judge scored ' + score + '/10.'] };
  }

  async function judgeAnswerLLM(question, answerText, heuristic, opts) {
    var p = buildJudgePrompt(question, answerText, heuristic);
    var text = await chat(p.system, p.user, opts);
    if (!text) return null;
    return validateJudgeResult(extractJson(text));
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.LLM = {
    PROVIDERS: PROVIDERS,
    setKey: setKey,
    getKey: getKey,
    hasKey: hasKey,
    setActiveLLM: setActiveLLM,
    getActiveLLM: getActiveLLM,
    activeProvider: activeProvider,
    chat: chat,
    extractJson: extractJson,
    buildQuestionPrompt: buildQuestionPrompt,
    validateAiQuestions: validateAiQuestions,
    generateResumeQuestions: generateResumeQuestions,
    buildJudgePrompt: buildJudgePrompt,
    validateJudgeResult: validateJudgeResult,
    judgeAnswerLLM: judgeAnswerLLM,
    KEY: KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
