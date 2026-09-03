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
  meetings: {
    schemaVersion: 1,
    verifiedOn: null,
    seriesTitle: "",
    source: {},
    meetings: []
  },
  garbage: null,
  communityEvents: {
    schemaVersion: 1,
    generatedAt: null,
    events: [],
    sourceHealth: []
  },
  community: {
    schemaVersion: 1,
    generatedAt: null,
    organizations: [],
    activities: [],
    sourceHubs: [],
    sourceHealth: []
  },
  changes: {
    schemaVersion: 1,
    generatedAt: null,
    changes: []
  },
  sourceHealth: [],
  bulletin: {
    archiveUrl: "https://www.city.nogata.fukuoka.jp/shisei/_1238/_2505/_16195.html",
    currentIssue: null,
    pages: [],
    drafts: [],
    availableIssues: [],
    sync: { status: "pending", message: "市報の最新号を更新しています。" }
  }
};

const VISIT_STORAGE_KEY = "mytown-last-visit-v1";

function readPriorVisitAt() {
  try {
    const saved = JSON.parse(localStorage.getItem(VISIT_STORAGE_KEY) || "{}");
    const parsed = new Date(saved.seenAt || "");
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  } catch (error) {
    console.warn("Previous visit could not be read", error);
    return null;
  }
}

function recordSuccessfulVisit() {
  try {
    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify({ seenAt: new Date().toISOString() }));
  } catch (error) {
    console.warn("Visit could not be saved", error);
  }
}

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
  priorVisitAt: readPriorVisitAt(),
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
    meetings: {
      ...FALLBACK_DATA.meetings,
      ...(data.meetings || {}),
      source: { ...FALLBACK_DATA.meetings.source, ...(data.meetings?.source || {}) },
      meetings: Array.isArray(data.meetings?.meetings) ? data.meetings.meetings : [],
    },
    communityEvents: {
      ...FALLBACK_DATA.communityEvents,
      ...(data.communityEvents || {}),
      events: Array.isArray(data.communityEvents?.events) ? data.communityEvents.events : [],
      sourceHealth: Array.isArray(data.communityEvents?.sourceHealth) ? data.communityEvents.sourceHealth : [],
    },
    community: {
      ...FALLBACK_DATA.community,
      ...(data.community || {}),
      organizations: Array.isArray(data.community?.organizations) ? data.community.organizations : [],
      activities: Array.isArray(data.community?.activities) ? data.community.activities : [],
      sourceHubs: Array.isArray(data.community?.sourceHubs) ? data.community.sourceHubs : [],
      sourceHealth: Array.isArray(data.community?.sourceHealth) ? data.community.sourceHealth : [],
    },
    changes: {
      ...FALLBACK_DATA.changes,
      ...(data.changes || {}),
      changes: Array.isArray(data.changes?.changes) ? data.changes.changes : [],
    },
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
    const [response, bulletinResponse, changesResponse, communityEventsResponse, communityResponse, meetingsResponse] = await Promise.all([
      fetch(`./data/latest.json?v=${Date.now()}`, { cache: "no-store" }),
      fetch(`./data/bulletin.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      fetch(`./data/changes.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      fetch(`./data/community-events.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      fetch(`./data/community.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
      fetch(`./data/meetings.json?v=${Date.now()}`, { cache: "no-store" }).catch(() => null),
    ]);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const latest = await response.json();
    const bulletin = bulletinResponse?.ok ? await bulletinResponse.json() : {};
    const changes = changesResponse?.ok ? await changesResponse.json() : FALLBACK_DATA.changes;
    const communityEvents = communityEventsResponse?.ok ? await communityEventsResponse.json() : FALLBACK_DATA.communityEvents;
    const community = communityResponse?.ok ? await communityResponse.json() : FALLBACK_DATA.community;
    const meetings = meetingsResponse?.ok ? await meetingsResponse.json() : FALLBACK_DATA.meetings;
    state.data = normalizeData({ ...latest, bulletin, changes, communityEvents, community, meetings });
    state.loadError = false;
  } catch (error) {
    console.warn("Official data load failed", error);
    state.data = FALLBACK_DATA;
    state.loadError = true;
  } finally {
    state.loading = false;
    render();
    if (!state.loadError) recordSuccessfulVisit();
  }
}

function tokyoDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyOffset(dateKey, offset) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
  if (!match) return "";
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offset)).toISOString().slice(0, 10);
}

function meetingDateKey(meeting = {}) {
  const start = String(meeting.start || "");
  return /^\d{4}-\d{2}-\d{2}/.test(start) ? start.slice(0, 10) : "";
}

function currentCouncilSchedule(now = new Date()) {
  const fallback = state.data?.council || {};
  const schedule = state.data?.meetings || {};
  const today = tokyoDateKey(now);
  const meetings = (Array.isArray(schedule.meetings) ? schedule.meetings : [])
    .filter((meeting) => meetingDateKey(meeting))
    .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
  const next = meetings.find((meeting) => meetingDateKey(meeting) >= today);
  if (next) {
    const dateKey = meetingDateKey(next);
    const [, month, day] = dateKey.split("-").map(Number);
    const time = String(next.start || "").match(/T(\d{2}:\d{2})/)?.[1] || "";
    const dayLabel = dateKey === today ? "今日" : dateKey === dateKeyOffset(today, 1) ? "明日" : `${month}/${day}`;
    return {
      ...fallback,
      title: schedule.seriesTitle || fallback.title || "直方市議会",
      status: dateKey === today ? "本日予定" : "予定・変更の場合あり",
      nextDateKey: dateKey,
      nextDateLabel: `${dayLabel}${time ? ` ${time}` : ""}`,
      nextSummary: `${next.title || next.meetingType || "会議"}が予定されています。日程・開会時間は変更されることがあります。`,
      meetingTitle: next.title || "",
      sourceUrl: next.sourceUrl || schedule.source?.sourceUrl || fallback.sourceUrl || "",
      sourceUpdated: schedule.source?.sourceUpdated || fallback.sourceUpdated || "",
    };
  }
  return {
    ...fallback,
    title: schedule.seriesTitle || fallback.title || "直方市議会",
    status: "次回日程を確認中",
    nextDateKey: "",
    nextDateLabel: "次回日程を確認中",
    nextSummary: "公表済みの日程は終了しました。次の開催日が公表され次第、更新します。",
    sourceUrl: schedule.source?.sourceUrl || fallback.sourceUrl || "",
  };
}

function syncBanner() {
  const { generatedAt, verifiedOn } = state.data;
  if (state.loadError) {
    return `<div class="sync-banner is-warning" role="status"><strong>公式データを読み込めませんでした</strong><span>現在は最低限の初期情報を表示しています。公式ページで最新情報を確認してください。</span></div>`;
  }
  return `<div class="sync-banner" role="status">
    <div><span class="official-badge">市の公開情報から</span><strong>直方市の情報を掲載</strong></div>
    <span>最終更新：${generatedAt ? esc(formatDateTime(generatedAt)) : esc(verifiedOn || "確認済み")}</span>
  </div>`;
}

function sourceLink(url, label = "直方市のページを見る") {
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
          <p class="card-copy">${esc(item.summary || "直方市が公開した情報です。")}</p>
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
    status: issue.isNewIssue ? "新しい号" : (issue.status || "最新号"),
  };
  const pages = Array.isArray(bulletin.pages) ? bulletin.pages : [];
  return [issueItem, ...pages];
}

function bulletinPreview(bulletin) {
  if (!bulletin?.currentIssue) return "";
  const issue = bulletinItems()[0];
  const pages = Array.isArray(bulletin.pages) ? bulletin.pages : [];
  return `<div class="section bulletin-section">
    <div class="section-head"><div><h2>市報のおがた</h2><p>最新号を掲載</p></div></div>
    ${realCard(issue)}
    <div class="bulletin-pages">
      <div class="bulletin-pages-head"><strong>主な見出し</strong><span>${pages.length}ページ</span></div>
      ${pages.slice(0, 8).map(bulletinPageRow).join("") || emptyCard("見出しを更新しています。")}
    </div>
    ${sourceLink(issue.sourceUrl, "市報をまとめて見る")}
  </div>`;
}

