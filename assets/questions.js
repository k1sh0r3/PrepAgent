/* PrepAgent question banks — the heart of the product.
 * Every question carries 2-3 follow-ups (asked when an answer scores < 6)
 * and looksFor[] rubric hints (used by the heuristic judge + shown in reports).
 * Vanilla JS, no dependencies. Loaded in browser via <script>, in Node via require. */
(function (root) {
  'use strict';

  var BANKS = {
    'behavioral': [
      { id: 'b1', level: 1, q: 'Tell me about yourself.',
        followups: ['What specifically drew you to AI engineering over pure data engineering?', 'Summarize your journey in 60 seconds as if we were walking to the interview room.'],
        looksFor: ['chronological arc', 'data to AI pivot', 'ends with why this role'] },
      { id: 'b2', level: 1, q: 'Tell me about the most technically challenging project you have worked on.',
        followups: ['What was the single hardest bug, and how did you find it?', 'What would you do differently if you started it today?'],
        looksFor: ['specific technical depth', 'personal ownership', 'trade-offs considered'] },
      { id: 'b3', level: 1, q: 'Describe a time you disagreed with a teammate or manager on a technical decision.',
        followups: ['How did you present your case?', 'What did you do when the decision went against you?'],
        looksFor: ['disagreement handled with data', 'respect for final decision', 'no badmouthing'] },
      { id: 'b4', level: 1, q: 'Tell me about a time you failed.',
        followups: ['What was the root cause — be specific.', 'What process did you change afterward?'],
        looksFor: ['real failure, not humblebrag', 'personal accountability', 'concrete lesson applied later'] },
      { id: 'b5', level: 2, q: 'Describe a time you had to deliver under a tight deadline.',
        followups: ['What did you cut, and how did you decide?', 'How did you communicate the risk?'],
        looksFor: ['scoping under pressure', 'explicit trade-offs', 'stakeholder communication'] },
      { id: 'b6', level: 2, q: 'Tell me about a time you dealt with real ambiguity — vague requirements, no clear spec.',
        followups: ['How did you decide what "done" meant?', 'What did you do when you guessed wrong?'],
        looksFor: ['drove clarity proactively', 'defined done', 'iterated with feedback'] },
      { id: 'b7', level: 2, q: 'Have you mentored anyone or helped a teammate grow? Give me a specific example.',
        followups: ['What was their starting point and where did they end up?', 'What did mentoring teach you about yourself?'],
        looksFor: ['specific person and outcome', 'investment of time', 'two-way learning'] },
      { id: 'b8', level: 2, q: 'Tell me about a conflict within a team and your role in resolving it.',
        followups: ['What was actually driving the conflict underneath?', 'Would everyone involved agree with your version?'],
        looksFor: ['empathy for other side', 'concrete resolution steps', 'durable outcome'] },
      { id: 'b9', level: 3, q: 'What is the project you are proudest of, and why?',
        followups: ['What part was genuinely yours versus the team\u2019s?', 'What did users actually think of it?'],
        looksFor: ['personal pride with specifics', 'user impact', 'honest about collaboration'] },
      { id: 'b10', level: 3, q: 'Why this company and this role?',
        followups: ['What do you know about what this team is building right now?', 'What would make you leave in a year?'],
        looksFor: ['company-specific research', 'role fit, not generic flattery', 'forward-looking motivation'] },
      { id: 'b11', level: 3, q: 'What is a weakness you are actively working on?',
        followups: ['Give me an example of it showing up recently.', 'What is your specific plan to improve?'],
        looksFor: ['real weakness', 'self-awareness', 'active plan, not "I work too hard"'] },
      { id: 'b12', level: 3, q: 'Tell me about a time you took ownership beyond your defined role.',
        followups: ['What gave you the confidence to step in?', 'How did the actual owner react?'],
        looksFor: ['initiative without permission', 'respect for boundaries', 'positive outcome'] }
    ],
    'ml-fundamentals': [
      { id: 'f1', level: 1, q: 'Explain the bias-variance tradeoff as if I am a smart backend engineer who never studied ML.',
        followups: ['How do you diagnose which side you are on in practice?', 'Give me a concrete case where you increased bias on purpose.'],
        looksFor: ['plain-language explanation', 'diagnosis via train/val gap', 'regularization or capacity as the lever'] },
      { id: 'f2', level: 1, q: 'Your model hits 99% training accuracy but 72% on validation. Walk me through your diagnosis, step by step.',
        followups: ['What is the first experiment you run?', 'At what point do you suspect the data instead of the model?'],
        looksFor: ['overfitting diagnosis', 'learning curves', 'data quality suspicion'] },
      { id: 'f3', level: 1, q: 'When do you optimize for precision, and when for recall? Give me one production example of each.',
        followups: ['How do you pick the threshold?', 'What happens to the other metric when you move it?'],
        looksFor: ['precision vs recall definitions', 'concrete examples (fraud, search)', 'threshold tradeoff'] },
      { id: 'f4', level: 1, q: 'Why cross-validate instead of a single train/test split? And what breaks if your data has a time component?',
        followups: ['Walk me through time-series split.', 'When is cross-validation overkill?'],
        looksFor: ['variance of the estimate', 'temporal leakage', 'forward chaining'] },
      { id: 'f5', level: 2, q: 'L1 vs L2 regularization — what is the practical difference, and when do you reach for each?',
        followups: ['What does the weight vector look like under each?', 'How does this interact with feature selection?'],
        looksFor: ['sparsity vs shrinkage', 'feature selection use case', 'geometric intuition'] },
      { id: 'f6', level: 2, q: 'What is an embedding, and why do embeddings make semantic search work?',
        followups: ['Why cosine similarity and not Euclidean distance?', 'What breaks when you embed a 2000-token chunk about twelve topics?'],
        looksFor: ['dense vector representation', 'cosine similarity rationale', 'dilution in long chunks'] },
      { id: 'f7', level: 2, q: 'Explain the attention mechanism in about a minute.',
        followups: ['What is the Q/K/V intuition?', 'Why is self-attention O(n^2), and what does that cost you?'],
        looksFor: ['query-key-value', 'weighted averaging', 'quadratic cost awareness'] },
      { id: 'f8', level: 2, q: 'Why did transformers displace RNNs for long sequences?',
        followups: ['What did we lose in the trade?', 'Where would you still consider a recurrent model?'],
        looksFor: ['parallelization', 'long-range dependencies', 'honest about tradeoffs'] },
      { id: 'f9', level: 3, q: 'What are vanishing and exploding gradients, and how do modern architectures deal with them?',
        followups: ['Why do residual connections help?', 'How would you detect this during training?'],
        looksFor: ['gradient flow intuition', 'residuals / normalization', 'gradient norms as diagnostic'] },
      { id: 'f10', level: 3, q: 'Your fraud dataset is 99.7% legitimate. How do you train and evaluate a useful model?',
        followups: ['Why is accuracy a lie here?', 'How do you set the decision threshold in production?'],
        looksFor: ['accuracy is misleading', 'sampling or class weights', 'PR curve over ROC'] },
      { id: 'f11', level: 3, q: 'What is train/serve skew, and how have you guarded against it in a pipeline?',
        followups: ['Give me a concrete skew you have seen or can imagine.', 'How do you monitor for it after launch?'],
        looksFor: ['definition with example', 'feature pipeline parity', 'production monitoring'] },
      { id: 'f12', level: 3, q: 'Your offline metrics look amazing but production is flat. Walk me through your debugging checklist.',
        followups: ['How do you check for label leakage?', 'What is the first dashboard you open?'],
        looksFor: ['leakage suspicion', 'offline/online metric gap', 'systematic checklist'] }
    ],
    'ml-system-design': [
      { id: 's1', level: 1, q: 'Design a RAG system over a company\u2019s internal docs. Talk me through chunking, retrieval, and how you know it works.',
        followups: ['How do you pick a chunking strategy?', 'What is your eval loop before and after launch?'],
        looksFor: ['chunking tradeoffs', 'hybrid retrieval mention', 'eval strategy, not just architecture'] },
      { id: 's2', level: 1, q: 'Design a real-time fraud detection system handling 10k transactions per second.',
        followups: ['Where does the model sit in the request path?', 'What happens when the model service is down?'],
        looksFor: ['latency budget', 'streaming vs batch', 'fallback path'] },
      { id: 's3', level: 1, q: 'Design an LLM evaluation pipeline for a production chatbot. What runs on every deploy?',
        followups: ['How do you build the golden dataset?', 'What gates a deploy versus just warns?'],
        looksFor: ['golden eval set', 'regression gating', 'LLM-judge pitfalls acknowledged'] },
      { id: 's4', level: 1, q: 'You need to serve an LLM to 10k concurrent users. Walk me through cost and latency.',
        followups: ['Where does batching help and where does it hurt?', 'When do you reach for a smaller model vs a bigger one?'],
        looksFor: ['throughput vs latency', 'batching / caching / quantization', 'cost per request math'] },
      { id: 's5', level: 2, q: 'Design a job recommendation system for a job board. Candidates on one side, postings on the other.',
        followups: ['Cold start: new user, no history — what do you show?', 'How do you avoid a feedback loop that only shows popular jobs?'],
        looksFor: ['two-sided framing', 'cold start strategy', 'exploration vs exploitation'] },
      { id: 's6', level: 2, q: 'How do you pick a vector database? What are you actually trading off?',
        followups: ['When is Postgres with pgvector enough?', 'What breaks at 100M vectors?'],
        looksFor: ['recall vs latency vs cost', 'managed vs self-hosted', 'honest about scale needs'] },
      { id: 's7', level: 2, q: 'Design a feedback loop: user corrections should improve the model over time. How do you close the loop safely?',
        followups: ['How do you prevent adversarial feedback from poisoning the model?', 'How do you measure the loop is helping?'],
        looksFor: ['human-in-the-loop design', 'abuse resistance', 'closed-loop metrics'] },
      { id: 's8', level: 3, q: 'How do you monitor an ML model in production? What do you alert on, and what is just a dashboard?',
        followups: ['How do you detect data drift without labels?', 'What is your rollback story?'],
        looksFor: ['input drift / prediction drift', 'alert vs dashboard discipline', 'rollback plan'] },
      { id: 's9', level: 3, q: 'Design the data pipeline feeding a model that retrains daily. Where do things break?',
        followups: ['How do you handle late-arriving data?', 'How do you make a training run reproducible?'],
        looksFor: ['orchestration', 'idempotency / backfill', 'versioned data + code'] },
      { id: 's10', level: 3, q: 'Your LLM feature costs $30k/month. Get it to $10k without killing quality. What is your plan?',
        followups: ['How do you prove quality did not regress?', 'What is the first thing you cut?'],
        looksFor: ['caching / smaller models / routing', 'eval-gated cost cuts', 'prioritized plan'] }
    ],
    'resume-deep-dive': [
      { id: 'r1', level: 1, q: 'Your Jailbreak Gym scores prompt robustness 0-100. Convince a skeptic that number means something.',
        followups: ['What is the biggest threat to the score\u2019s validity?', 'How would you validate it against a human red team?'],
        looksFor: ['grounding in cases', 'honest about limitations', 'validation proposal'] },
      { id: 'r2', level: 1, q: 'Walk me through the mutation engine in Jailbreak Gym. How do you keep 523 cases deterministic?',
        followups: ['Why seeded mutations instead of just writing more cases?', 'Where does determinism break down?'],
        looksFor: ['seeded RNG design', 'coverage vs hand-written tradeoff', 'edge cases'] },
      { id: 'r3', level: 1, q: 'Your Gym uses a heuristic judge, not an LLM. Where does that judge fail, and how would you know?',
        followups: ['Give me an attack it would miss.', 'At what point do you pay for an LLM judge?'],
        looksFor: ['known blind spots', 'honest cost/accuracy tradeoff', 'concrete miss example'] },
      { id: 'r4', level: 1, q: 'SQL Sentinel blocks destructive queries. How do you handle false positives without training users to ignore warnings?',
        followups: ['How do you distinguish "needs review" from "blocked"?', 'What telemetry tells you the guardrail is working?'],
        looksFor: ['precision/recall of the guardrail', 'alert fatigue awareness', 'graduated responses'] },
      { id: 'r5', level: 2, q: 'Why did you build PreSQL as an MCP server instead of a library? And why stdio over HTTP?',
        followups: ['What attack surface does stdio eliminate?', 'When would you add an HTTP transport, and what would it require?'],
        looksFor: ['protocol reasoning', 'threat model', 'auth-from-day-one instinct'] },
      { id: 'r6', level: 2, q: 'BlastRadius does column-level lineage from dbt manifests. How does that scale to 10,000 models?',
        followups: ['Where is the bottleneck — parse, graph build, or render?', 'How do you keep it interactive?'],
        looksFor: ['scaling analysis', 'client-side limits', 'pragmatic tradeoffs'] },
      { id: 'r7', level: 2, q: 'HireRadar dedupes job listings fuzzily. How do you merge "Sr. ML Engineer" and "Senior Machine Learning Engineer" without merging two genuinely different jobs?',
        followups: ['What is your false-merge rate and how do you measure it?', 'What signals beyond the title do you use?'],
        looksFor: ['normalization strategy', 'multi-signal dedup', 'error measurement'] },
      { id: 'r8', level: 3, q: 'At Wipro you built ETL pipelines with delta loads. How did you detect what changed between runs?',
        followups: ['How did you handle late-arriving or corrected records?', 'What broke most often?'],
        looksFor: ['change detection mechanism', 'idempotency', 'honest about failure modes'] },
      { id: 'r9', level: 3, q: 'Tell me about a production incident in one of your data pipelines and exactly how you debugged it.',
        followups: ['How long until you knew, and how?', 'What did you change so it would not happen again?'],
        looksFor: ['detection story', 'systematic debugging', 'preventive follow-through'] },
      { id: 'r10', level: 3, q: 'You pivoted from data engineering to AI engineering. What has been the hardest mental-model shift?',
        followups: ['What data-engineering instinct was wrong for ML?', 'What carried over directly?'],
        looksFor: ['real reflection', 'nondeterminism / evals as shift', 'transferable strengths'] }
    ],
    'evals-guardrails': [
      { id: 'g1', level: 1, q: 'How do you know an LLM feature actually works? Walk me through your eval setup from scratch.',
        followups: ['Where do your test cases come from?', 'What do you do when the eval and user complaints disagree?'],
        looksFor: ['golden dataset', 'task-appropriate metrics', 'human-in-the-loop'] },
      { id: 'g2', level: 1, q: 'What are the failure modes of LLM-as-a-judge, and how do you mitigate each?',
        followups: ['How do you calibrate a judge?', 'When is a heuristic judge better?'],
        looksFor: ['position/length bias', 'self-preference', 'calibration + spot checks'] },
      { id: 'g3', level: 1, q: 'Design guardrails for an AI assistant that handles PII. What layers, in what order?',
        followups: ['What happens when the guardrail itself is wrong?', 'How do you handle PII the model already memorized?'],
        looksFor: ['defense in depth', 'input + output filtering', 'false-positive handling'] },
      { id: 'g4', level: 2, q: 'How do you defend a RAG chatbot against prompt injection?',
        followups: ['What about injection smuggled in via retrieved documents?', 'How do you test the defense?'],
        looksFor: ['indirect injection awareness', 'delimiters / instruction hierarchy', 'adversarial testing'] },
      { id: 'g5', level: 2, q: 'You want to swap to a cheaper model. How do you evaluate the cost/latency/quality tradeoff rigorously?',
        followups: ['What is your non-inferiority bar?', 'How many eval cases is enough?'],
        looksFor: ['paired eval', 'statistical thinking', 'latency + cost measured, not guessed'] },
      { id: 'g6', level: 2, q: 'Describe your red-teaming methodology for a brand-new AI feature. Where do you start?',
        followups: ['How do you prioritize which attacks to try first?', 'When do you stop?'],
        looksFor: ['threat modeling first', 'attack taxonomy', 'stopping criteria'] },
      { id: 'g7', level: 3, q: 'Offline evals look great but users complain. Walk me through your debugging.',
        followups: ['How do you find out what users actually asked?', 'How do you close the loop into the eval set?'],
        looksFor: ['distribution mismatch', 'production sampling', 'eval set refresh loop'] },
      { id: 'g8', level: 3, q: 'Pick one metric you would track for an AI coding assistant, and defend it against alternatives.',
        followups: ['What would game your metric?', 'What leading indicator would you pair it with?'],
        looksFor: ['metric reasoning', 'Goodhart awareness', 'pairing lagging + leading'] }
    ]
  };

  var CATEGORIES = [
    { id: 'behavioral', label: 'Behavioral', desc: 'STAR stories: ownership, conflict, failure, ambiguity.' },
    { id: 'ml-fundamentals', label: 'ML Fundamentals', desc: 'The concepts behind the models: bias-variance, embeddings, attention.' },
    { id: 'ml-system-design', label: 'ML System Design', desc: 'Design RAG, serving, eval pipelines, and data loops at scale.' },
    { id: 'resume-deep-dive', label: 'Resume Deep-Dive', desc: 'Defend your own projects: the Gym, Sentinel, PreSQL, BlastRadius, HireRadar.' },
    { id: 'evals-guardrails', label: 'Evals & Guardrails', desc: 'How do you know it works, and how do you keep it safe.' }
  ];

  /* JD keywords -> category boosts. Deterministic, explainable. */
  var JD_KEYWORD_MAP = [
    { re: /system design|architect/i, category: 'ml-system-design', boost: 2 },
    { re: /machine learning|\bml\b|pytorch|tensorflow|training|deep learning/i, category: 'ml-fundamentals', boost: 2 },
    { re: /\bllm\b|rag|prompt|genai|agent/i, category: 'evals-guardrails', boost: 1.5 },
    { re: /\bllm\b|rag|prompt|genai|agent|inference|serving/i, category: 'ml-system-design', boost: 1 },
    { re: /eval|robustness|safety|guardrail|red.?team/i, category: 'evals-guardrails', boost: 2 },
    { re: /lead|mentor|stakeholder|cross-functional/i, category: 'behavioral', boost: 2 },
    { re: /data pipeline|\betl\b|spark|\bsql\b|warehouse/i, category: 'ml-system-design', boost: 1 },
    { re: /data pipeline|\betl\b|spark|\bsql\b/i, category: 'resume-deep-dive', boost: 1 }
  ];

  function getQuestionById(id) {
    for (var c = 0; c < CATEGORIES.length; c++) {
      var bank = BANKS[CATEGORIES[c].id];
      for (var i = 0; i < bank.length; i++) {
        if (bank[i].id === id) return bank[i];
      }
    }
    return null;
  }

  function categoryOf(id) {
    for (var c = 0; c < CATEGORIES.length; c++) {
      var bank = BANKS[CATEGORIES[c].id];
      for (var i = 0; i < bank.length; i++) {
        if (bank[i].id === id) return CATEGORIES[c].id;
      }
    }
    return null;
  }

  /**
   * Deterministic weighted round-robin selection.
   * - roundType: one of CATEGORIES ids or 'mixed' (default)
   * - jdText: boosts categories matching JD_KEYWORD_MAP
   * - weakAreas: { categoryId: rollingAvg } — categories averaging < 6 get +1.5
   * - excludeIds: question ids used in recent sessions (never repeat within 3)
   * - flaggedIds: question ids the user flagged as bad (excluded permanently)
   * - difficulty: 'junior' | 'mid' | 'senior' — re-weights per-question level
   *   (junior favors level 1, senior favors level 3); also steers follow-up
   *   sharpness via pickFollowup().
   * - count: how many questions
   */
  var DIFFICULTY_LEVEL_W = {
    junior: { 1: 3, 2: 1.2, 3: 0.4 },
    mid: { 1: 1, 2: 1.6, 3: 1 },
    senior: { 1: 0.4, 2: 1.2, 3: 3 }
  };

  function selectQuestions(opts) {
    opts = opts || {};
    var roundType = opts.roundType || 'mixed';
    var jdText = opts.jdText || '';
    var weakAreas = opts.weakAreas || {};
    var excludeIds = opts.excludeIds || [];
    var flaggedIds = opts.flaggedIds || [];
    var difficulty = DIFFICULTY_LEVEL_W[opts.difficulty] ? opts.difficulty : 'mid';
    var count = opts.count || 8;

    var weights = {};
    CATEGORIES.forEach(function (c) { weights[c.id] = 1; });
    if (roundType !== 'mixed' && weights[roundType] !== undefined) weights[roundType] = 4;
    JD_KEYWORD_MAP.forEach(function (m) {
      if (m.re.test(jdText)) weights[m.category] += m.boost;
    });
    Object.keys(weakAreas).forEach(function (cat) {
      if (weights[cat] !== undefined && weakAreas[cat] < 6) weights[cat] += 1.5;
    });

    var excluded = {};
    excludeIds.forEach(function (id) { excluded[id] = true; });
    flaggedIds.forEach(function (id) { excluded[id] = true; });

    var cats = CATEGORIES.map(function (c) { return c.id; });
    var pools = {};
    var lw = DIFFICULTY_LEVEL_W[difficulty];
    cats.forEach(function (c) {
      /* Sort each category pool by difficulty weight (stable): juniors meet
       * level-1 questions first, seniors meet level-3 first. */
      pools[c] = BANKS[c]
        .filter(function (q) { return !excluded[q.id]; })
        .map(function (q, i) { return { q: q, i: i }; })
        .sort(function (a, b) {
          var d = (lw[b.q.level] || 1) - (lw[a.q.level] || 1);
          return d !== 0 ? d : a.i - b.i;
        })
        .map(function (x) { return x.q; });
    });

    /* Largest-remainder allocation: questions per category proportional to weight.
     * A focused roundType (weight 4 vs 1) therefore dominates the session. */
    var totalW = cats.reduce(function (a, c) { return a + weights[c]; }, 0);
    var alloc = cats.map(function (c, i) {
      return { c: c, i: i, exact: count * weights[c] / totalW, n: 0 };
    });
    var assigned = 0;
    alloc.forEach(function (a) { a.n = Math.floor(a.exact); assigned += a.n; });
    var rem = count - assigned;
    alloc.sort(function (a, b) { return (b.exact - b.n) - (a.exact - a.n) || a.i - b.i; });
    for (var r = 0; r < rem; r++) alloc[r % alloc.length].n++;

    var picked = [], pickedIds = {};
    alloc.forEach(function (a) {
      var take = Math.min(a.n, pools[a.c].length);
      for (var i = 0; i < take; i++) {
        var q = pools[a.c][i];
        picked.push(q); pickedIds[q.id] = true;
      }
    });
    /* Fallback: pool exhausted (e.g. everything excluded) — allow repeats. */
    if (picked.length < count) {
      outer: for (var j = 0; j < cats.length; j++) {
        var bank = BANKS[cats[j]];
        for (var k = 0; k < bank.length; k++) {
          if (!pickedIds[bank[k].id]) {
            picked.push(bank[k]); pickedIds[bank[k].id] = true;
            if (picked.length >= count) break outer;
          }
        }
      }
    }
    return picked.slice(0, count).map(function (q) {
      return { id: q.id, category: categoryOf(q.id), q: q.q, level: q.level || 2, followups: q.followups.slice(), looksFor: q.looksFor.slice() };
    });
  }

  /**
   * Follow-up sharpness by difficulty. Banks list followups gentle -> probing,
   * so juniors take them in order and seniors take the sharpest remaining one.
   */
  function pickFollowup(q, usedCount, difficulty) {
    var f = q.followups || [];
    if (!f.length) return null;
    if (difficulty === 'senior') {
      var idx = f.length - 1 - usedCount;
      return f[Math.max(0, idx)];
    }
    return f[Math.min(usedCount, f.length - 1)];
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.Questions = {
    BANKS: BANKS,
    CATEGORIES: CATEGORIES,
    JD_KEYWORD_MAP: JD_KEYWORD_MAP,
    getQuestionById: getQuestionById,
    categoryOf: categoryOf,
    selectQuestions: selectQuestions,
    pickFollowup: pickFollowup,
    DIFFICULTY_LEVEL_W: DIFFICULTY_LEVEL_W
  };
})(typeof window !== 'undefined' ? window : globalThis);
