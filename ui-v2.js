/* MYTOWN UI v2 — watercolor, citizen-first home experience.
 * This file intentionally sits on top of the existing data/politics runtime.
 * It changes presentation and navigation without changing synchronized civic data.
 */

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

function v2Icon(path, alt = "", className = "") {
  return `<img class="${esc(className)}" src="${esc(path)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
}

function v2Mascot(alt = "まちナビ") {
  return `<img class="v2-mascot" src="${V2_ASSETS.mascot}" alt="${esc(alt)}" decoding="async" fetchpriority="high">`;
}

function v2DateLabel() {
  return japaneseDate();
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
  return (state.data.featured || []).find((item) => item.location) || null;
}

function v2CurrentBulletin() {
  const issue = state.data?.bulletin?.currentIssue;
  if (!issue) return null;
  return {
    ...issue,
    id: issue.id || `bulletin-${issue.issueKey || "latest"}`,
    sourceUrl: issue.sourceUrl || state.data.bulletin.archiveUrl,
    pdfUrl: issue.wholePdfUrl || null,
  };
}

function v2GlossaryPick() {
  const glossary = state.politics?.glossary || [];
  return glossary.find((item) => item.formal === "補正予算") || glossary[0] || null;
}

function v2Hero() {
  return `<section class="v2-hero" aria-labelledby="v2-home-title">
    <div class="v2-hero-actions">
      <button type="button" class="v2-round-action" data-v2-nav="notifications" aria-label="お知らせを見る">
        <span aria-hidden="true">🔔</span><small>お知らせ</small>
      </button>
      <button type="button" class="v2-round-action" data-v2-nav="menu" aria-label="マイ設定とメニューを開く">
        <span aria-hidden="true">👤</span><small>マイ設定</small>
      </button>
    </div>
    <div class="v2-hero-copy">
      <p class="v2-date">${esc(v2DateLabel())}</p>
      <p class="v2-wordmark">MYTOWN</p>
      <h1 id="v2-home-title">直方市</h1>
      <p class="v2-tagline">暮らしから、<br>まちがわかる。</p>
    </div>
    ${v2Mascot("チューリップと石炭をモチーフにしたMYTOWNの案内役まちナビ")}
    <div class="v2-hero-fade" aria-hidden="true"></div>
  </section>`;
}

function v2ActionGrid() {
  const cards = [
    { key: "nearby", title: "近くを見る", sub: "工事・場所", asset: V2_ASSETS.nearby, tone: "mint" },
    { key: "services", title: "使える制度", sub: "補助・手続き", asset: V2_ASSETS.services, tone: "peach" },
    { key: "deadline", title: "まだ間に合う", sub: "意見・期限", asset: V2_ASSETS.deadline, tone: "yellow" },
    { key: "decision", title: "誰が決めた？", sub: "市長・議会", asset: V2_ASSETS.decision, tone: "lavender" },
  ];
  return `<section class="v2-action-section" aria-labelledby="v2-action-title">
    <p class="v2-section-kicker" id="v2-action-title">🌱 直方の「いま」を30秒で</p>
    <div class="v2-action-grid">
      ${cards.map((card) => `<button type="button" class="v2-action-card tone-${card.tone}" data-v2-action="${card.key}">
        ${v2Icon(card.asset, "", "v2-action-image")}
        <span class="v2-action-copy"><strong>${card.title}</strong><small>${card.sub}</small></span>
        <span class="v2-action-arrow" aria-hidden="true">›</span>
      </button>`).join("")}
    </div>
  </section>`;
}

function v2DecisionFlow() {
  const steps = [
    ["1", "暮らし", "気づき・困りごと", "🏠"],
    ["2", "市役所", "調査・検討", "🏢"],
    ["3", "市議会", "審議・採決", "🏛️"],
    ["4", "決定・実行", "決まった後", "✅"],
  ];
  return `<section class="v2-flow-section" aria-labelledby="v2-flow-title">
    <div class="v2-section-heading"><span aria-hidden="true">🌷</span><h2 id="v2-flow-title">まちのこと、一緒にたどろう</h2><span aria-hidden="true">🌷</span></div>
    <div class="v2-flow-grid">
      ${steps.map(([n, title, sub, icon], index) => `<div class="v2-flow-step">
        <div class="v2-flow-number">${n}</div>
        <div class="v2-flow-icon" aria-hidden="true">${icon}</div>
        <strong>${title}</strong><small>${sub}</small>
        ${index < steps.length - 1 ? `<span class="v2-flow-arrow" aria-hidden="true">→</span>` : ""}
      </div>`).join("")}
    </div>
    <p class="v2-flow-note">※ 実際の手続きは事業ごとに異なります。MYTOWNでは一次資料で確認できた流れだけを表示します。</p>
  </section>`;
}

function v2DashboardCard({ tone = "white", eyebrow = "", icon = "", title = "", body = "", meta = "", action = "", actionLabel = "詳しく見る", sourceUrl = "" }) {
  const actionHtml = action
    ? `<button class="v2-card-button" type="button" data-v2-action="${esc(action)}">${esc(actionLabel)} <span aria-hidden="true">›</span></button>`
    : sourceUrl
      ? `<a class="v2-card-button" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(actionLabel)} <span aria-hidden="true">↗</span></a>`
      : "";
  return `<article class="v2-dashboard-card tone-${esc(tone)}">
    <div class="v2-card-head"><span class="v2-card-eyebrow">${icon ? `<b aria-hidden="true">${icon}</b>` : ""}${esc(eyebrow)}</span></div>
    <h3>${esc(title)}</h3>
    ${body ? `<p>${esc(body)}</p>` : ""}
    ${meta ? `<div class="v2-card-meta">${esc(meta)}</div>` : ""}
    ${actionHtml}
  </article>`;
}

function v2Dashboard() {
  const locationItem = v2FindLocationItem();
  const deadline = v2FindDeadlines()[0] || null;
  const council = state.data.council || null;
  const bulletin = v2CurrentBulletin();
  const glossary = v2GlossaryPick();

  const cards = [];
  cards.push(v2DashboardCard({
    tone: "mint",
    eyebrow: "あなたの近くを調べる",
    icon: "📍",
    title: locationItem ? locationItem.title : "場所がわかる情報",
    body: locationItem ? (locationItem.location || locationItem.summary || "") : "現在地との距離は推測しません。住所・場所が確認できた公式情報から探せます。",
    meta: locationItem?.status || "公式情報だけを表示",
    action: "nearby",
    actionLabel: locationItem ? "何の情報？" : "場所から見る",
  }));

  cards.push(v2DashboardCard({
    tone: "pink",
    eyebrow: "まだ間に合う",
    icon: "📣",
    title: deadline ? deadline.title : "募集中の情報を確認",
    body: deadline ? (deadline.summary || "公式ページで募集条件・期限をご確認ください。") : "意見募集・申込・受付など、同期済み公式情報から探します。",
    meta: deadline?.published ? `公開 ${deadline.published}` : "期限は公式ページで確認",
    action: "deadline",
    actionLabel: "30秒で見る",
  }));

  cards.push(v2DashboardCard({
    tone: "green",
    eyebrow: "次の市議会",
    icon: "🏛️",
    title: council?.nextDateLabel || council?.title || "市議会日程を確認",
    body: council ? (council.nextSummary || council.summary || "") : "同期済みの市議会日程を確認しています。",
    meta: council?.status || "公式日程ベース",
    action: "council",
    actionLabel: "くわしく見る",
  }));

  cards.push(v2DashboardCard({
    tone: "yellow",
    eyebrow: "直方のお金",
    icon: "¥",
    title: "予算・決算は検算してから",
    body: "本格的な予算データはまだ構造化中です。確認できない金額を見た目のために置きません。",
    meta: "数値データ連携準備中",
    action: "money",
    actionLabel: "現在の状況を見る",
  }));

  cards.push(v2DashboardCard({
    tone: "blue",
    eyebrow: "市報のおがた",
    icon: "📖",
    title: bulletin?.title || "最新号を確認中",
    body: bulletin ? (bulletin.summary || bulletin.sourceDescription || "直方市が公開している市報の最新号です。") : "最新号を自動検知しています。",
    meta: bulletin?.status || state.data?.bulletin?.sync?.message || "公式市報ベース",
    sourceUrl: bulletin?.sourceUrl || state.data?.bulletin?.archiveUrl || "",
    actionLabel: "読む",
  }));

  cards.push(v2DashboardCard({
    tone: "orange",
    eyebrow: "まちナビ",
    icon: "💡",
    title: glossary ? `${glossary.formal}って何？` : "役所の言葉、むずかしくない？",
    body: glossary ? glossary.easy : "難しい行政・議会用語を、普通の言葉から説明します。",
    meta: "人ではなく、分かりにくい制度をやさしく解説",
    action: "glossary",
    actionLabel: "見てみる",
  }));

  return `<section class="v2-dashboard-section" aria-labelledby="v2-dashboard-title">
    <div class="v2-section-heading"><span aria-hidden="true">🌷</span><h2 id="v2-dashboard-title">今日の直方</h2><span aria-hidden="true">🌷</span></div>
    <div class="v2-dashboard-grid">${cards.join("")}</div>
  </section>`;
}

function v2LifeAndLatest() {
  const latest = (state.data.latest || []).slice(0, 5);
  return `<section class="v2-lower-section">
    <div class="v2-mini-grid">
      ${garbageMini(state.data.garbage)}
      ${populationMini(state.data.population)}
    </div>
    <details class="v2-latest-details">
      <summary>直方市公式サイトの新着も見る <span aria-hidden="true">＋</span></summary>
      <div class="latest-list">${latest.length ? latest.map(latestRow).join("") : emptyCard("新着情報を取得できませんでした。")}</div>
    </details>
  </section>`;
}

function todayV2View() {
  if (state.loading) {
    return `<section class="page v2-page">${v2Hero()}<div class="v2-content"><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div><p class="muted">直方市の公式情報を確認しています…</p></div></div></section>`;
  }
  return `<section class="page v2-page v2-home-page">
    ${v2Hero()}
    <div class="v2-content">
      ${v2ActionGrid()}
      <div class="v2-sync-wrap">${syncBanner()}</div>
      ${v2DecisionFlow()}
      ${v2Dashboard()}
      ${v2LifeAndLatest()}
      <p class="v2-disclaimer">MYTOWNは非公式の地域生活アプリMVPです。重要な手続き・期限・選挙情報は必ずリンク先の直方市公式情報も確認してください。</p>
    </div>
  </section>`;
}

function v2SearchHubView() {
  const all = combinedSearchItems();
  const q = normalizeQuery(state.discoverQuery);
  const category = state.discoverCategory;
  const results = all.filter((item) => {
    const text = normalizeQuery(`${item.title} ${item.summary || ""} ${item.category || ""}`);
    const matchesQ = !q || q.split(/\s+/).every((token) => text.includes(token));
    const matchesCategory = !category || (item.category || classifyTitle(item.title)) === category;
    return matchesQ && matchesCategory;
  });
  return `<section class="page v2-page v2-inner-page">
    <div class="v2-inner-hero"><span class="v2-inner-icon" aria-hidden="true">🔎</span><div><p class="eyebrow">さがす</p><h1>役所の名前を知らなくて大丈夫</h1><p>場所・普通の言葉・テーマから、同期済みの公式情報を横断します。</p></div></div>
    ${syncBanner()}
    <div class="v2-search-shortcuts">
      <button type="button" data-v2-action="nearby"><span>📍</span><strong>場所から</strong><small>住所が確認できる情報</small></button>
      <button type="button" data-v2-action="services"><span>🎁</span><strong>使える制度</strong><small>補助・支援・手続き</small></button>
      <button type="button" data-v2-action="deadline"><span>⏳</span><strong>期限から</strong><small>募集・申込・意見</small></button>
    </div>
    <form class="search-box v2-search-box" id="discover-form"><span aria-hidden="true">⌕</span><input id="discover-search" type="search" value="${esc(state.discoverQuery)}" placeholder="例：バス、学校、ごみ" aria-label="街の情報を検索"><button>探す</button></form>
    <div class="filter-row" aria-label="カテゴリで絞る"><button class="filter-chip ${!category ? "is-active" : ""}" type="button" data-category-filter="">すべて</button>${discoverCategories.map((x) => `<button class="filter-chip ${category === x ? "is-active" : ""}" type="button" data-category-filter="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div class="section"><div class="section-head"><h2>検索結果</h2><p>${results.length}件</p></div><div class="stack">${results.length ? results.slice(0, 30).map(realCard).join("") : emptyCard("該当する同期情報は見つかりませんでした。見つからない内容を推測で補うことはしません。")}</div></div>
  </section>`;
}

function v2CollectionView(type) {
  const isServices = type === "services";
  const items = isServices ? v2FindServices() : v2FindDeadlines();
  const title = isServices ? "使える制度" : "まだ間に合う";
  const sub = isServices
    ? "補助・助成・給付・支援・手続きに関係する同期済み公式情報です。対象になるかは公式条件で確認してください。"
    : "募集・申込・意見募集などに関係する同期済み公式情報です。期限は必ず公式ページで最終確認してください。";
  return `<section class="page v2-page v2-inner-page">
    <button class="back-button" type="button" data-v2-action="home">‹ ホームへ</button>
    <div class="v2-inner-hero"><span class="v2-inner-icon" aria-hidden="true">${isServices ? "🎁" : "⏳"}</span><div><p class="eyebrow">暮らしから探す</p><h1>${title}</h1><p>${sub}</p></div></div>
    ${syncBanner()}
    <div class="section"><div class="section-head"><h2>確認できた情報</h2><p>${items.length}件</p></div><div class="stack">${items.length ? items.slice(0, 30).map(realCard).join("") : emptyCard(isServices ? "現在の同期データでは、制度として分類できる情報を確認できませんでした。通常検索からも探せます。" : "現在の同期データでは、募集中・申込中として抽出できる情報を確認できませんでした。")}</div></div>
    <button class="v2-wide-button" type="button" data-v2-nav="search">普通の言葉でさらに探す →</button>
  </section>`;
}

function v2NotificationsView() {
  const latest = (state.data.latest || []).slice(0, 12);
  return `<section class="page v2-page v2-inner-page">
    <div class="v2-inner-hero"><span class="v2-inner-icon" aria-hidden="true">🔔</span><div><p class="eyebrow">お知らせ</p><h1>直方の新しい動き</h1><p>未読を装う赤い数字は付けません。同期済みの公式新着を新しい順に見られます。</p></div></div>
    ${syncBanner()}
    <div class="latest-list v2-notification-list">${latest.length ? latest.map(latestRow).join("") : emptyCard("現在、新着情報を取得できませんでした。")}</div>
  </section>`;
}

function v2MenuView() {
  return `<section class="page v2-page v2-inner-page">
    <div class="v2-inner-hero"><span class="v2-inner-icon" aria-hidden="true">☰</span><div><p class="eyebrow">メニュー</p><h1>知りたいところから</h1><p>政治を前面に押し出さず、生活の疑問から必要な情報へ進めます。</p></div></div>
    <div class="v2-menu-grid">
      <button type="button" data-v2-action="decision"><span>👥</span><strong>市長・市議会</strong><small>誰が、どう決める？</small></button>
      <button type="button" data-v2-action="money"><span>¥</span><strong>直方のお金</strong><small>予算・決算</small></button>
      <button type="button" data-v2-action="ask"><span>✦</span><strong>直方のことを聞く</strong><small>同期済み公式情報から</small></button>
      <button type="button" data-v2-action="glossary"><span>📚</span><strong>ことば図鑑</strong><small>前提知識ゼロでOK</small></button>
      <button type="button" data-v2-action="settings"><span>⚙︎</span><strong>マイ設定</strong><small>このアプリについて</small></button>
      <button type="button" data-v2-action="nearby"><span>📍</span><strong>場所から見る</strong><small>公開情報の範囲で</small></button>
    </div>
    <div class="v2-menu-note card info-card"><h2>MYTOWNの約束</h2><p>分からないことは分からないと表示します。政治家をAIが採点・評価しません。大事な情報には一次資料へのリンクを付けます。</p></div>
  </section>`;
}

function v2EnsureActionSheet() {
  if (document.querySelector("#v2-action-sheet")) return;
  const wrapper = document.createElement("div");
  wrapper.id = "v2-action-sheet";
  wrapper.className = "v2-sheet";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.innerHTML = `<button class="v2-sheet-backdrop" type="button" data-v2-sheet-close aria-label="閉じる"></button>
    <section class="v2-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="v2-sheet-title">
      <div class="v2-sheet-handle" aria-hidden="true"></div>
      <div class="v2-sheet-head"><div>${v2Mascot("")}</div><div><small>MYTOWN</small><h2 id="v2-sheet-title">何を調べる？</h2></div><button type="button" data-v2-sheet-close aria-label="閉じる">×</button></div>
      <div class="v2-sheet-list">
        <button type="button" data-v2-action="nearby"><span>🚧</span><div><strong>この工事・場所なに？</strong><small>場所が確認できる情報から</small></div><b>›</b></button>
        <button type="button" data-v2-action="services"><span>🎁</span><div><strong>使える制度を探す</strong><small>補助・支援・手続き</small></div><b>›</b></button>
        <button type="button" data-v2-action="money"><span>¥</span><div><strong>直方のお金を見る</strong><small>予算・決算</small></div><b>›</b></button>
        <button type="button" data-v2-action="decision"><span>🏛️</span><div><strong>誰が決めた？</strong><small>市長・議会・議員</small></div><b>›</b></button>
        <button type="button" data-v2-action="ask"><span>✦</span><div><strong>直方のことを聞く</strong><small>同期済み公式情報から回答</small></div><b>›</b></button>
      </div>
    </section>`;
  document.body.appendChild(wrapper);
}

function v2OpenSheet() {
  v2EnsureActionSheet();
  const sheet = document.querySelector("#v2-action-sheet");
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  document.body.classList.add("v2-sheet-open");
  sheet.querySelector(".v2-sheet-panel button")?.focus();
}

function v2CloseSheet() {
  const sheet = document.querySelector("#v2-action-sheet");
  if (!sheet) return;
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  document.body.classList.remove("v2-sheet-open");
}

function v2SetRoute({ tab = "today", page = null, view = "tab", hash = "" } = {}) {
  state.tab = tab;
  state.v2Page = page;
  state.view = view;
  state.detailSection = null;
  state.selectedId = null;
  if (hash) history.pushState({ tab, page }, "", hash);
  render();
}

function v2HandleAction(action) {
  v2CloseSheet();
  if (action === "home") return v2SetRoute({ tab: "today", page: null, hash: "#home" });
  if (action === "nearby") return v2SetRoute({ tab: "nearby", page: null, hash: "#nearby" });
  if (action === "services") return v2SetRoute({ tab: "today", page: "services", hash: "#services" });
  if (action === "deadline") return v2SetRoute({ tab: "today", page: "deadline", hash: "#deadline" });
  if (action === "decision" || action === "council") {
    state.politicsSection = "home";
    return v2SetRoute({ tab: "politics", page: null, hash: "#politics" });
  }
  if (action === "glossary") {
    state.politicsSection = "glossary";
    return v2SetRoute({ tab: "politics", page: null, hash: "#politics" });
  }
  if (action === "ask") return v2SetRoute({ tab: "ask", page: null, hash: "#ask" });
  if (action === "money") {
    state.v2Page = null;
    state.view = "money";
    return render();
  }
  if (action === "settings") {
    state.v2Page = null;
    state.view = "settings";
    return render();
  }
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
    if (["home", "search", "notifications", "menu"].includes(button.dataset.v2Nav)) {
      button.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
}

/* Use the exact approved mascot in the existing politics explanations too. */
if (typeof guideBubble === "function") {
  guideBubble = function guideBubbleWithMascot(message, note = "") {
    return `<div class="guide-bubble v2-guide-bubble"><div class="guide-avatar" aria-hidden="true"><img src="${V2_ASSETS.mascot}" alt=""></div><div><strong>まちナビ</strong><p>${esc(message)}</p>${note ? `<small>${esc(note)}</small>` : ""}</div></div>`;
  };
}

const baseRenderForWatercolorV2 = render;
render = function renderWatercolorV2() {
  if (state.view === "tab" && state.tab === "today" && state.v2Page === "services") {
    main.innerHTML = v2CollectionView("services");
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (state.view === "tab" && state.tab === "today" && state.v2Page === "deadline") {
    main.innerHTML = v2CollectionView("deadline");
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (state.view === "tab" && state.tab === "today" && state.v2Page === "notifications") {
    main.innerHTML = v2NotificationsView();
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (state.view === "tab" && state.tab === "today" && state.v2Page === "menu") {
    main.innerHTML = v2MenuView();
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (state.view === "tab" && state.tab === "today") {
    main.innerHTML = todayV2View();
    window.scrollTo({ top: 0, behavior: "auto" });
  } else if (state.view === "tab" && state.tab === "discover") {
    main.innerHTML = v2SearchHubView();
    window.scrollTo({ top: 0, behavior: "auto" });
  } else {
    baseRenderForWatercolorV2();
  }
  v2SyncNav();
};

/* Earlier listeners still own legacy data-tab/data-action controls. These controls are separate. */
document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-v2-nav]");
  if (nav) {
    event.preventDefault();
    return v2HandleNav(nav.dataset.v2Nav);
  }
  if (event.target.closest("[data-v2-sheet-close]")) {
    event.preventDefault();
    return v2CloseSheet();
  }
  const action = event.target.closest("[data-v2-action]");
  if (action) {
    event.preventDefault();
    return v2HandleAction(action.dataset.v2Action);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") v2CloseSheet();
});

window.addEventListener("popstate", () => {
  const hash = location.hash.replace("#", "");
  if (hash === "home") { state.tab = "today"; state.v2Page = null; }
  else if (hash === "search") { state.tab = "discover"; state.v2Page = null; }
  else if (hash === "services") { state.tab = "today"; state.v2Page = "services"; }
  else if (hash === "deadline") { state.tab = "today"; state.v2Page = "deadline"; }
  else if (hash === "notifications") { state.tab = "today"; state.v2Page = "notifications"; }
  else if (hash === "menu") { state.tab = "today"; state.v2Page = "menu"; }
  render();
});

(function v2InitialRoute() {
  const hash = location.hash.replace("#", "");
  if (hash === "search") { state.tab = "discover"; state.v2Page = null; }
  else if (hash === "services") { state.tab = "today"; state.v2Page = "services"; }
  else if (hash === "deadline") { state.tab = "today"; state.v2Page = "deadline"; }
  else if (hash === "notifications") { state.tab = "today"; state.v2Page = "notifications"; }
  else if (hash === "menu") { state.tab = "today"; state.v2Page = "menu"; }
  else if (hash === "politics") { state.tab = "politics"; state.v2Page = null; }
  else if (hash === "ask") { state.tab = "ask"; state.v2Page = null; }
  else if (hash === "nearby") { state.tab = "nearby"; state.v2Page = null; }
  else if (hash === "discover") { state.tab = "discover"; state.v2Page = null; }
  else if (!hash || hash === "today" || hash === "home") { state.tab = "today"; state.v2Page = null; }
  v2EnsureActionSheet();
  render();
})();
