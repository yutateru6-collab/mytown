/* MYTOWN UI v3 — citizen-first home on top of synchronized official data. */

state.v2Page = state.v2Page || null;
state.v2SearchMode = state.v2SearchMode || "keyword";
document.body.classList.add("ui-v2");
history.replaceState({ ...(history.state || {}), mytownRoot: true }, "", location.href);

const V2_ASSETS = Object.freeze({
  hero: "./assets/hero/nogata-watercolor.webp?v=13",
  mascot: "./assets/mascot/machinavi.webp?v=13",
  nearby: "./assets/icons/nearby.webp?v=13",
  services: "./assets/icons/services.webp?v=13",
  deadline: "./assets/icons/deadline.webp?v=13",
  decision: "./assets/icons/decision.webp?v=13",
});

const V2_PREFERENCES_KEY = "mytown-preferences-v1";
const V2_DEFAULT_PREFERENCES = Object.freeze({ district: "", interests: [], lifeNotifications: true, civicDigest: "weekly" });
const V2_INTERESTS = ["子育て", "学校", "高齢者", "公共交通", "ごみ", "防災", "イベント", "税金・予算"];
let v2SheetReturnFocus = null;

function v2Icon(path, alt = "", className = "") {
  return `<img class="${esc(className)}" src="${esc(path)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

function v2Mascot(alt = "まちナビ") {
  return `<img class="v2-mascot" src="${V2_ASSETS.mascot}" alt="${esc(alt)}" decoding="async" fetchpriority="high">`;
}

function v2LoadPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(V2_PREFERENCES_KEY) || "{}");
    const civicDigest = saved.civicDigest === "off" ? "off" : "weekly";
    return { ...V2_DEFAULT_PREFERENCES, ...saved, civicDigest, interests: [] };
  } catch (error) {
    console.warn("Preference load failed", error);
    return { ...V2_DEFAULT_PREFERENCES };
  }
}

state.v2Preferences = v2LoadPreferences();

function v2DateLabel() { return japaneseDate(); }

function v2InterestForItem(item = {}) {
  const text = `${item.title || ""} ${item.summary || ""} ${item.category || ""}`;
  if (/子ども|こども|子育て|保育|乳幼児/.test(text)) return "子育て";
  if (/学校|教育|就学|給食/.test(text)) return "学校";
  if (/高齢|介護|シニア/.test(text)) return "高齢者";
  if (/バス|交通|路線|時刻/.test(text)) return "公共交通";
  if (/ごみ|廃棄|リサイクル/.test(text)) return "ごみ";
  if (/災害|防災|消防|避難|火災/.test(text)) return "防災";
  if (/イベント|まつり|教室|講座|フェスタ|観光/.test(text)) return "イベント";
  if (/税|予算|決算|財政|会計/.test(text)) return "税金・予算";
  return "";
}

function v2MatchesPreferences(item) {
  const selected = state.v2Preferences?.interests || [];
  return selected.length > 0 && selected.includes(v2InterestForItem(item));
}

function v2FindServices() {
  return (state.data.featured || []).filter((item) => {
    const hasVerifiedConditions = (Array.isArray(item.eligibility) && item.eligibility.length > 0) || item.eligibilitySummary || item.applicationConditions;
    return item.sourceUrl && hasVerifiedConditions;
  });
}

function v2FindDeadlines() {
  if (typeof combinedSearchItems !== "function") return [];
  return combinedSearchItems().filter((item) => /募集|申込|申し込み|応募|意見|パブリックコメント|受付|締切|期限/.test(`${item.title || ""} ${item.summary || ""}`));
}

function v2FindLocationItem() {
  const items = (state.data.featured || []).filter((item) => item.location);
  const district = (state.v2Preferences?.district || "").trim();
  if (district) {
    const districtMatch = items.find((item) => `${item.location || ""} ${item.title || ""}`.includes(district));
    if (districtMatch) return districtMatch;
  }
  return items.find(v2MatchesPreferences) || items[0] || null;
}

function v2CurrentBulletin() {
  const issue = state.data?.bulletin?.currentIssue;
  if (!issue) return null;
  return { ...issue, id: issue.id || `bulletin-${issue.issueKey || "latest"}`, sourceUrl: issue.sourceUrl || state.data.bulletin.archiveUrl, pdfUrl: issue.wholePdfUrl || null };
}

function v2Hero() {
  const district = (state.v2Preferences?.district || "").trim();
  return `<section class="v2-hero${district ? " has-district" : ""}" aria-labelledby="v2-home-title">
    <div class="v2-hero-actions">
      <button type="button" class="v2-round-action" data-v2-nav="notifications" aria-label="新着を見る"><span aria-hidden="true">🔔</span><small>新着</small></button>
      <button type="button" class="v2-round-action" data-v2-action="settings" aria-label="地域と表示順の設定を開く"><span aria-hidden="true">⚙︎</span><small>設定</small></button>
    </div>
    <div class="v2-hero-copy"><p class="v2-date">${esc(v2DateLabel())}</p><p class="v2-wordmark">のおがた<span class="v2-wordmark-accent">日和</span></p><h1 id="v2-home-title">知れば直方は<br>もっとおもしろい！</h1>${district ? `<p class="v2-tagline">よく見る地域：${esc(district)}</p>` : ""}</div>
    <p class="v2-data-note">非公式｜直方市の公開情報をもとに掲載</p>
    ${v2Mascot("チューリップと石炭をモチーフにした、のおがた日和の案内役まちナビ")}
  </section>`;
}

function v2SectionHeading(title, note = "", id = "") {
  return `<div class="v2-section-heading"><div><h2${id ? ` id="${esc(id)}"` : ""}>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ""}</div></div>`;
}

function v2CapabilityOverview() {
  const nearby = v2FindLocationItem();
  const deadlines = v2FindDeadlines();
  const services = v2FindServices();
  const council = state.data.council || null;
  const capabilities = [
    { action: "nearby", tone: "mint", kicker: "工事・施設・イベント", title: "地図から探す", note: nearby ? "場所を確認できる情報があります" : "場所を確認できる情報を探す" },
    { action: "deadline", tone: "pink", kicker: "申し込み・募集", title: "締切のある情報", note: deadlines.length ? `${deadlines.length}件を確認できます` : "募集情報を探す" },
    { action: "services", tone: "yellow", kicker: "補助・手続き", title: "制度・手続きを探す", note: services.length ? `${services.length}件の条件を確認` : "対象条件から探す" },
    { action: "decision", tone: "blue", kicker: "市の動き", title: "どうやって決まった？", note: council ? "市長・市議会の役割を見る" : "市の情報を見る" },
  ];
  return `<section class="v2-overview" aria-labelledby="v2-overview-title">
    <div class="v2-overview-heading"><p>今日の直方をひと目で</p><h2 id="v2-overview-title">何を見ますか？</h2><small>暮らしの情報から、市の決まり方まで。</small></div>
    <div class="v2-capability-grid">${capabilities.map((item) => `<button type="button" class="v2-capability-card tone-${item.tone}" data-v2-action="${item.action}"><span>${esc(item.kicker)}</span><strong>${esc(item.title)}</strong><small>${esc(item.note)}</small></button>`).join("")}</div>
    <button type="button" class="v2-ask-shortcut" data-v2-action="ask"><span><small>まちナビに聞く</small><strong>直方のことを聞く</strong></span><b>市の資料で分からないことは、そう伝えます</b></button>
  </section>`;
}

function v2CivicPath() {
  const stages = [["1", "暮らし", "気づく"], ["2", "市役所", "調べる"], ["3", "議会", "話し合う"], ["4", "決定", "実行する"]];
  return `<section class="v2-civic-path" aria-labelledby="v2-civic-path-title">
    <div class="v2-civic-path-heading"><div><p>どうやって決まった？</p><h2 id="v2-civic-path-title">決まるまでの流れ</h2></div><button type="button" data-v2-action="decision">流れを見る</button></div>
    <ol>${stages.map(([number, title, note]) => `<li><span>${number}</span><strong>${title}</strong><small>${note}</small></li>`).join("")}</ol>
  </section>`;
}

function v2OpenDetailButton(item, label = "30秒で読む", section = "what") {
  if (!item?.id) return "";
  return `<button class="v2-card-button" type="button" data-v2-detail-id="${esc(item.id)}" data-v2-detail-section="${esc(section)}">${esc(label)} <span aria-hidden="true">›</span></button>`;
}

function v2NearbyCard() {
  const item = v2FindLocationItem();
  const district = (state.v2Preferences?.district || "").trim();
  return `<section class="v2-home-section v2-nearby-section" aria-labelledby="v2-nearby-title"><article class="v2-nearby-card">
    ${v2Icon(V2_ASSETS.nearby, "", "v2-nearby-art")}
    <div class="v2-nearby-copy"><p class="v2-card-eyebrow">場所を確認できた市の情報</p><h2 id="v2-nearby-title">地図から探す</h2>
      ${item ? `<h3>${esc(item.title)}</h3><p>${esc(item.location || item.summary || "")}</p>${v2OpenDetailButton(item, "場所と内容を見る")}` : `<p>現在、場所が分かる情報はありません。確認できない距離は表示しません。</p><button class="v2-card-button" type="button" data-v2-action="nearby">場所から見る <span aria-hidden="true">›</span></button>`}
      ${district ? `<small class="v2-local-note">優先表示：${esc(district)}。同じ場所名がある情報を先に表示します。</small>` : `<button class="v2-text-link" type="button" data-v2-action="settings">よく見る地域を設定</button>`}
    </div></article></section>`;
}

function v2DailyCards() {
  const garbage = state.data.garbage;
  const deadline = v2FindDeadlines()[0] || null;
  return `<section class="v2-home-section" aria-labelledby="v2-life-title">${v2SectionHeading("今日の暮らし", "ごみ・締切など", "v2-life-title")}
    <div class="v2-daily-grid">
      <article class="v2-compact-card"><p class="v2-card-eyebrow">明日のごみ</p><h3>${garbage ? "ごみ収集日を確認" : "地区設定後に表示予定"}</h3><p>${garbage ? "地域ごとの日程を、市のページで確認できます。" : "収集日データを確認中です。"}</p>${garbage?.sourceUrl ? `<a class="v2-card-button" href="${esc(garbage.sourceUrl)}" target="_blank" rel="noopener noreferrer">公式日程を見る <span aria-hidden="true">↗</span></a>` : ""}</article>
      <article class="v2-compact-card tone-pink">${v2Icon(V2_ASSETS.deadline, "", "v2-compact-art")}<p class="v2-card-eyebrow">締切のある情報</p><h3>${esc(deadline?.title || "募集情報を確認")}</h3><p>${deadline ? esc(deadline.summary || "条件と期限を直方市のページで確認できます。") : "締切に関する情報は見つかりませんでした。"}</p>${deadline ? v2OpenDetailButton(deadline, "内容を確認") : `<button class="v2-card-button" type="button" data-v2-action="deadline">募集を探す <span aria-hidden="true">›</span></button>`}</article>
    </div></section>`;
}

function v2SpotlightCard() {
  const featured = state.data.featured || [];
  const item = featured.find(v2MatchesPreferences) || featured[0] || null;
  if (!item) return "";
  return `<section class="v2-home-section" aria-labelledby="v2-spotlight-title">${v2SectionHeading("あなたに関係しそうな情報", state.v2Preferences.interests.length ? "設定したテーマを優先" : "市の新着情報から")}
    <article class="v2-spotlight-card"><div class="v2-spotlight-meta"><span>${esc(item.category || "直方市情報")}</span>${item.status ? `<strong>${esc(item.status)}</strong>` : ""}</div><h3 id="v2-spotlight-title">${esc(item.title)}</h3><p>${esc(item.summary || "")}</p>${v2OpenDetailButton(item)}</article></section>`;
}

function v2ServicesCard() {
  const services = v2FindServices();
  if (!services.length) return "";
  const item = services.find(v2MatchesPreferences) || services[0];
  return `<section class="v2-home-section" aria-labelledby="v2-service-title">${v2SectionHeading("利用できそうな制度・手続き", "対象条件は市のページで確認")}
    <article class="v2-service-card">${v2Icon(V2_ASSETS.services, "", "v2-service-art")}<div><h3 id="v2-service-title">${esc(item.title)}</h3><p>${esc(item.summary || "")}</p>${v2OpenDetailButton(item, "条件を確認する")}</div></article></section>`;
}

function v2CivicCards() {
  const council = state.data.council || null;
  const featured = (state.data.featured || [])[0] || null;
  return `<section class="v2-home-section v2-civic-section" aria-labelledby="v2-civic-title">${v2SectionHeading("暮らしに関わる市の動き", "30秒で読めます", "v2-civic-title")}
    <div class="v2-civic-grid">
      <article class="v2-civic-card"><p class="v2-card-eyebrow">次の市議会</p><h3>${esc(council?.nextDateLabel || council?.title || "日程を確認中")}</h3><p>${esc(council?.nextSummary || council?.summary || "公式日程を確認しています。")}</p>${council ? `<button class="v2-card-button" type="button" data-v2-action="meeting">この会議を見る <span aria-hidden="true">›</span></button>` : ""}</article>
      <article class="v2-civic-card tone-lavender">${v2Icon(V2_ASSETS.decision, "", "v2-compact-art")}<p class="v2-card-eyebrow">どうやって決まった？</p><h3>${esc(featured?.title || "決まり方をたどる")}</h3><p>市の資料で確認できたことと、確認できないことを分けて表示します。</p>${featured ? v2OpenDetailButton(featured, "決まり方を見る", "decision") : `<button class="v2-card-button" type="button" data-v2-action="decision">市長・議会を見る <span aria-hidden="true">›</span></button>`}</article>
    </div></section>`;
}

function v2AskCard() {
  return `<section class="v2-home-section"><article class="v2-ask-card"><div>${v2Mascot("")}</div><div><p class="v2-card-eyebrow">まちナビに聞く</p><h2>直方のことを聞く</h2><p>市の資料で分からないことは、そう伝えます。</p></div><button class="v2-card-button" type="button" data-v2-action="ask">まちナビに聞く <span aria-hidden="true">›</span></button></article></section>`;
}

function v2LifeAndLatest() {
  const latest = (state.data.latest || []).slice(0, 5);
  const bulletin = v2CurrentBulletin();
  return `<section class="v2-lower-section"><details class="v2-latest-details"><summary>直方市の新着情報も見る <span aria-hidden="true">＋</span></summary><div class="latest-list">${latest.length ? latest.map(latestRow).join("") : emptyCard("新着情報を取得できませんでした。")}</div></details>${bulletin?.sourceUrl ? `<a class="v2-bulletin-link" href="${esc(bulletin.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span>市報のおがた</span><strong>${esc(bulletin.title || "最新号")}</strong><b aria-hidden="true">↗</b></a>` : ""}</section>`;
}

function todayV2View() {
  if (state.loading) return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content"><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div><p class="muted">直方市の公式情報を確認しています…</p></div></div></section>`;
  return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content">${v2CapabilityOverview()}${v2CivicPath()}<div class="v2-sync-wrap">${syncBanner()}</div>${v2NearbyCard()}${v2DailyCards()}${v2SpotlightCard()}${v2ServicesCard()}${state.v2Preferences.civicDigest === "off" ? "" : v2CivicCards()}${v2AskCard()}${v2LifeAndLatest()}<p class="v2-disclaimer">のおがた日和は、直方市の公開情報をもとにした非公式アプリです。掲載範囲は、現在取り込めた情報に限られます。手続き・期限・選挙は、直方市のページで最終確認してください。</p></div></section>`;
}

