/* MYTOWN Home v4 — events first, everyday usefulness, civic depth in the same screen. */
"use strict";

(() => {
  state.v4EventFilter = state.v4EventFilter || "all";

  const V4_ASSETS = Object.freeze({
    mascot: "./assets/mascot/machinavi.webp?v=13",
    nearby: "./assets/icons/nearby.webp?v=13",
    services: "./assets/icons/services.webp?v=13",
    deadline: "./assets/icons/deadline.webp?v=13",
    decision: "./assets/icons/decision.webp?v=13",
    event: "./assets/illustrations/event-festival.svg?v=15",
  });

  const V4_EVENT_PATTERN = /イベント|フェスタ|まつり|祭り|祭\b|教室|講座|体験|コンサート|演奏会|展示|展覧会|上映|大会|マルシェ|ワークショップ|説明会|観光/;
  const V4_EVENT_EXCLUDE_PATTERN = /職員募集|採用|入札|工事事業者|補助金|給付金|定例会|一般質問|議案|会議録/;

  function v4Text(item = {}) {
    return `${item.title || ""} ${item.summary || ""} ${item.category || ""} ${item.when || ""}`;
  }

  function v4Short(value = "", max = 58) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function v4AllItems() {
    if (typeof combinedSearchItems === "function") return combinedSearchItems();
    const featured = Array.isArray(state.data?.featured) ? state.data.featured : [];
    const latest = Array.isArray(state.data?.latest)
      ? state.data.latest.map((item, index) => ({
          id: `latest-${index}`,
          ...item,
          sourceUrl: item.url,
          published: item.date,
          summary: "直方市が公開した新着情報です。",
          category: typeof classifyTitle === "function" ? classifyTitle(item.title || "") : "その他",
        }))
      : [];
    return [...featured, ...latest];
  }

  function v4IsEvent(item = {}) {
    const text = v4Text(item);
    if (!item.title || V4_EVENT_EXCLUDE_PATTERN.test(text)) return false;
    if (/観光・イベント|健康・スポーツ/.test(item.category || "")) return true;
    return V4_EVENT_PATTERN.test(text);
  }

  function v4EventScore(item = {}) {
    const text = v4Text(item);
    let score = 0;
    if (/観光・イベント/.test(item.category || "")) score += 60;
    if (/フェスタ|まつり|祭り|イベント|マルシェ/.test(text)) score += 35;
    if (/親子|子ども|こども|体験/.test(text)) score += 18;
    if (/健康・スポーツ/.test(item.category || "")) score += 12;
    if (item.location) score += 6;
    if (item.when) score += 6;
    if (item.sourceUrl || item.url) score += 3;
    return score;
  }

  function v4EventItems() {
    const seen = new Set();
    return v4AllItems()
      .filter(v4IsEvent)
      .filter((item) => {
        const key = `${item.title || ""}|${item.sourceUrl || item.url || ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const scoreDiff = v4EventScore(b) - v4EventScore(a);
        if (scoreDiff) return scoreDiff;
        return String(b.published || b.date || "").localeCompare(String(a.published || a.date || ""));
      });
  }

  function v4IsFeaturedItem(item) {
    return Boolean(item?.id && (state.data?.featured || []).some((candidate) => candidate.id === item.id));
  }

  function v4ItemControl(item, label = "30秒で見る", section = "what", className = "v4-inline-cta") {
    if (!item) return "";
    if (v4IsFeaturedItem(item)) {
      return `<button class="${esc(className)}" type="button" data-v2-detail-id="${esc(item.id)}" data-v2-detail-section="${esc(section)}">${esc(label)} <span aria-hidden="true">→</span></button>`;
    }
    const href = item.sourceUrl || item.url;
    if (href) {
      return `<a class="${esc(className)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)} <span aria-hidden="true">↗</span></a>`;
    }
    return "";
  }

  function v4EventFeature() {
    const events = v4EventItems();
    const primary = events[0] || null;
    const countLabel = events.length ? `${events.length}件掲載中` : "更新中";
    const title = primary ? primary.title : "イベント情報を更新しています";
    const summary = primary
      ? v4Short(primary.summary || "詳しい内容は市のページで確認できます。", 74)
      : "イベント・教室・体験をまとめて探せます。";
    const chips = [primary?.status, primary?.location ? v4Short(primary.location, 22) : ""].filter(Boolean);

    return `<section class="v4-event-feature" aria-labelledby="v4-event-feature-title">
      <div class="v4-event-art" aria-hidden="true"><img src="${V4_ASSETS.event}" alt="" decoding="async" fetchpriority="high"></div>
      <div class="v4-event-copy">
        <div class="v4-event-topline"><span>直方のイベント</span><small>${esc(countLabel)}</small></div>
        <h2 id="v4-event-feature-title">直方で、なにする？</h2>
        <h3>${esc(v4Short(title, 44))}</h3>
        <p>${esc(summary)}</p>
        ${chips.length ? `<div class="v4-event-chips">${chips.map((chip) => `<span>${esc(chip)}</span>`).join("")}</div>` : ""}
        <button class="v4-primary-cta" type="button" data-v2-action="events">イベントを見る <span aria-hidden="true">→</span></button>
      </div>
    </section>`;
  }

  function v4BentoCard({ action, tone, icon, kicker, title, note }) {
    return `<button type="button" class="v4-bento-card tone-${esc(tone)}" data-v2-action="${esc(action)}">
      <img src="${esc(icon)}" alt="" aria-hidden="true" loading="lazy" decoding="async">
      <span class="v4-bento-kicker">${esc(kicker)}</span>
      <strong>${esc(title)}</strong>
      <small>${esc(note)}</small>
      <b aria-hidden="true">›</b>
    </button>`;
  }

  function v4BentoOverview() {
    const locationItems = (state.data?.featured || []).filter((item) => item.location);
    const district = String(state.v2Preferences?.district || "").trim();
    const localMatch = district
      ? locationItems.find((item) => `${item.location || ""} ${item.title || ""}`.includes(district))
      : null;
    const deadlines = typeof v2FindDeadlines === "function" ? v2FindDeadlines() : [];
    const services = typeof v2FindServices === "function" ? v2FindServices() : [];
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;

    const cards = [
      {
        action: "nearby",
        tone: "mint",
        icon: V4_ASSETS.nearby,
        kicker: "施設・イベント・工事",
        title: "地図から探す",
        note: localMatch ? v4Short(localMatch.title, 26) : locationItems.length ? `場所を確認できる情報 ${locationItems.length}件` : "場所を確認できる情報を見る",
      },
      {
        action: "deadline",
        tone: "pink",
        icon: V4_ASSETS.deadline,
        kicker: "申し込み・募集",
        title: "締切のある情報",
        note: deadlines.length ? `${deadlines.length}件掲載中` : "募集情報を見る",
      },
      {
        action: "services",
        tone: "yellow",
        icon: V4_ASSETS.services,
        kicker: "補助・給付・暮らし",
        title: "制度・手続きを探す",
        note: services.length ? `条件を確認できる情報 ${services.length}件` : "子育て・暮らしから",
      },
      {
        action: "bulletin",
        tone: "blue",
        icon: V4_ASSETS.decision,
        kicker: "市報のおがた",
        title: "市報を読む",
        note: bulletin ? v4Short(bulletin.title || "最新号", 28) : "最新号を確認",
      },
    ];

    return `<section class="v4-bento" aria-labelledby="v4-bento-title">
      <div class="v4-section-heading">
        <div><p>必要な情報を</p><h2 id="v4-bento-title">暮らしから探す</h2></div>
      </div>
      <div class="v4-bento-grid">${cards.map(v4BentoCard).join("")}</div>
    </section>`;
  }

  function v4LifeStrip() {
    const garbage = state.data?.garbage || null;
    return `<div class="v4-life-strip" aria-label="暮らしの確認">
      ${garbage?.sourceUrl
        ? `<a href="${esc(garbage.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🗑️</span><div><small>ごみ</small><strong>ごみ収集日を見る</strong></div><b aria-hidden="true">↗</b></a>`
        : `<button type="button" data-v2-query="ごみ"><span aria-hidden="true">🗑️</span><div><small>ごみ</small><strong>ごみ情報を探す</strong></div><b aria-hidden="true">›</b></button>`}
      <button type="button" data-v2-action="settings"><span aria-hidden="true">📍</span><div><small>地域を設定</small><strong>${state.v2Preferences?.district ? `よく見る地域：${esc(state.v2Preferences.district)}` : "よく見る地域を選ぶ"}</strong></div><b aria-hidden="true">›</b></button>
    </div>`;
  }

  function v4CivicLayer() {
    const featured = state.data?.featured || [];
    const lifeItem = featured.find((item) => /バス|交通|ごみ|施設|学校|公園/.test(v4Text(item)) && !v4IsEvent(item))
      || featured.find((item) => !v4IsEvent(item))
      || null;
    const council = state.data?.council || null;

    return `<section class="v4-civic-layer" aria-labelledby="v4-civic-title">
      <div class="v4-section-heading v4-civic-heading">
        <div><p>暮らしに関わる</p><h2 id="v4-civic-title"><span aria-hidden="true">🌱</span> 市の動き</h2></div>
        <button type="button" data-v2-action="decision">市長・市議会を知る</button>
      </div>
      <div class="v4-civic-grid">
        <article class="v4-civic-card tone-mint">
          <div class="v4-civic-badge"><span aria-hidden="true">⏱</span> 30秒で読む</div>
          <h3>${esc(v4Short(lifeItem?.title || "直方市の新着情報", 38))}</h3>
          <p>${esc(v4Short(lifeItem?.summary || "暮らしに関わる市の情報を短く読めます。", 82))}</p>
          ${lifeItem ? v4ItemControl(lifeItem, "30秒で読む") : `<button class="v4-inline-cta" type="button" data-v2-nav="notifications">新着を見る <span aria-hidden="true">→</span></button>`}
        </article>
        <article class="v4-civic-card tone-lavender">
          <div class="v4-civic-badge"><span aria-hidden="true">🏛️</span> 次の市議会</div>
          <h3>${esc(council?.nextDateLabel || council?.title || "市議会の日程を確認中")}</h3>
          <p>${esc(v4Short(council?.nextSummary || council?.summary || "直方市議会の公式日程を確認しています。", 82))}</p>
          <button class="v4-inline-cta" type="button" data-v2-action="meeting">日程を見る <span aria-hidden="true">→</span></button>
        </article>
      </div>
    </section>`;
  }

  function v4AskBar() {
    const bus = (state.data?.featured || []).find((item) => /バス|路線と時刻表/.test(item.title || ""));
    const sample = bus ? "10月からバスはどう変わる？" : "今度の市議会はいつ？";
    return `<section class="v4-ask-bar" aria-labelledby="v4-ask-title">
      <div class="v4-ask-mascot"><img src="${V4_ASSETS.mascot}" alt="" loading="lazy" decoding="async"></div>
      <div class="v4-ask-copy"><p>市の資料から答えを探します</p><h2 id="v4-ask-title">まちナビに聞く</h2><button type="button" data-v2-action="ask"><span>${esc(sample)}</span><b aria-hidden="true">→</b></button><small>見つからないときは、推測せず「確認できません」と伝えます。</small></div>
    </section>`;
  }

  function v4ParticipationTeaser() {
    return `<section class="v4-participation-teaser" aria-label="まちに参加する入口">
      <div><small>まちに参加</small><strong>イベント掲載・ボランティア</strong><span>情報受付の仕組みを準備中です。</span></div>
      <button type="button" data-v2-action="participate">準備中の内容を見る <span aria-hidden="true">›</span></button>
    </section>`;
  }

  function v4HomeLoading() {
    return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content v4-home-content"><section class="v4-event-feature is-loading" aria-label="情報を読み込み中"><div class="v4-event-art"></div><div class="v4-event-copy"><div class="loading-line"></div><div class="loading-line short"></div><p>イベントと暮らしの情報を更新しています…</p></div></section></div></section>`;
  }

  todayV2View = function todayHomeV4() {
    if (state.loading) return v4HomeLoading();
    return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content v4-home-content">
      ${v4EventFeature()}
      ${v4BentoOverview()}
      ${v4LifeStrip()}
      <div class="v2-sync-wrap v4-sync-wrap">${syncBanner()}</div>
      ${state.v2Preferences?.civicDigest === "off" ? "" : v4CivicLayer()}
      ${v4AskBar()}
      ${v2LifeAndLatest()}
      <p class="v2-disclaimer">MYTOWNは、直方市の公開情報をもとにした非公式アプリです。掲載範囲は、現在取り込めた情報に限られます。手続き・期限・選挙は、直方市のページで最終確認してください。</p>
    </div></section>`;
  };

  function v4EventFilterDefinitions(items) {
    const definitions = [
      { id: "all", label: "すべて", test: () => true },
      { id: "family", label: "親子・子ども", test: (item) => /親子|子ども|こども|幼児|小学生|家族/.test(v4Text(item)) },
      { id: "sports", label: "スポーツ・健康", test: (item) => /スポーツ|健康|体育|運動|ピラティス|ヨガ/.test(v4Text(item)) },
      { id: "learn", label: "体験・学び", test: (item) => /体験|学習|講座|教室|展示|アート|環境|ワークショップ/.test(v4Text(item)) },
    ];
    return definitions.map((definition) => ({ ...definition, count: items.filter(definition.test).length }));
  }

  function v4EventListCard(item) {
    const category = item.category || (typeof classifyTitle === "function" ? classifyTitle(item.title || "") : "イベント");
    const facts = [
      item.when ? `<span><b>日時</b>${esc(v4Short(item.when, 38))}</span>` : "",
      item.location ? `<span><b>場所</b>${esc(v4Short(item.location, 42))}</span>` : "",
      item.money ? `<span><b>費用</b>${esc(v4Short(item.money, 28))}</span>` : "",
    ].filter(Boolean);
    return `<article class="v4-event-list-card">
      <div class="v4-event-list-icon" aria-hidden="true">${/スポーツ|健康/.test(category) ? "🏃" : /講座|体験|学/.test(v4Text(item)) ? "🎨" : "🎪"}</div>
      <div class="v4-event-list-copy">
        <div class="v4-event-list-meta"><span>${esc(category)}</span>${item.status ? `<strong>${esc(item.status)}</strong>` : ""}</div>
        <h3>${esc(item.title || "イベント情報")}</h3>
        <p>${esc(v4Short(item.summary || "詳しい内容は市のページで確認できます。", 104))}</p>
        ${facts.length ? `<div class="v4-event-facts">${facts.join("")}</div>` : ""}
        ${v4ItemControl(item, v4IsFeaturedItem(item) ? "30秒で見る" : "公式情報を見る", "what", "v4-event-card-cta")}
      </div>
    </article>`;
  }

  function v4EventsView() {
    const items = v4EventItems();
    const filters = v4EventFilterDefinitions(items);
    const active = filters.some((filter) => filter.id === state.v4EventFilter) ? state.v4EventFilter : "all";
    const activeFilter = filters.find((filter) => filter.id === active) || filters[0];
    const shown = items.filter(activeFilter.test);

    return `<section class="page v2-page v2-inner-page v4-events-page">
      <button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button>
      <div class="v4-events-hero">
        <div><p class="eyebrow">直方のイベント</p><h1>イベント・体験を探す</h1><p>直方市が公開しているイベントを探せます。</p></div>
        <img src="${V4_ASSETS.event}" alt="" aria-hidden="true" decoding="async">
      </div>
      <div class="v2-sync-wrap v4-sync-wrap">${syncBanner()}</div>
      <div class="v4-event-page-note"><strong>掲載について</strong><p>市内のすべてのイベントを掲載しているわけではありません。地域団体などの情報は、今後追加する予定です。</p></div>
      <div class="v4-event-filter-row" aria-label="イベントの種類で絞る">${filters.map((filter) => `<button type="button" class="${active === filter.id ? "is-active" : ""}" data-v4-event-filter="${esc(filter.id)}">${esc(filter.label)} <span>${filter.count}</span></button>`).join("")}</div>
      <div class="v4-event-results-head"><h2>${esc(activeFilter.label)}</h2><span>${shown.length}件</span></div>
      <div class="v4-event-list">${shown.length ? shown.map(v4EventListCard).join("") : emptyCard("この種類のイベントは見つかりませんでした。上の分類から別の種類を選んでください。")}</div>
      <section class="v4-event-contribute"><div><small>載っていないイベントがありますか？</small><h2>イベント情報の受付は準備中です</h2><p>主催者や市民からの情報受付は、確認方法と安全対策を整えてから始めます。</p></div><button type="button" data-v2-action="participate">準備中の内容を見る →</button></section>
    </section>`;
  }

  function v4ParticipationView() {
    return `<section class="page v2-page v2-inner-page v4-participation-page">
      <button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button>
      <div class="v2-inner-hero"><div><p class="eyebrow">まちに参加する</p><h1>イベントや地域活動に参加する</h1><p>イベント情報の掲載や、短時間のボランティア募集を受け付ける仕組みを準備しています。</p></div></div>
      <div class="v4-participation-grid">
        <article><span class="v4-status-chip">準備中</span><div class="v4-participation-icon" aria-hidden="true">🎪</div><h2>イベントを載せる</h2><p>主催者から日時・場所・市のページなどの情報を受け付け、確認後に掲載する仕組みを準備しています。現在はまだ投稿できません。</p><button type="button" data-v2-action="events">現在のイベントを見る →</button></article>
        <article><span class="v4-status-chip">準備中</span><div class="v4-participation-icon" aria-hidden="true">🤝</div><h2>ボランティアを探す</h2><p>イベント運営、清掃、地域活動などの募集と、短時間なら参加できる人をつなぐ仕組みを準備しています。</p><button type="button" data-v2-query="ボランティア">現在の募集を探す →</button></article>
      </div>
      <div class="card info-card v4-safety-card"><h2>安全に利用できる仕組みを準備します</h2><p>自由掲示板にはしません。募集団体の確認、個人情報の保護、子ども・高齢者・個人宅・危険作業などの慎重な扱いを決めてから公開します。</p></div>
    </section>`;
  }

  v2SearchIntro = function v4SearchIntro() {
    const deadlines = typeof v2FindDeadlines === "function" ? v2FindDeadlines().slice(0, 2) : [];
    const eventCount = v4EventItems().length;
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;
    return `<div class="v2-search-intro"><section class="v2-popular-search" aria-labelledby="v2-popular-title"><h2 id="v2-popular-title">検索の例</h2><div class="v2-query-chips">${["イベント", "バス", "ごみ", "子育て", "学校"].map((query) => `<button type="button" data-v2-query="${esc(query)}">${esc(query)}</button>`).join("")}</div></section>
      <section class="v2-search-groups" aria-label="探し方"><button type="button" data-v2-action="events"><strong>イベント</strong><span>${eventCount ? `${eventCount}件掲載中` : "イベント・体験を探す"}</span></button><button type="button" data-v2-action="deadline"><strong>締切のある情報</strong><span>${deadlines.length ? `${deadlines.length}件掲載中` : "募集・申し込みを探す"}</span></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><span>子育て・暮らしの手続き</span></button><button type="button" data-v2-action="nearby"><strong>地図</strong><span>場所を確認できる情報</span></button><button type="button" data-v2-action="decision"><strong>市長・市議会</strong><span>役割・議員・選挙</span></button>${bulletin ? `<button type="button" data-v2-action="bulletin"><strong>市報</strong><span>${esc(bulletin.title || "最新号")}</span></button>` : ""}</section><p class="v2-search-note">現在取り込んでいる市の公開情報から検索します。</p></div>`;
  };

  v2MenuView = function v4MenuView() {
    const eventCount = v4EventItems().length;
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;
    return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">メニュー</p><h1>やりたいことから選ぶ</h1><p>イベント、暮らし、市の動きをまとめて探せます。</p></div></div><div class="v2-menu-grid v4-menu-grid"><button type="button" data-v2-action="events"><strong>イベント・おでかけ</strong><small>${eventCount ? `${eventCount}件掲載中` : "体験・教室も探す"}</small></button><button type="button" data-v2-action="nearby"><strong>地図から探す</strong><small>施設・イベント・工事など</small></button><button type="button" data-v2-action="deadline"><strong>締切のある情報</strong><small>申し込み・募集・意見募集</small></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><small>子育て・暮らしから</small></button>${bulletin ? `<button type="button" data-v2-action="bulletin"><strong>市報のおがた</strong><small>${esc(bulletin.title || "最新号")}</small></button>` : ""}<button type="button" data-v2-action="decision"><strong>市長・市議会</strong><small>役割・議員・選挙</small></button><button type="button" data-v2-action="ask"><strong>まちナビに聞く</strong><small>市の資料から答えを探す</small></button><button type="button" data-v2-action="participate"><strong>イベント掲載・ボランティア</strong><small>受付機能は準備中</small></button><button type="button" data-v2-action="settings"><strong>地域と表示順を設定</strong><small>このブラウザだけに保存</small></button><button type="button" data-v2-action="glossary"><strong>役所ことば図鑑</strong><small>難しい言葉をやさしく</small></button><button type="button" data-v2-action="money"><strong>直方市の予算</strong><small>市の資料と照合した数字だけ</small></button></div><div class="v2-menu-note card info-card"><h2>MYTOWNの約束</h2><p>公開資料で確認できないことは、推測で補いません。人物の評価や採点はしません。大切な情報には、確認に使った直方市のページへのリンクを付けます。</p></div></section>`;
  };

  function v4PatchActionSheet() {
    const list = document.querySelector("#v2-action-sheet .v2-sheet-list");
    if (!list || list.querySelector('[data-v2-action="events"]')) return;
    list.insertAdjacentHTML("afterbegin", `<button type="button" data-v2-action="events"><div><strong>イベント・おでかけ</strong><small>直方のイベント・体験を探す</small></div><b>›</b></button>`);
    list.insertAdjacentHTML("beforeend", `<button type="button" data-v2-action="participate"><div><strong>イベント掲載・ボランティア</strong><small>受付機能は準備中</small></div><b>›</b></button>`);
  }

  const baseEnsureActionSheet = v2EnsureActionSheet;
  v2EnsureActionSheet = function ensureV4ActionSheet() {
    baseEnsureActionSheet();
    v4PatchActionSheet();
  };

  const baseHandleAction = v2HandleAction;
  v2HandleAction = function handleV4Action(action) {
    if (action === "events") {
      v2CloseSheet(false);
      return v2SetRoute({ tab: "today", page: "events", hash: "#events" });
    }
    if (action === "participate") {
      v2CloseSheet(false);
      return v2SetRoute({ tab: "today", page: "participate", hash: "#participate" });
    }
    return baseHandleAction(action);
  };

  const baseApplyHashRoute = v2ApplyHashRoute;
  v2ApplyHashRoute = function applyV4HashRoute() {
    const hash = location.hash.replace("#", "");
    if (hash === "events") {
      state.view = "tab";
      state.tab = "today";
      state.v2Page = "events";
      state.selectedId = null;
      state.detailSection = null;
      return;
    }
    if (hash === "participate") {
      state.view = "tab";
      state.tab = "today";
      state.v2Page = "participate";
      state.selectedId = null;
      state.detailSection = null;
      return;
    }
    baseApplyHashRoute();
  };

  const baseActiveNav = v2ActiveNav;
  v2ActiveNav = function activeV4Nav() {
    if (state.v2Page === "participate") return "menu";
    return baseActiveNav();
  };

  const baseRender = render;
  render = function renderHomeV4() {
    if (state.view === "tab" && state.tab === "today" && state.v2Page === "events") {
      main.innerHTML = v4EventsView();
      window.scrollTo({ top: 0, behavior: "auto" });
      v2SyncNav();
      return;
    }
    if (state.view === "tab" && state.tab === "today" && state.v2Page === "participate") {
      main.innerHTML = v4ParticipationView();
      window.scrollTo({ top: 0, behavior: "auto" });
      v2SyncNav();
      return;
    }
    baseRender();
  };

  document.addEventListener("click", (event) => {
    const filter = event.target.closest("[data-v4-event-filter]");
    if (!filter) return;
    event.preventDefault();
    state.v4EventFilter = filter.dataset.v4EventFilter || "all";
    render();
  });

  v4PatchActionSheet();
  v2ApplyHashRoute();
  render();
})();
