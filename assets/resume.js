/* PrepAgent resume/JD parsing.
 * Browser: PDF via pdf.js CDN (window.pdfjsLib), DOCX via mammoth CDN (window.mammoth).
 * Pure-text helpers (parseResumeText, extractSignals) run anywhere, including Node tests. */
(function (root) {
  'use strict';

  var SKILLS = [
    'python', 'pytorch', 'tensorflow', 'scikit-learn', 'numpy', 'pandas',
    'llm', 'rag', 'embeddings', 'vector database', 'prompt engineering', 'fine-tuning',
    'mcp', 'langchain', 'agents', 'evals', 'red teaming', 'guardrails',
    'sql', 'postgres', 'spark', 'pyspark', 'airflow', 'dbt', 'kafka', 'etl',
    'aws', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'github actions',
    'typescript', 'javascript', 'react', 'node', 'fastapi',
    'a/b testing', 'experimentation', 'monitoring', 'distributed systems'
  ];

  var ROUND_HINTS = [
    { re: /system design|architect/i, hint: 'System design round likely — weight ML system design.' },
    { re: /machine learning|\bml\b|model training/i, hint: 'ML-heavy role — weight ML fundamentals.' },
    { re: /\bllm\b|genai|rag|agent/i, hint: 'LLM focus — weight evals & guardrails.' },
    { re: /coding|leetcode|algorithms/i, hint: 'Coding round mentioned — practice talk-throughs of your approach.' },
    { re: /behavioral|leadership|stakeholder/i, hint: 'Behavioral round explicit — prep STAR stories.' },
    { re: /data pipeline|\betl\b|warehouse/i, hint: 'Data engineering core — expect pipeline deep-dives.' }
  ];

  function normalize(text) {
    return (text || '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
  }

  /* Heuristic skill extraction: which known skills appear in the text. */
  function extractSkills(text) {
    var low = ' ' + (text || '').toLowerCase() + ' ';
    var found = [];
    SKILLS.forEach(function (s) {
      var re = new RegExp('[^a-z0-9+#]' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^a-z0-9+#]');
      if (re.test(low)) found.push(s);
    });
    return found;
  }

  function parseResumeText(text) {
    text = normalize(text);
    return {
      text: text,
      chars: text.length,
      skills: extractSkills(text),
      /* crude project/company hints: lines that look like headers */
      headline: text.split('\n').slice(0, 3).join(' ').slice(0, 160)
    };
  }

  function extractSignals(jdText) {
    jdText = normalize(jdText);
    var hints = [];
    ROUND_HINTS.forEach(function (h) {
      if (h.re.test(jdText)) hints.push(h.hint);
    });
    return {
      text: jdText,
      chars: jdText.length,
      skills: extractSkills(jdText),
      roundHints: hints
    };
  }

  /* Browser-only: extract text from an uploaded File. Resolves to plain text. */
  async function extractTextFromFile(file) {
    var name = (file.name || '').toLowerCase();
    if (name.endsWith('.txt') || name.endsWith('.md')) {
      return normalize(await file.text());
    }
    if (name.endsWith('.pdf')) {
      var pdfjs = root.pdfjsLib;
      if (!pdfjs) throw new Error('PDF library not loaded. Check your connection and retry.');
      var buf = await file.arrayBuffer();
      var pdf = await pdfjs.getDocument({ data: buf }).promise;
      var parts = [];
      for (var p = 1; p <= Math.min(pdf.numPages, 10); p++) {
        var page = await pdf.getPage(p);
        var tc = await page.getTextContent();
        parts.push(tc.items.map(function (it) { return it.str; }).join(' '));
      }
      return normalize(parts.join('\n'));
    }
    if (name.endsWith('.docx')) {
      var mammoth = root.mammoth;
      if (!mammoth) throw new Error('DOCX library not loaded. Check your connection and retry.');
      var ab = await file.arrayBuffer();
      var out = await mammoth.extractRawText({ arrayBuffer: ab });
      return normalize(out.value);
    }
    throw new Error('Unsupported file type. Use PDF, DOCX, TXT, or paste the text.');
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.Resume = {
    normalize: normalize,
    extractSkills: extractSkills,
    parseResumeText: parseResumeText,
    extractSignals: extractSignals,
    extractTextFromFile: extractTextFromFile,
    SKILLS: SKILLS
  };
})(typeof window !== 'undefined' ? window : globalThis);
