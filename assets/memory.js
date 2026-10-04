/* PrepAgent memory — sessions + weak-area tracking.
 * localStorage in the browser, transparent in-memory shim in Node/tests. */
(function (root) {
  'use strict';

  var KEY = 'prepagent.v1';
  var MAX_SESSIONS = 20;

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
    } catch (e) { /* private mode etc. */ }
    if (!root.__prepagentShim) root.__prepagentShim = makeShim();
    return root.__prepagentShim;
  }

  function read() {
    try {
      var raw = store().getItem(KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.sessions)) return parsed;
    } catch (e) { /* corrupted — start fresh */ }
    return { sessions: [] };
  }

  function write(state) {
    try { store().setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  /* session: { date, roundType, company, questions: [{id, category, score}], overall } */
  function saveSession(session) {
    var state = read();
    state.sessions.unshift({
      date: session.date || new Date().toISOString(),
      roundType: session.roundType || 'mixed',
      company: session.company || '',
      questions: (session.questions || []).map(function (q) {
        return { id: q.id, category: q.category, score: q.score };
      }),
      overall: session.overall
    });
    state.sessions = state.sessions.slice(0, MAX_SESSIONS);
    write(state);
    return state.sessions[0];
  }

  function getSessions() { return read().sessions; }

  function getRecentQuestionIds(sessionCount) {
    sessionCount = sessionCount || 3;
    var ids = [];
    read().sessions.slice(0, sessionCount).forEach(function (s) {
      (s.questions || []).forEach(function (q) { ids.push(q.id); });
    });
    return ids;
  }

  /* Rolling average per category over the last 5 sessions (fewer if new). */
  function getWeakAreas() {
    var sums = {}, counts = {};
    read().sessions.slice(0, 5).forEach(function (s) {
      (s.questions || []).forEach(function (q) {
        if (!q.category) return;
        sums[q.category] = (sums[q.category] || 0) + q.score;
        counts[q.category] = (counts[q.category] || 0) + 1;
      });
    });
    var out = {};
    Object.keys(sums).forEach(function (c) {
      out[c] = Math.round(sums[c] / counts[c] * 10) / 10;
    });
    return out;
  }

  function weakestCategories(n) {
    n = n || 3;
    var areas = getWeakAreas();
    return Object.keys(areas).sort(function (a, b) { return areas[a] - areas[b]; }).slice(0, n)
      .map(function (c) { return { category: c, avg: areas[c] }; });
  }

  function clearAll() { write({ sessions: [] }); }

  /* ---------- flagged questions (separate key — never wiped with sessions) ---------- */

  var FLAG_KEY = 'prepagent.flags.v1';

  function readFlags() {
    try {
      var raw = store().getItem(FLAG_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.ids)) return parsed;
    } catch (e) { /* corrupted — start fresh */ }
    return { ids: [] };
  }

  function writeFlags(state) {
    try { store().setItem(FLAG_KEY, JSON.stringify(state)); } catch (e) { /* blocked */ }
  }

  function getFlaggedIds() { return readFlags().ids.slice(); }

  function isFlagged(id) { return readFlags().ids.indexOf(id) !== -1; }

  function flagQuestion(id) {
    var state = readFlags();
    if (state.ids.indexOf(id) === -1) state.ids.push(id);
    writeFlags(state);
  }

  function unflagQuestion(id) {
    var state = readFlags();
    state.ids = state.ids.filter(function (x) { return x !== id; });
    writeFlags(state);
  }

  /**
   * Per-category trend: average over the most recent session vs the average
   * over the sessions before it (up to 4). Pure over stored sessions.
   * Returns { category: { current, previous, delta, n } }.
   */
  function getCategoryTrends() {
    var sessions = read().sessions;
    if (!sessions.length) return {};
    var agg = function (list) {
      var sums = {}, counts = {};
      list.forEach(function (s) {
        (s.questions || []).forEach(function (q) {
          if (!q.category) return;
          sums[q.category] = (sums[q.category] || 0) + q.score;
          counts[q.category] = (counts[q.category] || 0) + 1;
        });
      });
      var out = {};
      Object.keys(sums).forEach(function (c) {
        out[c] = { avg: Math.round(sums[c] / counts[c] * 10) / 10, n: counts[c] };
      });
      return out;
    };
    var cur = agg(sessions.slice(0, 1));
    var prev = agg(sessions.slice(1, 5));
    var out = {};
    Object.keys(cur).forEach(function (c) {
      out[c] = {
        current: cur[c].avg,
        previous: prev[c] ? prev[c].avg : null,
        delta: prev[c] ? Math.round((cur[c].avg - prev[c].avg) * 10) / 10 : null,
        n: cur[c].n
      };
    });
    return out;
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.Memory = {
    saveSession: saveSession,
    getSessions: getSessions,
    getRecentQuestionIds: getRecentQuestionIds,
    getWeakAreas: getWeakAreas,
    weakestCategories: weakestCategories,
    clearAll: clearAll,
    getFlaggedIds: getFlaggedIds,
    isFlagged: isFlagged,
    flagQuestion: flagQuestion,
    unflagQuestion: unflagQuestion,
    getCategoryTrends: getCategoryTrends,
    KEY: KEY,
    FLAG_KEY: FLAG_KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