function v2SearchIntro() {
  const deadlines = v2FindDeadlines().slice(0, 2);
  const bulletin = v2CurrentBulletin();
  return `<div class="v2-search-intro"><section class="v2-popular-search" aria-labelledby="v2-popular-title"><h2 id="v2-popular-title">検索の例</h2><div class="v2-query-chips">${["バス", "ごみ", "子育て", "学校", "工事"].map((q) => `<button type="button" data-v2-query="${q}">${q}</button>`).join("")}</div></section>
    <section class="v2-search-groups" aria-label="探し方"><button type="button" data-v2-action="deadline"><strong>締切のある情報</strong><span>${deadlines.length ? `${deadlines.length}件を確認` : "募集情報を探す"}</span></button><button type="button" data-v2-query="子育て 学校"><strong>暮らし</strong><span>制度・手続き・学校</span></button><button type="button" data-v2-action="nearby"><strong>地図</strong><span>場所を確認できる情報</span></button><button type="button" data-v2-action="decision"><strong>市の動き</strong><span>議会・選挙・決まり方</span></button>${bulletin ? `<button type="button" data-v2-action="bulletin"><strong>市報</strong><span>${esc(bulletin.title || "最新号")}</span></button>` : ""}</section><p class="v2-search-note">現在取り込んでいる市の公開情報から検索します。</p></div>`;
}

