/* MYTOWN UI v3 — citizen-first home on top of synchronized official data. */

state.v2Page = state.v2Page || null;
state.v2SearchMode = state.v2SearchMode || "keyword";
document.body.classList.add("ui-v2");

const V2_ASSETS = Object.freeze({
  hero: "./assets/hero/nogata-watercolor.webp",
  mascot: "./assets/mascot/machinavi.webp",
  nearby: "./assets/icons/nearby.webp",
  services: "./assets/icons/services.webp",
  deadline: "./assets/icons/deadline.webp",
  decision: "./assets/icons/decision.webp",
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
    return { ...V2_DEFAULT_PREFERENCES, ...saved, interests: Array.isArray(saved.interests) ? saved.interests.filter((x) => V2_INTERESTS.includes(x)) : [] };
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
  if (typeof combinedSearchItems !== "function") return [];
  return combinedSearchItems().filter((item) => /補助|助成|給付|支援|制度|手続|申請|減免|相談/.test(`${item.title || ""} ${item.summary || ""}`));
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
  return `<section class="v2-hero" aria-labelledby="v2-home-title">
    <div class="v2-hero-actions">
      <button type="button" class="v2-round-action" data-v2-nav="notifications" aria-label="お知らせを見る"><span aria-hidden="true">🔔</span><small>お知らせ</small></button>
      <button type="button" class="v2-round-action" data-v2-action="settings" aria-label="地域やテーマの設定を開く"><span aria-hidden="true">⚙︎</span><small>設定</small></button>
    </div>
    <div class="v2-hero-copy"><p class="v2-date">${esc(v2DateLabel())}</p><p class="v2-wordmark">MYTOWN <span>直方</span></p><h1 id="v2-home-title">今日の直方</h1><p class="v2-tagline">${district ? `${esc(district)}の情報を優先` : "暮らしから、まちがわかる。"}</p></div>
    ${v2Mascot("チューリップと石炭をモチーフにしたMYTOWNの案内役まちナビ")}
  </section>`;
}

function v2SectionHeading(title, note = "", id = "") {
  return `<div class="v2-section-heading"><div><h2${id ? ` id="${esc(id)}"` : ""}>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ""}</div></div>`;
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
    <div class="v2-nearby-copy"><p class="v2-card-eyebrow">場所が確認できる公式情報</p><h2 id="v2-nearby-title">近くで確認できること</h2>
      ${item ? `<h3>${esc(item.title)}</h3><p>${esc(item.location || item.summary || "")}</p>${v2OpenDetailButton(item, "場所と内容を見る")}` : `<p>住所が確認できる情報は現在ありません。距離や現在地は推測で表示しません。</p><button class="v2-card-button" type="button" data-v2-action="nearby">場所から見る <span aria-hidden="true">›</span></button>`}
      ${district ? `<small class="v2-local-note">設定中：${esc(district)}。一致する公開情報を優先します。</small>` : `<button class="v2-text-link" type="button" data-v2-action="settings">地区を設定する</button>`}
    </div></article></section>`;
}

function v2DailyCards() {
  const garbage = state.data.garbage;
  const deadline = v2FindDeadlines()[0] || null;
  return `<section class="v2-home-section" aria-labelledby="v2-life-title">${v2SectionHeading("今日と明日の暮らし", "まず生活に近い情報から", "v2-life-title")}
    <div class="v2-daily-grid">
      <article class="v2-compact-card"><p class="v2-card-eyebrow">明日のごみ</p><h3>${garbage ? "地区別の収集日を確認" : "地区設定後に表示予定"}</h3><p>${garbage ? "地域ごとの日程は直方市公式ページで確認できます。" : "収集日データを確認中です。"}</p>${garbage?.sourceUrl ? `<a class="v2-card-button" href="${esc(garbage.sourceUrl)}" target="_blank" rel="noopener noreferrer">公式日程を見る <span aria-hidden="true">↗</span></a>` : ""}</article>
      <article class="v2-compact-card tone-pink">${v2Icon(V2_ASSETS.deadline, "", "v2-compact-art")}<p class="v2-card-eyebrow">まだ間に合う</p><h3>${esc(deadline?.title || "募集中の情報を確認")}</h3><p>${deadline ? esc(deadline.summary || "条件と期限を公式ページで確認できます。") : "現在の同期データでは、募集中と確認できる情報がありません。"}</p>${deadline ? v2OpenDetailButton(deadline, "内容を確認") : `<button class="v2-card-button" type="button" data-v2-action="deadline">募集を探す <span aria-hidden="true">›</span></button>`}</article>
    </div></section>`;
}

function v2SpotlightCard() {
  const featured = state.data.featured || [];
  const item = featured.find(v2MatchesPreferences) || featured[0] || null;
  if (!item) return "";
  return `<section class="v2-home-section" aria-labelledby="v2-spotlight-title">${v2SectionHeading("今日いちばん関係しそう", state.v2Preferences.interests.length ? "設定したテーマを優先" : "直方市の注目情報から")}
    <article class="v2-spotlight-card"><div class="v2-spotlight-meta"><span>${esc(item.category || "直方市情報")}</span>${item.status ? `<strong>${esc(item.status)}</strong>` : ""}</div><h3 id="v2-spotlight-title">${esc(item.title)}</h3><p>${esc(item.summary || "")}</p>${v2OpenDetailButton(item)}</article></section>`;
}

function v2ServicesCard() {
  const services = v2FindServices();
  if (!services.length) return "";
  const item = services.find(v2MatchesPreferences) || services[0];
  return `<section class="v2-home-section" aria-labelledby="v2-service-title">${v2SectionHeading("使える可能性のある制度", "対象になるかは公式条件で確認")}
    <article class="v2-service-card">${v2Icon(V2_ASSETS.services, "", "v2-service-art")}<div><h3 id="v2-service-title">${esc(item.title)}</h3><p>${esc(item.summary || "")}</p>${v2OpenDetailButton(item, "条件を確認する")}</div></article></section>`;
}

function v2CivicCards() {
  const council = state.data.council || null;
  const featured = (state.data.featured || [])[0] || null;
  return `<section class="v2-home-section v2-civic-section" aria-labelledby="v2-civic-title">${v2SectionHeading("気づいたら市政も分かる", "生活情報の次に、短く", "v2-civic-title")}
    <div class="v2-civic-grid">
      <article class="v2-civic-card"><p class="v2-card-eyebrow">次の市議会</p><h3>${esc(council?.nextDateLabel || council?.title || "日程を確認中")}</h3><p>${esc(council?.nextSummary || council?.summary || "公式日程を確認しています。")}</p>${council ? `<button class="v2-card-button" type="button" data-v2-action="meeting">この会議を見る <span aria-hidden="true">›</span></button>` : ""}</article>
      <article class="v2-civic-card tone-lavender">${v2Icon(V2_ASSETS.decision, "", "v2-compact-art")}<p class="v2-card-eyebrow">なぜ？ 誰が決めた？</p><h3>${esc(featured?.title || "決まり方をたどる")}</h3><p>確認できた事実と、まだ分からないことを分けて表示します。</p>${featured ? v2OpenDetailButton(featured, "決まり方を見る", "decision") : `<button class="v2-card-button" type="button" data-v2-action="decision">市長・議会を見る <span aria-hidden="true">›</span></button>`}</article>
    </div></section>`;
}

function v2AskCard() {
  return `<section class="v2-home-section"><article class="v2-ask-card"><div>${v2Mascot("")}</div><div><p class="v2-card-eyebrow">公式情報に質問</p><h2>直方のことを聞く</h2><p>資料にないことは、無理に答えません。</p></div><button class="v2-card-button" type="button" data-v2-action="ask">まちナビに聞く <span aria-hidden="true">›</span></button></article></section>`;
}

function v2LifeAndLatest() {
  const latest = (state.data.latest || []).slice(0, 5);
  const bulletin = v2CurrentBulletin();
  return `<section class="v2-lower-section"><details class="v2-latest-details"><summary>直方市公式サイトの新着も見る <span aria-hidden="true">＋</span></summary><div class="latest-list">${latest.length ? latest.map(latestRow).join("") : emptyCard("新着情報を取得できませんでした。")}</div></details>${bulletin?.sourceUrl ? `<a class="v2-bulletin-link" href="${esc(bulletin.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span>市報のおがた</span><strong>${esc(bulletin.title || "最新号")}</strong><b aria-hidden="true">↗</b></a>` : ""}</section>`;
}

function todayV2View() {
  if (state.loading) return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content"><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div><p class="muted">直方市の公式情報を確認しています…</p></div></div></section>`;
  return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content"><div class="v2-sync-wrap">${syncBanner()}</div>${v2NearbyCard()}${v2DailyCards()}${v2SpotlightCard()}${v2ServicesCard()}${state.v2Preferences.civicDigest === "off" ? "" : v2CivicCards()}${v2AskCard()}${v2LifeAndLatest()}<p class="v2-disclaimer">MYTOWNは非公式の地域生活アプリMVPです。重要な手続き・期限・選挙情報は必ずリンク先の直方市公式情報も確認してください。</p></div></section>`;
}

function v2SearchIntro() {
  const deadlines = v2FindDeadlines().slice(0, 2);
  const bulletin = v2CurrentBulletin();
  return `<div class="v2-search-intro"><section class="v2-popular-search" aria-labelledby="v2-popular-title"><h2 id="v2-popular-title">よく探される</h2><div class="v2-query-chips">${["バス", "ごみ", "子育て", "学校", "工事"].map((q) => `<button type="button" data-v2-query="${q}">${q}</button>`).join("")}</div></section>
    <section class="v2-search-groups" aria-label="探し方"><button type="button" data-v2-action="deadline"><strong>締切が近い</strong><span>${deadlines.length ? `${deadlines.length}件を確認` : "募集中の情報を探す"}</span></button><button type="button" data-v2-query="子育て 学校"><strong>暮らし</strong><span>制度・手続き・学校</span></button><button type="button" data-v2-action="nearby"><strong>近く</strong><span>場所が確認できる情報</span></button><button type="button" data-v2-action="decision"><strong>市政</strong><span>議会・選挙・決まり方</span></button>${bulletin ? `<button type="button" data-v2-query="市報"><strong>市報</strong><span>${esc(bulletin.title || "最新号")}</span></button>` : ""}</section><p class="v2-search-note">検索すると、同期済みの公式情報だけを結果として表示します。</p></div>`;
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
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">さがす</p><h1>役所の名前を知らなくて大丈夫</h1><p>「バス」「ごみ」「学校」など、普通の言葉で探せます。</p></div></div>${syncBanner()}<form class="search-box v2-search-box" id="discover-form"><span aria-hidden="true">⌕</span><input id="discover-search" type="search" value="${esc(state.discoverQuery)}" placeholder="例：バス、学校、ごみ" aria-label="街の情報を検索"><button>探す</button></form>${hasSearch ? `<div class="filter-row" aria-label="カテゴリで絞る"><button class="filter-chip ${!category ? "is-active" : ""}" type="button" data-category-filter="">すべて</button>${discoverCategories.map((x) => `<button class="filter-chip ${category === x ? "is-active" : ""}" type="button" data-category-filter="${esc(x)}">${esc(x)}</button>`).join("")}</div><div class="section"><div class="section-head"><h2>検索結果</h2><p>${results.length}件</p></div><div class="stack">${results.length ? results.slice(0, 30).map(realCard).join("") : emptyCard("該当する同期情報は見つかりませんでした。見つからない内容を推測で補うことはしません。")}</div></div>` : v2SearchIntro()}</section>`;
}

function v2CollectionView(type) {
  const isServices = type === "services";
  const items = isServices ? v2FindServices() : v2FindDeadlines();
  const title = isServices ? "使える制度" : "まだ間に合う";
  const sub = isServices ? "補助・助成・給付・支援・手続きに関係する同期済み公式情報です。対象になるかは公式条件で確認してください。" : "募集・申込・意見募集などに関係する同期済み公式情報です。期限は必ず公式ページで最終確認してください。";
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-v2-action="home">‹ きょうへ</button><div class="v2-inner-hero"><div><p class="eyebrow">暮らしから探す</p><h1>${title}</h1><p>${sub}</p></div></div>${syncBanner()}<div class="section"><div class="section-head"><h2>確認できた情報</h2><p>${items.length}件</p></div><div class="stack">${items.length ? items.slice(0, 30).map(realCard).join("") : emptyCard(isServices ? "現在の同期データでは、制度として分類できる情報を確認できませんでした。空の機能を主役にはせず、検索から探せるようにしています。" : "現在の同期データでは、募集中・申込中として抽出できる情報を確認できませんでした。")}</div></div><button class="v2-wide-button" type="button" data-v2-nav="search">普通の言葉でさらに探す →</button></section>`;
}

function v2NotificationGroups() {
  const items = (state.data.latest || []).slice(0, 20);
  const civicPattern = /議会|定例会|一般質問|議案|選挙|市長|条例|予算|決算|計画|パブリックコメント/;
  return { life: items.filter((item) => !civicPattern.test(item.title || "")), civic: items.filter((item) => civicPattern.test(item.title || "")) };
}

function v2NotificationsView() {
  const { life, civic } = v2NotificationGroups();
  const lifeSection = `<section class="v2-notification-group"><div class="section-head"><div><h2>生活のお知らせ</h2><p>防災・施設・イベント・手続きなど</p></div><span>${life.length}件</span></div><div class="latest-list">${life.length ? life.map(latestRow).join("") : emptyCard("現在、生活に分類できる新着はありません。")}</div></section>`;
  const civicSection = `<section class="v2-notification-group"><div class="section-head"><div><h2>市政のお知らせ</h2><p>議会・計画・予算など</p></div><span>${civic.length}件</span></div><div class="latest-list">${civic.length ? civic.map(latestRow).join("") : emptyCard("現在、市政に分類できる新着はありません。")}</div></section>`;
  const ordered = state.v2Preferences.lifeNotifications ? `${lifeSection}${civicSection}` : `${civicSection}${lifeSection}`;
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">お知らせ</p><h1>生活と市政を分けて見る</h1><p>設定した優先順で、2つを混ぜずに確認できます。</p></div></div>${syncBanner()}${ordered}</section>`;
}

function v2MeetingView() {
  const council = state.data.council || {};
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-v2-action="home">‹ きょうへ</button><div class="v2-inner-hero"><div><p class="eyebrow">次の市議会</p><h1>${esc(council.nextDateLabel || council.title || "日程を確認中")}</h1><p>${esc(council.nextSummary || council.summary || "公式日程を確認しています。")}</p></div></div>${syncBanner()}<div class="card info-card v2-meeting-detail"><h2>${esc(council.title || "直方市議会")}</h2><p><strong>予定：</strong>${esc(council.nextDateLabel || "確認中")}</p><p><strong>内容：</strong>${esc(council.nextSummary || "確認中")}</p><p><strong>注意：</strong>日程・開会時間は変更されることがあります。</p>${sourceLink(council.sourceUrl, "この会議の公式日程を見る")}</div><div class="card info-card"><h2>この画面で確認できないこと</h2><p>個別議案の内容や採決結果は、この日程ページだけではまだ確認できません。推測では結び付けません。</p></div></section>`;
}

function v2MenuView() {
  return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">メニュー</p><h1>知りたいところから</h1><p>未完成の機能は、現在の状態が分かる名前で表示します。</p></div></div><div class="v2-menu-grid"><button type="button" data-v2-action="decision"><strong>市長・市議会</strong><small>誰が、どう決める？</small></button><button type="button" data-v2-action="ask"><strong>公式情報に質問</strong><small>資料にないことは不回答</small></button><button type="button" data-v2-action="glossary"><strong>ことば図鑑</strong><small>前提知識ゼロでOK</small></button><button type="button" data-v2-action="settings"><strong>地域・テーマ設定</strong><small>端末内だけに保存</small></button><button type="button" data-v2-action="nearby"><strong>場所から見る</strong><small>住所が確認できる情報</small></button><button type="button" data-v2-action="money"><strong>予算データの準備状況</strong><small>検算済みの数字だけ</small></button></div><div class="v2-menu-note card info-card"><h2>MYTOWNの約束</h2><p>分からないことは分からないと表示します。政治家をAIが採点・評価しません。大事な情報には一次資料へのリンクを付けます。</p></div></section>`;
}

function v2SettingsView() {
  const preferences = state.v2Preferences;
  return `<section class="page v2-page v2-inner-page"><button class="back-button" type="button" data-action="back">‹ 戻る</button><div class="v2-inner-hero"><div><p class="eyebrow">地域・テーマ設定</p><h1>自分に関係する情報を先に</h1><p>住所や会員登録は不要です。設定はこの端末の中だけに保存します。</p></div></div><form id="v2-preferences-form" class="v2-preferences-form"><fieldset><legend>おおまかな地区（任意）</legend><label class="v2-field"><span>町名やよく使う場所</span><input type="text" name="district" value="${esc(preferences.district)}" placeholder="例：植木、感田、直方駅周辺" maxlength="30"><small>位置情報は使いません。公開情報の場所名と一致するときだけ優先します。</small></label></fieldset><fieldset><legend>関心のあるテーマ</legend><div class="v2-interest-grid">${V2_INTERESTS.map((interest) => `<label><input type="checkbox" name="interests" value="${esc(interest)}" ${preferences.interests.includes(interest) ? "checked" : ""}><span>${esc(interest)}</span></label>`).join("")}</div></fieldset><fieldset><legend>お知らせの希望</legend><label class="v2-check-row"><input type="checkbox" name="lifeNotifications" ${preferences.lifeNotifications ? "checked" : ""}><span><strong>お知らせは生活情報を上に</strong><small>オフにすると、市政情報を先に表示します。</small></span></label><label class="v2-field"><span>市政情報の見方</span><select name="civicDigest"><option value="weekly" ${preferences.civicDigest === "weekly" ? "selected" : ""}>週1回くらいでまとめて</option><option value="all" ${preferences.civicDigest === "all" ? "selected" : ""}>新着をすべて見る</option><option value="off" ${preferences.civicDigest === "off" ? "selected" : ""}>ホームでは優先しない</option></select><small>端末へのプッシュ通知はまだ未接続です。ここでは表示の優先度を保存します。</small></label></fieldset><button class="primary-button v2-save-button" type="submit">設定を保存する</button></form><div class="card info-card v2-about-card"><h2>このアプリについて</h2><p>MYTOWNは非公式のMVPです。直方市公式アプリではありません。表示内容は直方市の公開情報を約6時間ごとに確認し、公式ページへのリンクを付けます。</p></div></section>`;
}

settingsView = v2SettingsView;

function v2EnsureActionSheet() {
  if (document.querySelector("#v2-action-sheet")) return;
  const wrapper = document.createElement("div");
  wrapper.id = "v2-action-sheet";
  wrapper.className = "v2-sheet";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `<button class="v2-sheet-backdrop" type="button" data-v2-sheet-close aria-label="閉じる"></button><section class="v2-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="v2-sheet-title"><div class="v2-sheet-handle" aria-hidden="true"></div><div class="v2-sheet-head"><div>${v2Mascot("")}</div><div><small>MYTOWN</small><h2 id="v2-sheet-title">何を調べる？</h2></div><button type="button" data-v2-sheet-close aria-label="閉じる">×</button></div><div class="v2-sheet-list"><button type="button" data-v2-action="nearby"><div><strong>この工事・場所なに？</strong><small>場所が確認できる情報から</small></div><b>›</b></button><button type="button" data-v2-action="services"><div><strong>使える制度を探す</strong><small>補助・支援・手続き</small></div><b>›</b></button><button type="button" data-v2-action="money"><div><strong>直方のお金</strong><small>現在のデータ準備状況</small></div><b>›</b></button><button type="button" data-v2-action="decision"><div><strong>誰が決めた？</strong><small>市長・議会・議員</small></div><b>›</b></button><button type="button" data-v2-action="ask"><div><strong>公式情報に質問</strong><small>資料にないことは不回答</small></div><b>›</b></button></div></section>`;
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
  if (hash) history.pushState({ tab, page, view }, "", hash);
  render();
}

function v2HandleAction(action) {
  v2CloseSheet(false);
  if (action === "home") return v2SetRoute({ tab: "today", page: null, hash: "#home" });
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
  if (nav === "search") return v2SetRoute({ tab: "discover", page: null, hash: "#search" });
  if (nav === "action") return v2OpenSheet();
  if (nav === "notifications") return v2SetRoute({ tab: "today", page: "notifications", hash: "#notifications" });
  if (nav === "menu") return v2SetRoute({ tab: "today", page: "menu", hash: "#menu" });
}

function v2ActiveNav() {
  if (state.v2Page === "notifications") return "notifications";
  if (state.v2Page === "menu" || state.tab === "politics" || state.view === "settings" || state.view === "money") return "menu";
  if (state.tab === "discover" || state.tab === "nearby") return "search";
  return "home";
}

function v2SyncNav() {
  const active = v2ActiveNav();
  document.querySelectorAll("[data-v2-nav]").forEach((button) => {
    const isActive = button.dataset.v2Nav === active;
    button.classList.toggle("is-active", isActive);
    if (["home", "search", "notifications", "menu"].includes(button.dataset.v2Nav)) button.setAttribute("aria-current", isActive ? "page" : "false");
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
  state.v2Preferences = { ...V2_DEFAULT_PREFERENCES, district: String(formData.get("district") || "").trim(), interests: formData.getAll("interests").map(String), lifeNotifications: formData.get("lifeNotifications") === "on", civicDigest: String(formData.get("civicDigest") || "weekly") };
  try {
    localStorage.setItem(V2_PREFERENCES_KEY, JSON.stringify(state.v2Preferences));
    showToast("地域とテーマの設定を保存しました");
  } catch (error) {
    console.warn("Preference save failed", error);
    showToast("このブラウザでは設定を保存できませんでした");
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