function todayView() {
  if (state.loading) return loadingView();
  const d = state.data;
  const featured = d.featured.slice(0, 4);
  return `<section class="page">
    <div class="hero"><p class="eyebrow">${japaneseDate()}</p><h1>のおがた日和</h1><p>知れば直方はもっとおもしろい！</p></div>
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
      <div class="section-head"><div><h2>直方市の新着</h2><p>市の新着情報から</p></div></div>
      <div class="latest-list">${d.latest.slice(0, 7).map(latestRow).join("") || emptyCard("新着情報を取得できませんでした。")}</div>
    </div>

    ${bulletinPreview(d.bulletin)}

    <div class="section">
      <div class="section-head"><h2>すぐ見る</h2></div>
      <div class="quick-grid">
        <button class="quick-button" type="button" data-quick="nearby"><span>⌖</span><strong>場所から見る</strong></button>
        <button class="quick-button" type="button" data-quick="discover"><span>◎</span><strong>生活から探す</strong></button>
        <button class="quick-button" type="button" data-quick="ask"><span>✦</span><strong>直方のことを聞く</strong></button>
        <button class="quick-button" type="button" data-quick="money"><span>¥</span><strong>直方市の予算</strong></button>
      </div>
    </div>
  </section>`;
}

function loadingView() {
  return `<section class="page"><div class="hero"><p class="eyebrow">${japaneseDate()}</p><h1>のおがた日和</h1><p>知れば直方はもっとおもしろい！</p></div><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div><p class="muted">直方市公式サイトの同期データを読み込んでいます…</p></div></section>`;
}