function v2SearchHubView() {
  const all = combinedSearchItems();
  const q = normalizeQuery(state.discoverQuery);
  const category = state.discoverCategory;
  const hasSearch = Boolean(q || category);
  const results = hasSearch ? all.filter((item) => {
    const text = normalizeQuery(`${item.title} ${item.summary || ""} ${item.category || ""}`);
    return (!q || q.split(/\s+/).every((token) => text.includes(token))) && (!category || (item.category || classifyTitle(item.title)) === category);
  }) : [];
  const noResults = state.discoverQuery
    ? `「${state.discoverQuery}」に合う情報は見つかりませんでした。キーワードを1語にするか、分類を「すべて」に戻してください。`
    : "この分類に合う情報は見つかりませんでした。分類を「すべて」に戻してください。";
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">さがす</p><h1>直方の情報を探す</h1><p>制度名や担当課が分からなくても、「バス」「ごみ」のような言葉で探せます。</p></div></div>${syncBanner()}<form class="search-box v2-search-box" id="discover-form"><span aria-hidden="true">⌕</span><input id="discover-search" type="search" value="${esc(state.discoverQuery)}" placeholder="例：バス、学校、ごみ" aria-label="直方の情報を検索"><button>探す</button></form>${hasSearch ? `<div class="filter-row" aria-label="カテゴリで絞る"><button class="filter-chip ${!category ? "is-active" : ""}" type="button" data-category-filter="">すべて</button>${discoverCategories.map((x) => `<button class="filter-chip ${category === x ? "is-active" : ""}" type="button" data-category-filter="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="section"><div class="section-head"><h2>検索結果</h2><p>${results.length}件</p></div><div class="stack">${results.length ? results.slice(0, 30).map(realCard).join("") : emptyCard(noResults)}</div></div>` : v2SearchIntro()}</section>`;
}

