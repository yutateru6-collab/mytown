/* Independently written civic/business guide. No external AI service is called. */
'use strict';
(function () {
  const ROUTES = Object.freeze({ 'city-moves': ['市政の動き', '議会で決まったことと、まだ決まっていないこと。', 'civic'], business: ['商売のチャンス', '出店支援や市の発注を、条件と期限から確認。', 'business'], projects: ['地域事業を追う', '地域の事業を、議会・予算・実施の資料でたどる。', 'project'] });
  const escape = (v = '') => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (value) => { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } };
  function selectItems(items, route, query = '', stage = '') {
    const category = ROUTES[route]?.[2];
    return (items || []).filter((i) => i.categories?.includes(category) && (!stage || i.stage === stage) && `${i.title} ${i.summary} ${(i.tags || []).join(' ')} ${(i.officialFacts || []).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase()));
  }
  function entries() {
    return `<section class="cb-entry" aria-labelledby="cb-entry-title"><p class="cb-eyebrow">市政と商売を、地域の事業から</p><h2 id="cb-entry-title">直方の動きをつかむ</h2><nav class="cb-entry-grid" aria-label="市政とビジネスの入口">${Object.entries(ROUTES).map(([route, [title, note]], n) => `<a class="cb-entry-link cb-tone-${n}" href="#${route}" data-cb-route="${route}"><span aria-hidden="true">${['議','商','地'][n]}</span><div><strong>${title}</strong><small>${note}</small></div><b aria-hidden="true">›</b></a>`).join('')}</nav><small class="cb-disclosure">市・議会の公式サービスではありません。原典で確認できた少数の案件を掲載しています。</small></section>`;
  }
  function card(item, items) {
    const links = (item.sources || []).map((s) => { const url = safeUrl(s.url); return url ? `<a href="${escape(url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)} ↗</a>` : ''; }).join('');
    const related = (item.relatedIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
    return `<article class="cb-card" id="cb-${escape(item.id)}"><div class="cb-card-meta"><span class="cb-stage">${escape(item.stage)}</span><small>対象：${escape(item.targetDate)}</small></div><p class="cb-stage-note">${escape(item.stageNote || '')}</p><h2>${escape(item.title)}</h2><p class="cb-summary-label">AIによる非公式要約（出典付き）</p><p>${escape(item.summary)}</p><dl class="cb-numbers"><div><dt>金額</dt><dd>${escape(item.amount)}</dd></div><div><dt>期限・受付</dt><dd>${escape(item.deadline)}</dd></div></dl><details><summary>論点と一次資料を読む</summary><div class="cb-detail"><h3>公式資料で確認した事実</h3><ul>${(item.officialFacts || []).map((x) => `<li>${escape(x)}</li>`).join('')}</ul><h3>確認しておきたいこと</h3><ul>${(item.issues || []).map((x) => `<li>${escape(x)}</li>`).join('')}</ul><h3>商売への影響を考える（推論）</h3><p>${escape(item.businessImpact)}</p><p class="cb-disclosure">事業への効果や採択・受注を保証するものではありません。</p>${related.length ? `<h3>つながる地域案件</h3>${related.map((i) => `<button type="button" data-cb-related="${escape(i.id)}">${escape(i.title)} →</button>`).join('')}` : ''}<h3>一次資料</h3><div class="cb-sources">${links}</div><p class="cb-checked">最終確認：${escape(item.checkedAt)}。確認後に変更されることがあります。申請・入札前に原典を確認してください。</p></div></details></article>`;
  }
  const api = { ROUTES, escape, safeUrl, selectItems, entries, card };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  let data = { items: [] }, loading = true, error = false, query = '', stage = '', focusedHash = '';
  function revealLinkedItem() {
    const hash = location.hash;
    if (loading) return;
    const encodedId = hash.slice(1).split('/')[1];
    if (!encodedId) { focusedHash = ''; return; }
    let id;
    try { id = decodeURIComponent(encodedId); } catch { return; }
    const item = document.getElementById(`cb-${id}`);
    if (!item) return;
    const details = item.querySelector('details');
    if (details) details.open = true;
    if (hash === focusedHash) return;
    focusedHash = hash;
    requestAnimationFrame(() => {
      if (location.hash !== hash) return;
      item.scrollIntoView({ block: 'start', behavior: 'auto' });
      const title = item.querySelector('h2');
      if (title) { title.setAttribute('tabindex', '-1'); title.focus({ preventScroll: true }); }
    });
  }
  function route() { return location.hash.slice(1).split('/')[0]; }
  function page() {
    const key = route(), [title, note] = ROUTES[key];
    const items = selectItems(data.items, key, query, stage);
    const statuses = [...new Set(selectItems(data.items, key).map((i) => i.stage))];
    return `<section class="page cb-page"><button class="back-button" type="button" data-v2-action="home">‹ きょうへ</button><header class="cb-hero"><p class="cb-eyebrow">のおがた日和 · 市政とビジネス</p><h1>${title}</h1><p>${note}</p></header>${entries()}<div class="cb-note"><strong>議論・提案・議決・実施・報告を区別します</strong><p>議決は議会の判断、実施は事業の進行、報告は公表された記録です。発注見通しは契約や募集の確定ではありません。</p><p>AIによる要約、公式資料の事実、商売への影響の推論を分けて掲載しています。全案件・全議員の活動を網羅するものではありません。</p></div><form class="cb-filters"><label>案件を探す<input name="query" value="${escape(query)}" placeholder="出店、工事、産業団地…" type="search"></label><label>資料の状態<select name="stage"><option value="">すべて</option>${statuses.map((s) => `<option ${stage === s ? 'selected' : ''} value="${escape(s)}">${escape(s)}</option>`).join('')}</select></label><button type="submit">絞り込む</button><button type="button" data-cb-clear>条件を消す</button></form><p class="cb-count" role="status">${loading ? '資料を読み込んでいます。' : `${items.length}件を掲載`}</p>${error ? '<div class="cb-empty" role="alert"><p>案件データを読み込めませんでした。</p><button type="button" data-cb-retry>もう一度読み込む</button></div>' : !loading && !items.length ? '<div class="cb-empty"><p>この条件に合う案件はありません。条件を消して探し直せます。</p></div>' : ''}<div class="cb-list">${items.map((i) => card(i, data.items)).join('')}</div><footer class="cb-footer">掲載範囲：公式資料を確認した地域案件のみ。議員のランキングや政治的な自動評価は行いません。</footer></section>`;
  }
  function go(key, id) { query = ''; stage = ''; v2CloseSheet(false); v2SetRoute({ tab: 'politics', page: null, hash: `#${key}${id ? '/' + encodeURIComponent(id) : ''}` }); if (!id) window.scrollTo({ top: 0, behavior: 'auto' }); }
  const baseHash = v2ApplyHashRoute;
  v2ApplyHashRoute = function () { if (ROUTES[route()]) { state.tab = 'politics'; state.view = 'tab'; state.v2Page = null; state.selectedId = null; return; } baseHash(); };
  const baseRender = render;
  render = function () {
    if (ROUTES[route()] && state.view === 'tab' && state.tab === 'politics') { main.innerHTML = page(); v2SyncNav(); revealLinkedItem(); return; }
    focusedHash = '';
    baseRender();
    if (state.view === 'tab' && ((state.tab === 'today' && !state.v2Page) || state.tab === 'politics') && !main.querySelector('.cb-entry')) {
      const container = main.querySelector('.v2-home-page, .politics-page, .civic-page');
      if (container) container.insertAdjacentHTML('afterbegin', entries());
    }
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-cb-route]'); if (link) { event.preventDefault(); go(link.dataset.cbRoute); return; }
    const related = event.target.closest('[data-cb-related]'); if (related) { go('projects', related.dataset.cbRelated); return; }
    if (event.target.closest('[data-cb-clear]')) { query = ''; stage = ''; render(); }
    if (event.target.closest('[data-cb-retry]')) load();
  });
  document.addEventListener('submit', (event) => { if (!event.target.matches('.cb-filters')) return; event.preventDefault(); const form = new FormData(event.target); query = String(form.get('query') || ''); stage = String(form.get('stage') || ''); render(); });
  async function load() { loading = true; error = false; render(); try { const response = await fetch('./data/civic-business.json', { cache: 'no-store' }); if (!response.ok) throw Error(`HTTP ${response.status}`); const payload = await response.json(); if (!Array.isArray(payload.items)) throw Error('Invalid items'); data = payload; } catch (e) { error = true; data = { items: [] }; console.warn('Civic business data load failed', e); } finally { loading = false; render(); } }
  v2ApplyHashRoute(); render(); load();
})();