function councilPreview(council) {
  if (!council) return "";
  return `<div class="section">
    <div class="section-head"><div><h2>次の市議会</h2><p>日程と内容</p></div></div>
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
  const items = combinedSearchItems().filter((item) => item.location);
  return `<section class="page">
    <div class="hero"><p class="eyebrow">近く</p><h1>場所から情報を探す</h1><p>イベント・施設・工事など、場所を確認できた情報をまとめます。</p></div>
    ${syncBanner()}
    <div class="card info-card"><h2>位置を確認できた情報だけ地図に表示</h2><p>住所だけ確認できた情報は一覧に、緯度経度まで確認できた情報は地図にも表示します。</p></div>
    <div class="section"><div class="section-head"><h2>場所が確認できる情報</h2><p>${items.length}件</p></div><div class="stack">${items.length ? items.slice(0, 40).map(realCard).join("") : emptyCard("場所を確認できる情報は、まだありません。")}</div></div>
  </section>`;
}

const discoverCategories = ["交通", "学校・教育", "健康・スポーツ", "ごみ", "観光・イベント", "地域活動", "工事・道路", "税金・予算", "市長・市議会", "防災", "市報", "その他"];

function searchableCommunityItems() {
  const events = (state.data?.communityEvents?.events || []).map((item) => ({
    ...item,
    url: item.sourceUrl,
    published: item.startDate || item.lastCheckedAt || "",
    category: item.category || "観光・イベント",
    sourceKind: "イベント",
    publisherName: item.publisherName || item.organizerName || "地域・施設",
  }));
  const activities = (state.data?.community?.activities || []).map((item) => ({
    ...item,
    url: item.sourceUrl,
    published: item.lastCheckedAt || "",
    category: item.category || "地域活動",
    sourceKind: "地域活動",
    publisherName: item.sourceName || "地域団体",
  }));
  const organizations = (state.data?.community?.organizations || []).map((item) => ({
    id: item.id,
    title: item.name,
    summary: item.summary || "直方で活動する団体です。",
    category: item.category || "地域団体",
    sourceUrl: item.sourceUrl,
    url: item.sourceUrl,
    published: item.lastCheckedAt || "",
    sourceKind: "団体",
    publisherName: item.sourceName || "公開団体一覧",
  }));
  return [...events, ...activities, ...organizations];
}

function searchableCivicItems() {
  const portal = state.civicPortal || {};
  const works = (portal.works || []).map((work) => ({
    id: `civic-work-${work.id || work.title}`,
    title: work.title,
    summary: `${work.location || ""}　予定工期 ${work.plannedPeriod || "確認中"}`.trim(),
    category: "工事・道路",
    location: work.location || "",
    status: work.status || "",
    sourceUrl: work.sourcePageUrl || work.sourcePdfUrl || "",
    url: work.sourcePageUrl || work.sourcePdfUrl || "",
    sourceKind: "工事",
    publisherName: "直方市",
  }));
  const budget = portal.budget?.generalAccountLabel ? [{
    id: `civic-budget-${portal.budget.fiscalYear || "current"}`,
    title: `${portal.budget.fiscalYear || ""} 直方市の当初予算`.trim(),
    summary: `一般会計 ${portal.budget.generalAccountLabel}`,
    category: "税金・予算",
    status: portal.budget.kind || "当初予算",
    sourceUrl: portal.budget.sourcePageUrl || portal.budget.sourcePdfUrl || "",
    url: portal.budget.sourcePageUrl || portal.budget.sourcePdfUrl || "",
    sourceKind: "予算",
    publisherName: "直方市",
  }] : [];
  const politics = state.politics || {};
  const mayor = politics.mayor?.name ? [{
    id: `politics-mayor-${politics.mayor.name}`,
    title: `直方市長 ${politics.mayor.name}`,
    summary: `${politics.mayor.term || ""}。公式資料で確認できた経歴を掲載しています。`,
    category: "市長・市議会",
    sourceUrl: politics.mayor.sources?.[0]?.url || "",
    url: politics.mayor.sources?.[0]?.url || "",
    sourceKind: "市長",
    publisherName: "直方市",
  }] : [];
  const members = (politics.council?.members || []).map((member) => ({
    id: `politician-${member.name}`,
    title: `市議会議員 ${member.name}`,
    summary: `${member.committee || "委員会確認中"}${member.recentQuestions?.length ? `。最近確認できた一般質問 ${member.recentQuestions.length}件` : ""}`,
    category: "市長・市議会",
    sourceUrl: politics.council?.membersSourceUrl || "",
    url: politics.council?.membersSourceUrl || "",
    sourceKind: "議員",
    publisherName: "直方市議会",
  }));
  return [...works, ...budget, ...mayor, ...members];
}

function combinedSearchItems() {
  const featured = (state.data?.featured || []).map((item) => ({ ...item, url: item.sourceUrl, date: item.published, sourceKind: item.sourceKind || "市の情報", publisherName: item.publisherName || "直方市" }));
  const latest = (state.data?.latest || []).map((item, index) => ({ id: `latest-${index}`, ...item, sourceUrl: item.url, published: item.date, summary: item.summary || "直方市が公開した新着情報です。", category: item.category || classifyTitle(item.title), sourceKind: "市の新着", publisherName: "直方市" }));
  const bulletin = bulletinItems().map((item) => ({ ...item, category: item.category || "市報", sourceKind: "市報", publisherName: "直方市" }));
  const seen = new Set();
  return [...featured, ...latest, ...bulletin, ...searchableCommunityItems(), ...searchableCivicItems()].filter((item) => {
    if (!item?.title) return false;
    const key = `${normalizeQuery(item.title)}|${causalSourceKey(item)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function causalSourceKey(item = {}) {
  return item.sourceUrl || item.url || item.id || item.publisherName || "";
}

function classifyTitle(title = "") {
  if (/バス|交通|路線|時刻/.test(title)) return "交通";
  if (/学校|小学校|中学校|教育|就学|給食/.test(title)) return "学校・教育";
  if (/健康|スポーツ|体育|ピラティス|講習/.test(title)) return "健康・スポーツ";
  if (/議会|定例会|会議録|議案|市長|議員/.test(title)) return "市長・市議会";
  if (/予算|決算|財政|税/.test(title)) return "税金・予算";
  if (/工事|道路|舗装/.test(title)) return "工事・道路";
  if (/ごみ|廃棄|リサイクル/.test(title)) return "ごみ";
  if (/消防|災害|防災|火災|避難/.test(title)) return "防災";
  if (/観光|キャンプ|イベント|まつり|シンポジウム|マンホール|講座|教室/.test(title)) return "観光・イベント";
  if (/団体|ボランティア|地域活動|こども食堂/.test(title)) return "地域活動";
  return "その他";
}

const SEARCH_SYNONYM_GROUPS = [
  ["ごみ", "ゴミ", "廃棄", "資源"],
  ["子ども", "こども", "子供", "子育て"],
  ["高齢者", "シニア", "介護"],
  ["イベント", "催し", "講座", "教室", "体験"],
  ["助成", "補助", "給付", "支援"],
  ["道路", "道", "舗装"],
  ["バス", "公共交通", "路線"],
  ["議会", "市議会", "定例会"],
  ["工事", "工事情報", "道路工事"],
  ["ボランティア", "地域活動", "手伝い"],
];

function normalizeQuery(value = "") {
  return String(value || "")
    .normalize("NFKC")
    .replaceAll("ゴミ", "ごみ")
    .replaceAll("子供", "子ども")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function searchTermsFor(token) {
  const normalized = normalizeQuery(token);
  const group = SEARCH_SYNONYM_GROUPS.find((items) => items.some((item) => normalizeQuery(item) === normalized));
  return (group || [normalized]).map(normalizeQuery);
}

function searchTextFor(item = {}) {
  return normalizeQuery([
    item.title,
    item.summary,
    item.category,
    item.location,
    item.publisherName,
    item.organizerName,
    item.sourceKind,
    ...(item.tags || []),
  ].filter(Boolean).join(" "));
}

function matchesSearchQuery(item, query) {
  const normalized = normalizeQuery(query);
  if (!normalized) return true;
  const text = searchTextFor(item);
  return normalized.split(/\s+/).every((token) => searchTermsFor(token).some((term) => text.includes(term)));
}

function searchResultScore(item, query) {
  const title = normalizeQuery(item.title);
  const text = searchTextFor(item);
  const interestBoost = typeof v2MatchesPreferences === "function" && v2MatchesPreferences(item) ? 8 : 0;
  const district = normalizeQuery(state.v2Preferences?.district || "");
  const districtBoost = district && text.includes(district) ? 8 : 0;
  return normalizeQuery(query).split(/\s+/).reduce((score, token) => {
    const terms = searchTermsFor(token);
    if (terms.some((term) => title.includes(term))) return score + 20;
    if (terms.some((term) => text.includes(term))) return score + 5;
    return score;
  }, (item.location ? 1 : 0) + interestBoost + districtBoost);
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
    <div class="hero"><p class="eyebrow">さがす</p><h1>直方の情報を探す</h1><p>制度名や担当課が分からなくても、「バス」「ごみ」のような言葉で探せます。</p></div>
    ${syncBanner()}
    <form class="search-box" id="discover-form"><span aria-hidden="true">⌕</span><input id="discover-search" type="search" value="${esc(state.discoverQuery)}" placeholder="例：バス、学校、キャンプ" aria-label="街の情報を検索"><button>探す</button></form>
    <div class="filter-row" aria-label="カテゴリで絞る"><button class="filter-chip ${!category ? "is-active" : ""}" type="button" data-category-filter="">すべて</button>${discoverCategories.map((x) => `<button class="filter-chip ${category === x ? "is-active" : ""}" type="button" data-category-filter="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div class="section"><div class="section-head"><h2>検索結果</h2><p>${results.length}件</p></div><div class="stack">${results.length ? results.slice(0, 20).map(realCard).join("") : emptyCard("見つかりませんでした。言葉を短くして、もう一度検索してください。")}</div></div>
  </section>`;
}

function askView(answer = "") {
  return `<section class="page">
    <div class="hero"><p class="eyebrow">よくある質問と関連情報</p><h1>ふだんの言葉で探す</h1><p>確認済みの定型回答と、現在取り込んでいる公開情報から関連項目を探します。</p></div>
    ${syncBanner()}
    <div class="ask-panel"><h2>何が気になる？</h2><p>定型回答で確認できない質問は、答えを作らず関連情報として表示します。</p><form class="ask-form" id="ask-form"><input id="ask-input" type="text" placeholder="例：子ども向けイベント" autocomplete="off" aria-label="直方について質問"><button class="primary-button" type="submit">関連情報を探す</button></form><div class="suggestion-list"><button class="suggestion-chip" type="button" data-question="バスはどう変わる？">バスはどう変わる？</button><button class="suggestion-chip" type="button" data-question="今度の市議会いつ？">今度の市議会いつ？</button><button class="suggestion-chip" type="button" data-question="ごみの収集日は？">ごみの収集日は？</button><button class="suggestion-chip" type="button" data-question="子ども向けイベント">子ども向けイベント</button></div></div>
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
  } else if (/議会|定例会|市議会/.test(q) && /いつ|日程|次|何|内容|予定/.test(q)) {
    const council = currentCouncilSchedule();
    answer = { title: council.title, body: `${council.nextDateLabel || ""} ${council.nextSummary || ""}`.trim(), url: council.sourceUrl };
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
    const related = combinedSearchItems()
      .filter((item) => matchesSearchQuery(item, q))
      .sort((a, b) => searchResultScore(b, q) - searchResultScore(a, q))
      .slice(0, 5);
    if (related.length) {
      return `<div class="card answer-card ca-related-answer" role="status"><span class="pill">関連情報</span><h3>この質問への確定回答は作れませんが、関連する公開情報が見つかりました</h3><p>内容と対象時期を確認して選んでください。</p><div class="stack">${related.map(realCard).join("")}</div><p class="muted">入力した質問：${esc(question)}</p></div>`;
    }
    return `<div class="card answer-card" role="status"><span class="pill">確認できませんでした</span><h3>現在取り込んでいる情報では、答えも関連項目も確認できませんでした</h3><p>言葉を短くしてもう一度探すか、直方市の公式サイトを確認してください。</p><div class="source-stack"><button class="text-button" type="button" data-v2-action="retry-question">聞き方を変える</button>${sourceLink("https://www.city.nogata.fukuoka.jp/", "直方市のサイトを開く")}</div><p class="muted">入力した質問：${esc(question)}</p></div>`;
  }

  return `<div class="card answer-card" role="status"><span class="pill verified">確認済みの定型回答</span><h3>${esc(answer.title)}</h3><p>${esc(answer.body)}</p>${sourceLink(answer.url, "根拠のページを見る")}</div>`;
}

function detailView(item) {
  if (!item) return todayView();
  const section = state.detailSection;
  const buttons = [
    ["what", "まとめて見る", "概要から資料まで"],
    ["why", "なんで？", "理由"],
    ["money", "いくら？", "お金"],
    ["decision", "決まり方", "資料でたどる"],
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
    ${timeline.length ? `<h3>市の資料で確認できた流れ</h3><ol class="decision-timeline">${timeline.map((step) => `<li><div class="decision-date"><time>${esc(step.date || "日付確認中")}</time>${step.status ? `<span class="pill">${esc(step.status)}</span>` : ""}</div><h4>${esc(step.title || "確認できた出来事")}</h4><p>${esc(step.detail || "")}</p>${step.url ? sourceLink(step.url, "この段階の市の資料") : ""}</li>`).join("")}</ol>` : ""}
    ${unknowns.length ? `<div class="decision-unknowns"><h3>まだ分からないこと</h3><ul class="plain-list">${unknowns.map((fact) => `<li>${esc(fact)}</li>`).join("")}</ul><p>確認できる資料が見つかるまで、推測で決まったとは表示しません。</p></div>` : ""}
    ${sources.length ? `<div class="decision-source-list"><h3>この流れの元になった市の資料</h3>${sources.map((source) => sourceLink(source.url, source.label || "公式資料を見る")).join("")}</div>` : ""}
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
    const sourceDate = item.sourceUpdated || item.published || item.lastCheckedAt || "確認できず";
    const publisher = item.publisherName || item.organizerName || (item.sourceType ? "掲載元" : "直方市");
    const sourceLabel = publisher === "直方市" ? "直方市の資料" : "掲載元の情報";
    return `<div class="detail-layers">
      <div class="card info-card detail-layer"><span class="detail-layer-label">30秒で読む</span><h2>まず、これだけ</h2><p>${esc(item.summary || "")}</p></div>
      <div class="card info-card detail-layer"><span class="detail-layer-label">くわしく見る</span><h2>背景・費用・決まり方</h2>
        <h3>公開情報で確認できたこと</h3>${confirmed.length ? `<ul class="plain-list">${confirmed.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p>この項目について、追加で確認できた事実はまだありません。</p>`}
        <h3>なぜ？</h3><p>${esc(item.why || "今回確認した公開ページでは、理由を確認できませんでした。推測では補いません。")}</p>
        <h3>お金</h3>${item.money ? `<p class="money-value">${esc(item.money)}</p><p>${esc(item.moneyNote || "")}</p>` : `<p>今回確認した公開ページでは、費用や予算額を確認できませんでした。</p>`}
        <h3>決まり方</h3><p>${esc(item.decision || "今回確認した資料では、決定までの流れを確認できませんでした。推測では補いません。")}</p>${renderDecisionEvidence(item)}
      </div>
      <div class="card info-card detail-layer source-layer"><span class="detail-layer-label">${esc(sourceLabel)}</span><h2>確認に使った資料</h2><dl class="source-facts"><div><dt>公開元</dt><dd>${esc(publisher)}</dd></div><div><dt>公開・更新日</dt><dd>${esc(sourceDate)}</dd></div><div><dt>のおがた日和で確認した日</dt><dd>${esc(item.lastCheckedAt || state.data.verifiedOn || formatDateTime(state.data.generatedAt) || "確認中")}</dd></div></dl>${sourceLink(item.sourceUrl, `${publisher}のページを見る`)}${item.pdfUrl ? sourceLink(item.pdfUrl, "PDFを開く") : ""}</div>
    </div>`;
  }
  if (section === "why") {
    return `<div class="card info-card"><h2>なんで？</h2><p>${esc(item.why || "今回確認した公開ページでは、理由を確認できませんでした。推測では補いません。")}</p>${sourceLink(item.sourceUrl)}</div>`;
  }
  if (section === "money") {
    return `<div class="card info-card"><h2>いくら？</h2>${item.money ? `<p class="money-value">${esc(item.money)}</p><p>${esc(item.moneyNote || "")}</p>` : `<p>今回確認した公開ページでは、費用や予算額を確認できませんでした。</p>`}${sourceLink(item.sourceUrl)}</div>`;
  }
  return `<div class="card info-card"><h2>決まり方</h2><p>${esc(item.decision || "今回確認した資料では、決定までの流れを確認できませんでした。推測では補いません。")}</p>${renderDecisionEvidence(item)}${sourceLink(item.sourceUrl, "変更案内の市のページ")}</div>`;
}

function moneyView() {
  return `<section class="page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="hero"><p class="eyebrow">直方市の予算</p><h1>市の資料で確認できた数字だけを掲載します</h1><p>このページは準備中です。</p></div>${syncBanner()}<div class="card info-card"><h2>予算情報は準備中です</h2><p>予算書・補正予算・決算の数字を整理し、市の資料と照合してから掲載します。個人が納めた税金と特定の事業を直接結び付ける表示はしません。</p><a class="source-link" href="https://www.city.nogata.fukuoka.jp/shisei/_1242/_2796/" target="_blank" rel="noopener noreferrer">直方市の財政・予算・決算へ ↗</a></div></section>`;
}

function settingsView() {
  return `<section class="page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="hero"><p class="eyebrow">設定</p><h1>よく見る情報を設定</h1><p>会員登録は不要です。設定は、このブラウザだけに保存されます。</p></div><div class="card info-card"><h2>このアプリについて</h2><p>のおがた日和は試験公開中の非公式アプリです。直方市の公式アプリではありません。市の公開情報を定期的に確認し、直方市のページへのリンクを付けます。</p><p class="fact-line"><strong>自動更新：</strong>約6時間ごと（実行時刻は前後することがあります）</p></div></section>`;
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