function v2CollectionView(type) {
  const isServices = type === "services";
  const items = isServices ? v2FindServices() : v2FindDeadlines();
  const title = isServices ? "制度・手続きを探す" : "締切のある情報";
  const sub = isServices ? "補助・給付・暮らしの手続きを掲載しています。利用できる条件は、直方市のページで最終確認してください。" : "募集・申し込み・意見募集に関する情報です。受付中かどうかと期限は、直方市のページで最終確認してください。";
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button><div class="v2-inner-hero"><div><p class="eyebrow">暮らしから探す</p><h1>${title}</h1><p>${sub}</p></div></div>${syncBanner()}<div class="section"><div class="section-head"><h2>掲載中の情報</h2><p>${items.length}件</p></div><div class="stack">${items.length ? items.slice(0, 30).map(realCard).join("") : emptyCard(isServices ? "現在、対象条件まで確認できる制度情報はありません。ほかの言葉でも検索できます。" : "現在、募集・申し込み中の情報は見つかりませんでした。")}</div></div><button class="v2-wide-button" type="button" data-v2-nav="search">別の言葉で探す →</button></section>`;
}

function v2NotificationGroups() {
  const items = (state.data.latest || []).slice(0, 20);
  const civicPattern = /議会|定例会|一般質問|議案|選挙|市長|条例|予算|決算|計画|パブリックコメント/;
  return { life: items.filter((item) => !civicPattern.test(item.title || "")), civic: items.filter((item) => civicPattern.test(item.title || "")) };
}

function v2ChangesSinceLastVisit() {
  const prior = state.priorVisitAt ? new Date(state.priorVisitAt) : null;
  if (!prior || Number.isNaN(prior.getTime())) return [];
  return (state.data?.changes?.changes || []).filter((item) => {
    const detected = new Date(item.detectedAt || "");
    return !Number.isNaN(detected.getTime()) && detected > prior;
  });
}

function v2NotificationsView() {
  const { life, civic } = v2NotificationGroups();
  const changes = v2ChangesSinceLastVisit();
  const changedSection = changes.length
    ? `<section class="v2-notification-group v2-changes-group"><div class="section-head"><div><h2>前回見たあと</h2><p>追加・更新された公式情報</p></div><span>${changes.length}件</span></div><div class="latest-list">${changes.map((item) => latestRow({ date: item.kind === "new" ? "追加" : "更新", title: item.title, url: item.sourceUrl })).join("")}</div></section>`
    : "";
  const lifeSection = `<section class="v2-notification-group"><div class="section-head"><div><h2>暮らしのお知らせ</h2><p>防災・施設・イベント・手続きなど</p></div><span>${life.length}件</span></div><div class="latest-list">${life.length ? life.map(latestRow).join("") : emptyCard("現在、暮らしに分類できる新着はありません。")}</div></section>`;
  const civicSection = `<section class="v2-notification-group"><div class="section-head"><div><h2>市の動き</h2><p>議会・計画・予算など</p></div><span>${civic.length}件</span></div><div class="latest-list">${civic.length ? civic.map(latestRow).join("") : emptyCard("現在、市政に分類できる新着はありません。")}</div></section>`;
  const ordered = state.v2Preferences.lifeNotifications ? `${lifeSection}${civicSection}` : `${civicSection}${lifeSection}`;
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">新着</p><h1>暮らしと市の動き</h1><p>「暮らしのお知らせ」と「市の動き」に分けて表示します。</p></div></div>${syncBanner()}${changedSection}${ordered}</section>`;
}

