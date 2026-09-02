const FALLBACK_DATA = {
  schemaVersion: 1,
  city: "直方市",
  generatedAt: null,
  verifiedOn: "2026-09-01",
  population: {
    asOf: "2026年7月末",
    total: 53876,
    male: 25605,
    female: 28271,
    households: 27963,
    sourceUrl: "https://www.city.nogata.fukuoka.jp/home.html"
  },
  featured: [],
  latest: [],
  council: null,
  garbage: null,
  sourceHealth: [],
  bulletin: {
    archiveUrl: "https://www.city.nogata.fukuoka.jp/shisei/_1238/_2505/_16195.html",
    currentIssue: null,
    pages: [],
    drafts: [],
    availableIssues: [],
    sync: { status: "pending", message: "市報の最新号を確認しています。" }
  }
};

const state = {
  tab: "today",
  view: "tab",
  selectedId: null,
  detailSection: null,
  discoverQuery: "",
  discoverCategory: null,
  data: FALLBACK_DATA,
  loading: true,
  loadError: false,
};

const main = document.querySelector("#main");
const toast = document.querySelector("#toast");

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(value) {
  if (!value) return "初期データ";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function japaneseDate() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function normalizeData(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  return {
    ...FALLBACK_DATA,
    ...data,
    population: { ...FALLBACK_DATA.population, ...(data.population || {}) },
    featured: Array.isArray(data.featured) ? data.featured : [],
    latest: Array.isArray(data.latest) ? data.latest : [],
    sourceHealth: Array.isArray(data.sourceHealth) ? data.sourceHealth : [],
    bulletin: {
      ...FALLBACK_DATA.bulletin,
      ...(data.bulletin || {}),
      currentIssue: data.bulletin?.currentIssue || FALLBACK_DATA.bulletin.currentIssue,
      pages: Array.isArray(data.bulletin?.pages) ? data.bulletin.pages : [],
      drafts: Array.isArray(data.bulletin?.drafts) ? data.bulletin.drafts : [],
      availableIssues: Array.isArray(data.bulletin?.availableIssues) ? data.bulletin.availableIssues : [],
    },
  };
}

async function loadOfficialData() {
  state.loading = true;
  render();
  try {
    const [response, bulletinResponse] = await Promise.all([
      fetch(`./data/latest.json?v=${Date.now()}`, { cache: "no-store" }),
      fetch(`./data/bulletin.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const latest = await response.json();
    const bulletin = bulletinResponse?.ok ? await bulletinResponse.json() : {};
    state.data = normalizeData({ ...latest, bulletin });
    state.loadError = false;
  } catch (error) {
    console.warn("Official data load failed", error);
    state.data = FALLBACK_DATA;
    state.loadError = true;
  } finally {
    state.loading = false;
    render();
  }
}

function syncBanner() {
  const { generatedAt, verifiedOn } = state.data;
  if (state.loadError) {
    return `<div class="sync-banner is-warning" role="status"><strong>公式データを読み込めませんでした</strong><span>現在は最低限の初期情報を表示しています。公式ページで最新情報を確認してください。</span></div>`;
  }
  return `<div class="sync-banner" role="status">
    <div><span class="official-badge">公式情報ベース</span><strong>直方市の公開情報を表示</strong></div>
    <span>データ更新：${generatedAt ? esc(formatDateTime(generatedAt)) : esc(verifiedOn || "確認済み")}</span>
  </div>`;
}

function sourceLink(url, label = "直方市公式ページを見る") {
  if (!url) return "";
  return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
}

function categoryIcon(category = "") {
  if (/交通|バス/.test(category)) return "🚌";
  if (/教育|学校/.test(category)) return "🏫";
  if (/健康|スポーツ/.test(category)) return "🏃";
  if (/議会/.test(category)) return "🏛️";
  if (/ごみ|環境/.test(category)) return "🗑️";
  if (/防災|消防/.test(category)) return "🚒";
  if (/観光|イベント/.test(category)) return "🎪";
  if (/工事|道路/.test(category)) return "🚧";
  return "📌";
}

function realCard(item) {
  return `<article class="action-card real-card">
    <button class="card-open" type="button" data-real-id="${esc(item.id)}" aria-label="${esc(item.title)}の詳細を見る">
      <div class="card-row">
        <div class="card-icon blue" aria-hidden="true">${categoryIcon(item.category)}</div>
        <div class="card-body">
          <div class="card-kicker">${esc(item.category || "直方市情報")}</div>
          <h3 class="card-title">${esc(item.title)}</h3>
          <p class="card-copy">${esc(item.summary || "直方市公式情報です。")}</p>
          <div class="card-meta">
            ${item.status ? `<span class="pill verified">${esc(item.status)}</span>` : ""}
            ${item.published ? `<span class="pill">公開 ${esc(item.published)}</span>` : ""}
          </div>
        </div>
        <span class="arrow" aria-hidden="true">›</span>
      </div>
    </button>
  </article>`;
}

function latestRow(item) {
  return `<a class="latest-row" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">
    <div><span>${esc(item.date || "")}</span><strong>${esc(item.title)}</strong></div><span aria-hidden="true">↗</span>
  </a>`;
}

function bulletinPageRow(page) {
  const href = page.pdfUrl || page.sourceUrl;
  return `<a class="bulletin-page-row" href="${esc(href || "#")}" target="_blank" rel="noopener noreferrer">
    <div><span>${esc(page.pageLabel || "市報ページ")}</span><strong>${esc(page.sourceDescription || page.title || "公式PDF")}</strong></div><span aria-hidden="true">↗</span>
  </a>`;
}

function bulletinItems() {
  const bulletin = state.data.bulletin || {};
  const issue = bulletin.currentIssue;
  if (!issue) return [];
  const issueItem = {
    ...issue,
    id: issue.id || `bulletin-${issue.issueKey || "latest"}`,
    sourceUrl: issue.sourceUrl || bulletin.archiveUrl,
    pdfUrl: issue.wholePdfUrl || null,
    status: issue.isNewIssue ? "新号を検知" : (issue.status || "最新号"),
  };
  const pages = Array.isArray(bulletin.pages) ? bulletin.pages : [];
  return [issueItem, ...pages];
}

function bulletinPreview(bulletin) {
  if (!bulletin?.currentIssue) return "";
  const issue = bulletinItems()[0];
  const pages = Array.isArray(bulletin.pages) ? bulletin.pages : [];
  return `<div class="section bulletin-section">
    <div class="section-head"><div><h2>市報のおがた</h2><p>最新号を自動検知</p></div></div>
    ${realCard(issue)}
    <div class="bulletin-pages">
      <div class="bulletin-pages-head"><strong>ページごとの見出し</strong><span>${pages.length}ページ</span></div>
      ${pages.slice(0, 8).map(bulletinPageRow).join("") || emptyCard("ページ情報を確認中です。")}
    </div>
    ${sourceLink(issue.sourceUrl, "市報の号全体を確認")}
  </div>`;
}

function todayView() {
  if (state.loading) return loadingView();
  const d = state.data;
  const featured = d.featured.slice(0, 4);
  return `<section class="page">
    <div class="hero"><p class="eyebrow">${japaneseDate()}</p><h1>今日の直方</h1><p>暮らしに近い情報から、街の動きまで。</p></div>
    ${syncBanner()}

    <div class="section">
      <div class="section-head"><div><h2>いま知っておきたい</h2><p>直方市公式情報から</p></div></div>
      <div class="stack">${featured.length ? featured.map(realCard).join("") : emptyCard("最新情報を読み込み中、または取得できませんでした。")}</div>
    </div>

    ${councilPreview(d.council)}

    <div class="section">
      <div class="section-head"><h2>暮らしの基本</h2></div>
      <div class="life-grid">
        ${garbageMini(d.garbage)}
        ${populationMini(d.population)}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><div><h2>直方市の新着</h2><p>公式サイトのRSS等から同期</p></div></div>
      <div class="latest-list">${d.latest.slice(0, 7).map(latestRow).join("") || emptyCard("新着情報を取得できませんでした。")}</div>
    </div>

    ${bulletinPreview(d.bulletin)}

    <div class="section">
      <div class="section-head"><h2>すぐ見る</h2></div>
      <div class="quick-grid">
        <button class="quick-button" type="button" data-quick="nearby"><span>⌖</span><strong>場所から見る</strong></button>
        <button class="quick-button" type="button" data-quick="discover"><span>◎</span><strong>生活から探す</strong></button>
        <button class="quick-button" type="button" data-quick="ask"><span>✦</span><strong>直方のことを聞く</strong></button>
        <button class="quick-button" type="button" data-quick="money"><span>¥</span><strong>直方のお金</strong></button>
      </div>
    </div>
  </section>`;
}

function loadingView() {
  return `<section class="page"><div class="hero"><p class="eyebrow">${japaneseDate()}</p><h1>今日の直方</h1><p>公式情報を確認しています。</p></div><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div><p class="muted">直方市公式サイトの同期データを読み込んでいます…</p></div></section>`;
}

function councilPreview(council) {
  if (!council) return "";
  return `<div class="section">
    <div class="section-head"><div><h2>今月の市議会</h2><p>政治ニュースではなく「いつ何がある？」を短く</p></div></div>
    <article class="card info-card council-card">
      <div class="split-head"><div><span class="pill verified">${esc(council.status || "公式確認")}</span><h3>${esc(council.title || "市議会日程")}</h3></div><span class="big-date">${esc(council.nextDateLabel || "")}</span></div>
      <p>${esc(council.nextSummary || council.summary || "")}</p>
      ${sourceLink(council.sourceUrl)}
    </article>
  </div>`;
}

function garbageMini(garbage) {
  if (!garbage) return `<div class="card mini-card"><span class="mini-icon">🗑️</span><strong>ごみ収集</strong><p>地域設定後に使いやすくします。</p></div>`;
  return `<div class="card mini-card"><span class="mini-icon">🗑️</span><strong>ごみ収集</strong><p>${esc(garbage.summary || "収集日程を確認できます。")}</p>${sourceLink(garbage.sourceUrl, "収集日を確認")}</div>`;
}

function populationMini(pop) {
  return `<div class="card mini-card"><span class="mini-icon">🏘️</span><strong>直方の人口</strong><p class="number">${Number(pop.total || 0).toLocaleString("ja-JP")}人</p><small>${esc(pop.asOf || "")}</small>${sourceLink(pop.sourceUrl, "公式ページ")}</div>`;
}

function nearbyView() {
  const items = state.data.featured.filter((x) => x.location);
  return `<section class="page">
    <div class="hero"><p class="eyebrow">場所から見る</p><h1>この場所で何がある？</h1><p>架空の地図や距離は表示しません。公式ページで場所を確認できる情報だけを出しています。</p></div>
    ${syncBanner()}
    <div class="card info-card"><h2>地図は次の段階</h2><p>本物の緯度・経度が確認できたデータだけを地図に載せます。今は住所が明記された情報を一覧で確認できます。</p></div>
    <div class="section"><div class="section-head"><h2>場所が確認できる情報</h2><p>${items.length}件</p></div><div class="stack">${items.length ? items.map(realCard).join("") : emptyCard("現在、住所付きで表示できる同期情報がありません。")}</div></div>
  </section>`;
}

const discoverCategories = ["交通", "学校・教育", "健康・スポーツ", "議会", "ごみ", "観光・イベント", "防災", "その他"];

function combinedSearchItems() {
  const featured = state.data.featured.map((x) => ({ ...x, url: x.sourceUrl, date: x.published }));
  const latest = state.data.latest.map((x, i) => ({ id: `latest-${i}`, ...x, sourceUrl: x.url, published: x.date, summary: "直方市公式サイトの新着情報です。", category: classifyTitle(x.title) }));
  const bulletin = bulletinItems();
  const seen = new Set();
  return [...featured, ...latest, ...bulletin].filter((x) => {
    const key = `${x.title}|${x.sourceUrl || x.url || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyTitle(title = "") {
  if (/バス|交通|路線|時刻/.test(title)) return "交通";
  if (/学校|小学校|中学校|教育|就学|給食/.test(title)) return "学校・教育";
  if (/健康|スポーツ|体育|ピラティス|講習/.test(title)) return "健康・スポーツ";
  if (/議会|定例会|会議録|議案/.test(title)) return "議会";
  if (/ごみ|廃棄|リサイクル/.test(title)) return "ごみ";
  if (/消防|災害|防災|火災|避難/.test(title)) return "防災";
  if (/観光|キャンプ|イベント|まつり|シンポジウム|マンホール/.test(title)) return "観光・イベント";
  return "その他";
}

function normalizeQuery(q = "") {
  return q.trim().replaceAll("ゴミ", "ごみ").replaceAll("子供", "子ども").toLowerCase();
}

function discoverView() {
  const all = combinedSearchItems();
  const q = normalizeQuery(state.discoverQuery);
  const category = state.discoverCategory;
  const results = all.filter((item) => {
    const text = normalizeQuery(`${item.title} ${item.summary || ""} ${item.category || ""}`);
    const matchesQ = !q || q.split(/\s+/).every((token) => text.includes(token));
    const matchesCategory = !category || (item.category || classifyTitle(item.title)) === category;
    return matchesQ && matchesCategory;
  });
  return `<section class="page">
    <div class="hero"><p class="eyebrow">見つける</p><h1>役所の言葉を知らなくて大丈夫</h1><p>「バス」「学校」「ごみ」など普通の言葉で探せます。</p></div>
    ${syncBanner()}
    <form class="search-box" id="discover-form"><span aria-hidden="true">⌕</span><input id="discover-search" type="search" value="${esc(state.discoverQuery)}" placeholder="例：バス、学校、キャンプ" aria-label="街の情報を検索"><button>探す</button></form>
    <div class="filter-row" aria-label="カテゴリで絞る"><button class="filter-chip ${!category ? "is-active" : ""}" type="button" data-category-filter="">すべて</button>${discoverCategories.map((x) => `<button class="filter-chip ${category === x ? "is-active" : ""}" type="button" data-category-filter="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div class="section"><div class="section-head"><h2>検索結果</h2><p>${results.length}件</p></div><div class="stack">${results.length ? results.slice(0, 20).map(realCard).join("") : emptyCard("該当する同期情報は見つかりませんでした。公式サイトの全文検索は次の段階で接続します。")}</div></div>
  </section>`;
}

function askView(answer = "") {
  return `<section class="page">
    <div class="hero"><p class="eyebrow">公式情報に質問</p><h1>ふつうの言葉で聞く。</h1><p>同期済みの公式資料に直接答えがある質問だけに回答します。</p></div>
    ${syncBanner()}
    <div class="ask-panel"><h2>何が気になる？</h2><p>質問の一部に関係する言葉があっても、質問そのものに答える資料がなければ「確認できません」と返します。</p><form class="ask-form" id="ask-form"><input id="ask-input" type="text" placeholder="10月からバスどう変わる？" autocomplete="off" aria-label="直方について質問"><button class="primary-button" type="submit">聞く</button></form><div class="suggestion-list"><button class="suggestion-chip" type="button" data-question="10月からバスどう変わる？">10月からバスどう変わる？</button><button class="suggestion-chip" type="button" data-question="今度の市議会いつ？">今度の市議会いつ？</button><button class="suggestion-chip" type="button" data-question="ごみの収集日は？">ごみの収集日は？</button><button class="suggestion-chip" type="button" data-question="直方の人口は？">直方の人口は？</button></div></div>
    ${answer}
  </section>`;
}

function answerFor(question) {
  const q = normalizeQuery(question);
  if (!q) return "";
  const d = state.data;
  let answer = null;

  const bus = d.featured.find((x) => /バス|路線と時刻表/.test(x.title));
  if (/バス|路線|時刻|バス停/.test(q) && /変|どう|いつ|路線|時刻|バス停|運行/.test(q) && bus) {
    answer = { title: "10月1日からコミュニティバスが変わります", body: bus.summary, url: bus.sourceUrl };
  } else if (/議会|定例会|市議会/.test(q) && /いつ|日程|次|何|内容|予定/.test(q) && d.council) {
    answer = { title: d.council.title, body: `${d.council.nextDateLabel || ""} ${d.council.nextSummary || d.council.summary || ""}`.trim(), url: d.council.sourceUrl };
  } else if (/ごみ|収集|カン|ビン|燃や/.test(q) && /いつ|日|曜日|捨て|出す|収集/.test(q) && d.garbage) {
    answer = { title: "ごみ・資源リサイクルの収集日", body: d.garbage.summary, url: d.garbage.sourceUrl };
  } else if (/人口|何人|世帯/.test(q)) {
    answer = { title: `直方市の人口は ${Number(d.population.total || 0).toLocaleString("ja-JP")}人`, body: `${d.population.asOf}現在。世帯数は ${Number(d.population.households || 0).toLocaleString("ja-JP")}世帯です。`, url: d.population.sourceUrl };
  } else if (/ピラティス/.test(q) && /いつ|どこ|申込|申し込|料金|参加|募集/.test(q)) {
    const item = d.featured.find((x) => /ピラティス/.test(x.title));
    if (item) answer = { title: item.title, body: item.summary, url: item.sourceUrl };
  } else if (/就学|健康診断/.test(q) && /いつ|どこ|対象|会場|日程/.test(q)) {
    const item = d.featured.find((x) => /就学時健康診断/.test(x.title));
    if (item) answer = { title: item.title, body: item.summary, url: item.sourceUrl };
  }

  if (!answer) {
    return `<div class="card answer-card" role="status"><span class="pill">公開資料で確認できず</span><h3>その質問には、現在の資料から直接答えられません</h3><p>質問に関係しそうな別の情報を、答えの代わりには表示しません。言葉を変えて検索するか、公式窓口で確認してください。</p><p class="muted">入力した質問：${esc(question)}</p></div>`;
  }

  return `<div class="card answer-card" role="status"><span class="pill verified">質問に対応する公式情報</span><h3>${esc(answer.title)}</h3><p>${esc(answer.body)}</p>${sourceLink(answer.url, "根拠の公式ページ")}</div>`;
}

function detailView(item) {
  if (!item) return todayView();
  const section = state.detailSection;
  const buttons = [
    ["what", "これ何？", "まず概要"],
    ["why", "なんで？", "理由"],
    ["money", "いくら？", "お金"],
    ["decision", "誰が決めた？", "決まり方"],
  ];
  return `<section class="page">
    <button class="back-button" type="button" data-action="back">‹ 戻る</button>
    <div class="detail-hero"><div class="big-icon" aria-hidden="true">${categoryIcon(item.category)}</div><p class="eyebrow">${esc(item.category || "直方市情報")}</p><h1>${esc(item.title)}</h1><p>${esc(item.summary || "")}</p><div class="card-meta">${item.status ? `<span class="pill verified">${esc(item.status)}</span>` : ""}${item.published ? `<span class="pill">公開 ${esc(item.published)}</span>` : ""}</div></div>
    <div class="question-grid" aria-label="詳しく見る">${buttons.map(([key, label, small]) => `<button class="question-button ${section === key ? "is-active" : ""}" type="button" data-section="${key}" aria-pressed="${section === key}"><span>${small}</span><strong>${label}</strong></button>`).join("")}</div>
    ${renderDetailSection(item, section)}
  </section>`;
}

function renderDecisionEvidence(item) {
  const timeline = Array.isArray(item.decisionTimeline) ? item.decisionTimeline : [];
  const unknowns = Array.isArray(item.decisionUnknowns) ? item.decisionUnknowns : [];
  const sources = Array.isArray(item.decisionSources) ? item.decisionSources : [];
  if (!timeline.length && !unknowns.length && !sources.length) return "";
  return `<div class="decision-evidence">
    ${timeline.length ? `<h3>公式資料で追える経緯</h3><ol class="decision-timeline">${timeline.map((step) => `<li><div class="decision-date"><time>${esc(step.date || "日付確認中")}</time>${step.status ? `<span class="pill">${esc(step.status)}</span>` : ""}</div><h4>${esc(step.title || "確認できた出来事")}</h4><p>${esc(step.detail || "")}</p>${step.url ? sourceLink(step.url, "この段階の公式資料") : ""}</li>`).join("")}</ol>` : ""}
    ${unknowns.length ? `<div class="decision-unknowns"><h3>まだ確認できないこと</h3><ul class="plain-list">${unknowns.map((fact) => `<li>${esc(fact)}</li>`).join("")}</ul><p>資料が見つかるまで、推測で「決定」とは表示しません。</p></div>` : ""}
    ${sources.length ? `<div class="decision-source-list"><h3>この経緯に使った一次資料</h3>${sources.map((source) => sourceLink(source.url, source.label || "公式資料を見る")).join("")}</div>` : ""}
  </div>`;
}

function renderDetailSection(item, section) {
  if (!section || section === "what") {
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];
    const confirmed = [
      item.when ? `時期・日程：${item.when}` : "",
      item.location ? `場所：${item.location}` : "",
      ...bullets,
    ].filter(Boolean);
    const sourceDate = item.sourceUpdated || item.published || state.data.verifiedOn || "確認中";
    return `<div class="detail-layers">
      <div class="card info-card detail-layer"><span class="detail-layer-label">MYTOWNによる30秒要約</span><h2>30秒でいうと</h2><p>${esc(item.summary || "")}</p></div>
      <div class="card info-card detail-layer"><span class="detail-layer-label">3分で背景まで</span><h2>もう少しくわしく</h2>
        <h3>公式資料で確認できた事実</h3>${confirmed.length ? `<ul class="plain-list">${confirmed.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>この項目について、追加で整理できる事実はまだありません。</p>`}
        <h3>なぜ？</h3><p>${esc(item.why || "この公式ページだけからは、理由を十分に確認できません。推測では補いません。")}</p>
        <h3>お金</h3>${item.money ? `<p class="money-value">${esc(item.money)}</p><p>${esc(item.moneyNote || "")}</p>` : `<p>この公式ページからは、費用・予算額を確認できません。</p>`}
        <h3>誰が、どう決めた？</h3><p>${esc(item.decision || "このページだけでは、提案・審議・契約などの意思決定全体を確認できません。")}</p>${renderDecisionEvidence(item)}
      </div>
      <div class="card info-card detail-layer source-layer"><span class="detail-layer-label">原文・一次資料</span><h2>情報源</h2><dl class="source-facts"><div><dt>公開主体</dt><dd>直方市</dd></div><div><dt>公式公開・更新</dt><dd>${esc(sourceDate)}</dd></div><div><dt>MYTOWN最終確認</dt><dd>${esc(state.data.verifiedOn || formatDateTime(state.data.generatedAt) || "確認中")}</dd></div></dl>${sourceLink(item.sourceUrl, "公式原文を見る")}${item.pdfUrl ? sourceLink(item.pdfUrl, "市報PDFを見る") : ""}</div>
    </div>`;
  }
  if (section === "why") {
    return `<div class="card info-card"><h2>なんで？</h2><p>${esc(item.why || "この公式ページだけからは、理由を十分に確認できません。推測では補いません。")}</p>${sourceLink(item.sourceUrl)}</div>`;
  }
  if (section === "money") {
    return `<div class="card info-card"><h2>いくら？</h2>${item.money ? `<p class="money-value">${esc(item.money)}</p><p>${esc(item.moneyNote || "")}</p>` : `<p>この公式ページからは、この情報に関する費用・予算額を確認できません。</p>`}${sourceLink(item.sourceUrl)}</div>`;
  }
  return `<div class="card info-card"><h2>誰が決めた？</h2><p>${esc(item.decision || "このページだけでは、提案・予算・議会・契約までの意思決定全体を確認できません。関連する議案・予算・会議録を一次資料同士で結び付ける機能は次の開発段階です。")}</p>${renderDecisionEvidence(item)}${sourceLink(item.sourceUrl, "変更案内の公式原文")}</div>`;
}

function moneyView() {
  return `<section class="page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="hero"><p class="eyebrow">直方のお金</p><h1>数字は、確認できたものだけ。</h1><p>現在は本格的な予算データ未接続です。</p></div>${syncBanner()}<div class="card info-card"><h2>まだ「円グラフ」は出しません</h2><p>令和8年度予算書・補正予算・決算を正確に構造化して検算してから表示します。個人の税金と特定事業を直接結び付ける表現もしません。</p><a class="source-link" href="https://www.city.nogata.fukuoka.jp/shisei/_1242/_2796/" target="_blank" rel="noopener noreferrer">直方市の財政・予算・決算へ ↗</a></div></section>`;
}

function settingsView() {
  return `<section class="page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="hero"><p class="eyebrow">設定</p><h1>自分にちょうどいい直方へ</h1><p>住所やアカウント登録はまだ必要ありません。</p></div><div class="card info-card"><h2>このアプリについて</h2><p>MYTOWNは非公式のMVPです。直方市公式アプリではありません。表示内容は直方市の公開情報を定期同期し、必ず公式ページへのリンクを付けます。</p><p class="fact-line"><strong>自動同期：</strong>GitHub Actionsで約2時間ごと（実行時刻は前後することがあります）</p></div></section>`;
}

function emptyCard(message) {
  return `<div class="card info-card"><p>${esc(message)}</p></div>`;
}

function currentSelectedItem() {
  return state.data.featured.find((x) => x.id === state.selectedId) || null;
}

function parentTabForView() {
  if (state.view === "detail") return state.tab;
  if (state.view === "money" || state.view === "settings") return state.tab;
  return state.tab;
}

function render() {
  document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === parentTabForView()));
  if (state.view === "detail") main.innerHTML = detailView(currentSelectedItem());
  else if (state.view === "money") main.innerHTML = moneyView();
  else if (state.view === "settings") main.innerHTML = settingsView();
  else if (state.tab === "nearby") main.innerHTML = nearbyView();
  else if (state.tab === "discover") main.innerHTML = discoverView();
  else if (state.tab === "ask") main.innerHTML = askView();
  else main.innerHTML = todayView();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function goTab(tab) {
  state.tab = tab;
  state.view = "tab";
  state.detailSection = null;
  state.selectedId = null;
  history.pushState({ tab }, "", `#${tab}`);
  render();
}

function goBack() {
  state.view = "tab";
  state.detailSection = null;
  state.selectedId = null;
  render();
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) return goTab(tab.dataset.tab);
  const real = event.target.closest("[data-real-id]");
  if (real) {
    state.selectedId = real.dataset.realId;
    state.detailSection = null;
    state.view = "detail";
    return render();
  }
  const section = event.target.closest("[data-section]");
  if (section) { state.detailSection = section.dataset.section; return render(); }
  const quick = event.target.closest("[data-quick]");
  if (quick) {
    if (quick.dataset.quick === "money") { state.view = "money"; return render(); }
    return goTab(quick.dataset.quick);
  }
  const filter = event.target.closest("[data-category-filter]");
  if (filter) { state.discoverCategory = filter.dataset.categoryFilter || null; return render(); }
  const question = event.target.closest("[data-question]");
  if (question) { main.innerHTML = askView(answerFor(question.dataset.question)); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "go-home") return goTab("today");
  if (action.dataset.action === "open-settings") { state.view = "settings"; return render(); }
  if (action.dataset.action === "back") return goBack();
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "ask-form") {
    event.preventDefault();
    const input = document.querySelector("#ask-input");
    main.innerHTML = askView(answerFor(input?.value || ""));
  }
  if (event.target.id === "discover-form") {
    event.preventDefault();
    state.discoverQuery = document.querySelector("#discover-search")?.value || "";
    render();
  }
});

window.addEventListener("popstate", () => {
  const hash = location.hash.replace("#", "");
  if (["today", "nearby", "discover", "ask"].includes(hash)) state.tab = hash;
  state.view = "tab";
  state.detailSection = null;
  state.selectedId = null;
  render();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

render();
loadOfficialData();
