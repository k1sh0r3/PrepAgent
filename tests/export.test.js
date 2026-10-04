/* PrepAgent tests — P2: markdown export + radar data shaping.
 * Run: node --test tests/*.test.js */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('../assets/questions.js');
require('../assets/judge.js');
require('../assets/memory.js');
require('../assets/research.js');
require('../assets/resume.js');
require('../assets/app.js');

const App = globalThis.PrepAgent.App;

function fakeReport() {
  return {
    perQuestion: [
      {
        id: 'b4', category: 'behavioral', q: 'Tell me about a time you failed.',
        score: 4, dimensions: { structure: 3, length: 5, terminology: 4, clarity: 6 },
        feedback: ['STAR structure: 2/4 beats found.'], words: 80, followupsUsed: 1
      },
      {
        id: 'f6', category: 'ml-fundamentals', q: 'What is an embedding?',
        score: 8, dimensions: { structure: 8, length: 9, terminology: 8, clarity: 8 },
        feedback: ['Good length (150 words).'], words: 150, followupsUsed: 0
      }
    ],
    overall: 6,
    signal: { label: 'Hire signal', cls: 'sig-hire' },
    weakAreas: [{ category: 'behavioral', avg: 4 }],
    drills: ['STAR closings drill.']
  };
}

describe('buildMarkdownReport', () => {
  it('renders all sections with meta', () => {
    const md = App.buildMarkdownReport(fakeReport(), {
      company: 'Anthropic', roundType: 'mixed', date: '2026-10-05T00:00:00Z'
    });
    assert.ok(md.includes('# PrepAgent report card'));
    assert.ok(md.includes('Anthropic'));
    assert.ok(md.includes('**6/10**'));
    assert.ok(md.includes('## Per-question scores'));
    assert.ok(md.includes('Tell me about a time you failed'));
    assert.ok(md.includes('## Weak areas'));
    assert.ok(md.includes('## Drills'));
    assert.ok(md.includes('STAR closings drill.'));
  });

  it('works with empty meta', () => {
    const md = App.buildMarkdownReport(fakeReport(), {});
    assert.ok(md.includes('Round type: Mixed'));
    assert.ok(!md.includes('Company:'));
  });
});

describe('buildRadarData', () => {
  function sess(cats) {
    return {
      questions: Object.entries(cats).map(([category, score], i) => ({
        id: 'r' + i, category, score
      }))
    };
  }

  it('aligns to category order with current vs previous', () => {
    const data = App.buildRadarData([
      sess({ behavioral: 9, 'ml-fundamentals': 5 }),
      sess({ behavioral: 5, 'ml-fundamentals': 7 })
    ]);
    assert.equal(data.labels.length, 5, 'five radar axes');
    const i = id => data.labels.findIndex(l => l.id === id);
    assert.equal(data.current[i('behavioral')], 9);
    assert.equal(data.previous[i('behavioral')], 5);
    assert.equal(data.current[i('ml-system-design')], null, 'untested category is null');
  });

  it('empty sessions give all-null series', () => {
    const data = App.buildRadarData([]);
    assert.ok(data.current.every(v => v === null));
    assert.ok(data.previous.every(v => v === null));
  });
});