function v2MeetingView() {
  const council = state.data.council || {};
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button><div class="v2-inner-hero"><div><p class="eyebrow">次の市議会</p><h1>${esc(council.nextDateLabel || council.title || "日程を確認中")}</h1><p>${esc(council.nextSummary || council.summary || "公式日程を確認しています。")}</p></div></div>${syncBanner()}<div class="card info-card v2-meeting-detail"><h2>${esc(council.title || "直方市議会")}</h2><p><strong>予定：</strong>${esc(council.nextDateLabel || "確認中")}</p><p><strong>内容：</strong>${esc(council.nextSummary || "確認中")}</p><p><strong>注意：</strong>日程・開会時間は変更されることがあります。</p>${sourceLink(council.sourceUrl, "この会議の公式日程を見る")}</div><div class="card info-card"><h2>このページでは分からないこと</h2><p>議案の詳しい内容や採決結果は、この日程ページだけでは分かりません。別の資料と推測で結び付けることはしません。</p></div></section>`;
}

function v2MenuView() {
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">メニュー</p><h1>知りたいところから</h1><p>未完成の機能は、現在の状態が分かる名前で表示します。</p></div></div><div class="v2-menu-grid"><button type="button" data-v2-action="decision"><strong>市長・市議会</strong><small>役割・議員・選挙</small></button><button type="button" data-v2-action="ask"><strong>まちナビに聞く</strong><small>市の資料から答えを探す</small></button><button type="button" data-v2-action="glossary"><strong>役所ことば図鑑</strong><small>難しい言葉をやさしく</small></button><button type="button" data-v2-action="settings"><strong>地域と表示順</strong><small>このブラウザだけに保存</small></button><button type="button" data-v2-action="nearby"><strong>地図から探す</strong><small>位置を確認できる情報</small></button><button type="button" data-v2-action="money"><strong>直方市の予算</strong><small>市の資料と照合した数字だけ</small></button></div><div class="v2-menu-note card info-card"><h2>のおがた日和の約束</h2><p>公開資料で確認できないことは、推測で補いません。人物の評価や採点はしません。大切な情報には、確認に使った直方市のページへのリンクを付けます。</p></div></section>`;
}

