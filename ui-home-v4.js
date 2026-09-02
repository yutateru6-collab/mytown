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
          summary: "直方市公式サイトの新着情報です。",
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
    const countLabel = events.length ? `確認できた ${events.length}件` : "情報を確認中";
    const title = primary ? primary.title : "直方のイベント情報を集めています";
    const summary = primary
      ? v4Short(primary.summary || "開催内容は公式ページで確認できます。", 74)
      : "イベント・教室・体験などを、暮らしの情報と一緒に見つけられる入口です。";
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
    const council = state.data?.council || null;

    const cards = [
      {
        action: "nearby",
        tone: "mint",
        icon: V4_ASSETS.nearby,
        kicker: "近くで",
        title: "何がある？",
        note: localMatch ? v4Short(localMatch.title, 26) : locationItems.length ? `場所つき情報 ${locationItems.length}件` : "施設・イベントを探す",
      },
      {
        action: "deadline",
        tone: "pink",
        icon: V4_ASSETS.deadline,
        kicker: "まだ間に合う",
        title: "申込・意見募集",
        note: deadlines.length ? `確認できる情報 ${deadlines.length}件` : "締切のある情報を探す",
      },
      {
        action: "services",
        tone: "yellow",
        icon: V4_ASSETS.services,
        kicker: "使えるかも",
        title: "制度・手続き",
        note: services.length ? `公式条件つき ${services.length}件` : "子育て・暮らしから探す",
      },
      {
        action: "decision",
        tone: "blue",
        icon: V4_ASSETS.decision,
        kicker: "少しずつ分かる",
        title: "市議会・議員",
        note: council?.nextDateLabel ? `${council.nextDateLabel} 次の会議` : "誰が、どう決める？",
      },
    ];

    return `<section class="v4-bento" aria-labelledby="v4-bento-title">
      <div class="v4-section-heading">
        <div><p>直方のいまをひと目で</p><h2 id="v4-bento-title">今日、何を見よう？</h2></div>
      </div>
      <div class="v4-bento-grid">${cards.map(v4BentoCard).join("")}</div>
    </section>`;
  }

  function v4LifeStrip() {
    const garbage = state.data?.garbage || null;
    return `<div class="v4-life-strip" aria-label="暮らしの近道">
      ${garbage?.sourceUrl
        ? `<a href="${esc(garbage.sourceUrl)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">🗑️</span><div><small>暮らしの近道</small><strong>ごみ収集日を確認</strong></div><b aria-hidden="true">↗</b></a>`
        : `<button type="button" data-v2-query="ごみ"><span aria-hidden="true">🗑️</span><div><small>暮らしの近道</small><strong>ごみ情報を探す</strong></div><b aria-hidden="true">›</b></button>`}
      <button type="button" data-v2-action="settings"><span aria-hidden="true">📍</span><div><small>自分ごとにする</small><strong>${state.v2Preferences?.district ? `${esc(state.v2Preferences.district)}を優先中` : "よく使う地域を設定"}</strong></div><b aria-hidden="true">›</b></button>
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
        <div><p>生活のつづきに置いておく</p><h2 id="v4-civic-title"><span aria-hidden="true">🌱</span> 気づいたら市政も分かる</h2></div>
        <button type="button" data-v2-action="decision">市議会・議員を見る</button>
      </div>
      <div class="v4-civic-grid">
        <article class="v4-civic-card tone-mint">
          <div class="v4-civic-badge"><span aria-hidden="true">⏱</span> 今日の30秒</div>
          <h3>${esc(v4Short(lifeItem?.title || "直方市の新着情報", 38))}</h3>
          <p>${esc(v4Short(lifeItem?.summary || "生活に近い変更を短く確認できます。", 82))}</p>
          ${lifeItem ? v4ItemControl(lifeItem, "30秒で読む") : `<button class="v4-inline-cta" type="button" data-v2-nav="notifications">新着を見る <span aria-hidden="true">→</span></button>`}
        </article>
        <article class="v4-civic-card tone-lavender">
          <div class="v4-civic-badge"><span aria-hidden="true">👥</span> だれが決めた？</div>
          <h3>${esc(council?.nextDateLabel || council?.title || "市議会の日程を確認中")}</h3>
          <p>${esc(v4Short(council?.nextSummary || council?.summary || "会議と、決まり方をたどれます。", 82))}</p>
          <button class="v4-inline-cta" type="button" data-v2-action="decision">流れを見る <span aria-hidden="true">→</span></button>
        </article>
      </div>
    </section>`;
  }

  function v4AskBar() {
    const bus = (state.data?.featured || []).find((item) => /バス|路線と時刻表/.test(item.title || ""));
    const sample = bus ? "10月からバスはどう変わる？" : "今度の市議会はいつ？";
    return `<section class="v4-ask-bar" aria-labelledby="v4-ask-title">
      <div class="v4-ask-mascot"><img src="${V4_ASSETS.mascot}" alt="" loading="lazy" decoding="async"></div>
      <div class="v4-ask-copy"><p>まちナビに聞く</p><h2 id="v4-ask-title">直方のことを聞く</h2><button type="button" data-v2-action="ask"><span>${esc(sample)}</span><b aria-hidden="true">→</b></button><small>公式情報ベース。資料にないことは無理に答えません。</small></div>
    </section>`;
  }

  function v4ParticipationTeaser() {
    return `<section class="v4-participation-teaser" aria-label="まちに参加する入口">
      <div><small>見るだけで終わらない</small><strong>イベントを載せる・直方をちょっと手伝う</strong><span>安全確認と投稿受付の仕組みを準備中です。</span></div>
      <button type="button" data-v2-action="participate">できることを見る <span aria-hidden="true">›</span></button>
    </section>`;
  }

  function v4HomeLoading() {
    return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content v4-home-content"><section class="v4-event-feature is-loading" aria-label="情報を読み込み中"><div class="v4-event-art"></div><div class="v4-event-copy"><div class="loading-line"></div><div class="loading-line short"></div><p>直方のイベントと暮らしの情報を確認しています…</p></div></section></div></section>`;
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
      ${v4ParticipationTeaser()}
      ${v2LifeAndLatest()}
      <p class="v2-disclaimer">MYTOWNは非公式の地域生活アプリMVPです。表示件数は、現在同期・確認できた公開情報の範囲です。重要な手続き・期限・選挙情報はリンク先の直方市公式情報も確認してください。</p>
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
        <p>${esc(v4Short(item.summary || "開催内容は公式ページで確認できます。", 104))}</p>
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
      <button class="back-button" type="button" data-v2-action="home">‹ きょうへ</button>
      <div class="v4-events-hero">
        <div><p class="eyebrow">直方で、なにする？</p><h1>イベント・体験を見つける</h1><p>現在は同期できた公開情報から始め、今後は施設や地域団体の情報も同じ入口に集めていきます。</p></div>
        <img src="${V4_ASSETS.event}" alt="" aria-hidden="true" decoding="async">
      </div>
      <div class="v2-sync-wrap v4-sync-wrap">${syncBanner()}</div>
      <div class="v4-event-page-note"><strong>現在の掲載範囲</strong><p>同期・確認できた公開情報だけを表示しています。現時点で直方市内の全イベントを網羅しているとは表示しません。</p></div>
      <div class="v4-event-filter-row" aria-label="イベントの種類で絞る">${filters.map((filter) => `<button type="button" class="${active === filter.id ? "is-active" : ""}" data-v4-event-filter="${esc(filter.id)}">${esc(filter.label)} <span>${filter.count}</span></button>`).join("")}</div>
      <div class="v4-event-results-head"><h2>${esc(activeFilter.label)}</h2><span>${shown.length}件</span></div>
      <div class="v4-event-list">${shown.length ? shown.map(v4EventListCard).join("") : emptyCard("この条件で確認できるイベント情報はありません。別の種類で探してください。")}</div>
      <section class="v4-event-contribute"><div><small>イベント情報が分散する問題も解決したい</small><h2>「このイベントも載せて」を準備中</h2><p>主催者投稿と市民からのURL提供は、確認・重複整理・安全対策を整えてから公開します。</p></div><button type="button" data-v2-action="participate">参加の入口を見る →</button></section>
    </section>`;
  }

  function v4ParticipationView() {
    return `<section class="page v2-page v2-inner-page v4-participation-page">
      <button class="back-button" type="button" data-v2-action="home">‹ きょうへ</button>
      <div class="v2-inner-hero"><div><p class="eyebrow">まちに参加する</p><h1>知ったあとに、少し動ける入口へ</h1><p>情報を見るだけでなく、イベントを届けたり、短時間だけ手伝えたりする仕組みを段階的に作ります。</p></div></div>
      <div class="v4-participation-grid">
        <article><span class="v4-status-chip">準備中</span><div class="v4-participation-icon" aria-hidden="true">🎪</div><h2>イベントを載せる</h2><p>主催者が日時・場所・元URLを送り、確認後に掲載する仕組みを検討しています。現在は投稿フォームを公開していません。</p><button type="button" data-v2-action="events">いま確認できるイベントを見る →</button></article>
        <article><span class="v4-status-chip">準備中</span><div class="v4-participation-icon" aria-hidden="true">🤝</div><h2>直方をちょっと手伝う</h2><p>イベント運営、清掃、地域活動などの確認済み募集と、「30分なら手伝える」人をつなぐ入口を検討しています。</p><button type="button" data-v2-query="ボランティア">現在の公開情報を探す →</button></article>
      </div>
      <div class="card info-card v4-safety-card"><h2>先に安全性を作ります</h2><p>自由掲示板にはしません。募集団体の確認、個人情報の保護、子ども・高齢者・個人宅・危険作業などの慎重な扱いを決めてから公開します。</p></div>
    </section>`;
  }

  v2SearchIntro = function v4SearchIntro() {
    const deadlines = typeof v2FindDeadlines === "function" ? v2FindDeadlines().slice(0, 2) : [];
    const eventCount = v4EventItems().length;
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;
    return `<div class="v2-search-intro"><section class="v2-popular-search" aria-labelledby="v2-popular-title"><h2 id="v2-popular-title">よく探される</h2><div class="v2-query-chips">${["イベント", "バス", "ごみ", "子育て", "学校"].map((query) => `<button type="button" data-v2-query="${esc(query)}">${esc(query)}</button>`).join("")}</div></section>
      <section class="v2-search-groups" aria-label="探し方"><button type="button" data-v2-action="events"><strong>イベント</strong><span>${eventCount ? `${eventCount}件を確認` : "イベント・体験を探す"}</span></button><button type="button" data-v2-action="deadline"><strong>まだ間に合う</strong><span>${deadlines.length ? `${deadlines.length}件を確認` : "募集・申込を探す"}</span></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><span>子育て・暮らしから</span></button><button type="button" data-v2-action="nearby"><strong>近く</strong><span>場所が確認できる情報</span></button><button type="button" data-v2-action="decision"><strong>市議会・議員</strong><span>誰が、どう決める？</span></button>${bulletin ? `<button type="button" data-v2-query="市報"><strong>市報</strong><span>${esc(bulletin.title || "最新号")}</span></button>` : ""}</section><p class="v2-search-note">検索結果には、同期済みの公開情報だけを表示します。</p></div>`;
  };

  v2MenuView = function v4MenuView() {
    const eventCount = v4EventItems().length;
    return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">メニュー</p><h1>やりたいことから選ぶ</h1><p>生活、イベント、制度、市政を一つの入口にまとめています。</p></div></div><div class="v2-menu-grid v4-menu-grid"><button type="button" data-v2-action="events"><strong>イベント・おでかけ</strong><small>${eventCount ? `${eventCount}件を確認` : "体験・教室も探す"}</small></button><button type="button" data-v2-action="nearby"><strong>近くで何がある？</strong><small>施設・イベント・工事など</small></button><button type="button" data-v2-action="deadline"><strong>まだ間に合う</strong><small>申込・募集・意見募集</small></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><small>子育て・暮らしから探す</small></button><button type="button" data-v2-action="decision"><strong>市議会・議員</strong><small>誰が、どう決める？</small></button><button type="button" data-v2-action="ask"><strong>直方のことを聞く</strong><small>公式情報に基づいて案内</small></button><button type="button" data-v2-action="participate"><strong>まちに参加する</strong><small>載せる・ちょっと手伝う</small></button><button type="button" data-v2-action="settings"><strong>地域・テーマ設定</strong><small>端末内だけに保存</small></button><button type="button" data-v2-action="glossary"><strong>ことば図鑑</strong><small>役所の言葉をやさしく</small></button><button type="button" data-v2-action="money"><strong>直方のお金</strong><small>検算済みの数字だけ</small></button></div><div class="v2-menu-note card info-card"><h2>MYTOWNの約束</h2><p>分からないことは分からないと表示します。政治家をAIが採点・評価しません。大事な情報には一次資料へのリンクを付けます。</p></div></section>`;
  };

  function v4PatchActionSheet() {
    const list = document.querySelector("#v2-action-sheet .v2-sheet-list");
    if (!list || list.querySelector('[data-v2-action="events"]')) return;
    list.insertAdjacentHTML("afterbegin", `<button type="button" data-v2-action="events"><div><strong>イベント・おでかけ</strong><small>直方のイベント・体験を探す</small></div><b>›</b></button>`);
    list.insertAdjacentHTML("beforeend", `<button type="button" data-v2-action="participate"><div><strong>まちに参加する</strong><small>イベントを載せる・ちょっと手伝う</small></div><b>›</b></button>`);
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
