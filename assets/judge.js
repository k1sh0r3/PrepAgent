/* PrepAgent heuristic judge — explainable, deterministic, zero API keys.
 * Scores an answer 1-10 across four dimensions:
 *   structure   — STAR beats present (behavioral) / logical flow (technical)
 *   length      — word-count bands
 *   terminology — overlap with the question's looksFor rubric terms
 *   clarity     — filler-word rate
 * Every point is explainable: feedback[] says exactly what was found/missed. */
(function (root) {
  'use strict';

  var FILLERS = ['um', 'uh', 'like', 'basically', 'actually', 'literally', 'stuff', 'things', 'very', 'really', 'quite', 'just', 'sort of', 'kind of', 'you know', 'i mean'];

  var STOPWORDS = {};
  ('the and for with your you how what why when that this from into mention expected should like just than then them they their there here were was are has have had not but all any can will would there their discuss explain describe give example including expected looks').split(' ').forEach(function (w) { STOPWORDS[w] = true; });

  var STAR_SIGNALS = {
    situation: /\b(situation|context|background|the problem was|challenge was|when i (joined|started)|at the time)\b/i,
    task: /\b(task|goal|objective|responsib\w+|my role|i was asked to|assigned to)\b/i,
    action: /\b(i built|i designed|i implemented|i led|we shipped|i decided|my approach|i chose|i wrote|i created)\b/i,
    result: /(\d+\s*%|\$\d+|\d+x\b|\b(result|outcome|impact|improved|reduced|increased|saved|grew|cut)\b)/i
  };
  var STAR_LABELS = { situation: 'Situation', task: 'Task', action: 'Action', result: 'Result' };

  function wordCount(text) {
    var t = (text || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  function analyzeStructure(text, category) {
    var found = {}, n = 0, fb = [];
    Object.keys(STAR_SIGNALS).forEach(function (k) {
      if (STAR_SIGNALS[k].test(text)) { found[k] = true; n++; }
    });
    var score = n * 2.5;
    if (category === 'behavioral') {
      if (n === 4) fb.push('Strong STAR structure — all four beats present.');
      else {
        var missing = Object.keys(STAR_SIGNALS).filter(function (k) { return !found[k]; })
          .map(function (k) { return STAR_LABELS[k]; }).join(', ');
        fb.push('STAR structure: ' + n + '/4 beats found. Missing: ' + missing + '.');
      }
    } else {
      /* Technical answers: reward problem -> approach -> outcome flow instead. */
      var flow = 0;
      if (/\b(problem|challenge|issue|because|first)\b/i.test(text)) flow++;
      if (/\b(approach|solution|design|implement|tradeoff|chose|decided)\b/i.test(text)) flow++;
      if (/\b(result|outcome|impact|measured|evaluat\w+|in production)\b/i.test(text)) flow++;
      score = Math.max(score, flow * 3.3);
      fb.push(flow === 3 ? 'Clear problem \u2192 approach \u2192 outcome flow.' :
        'Answer flow: ' + flow + '/3 stages (problem \u2192 approach \u2192 outcome).');
    }
    return { score: Math.min(10, score), feedback: fb };
  }

  function analyzeLength(text) {
    var n = wordCount(text), score, fb;
    if (n === 0) { score = 0; fb = 'No answer given.'; }
    else if (n < 40) { score = 2; fb = 'Too short (' + n + ' words) — aim for 120+ words with specifics.'; }
    else if (n < 120) { score = 6; fb = 'Thin (' + n + ' words) — add concrete details or an example.'; }
    else if (n <= 250) { score = 10; fb = 'Good length (' + n + ' words).'; }
    else if (n <= 400) { score = 8; fb = 'Solid (' + n + ' words) — watch for repetition.'; }
    else { score = 5; fb = 'Rambling (' + n + ' words) — tighten to the strongest 250.'; }
    return { score: score, feedback: [fb], words: n };
  }

  /* Extract matchable terms from looksFor rubric hints. */
  function termsFromLooksFor(looksFor) {
    var terms = {}, out = [];
    (looksFor || []).join(' ').toLowerCase().split(/[^a-z0-9+#]+/).forEach(function (t) {
      if (t.length >= 2 && !STOPWORDS[t] && !terms[t]) { terms[t] = true; out.push(t); }
    });
    return out;
  }

  function analyzeTerminology(text, looksFor) {
    var terms = termsFromLooksFor(looksFor);
    var low = (text || '').toLowerCase();
    var hit = [], missed = [];
    terms.forEach(function (t) {
      var re = new RegExp('\\b' + t.replace(/[^a-z0-9]/g, '') + '\\b');
      if (re.test(low)) hit.push(t); else missed.push(t);
    });
    var denom = Math.max(3, terms.length);
    var score = Math.min(10, 10 * hit.length / denom);
    var fb = hit.length + '/' + terms.length + ' expected terms hit' +
      (missed.length ? '. Missed: ' + missed.slice(0, 4).join(', ') + '.' : '.');
    return { score: score, feedback: [fb], hit: hit, missed: missed };
  }

  function analyzeClarity(text) {
    var low = ' ' + (text || '').toLowerCase() + ' ';
    var count = 0, found = [];
    FILLERS.forEach(function (f) {
      var re = new RegExp('\\b' + f.replace(/ /g, '\\s+') + '\\b', 'g');
      var m = low.match(re);
      if (m) { count += m.length; found.push(f + ' x' + m.length); }
    });
    var words = Math.max(1, wordCount(text));
    var rate = count / words * 100;
    var score = Math.max(0, Math.min(10, 10 - Math.max(0, rate - 2) * 2.5));
    var fb = count === 0 ? 'Clean — no filler words detected.' :
      count + ' filler words (' + rate.toFixed(1) + '/100 words: ' + found.slice(0, 4).join(', ') + ').';
    return { score: score, feedback: [fb], fillerCount: count };
  }

  var WEIGHTS = {
    behavioral: { structure: 0.4, length: 0.2, terminology: 0.2, clarity: 0.2 },
    technical: { structure: 0.15, length: 0.2, terminology: 0.45, clarity: 0.2 }
  };

  function scoreAnswer(question, answerText) {
    var category = question.category || 'behavioral';
    var isBehavioral = category === 'behavioral';
    var w = isBehavioral ? WEIGHTS.behavioral : WEIGHTS.technical;

    var words = wordCount(answerText);
    if (words === 0) {
      return {
        score: 1,
        dimensions: { structure: 0, length: 0, terminology: 0, clarity: 0 },
        words: 0,
        feedback: ['No answer given — even a rough attempt outscores silence.']
      };
    }
    var s = analyzeStructure(answerText, category);
    var l = analyzeLength(answerText);
    var t = analyzeTerminology(answerText, question.looksFor);
    var c = analyzeClarity(answerText);

    var score = Math.round(s.score * w.structure + l.score * w.length + t.score * w.terminology + c.score * w.clarity);
    score = Math.max(1, Math.min(10, score));

    return {
      score: score,
      dimensions: {
        structure: Math.round(s.score * 10) / 10,
        length: l.score,
        terminology: Math.round(t.score * 10) / 10,
        clarity: Math.round(c.score * 10) / 10
      },
      words: l.words,
      feedback: s.feedback.concat(l.feedback, t.feedback, c.feedback)
    };
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.Judge = {
    scoreAnswer: scoreAnswer,
    analyzeStructure: analyzeStructure,
    analyzeLength: analyzeLength,
    analyzeTerminology: analyzeTerminology,
    analyzeClarity: analyzeClarity,
    termsFromLooksFor: termsFromLooksFor,
    wordCount: wordCount
  };
})(typeof window !== 'undefined' ? window : globalThis);