function v2SettingsView() {
  const preferences = state.v2Preferences;
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="v2-inner-hero"><div><p class="eyebrow">設定</p><h1>よく見る地域と表示順を設定</h1><p>会員登録は不要です。設定は、このブラウザだけに保存されます。</p></div></div><form id="v2-preferences-form" class="v2-preferences-form"><fieldset><legend>よく見る地域（任意）</legend><label class="v2-field"><span>町名・駅名・よく行く場所</span><input type="text" name="district" value="${esc(preferences.district)}" placeholder="例：植木、感田、直方駅周辺" maxlength="30"><small>入力した地名が掲載情報に含まれるとき、ホームの「地図から探す」に表示します。位置情報は使いません。</small></label></fieldset><fieldset><legend>表示の設定</legend><label class="v2-check-row"><input type="checkbox" name="lifeNotifications" ${preferences.lifeNotifications ? "checked" : ""}><span><strong>「新着」で暮らしの情報を先に表示</strong><small>オフにすると、「市の動き」が上になります。</small></span></label><label class="v2-field"><span>ホームに市の動きを表示</span><select name="civicDigest"><option value="weekly" ${preferences.civicDigest !== "off" ? "selected" : ""}>表示する</option><option value="off" ${preferences.civicDigest === "off" ? "selected" : ""}>表示しない</option></select><small>この設定はホームの表示だけを変えます。スマホには通知しません。</small></label></fieldset><button class="primary-button v2-save-button" type="submit">設定を保存</button></form><div class="card info-card v2-about-card"><h2>このアプリについて</h2><p>のおがた日和は試験公開中の非公式アプリです。直方市の公式アプリではありません。市の公開情報を約6時間ごとに確認し、直方市のページへのリンクを付けます。</p></div></section>`;
}

settingsView = v2SettingsView;

function v2EnsureActionSheet() {
  if (document.querySelector("#v2-action-sheet")) return;
  const wrapper = document.createElement("div");
  wrapper.id = "v2-action-sheet";
  wrapper.className = "v2-sheet";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `<button class="v2-sheet-backdrop" type="button" data-v2-sheet-close aria-label="閉じる"></button><section class="v2-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="v2-sheet-title"><div class="v2-sheet-handle" aria-hidden="true"></div><div class="v2-sheet-head"><div>${v2Mascot("")}</div><div><small>のおがた日和</small><h2 id="v2-sheet-title">何を調べる？</h2></div><button type="button" data-v2-sheet-close aria-label="閉じる">×</button></div><div class="v2-sheet-list"><button type="button" data-v2-action="nearby"><div><strong>地図から探す</strong><small>位置を確認できる市の情報</small></div><b>›</b></button><button type="button" data-v2-action="services"><div><strong>制度・手続きを探す</strong><small>補助・支援・手続き</small></div><b>›</b></button><button type="button" data-v2-action="money"><div><strong>直方市の予算</strong><small>現在は準備中</small></div><b>›</b></button><button type="button" data-v2-action="decision"><div><strong>市長・市議会を知る</strong><small>役割・議員・選挙</small></div><b>›</b></button><button type="button" data-v2-action="ask"><div><strong>まちナビに聞く</strong><small>市の資料から答えを探す</small></div><b>›</b></button></div></section>`;
  document.body.appendChild(wrapper);
}

