/* PrepAgent research — keyless company briefing via the Wikipedia REST API.
 * fetchCompanySummary(name, fetchImpl) — fetchImpl injectable for tests. */
(function (root) {
  'use strict';

  function defaultFetch() {
    if (typeof fetch !== 'undefined') return fetch;
    throw new Error('No fetch implementation available.');
  }

  function parseSummary(data) {
    if (!data || typeof data !== 'object') return { ok: false, reason: 'bad-response' };
    if (data.type === 'disambiguation') {
      return { ok: false, reason: 'disambiguation', title: data.title };
    }
    if (!data.extract) return { ok: false, reason: 'empty' };
    var url = data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page;
    return {
      ok: true,
      title: data.title,
      extract: data.extract,
      url: url || null,
      thumbnail: data.thumbnail && data.thumbnail.source ? data.thumbnail.source : null
    };
  }

  async function fetchCompanySummary(name, fetchImpl) {
    var clean = (name || '').trim();
    if (!clean) return { ok: false, reason: 'empty-query' };
    var impl = fetchImpl || defaultFetch();
    var title = encodeURIComponent(clean.replace(/\s+/g, '_'));
    var url = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + title;
    var res;
    try {
      res = await impl(url, { headers: { 'Accept': 'application/json' } });
    } catch (e) {
      return { ok: false, reason: 'network', detail: String(e && e.message || e) };
    }
    if (res.status === 404) return { ok: false, reason: 'not-found' };
    if (!res.ok) return { ok: false, reason: 'http-' + res.status };
    var data;
    try { data = await res.json(); }
    catch (e) { return { ok: false, reason: 'bad-json' }; }
    return parseSummary(data);
  }

  /* One-line briefing hook: turns a summary into interview-prep context. */
  function briefingLine(summary, role) {
    if (!summary || !summary.ok) return null;
    var first = (summary.extract || '').split('. ')[0];
    if (first && first.charAt(first.length - 1) !== '.') first += '.';
    return {
      fact: first,
      angle: 'Expect questions tying your experience to ' + summary.title + '\u2019s domain — interviewers love "how would you apply X here?"'
        + (role ? ' for this ' + role + ' role.' : '.')
    };
  }

  /**
   * Tavily search (BYOK). Returns { ok, results: [{title, url, snippet}] }.
   * Graceful: any failure -> { ok: false, reason }. Never throws.
   */
  async function fetchTavilySearch(query, apiKey, fetchImpl, maxResults) {
    if (!apiKey) return { ok: false, reason: 'no-key' };
    var impl;
    try { impl = fetchImpl || defaultFetch(); }
    catch (e) { return { ok: false, reason: 'no-fetch' }; }
    var res;
    try {
      res = await impl('https://api.tavily.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          max_results: maxResults || 5,
          search_depth: 'basic',
          include_answer: false
        })
      });
    } catch (e) {
      return { ok: false, reason: 'network', detail: String(e && e.message || e) };
    }
    if (!res.ok) return { ok: false, reason: 'http-' + res.status };
    var data;
    try { data = await res.json(); }
    catch (e) { return { ok: false, reason: 'bad-json' }; }
    var results = (data.results || []).map(function (r) {
      return { title: r.title || '', url: r.url || '', snippet: (r.content || '').slice(0, 280) };
    }).filter(function (r) { return r.title || r.url; });
    return { ok: true, results: results };
  }

  /**
   * Company news + interview-reports bundle. Runs both queries; partial
   * success is fine (one may fail while the other lands).
   */
  async function fetchCompanyIntel(company, apiKey, fetchImpl) {
    var news = await fetchTavilySearch(company + ' company recent news', apiKey, fetchImpl, 4);
    var interviews = await fetchTavilySearch(company + ' interview questions experience', apiKey, fetchImpl, 4);
    return {
      ok: news.ok || interviews.ok,
      news: news.ok ? news.results : [],
      interviews: interviews.ok ? interviews.results : []
    };
  }

  root.PrepAgent = root.PrepAgent || {};
  root.PrepAgent.Research = {
    fetchCompanySummary: fetchCompanySummary,
    parseSummary: parseSummary,
    briefingLine: briefingLine,
    fetchTavilySearch: fetchTavilySearch,
    fetchCompanyIntel: fetchCompanyIntel
  };
})(typeof window !== 'undefined' ? window : globalThis);