function v2OpenSheet() {
  v2EnsureActionSheet();
  const sheet = document.querySelector("#v2-action-sheet");
  const appShell = document.querySelector(".app-shell");
  v2SheetReturnFocus = document.activeElement;
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("v2-sheet-open");
  if (appShell) appShell.inert = true;
  sheet.querySelector(".v2-sheet-panel [data-v2-sheet-close]")?.focus();
}

function v2CloseSheet(restoreFocus = true) {
  const sheet = document.querySelector("#v2-action-sheet");
  if (!sheet) return;
  const appShell = document.querySelector(".app-shell");
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("v2-sheet-open");
  if (appShell) appShell.inert = false;
  if (restoreFocus && v2SheetReturnFocus instanceof HTMLElement) v2SheetReturnFocus.focus();
  v2SheetReturnFocus = null;
}

function v2SetRoute({ tab = "today", page = null, view = "tab", hash = "" } = {}) {
  state.tab = tab; state.v2Page = page; state.view = view; state.detailSection = null; state.selectedId = null;
  if (hash) history.pushState({ tab, page, view, mytownRoute: true }, "", hash);
  render();
}

function v2HandleAction(action) {
  v2CloseSheet(false);
  if (action === "home") return v2SetRoute({ tab: "today", page: null, hash: "#home" });
  if (action === "back-route") {
    if (history.state?.mytownRoute) return history.back();
    return v2SetRoute({ tab: "today", page: null, hash: "#home" });
  }
  if (action === "reload") return loadOfficialData();
  if (action === "retry-question") {
    document.querySelector("#ask-input")?.focus();
    return;
  }
  if (action === "nearby") return v2SetRoute({ tab: "nearby", page: null, hash: "#nearby" });
  if (action === "services") return v2SetRoute({ tab: "today", page: "services", hash: "#services" });
  if (action === "deadline") return v2SetRoute({ tab: "today", page: "deadline", hash: "#deadline" });
  if (action === "meeting") return v2SetRoute({ tab: "today", page: "meeting", hash: "#meeting" });
  if (action === "decision" || action === "council") { state.politicsSection = "home"; return v2SetRoute({ tab: "politics", page: null, hash: "#politics" }); }
  if (action === "glossary") { state.politicsSection = "glossary"; return v2SetRoute({ tab: "politics", page: null, hash: "#politics" }); }
  if (action === "ask") return v2SetRoute({ tab: "ask", page: null, hash: "#ask" });
  if (action === "money") return v2SetRoute({ tab: "today", page: null, view: "money", hash: "#money" });
  if (action === "settings") return v2SetRoute({ tab: "today", page: null, view: "settings", hash: "#settings" });
}

function v2HandleNav(nav) {
  if (nav === "home") return v2HandleAction("home");
  if (nav === "nearby") return v2HandleAction("nearby");
  if (nav === "search") return v2SetRoute({ tab: "discover", page: null, hash: "#search" });
  if (nav === "action") return v2OpenSheet();
  if (nav === "notifications") return v2SetRoute({ tab: "today", page: "notifications", hash: "#notifications" });
  if (nav === "menu") return v2SetRoute({ tab: "today", page: "menu", hash: "#menu" });
}

function v2ActiveNav() {
  if (state.v2Page === "notifications") return "notifications";
  if (state.v2Page === "menu" || state.tab === "politics" || state.view === "settings" || state.view === "money") return "menu";
  if (state.tab === "nearby") return "nearby";
  if (state.tab === "discover") return "search";
  return "home";
}

function v2SyncNav() {
  const active = v2ActiveNav();
  document.querySelectorAll("[data-v2-nav]").forEach((button) => {
    const isActive = button.dataset.v2Nav === active;
    button.classList.toggle("is-active", isActive);
    if (["home", "nearby", "search", "notifications", "menu"].includes(button.dataset.v2Nav)) button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}

if (typeof guideBubble === "function") {
  guideBubble = function guideBubbleWithMascot(message, note = "") {
    return `<div class="guide-bubble v2-guide-bubble"><div class="guide-avatar" aria-hidden="true"><img src="${V2_ASSETS.mascot}" alt=""></div><div><strong>まちナビ</strong><p>${esc(message)}</p>${note ? `<small>${esc(note)}</small>` : ""}</div></div>`;
  };
}

const baseRenderForWatercolorV2 = render;
render = function renderWatercolorV2() {
  if (state.view === "tab" && state.tab === "today" && state.v2Page === "services") main.innerHTML = v2CollectionView("services");
  else if (state.view === "tab" && state.tab === "today" && state.v2Page === "deadline") main.innerHTML = v2CollectionView("deadline");
  else if (state.view === "tab" && state.tab === "today" && state.v2Page === "notifications") main.innerHTML = v2NotificationsView();
  else if (state.view === "tab" && state.tab === "today" && state.v2Page === "meeting") main.innerHTML = v2MeetingView();
  else if (state.view === "tab" && state.tab === "today" && state.v2Page === "menu") main.innerHTML = v2MenuView();
  else if (state.view === "tab" && state.tab === "today") main.innerHTML = todayV2View();
  else if (state.view === "tab" && state.tab === "discover") main.innerHTML = v2SearchHubView();
  else baseRenderForWatercolorV2();
  window.scrollTo({ top: 0, behavior: "auto" });
  v2SyncNav();
};

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-v2-nav]");
  if (nav) { event.preventDefault(); return v2HandleNav(nav.dataset.v2Nav); }
  if (event.target.closest("[data-v2-sheet-close]")) { event.preventDefault(); return v2CloseSheet(); }
  const detail = event.target.closest("[data-v2-detail-id]");
  if (detail) { event.preventDefault(); state.selectedId = detail.dataset.v2DetailId; state.detailSection = detail.dataset.v2DetailSection || "what"; state.view = "detail"; return render(); }
  const query = event.target.closest("[data-v2-query]");
  if (query) { event.preventDefault(); state.discoverQuery = query.dataset.v2Query || ""; state.discoverCategory = null; return v2SetRoute({ tab: "discover", page: null, hash: "#search" }); }
  const action = event.target.closest("[data-v2-action]");
  if (action) { event.preventDefault(); return v2HandleAction(action.dataset.v2Action); }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "v2-preferences-form") return;
  event.preventDefault();
  const formData = new FormData(event.target);
  state.v2Preferences = { ...V2_DEFAULT_PREFERENCES, district: String(formData.get("district") || "").trim(), interests: [], lifeNotifications: formData.get("lifeNotifications") === "on", civicDigest: String(formData.get("civicDigest") || "weekly") };
  try {
    localStorage.setItem(V2_PREFERENCES_KEY, JSON.stringify(state.v2Preferences));
    showToast("設定を保存しました");
  } catch (error) {
    console.warn("Preference save failed", error);
    showToast("今回は反映しましたが、次に開くと元に戻ります");
  }
  render();
});

document.addEventListener("keydown", (event) => {
  const sheet = document.querySelector("#v2-action-sheet.is-open");
  if (!sheet) return;
  if (event.key === "Escape") { event.preventDefault(); v2CloseSheet(); return; }
  if (event.key !== "Tab") return;
  const focusable = Array.from(sheet.querySelectorAll(".v2-sheet-panel button:not([disabled]), .v2-sheet-panel a[href], .v2-sheet-panel input:not([disabled])"));
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

function v2ApplyHashRoute() {
  const hash = location.hash.replace("#", "");
  state.view = "tab"; state.v2Page = null;
  if (hash === "search" || hash === "discover") state.tab = "discover";
  else if (hash === "services") { state.tab = "today"; state.v2Page = "services"; }
  else if (hash === "deadline") { state.tab = "today"; state.v2Page = "deadline"; }
  else if (hash === "meeting") { state.tab = "today"; state.v2Page = "meeting"; }
  else if (hash === "notifications") { state.tab = "today"; state.v2Page = "notifications"; }
  else if (hash === "menu") { state.tab = "today"; state.v2Page = "menu"; }
  else if (hash === "politics") state.tab = "politics";
  else if (hash === "ask") state.tab = "ask";
  else if (hash === "nearby") state.tab = "nearby";
  else if (hash === "money") { state.tab = "today"; state.view = "money"; }
  else if (hash === "settings") { state.tab = "today"; state.view = "settings"; }
  else state.tab = "today";
}

window.addEventListener("popstate", () => { v2ApplyHashRoute(); render(); });

(function v2InitialRoute() { v2ApplyHashRoute(); v2EnsureActionSheet(); render(); })();
