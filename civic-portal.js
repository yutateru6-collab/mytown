/* Dedicated civic portal: decisions, budget, people and public works in one place. */
"use strict";

(() => {
  const CIVIC_FALLBACK = {
    verifiedOn: null,
    budget: { categories: [] },
    works: [],
  };

  const CIVIC_ASSETS = Object.freeze({
    upcoming: "./assets/illustrations/card-deadline.svg?v=1",
    decisions: "./assets/illustrations/card-bulletin.svg?v=1",
    budget: "./assets/illustrations/civic-budget.webp?v=3",
    people: "./assets/illustrations/card-decision.svg?v=1",
    bus: "./assets/illustrations/civic-bus.webp?v=3",
    works: "./assets/illustrations/civic-roadwork.webp?v=3",
  });

  state.civicPortal = CIVIC_FALLBACK;
  state.civicPortalLoading = true;
  state.civicPortalLoadError = false;

  function civicShort(value = "", max = 92) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function civicFeatured(pattern) {
    return (state.data?.featured || []).find((item) => pattern.test(`${item.title || ""} ${item.summary || ""}`)) || null;
  }

  function civicOfficialBanner() {
    const verifiedOn = state.civicPortal.verifiedOn || state.data?.verifiedOn || "確認中";
    if (state.civicPortalLoadError) {
      return `<div class="civic-source-banner is-warning"><div><span>市の資料から</span><strong>一部の市政情報を読み込めませんでした</strong></div><button type="button" data-civic-reload>もう一度読み込む</button></div>`;
    }
    return `<div class="civic-source-banner"><div><span>市の資料から</span><strong>公開情報をもとに掲載</strong></div><small>最終確認：${esc(verifiedOn)}</small></div>`;
  }

  function civicLoadingView() {
    return `<section class="page civic-page"><div class="civic-hero"><div><p class="civic-eyebrow">市政</p><h1>直方の今を知る</h1><p>公開情報を読み込んでいます。</p></div></div><div class="civic-source-banner"><div><span>市の資料から</span><strong>確認しています</strong></div></div><div class="civic-menu-grid" aria-hidden="true"><div class="civic-menu-card is-loading"></div><div class="civic-menu-card is-loading"></div><div class="civic-menu-card is-loading"></div><div class="civic-menu-card is-loading"></div></div></section>`;
  }

  function civicPortalHome() {
    if (state.civicPortalLoading) return civicLoadingView();
    const bus = civicFeatured(/コミュニティバス|路線と時刻表/);
    const work = state.civicPortal.works?.[0] || null;
    const budget = state.civicPortal.budget || {};
    const council = state.data?.council || {};

    const cards = [
      {
        section: "upcoming",
        tone: "pink",
        title: "これから決まる",
        note: council.nextDateLabel ? `次の市議会 ${council.nextDateLabel}` : "議会の日程や意見募集",
        asset: CIVIC_ASSETS.upcoming,
      },
      {
        section: "decisions",
        tone: "green",
        title: "決まったこと",
        note: bus?.status || "決定までの流れを見る",
        asset: CIVIC_ASSETS.decisions,
      },
      {
        action: "money",
        tone: "yellow",
        title: "直方のお金",
        note: budget.generalAccountLabel ? `${budget.fiscalYear} ${budget.generalAccountLabel}` : "予算の使い道",
        asset: CIVIC_ASSETS.budget,
      },
      {
        section: "people",
        tone: "blue",
        title: "市長・市議会",
        note: "役割・議員・選挙を見る",
        asset: CIVIC_ASSETS.people,
      },
    ];

    return `<section class="page civic-page">
      <header class="civic-hero">
        <div class="civic-hero-copy"><p class="civic-eyebrow">市政</p><h1>直方の今を知る</h1><p>何が決まり、何にお金が使われている？</p></div>
        <img src="${CIVIC_ASSETS.people}" alt="" aria-hidden="true">
      </header>
      ${civicOfficialBanner()}

      <nav class="civic-menu-grid" aria-label="市政のメニュー">
        ${cards.map((card) => `<button type="button" class="civic-menu-card tone-${card.tone}" ${card.action ? `data-v2-action="${card.action}"` : `data-politics-section="${card.section}"`}><span class="civic-menu-copy"><strong>${esc(card.title)}</strong><small>${esc(card.note)}</small></span><img src="${card.asset}" alt="" aria-hidden="true"><b aria-hidden="true">›</b></button>`).join("")}
      </nav>

      <section class="civic-digest" aria-labelledby="civic-digest-title">
        <div class="civic-section-heading"><div><p>むずかしい話を、短く</p><h2 id="civic-digest-title">今週の市政を1分で</h2></div></div>
        <article class="civic-digest-card">
          <img src="${CIVIC_ASSETS.bus}" alt="" aria-hidden="true">
          <div><span class="civic-status-pill">${esc(bus?.status || "市の動き")}</span><h3>${esc(civicShort(bus?.title || "直方市の新しい動きを確認しています", 54))}</h3><p>${esc(civicShort(bus?.summary || "公開資料で確認できた市の動きを、短くまとめます。", 98))}</p>${bus ? `<button type="button" data-v2-detail-id="${esc(bus.id)}" data-v2-detail-section="what">1分で読む <span aria-hidden="true">→</span></button>` : ""}</div>
        </article>
      </section>

      <section class="civic-works" aria-labelledby="civic-works-title">
        <div class="civic-section-heading"><div><p>ページの下で、必要なときに</p><h2 id="civic-works-title">暮らしに関わる工事</h2></div><button type="button" data-politics-section="works">一覧を見る</button></div>
        ${work ? `<article class="civic-work-card"><img src="${CIVIC_ASSETS.works}" alt="" aria-hidden="true"><div><span>${esc(work.status)}</span><h3>${esc(work.title)}</h3><p>${esc(work.location)}・予定工期 ${esc(work.plannedPeriod)}</p><button type="button" data-politics-section="works">内容と資料を見る <b aria-hidden="true">›</b></button></div></article>` : `<div class="card info-card"><p>確認できた工事情報はありません。</p></div>`}
        <p class="civic-works-note">直方市などの公開資料から確認できた工事だけを掲載します。</p>
      </section>
    </section>`;
  }

  function civicBackButton(label = "市政トップへ") {
    return `<button class="back-button civic-back" type="button" data-politics-section="home">‹ ${esc(label)}</button>`;
  }

  function civicUpcomingView() {
    const council = state.data?.council || {};
    return `<section class="page civic-page civic-subpage">${civicBackButton()}<header class="civic-sub-hero"><p class="civic-eyebrow">これから決まる</p><h1>これからの市議会</h1><p>予定として公表された日程を表示しています。</p></header>${civicOfficialBanner()}<article class="civic-focus-card"><span>次の予定</span><h2>${esc(council.title || "市議会の日程")}</h2><strong>${esc(council.nextDateLabel || "日程を確認中")}</strong><p>${esc(council.nextSummary || council.summary || "直方市の公開資料を確認しています。")}</p>${council.sourceUrl ? sourceLink(council.sourceUrl, "直方市議会の日程を見る") : ""}</article><div class="civic-caution"><strong>「予定」と「決定」は分けて表示します</strong><p>日程や内容は変更されることがあります。決まった内容は、公開された議決結果や実施案内で確認します。</p></div></section>`;
  }

  function civicDecisionsView() {
    const bus = civicFeatured(/コミュニティバス|路線と時刻表/);
    const timeline = bus?.decisionTimeline || [];
    return `<section class="page civic-page civic-subpage">${civicBackButton()}<header class="civic-sub-hero"><p class="civic-eyebrow">決まったこと</p><h1>市の動きと決まり方</h1><p>提案、協議、実施案内を混ぜずに表示します。</p></header>${civicOfficialBanner()}${bus ? `<article class="civic-decision-card"><span class="civic-status-pill">${esc(bus.status || "実施案内")}</span><h2>${esc(bus.title)}</h2><p>${esc(bus.summary || "")}</p><ol class="civic-timeline">${timeline.map((item) => `<li><time>${esc(item.date)}</time><div><span>${esc(item.status)}</span><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div></li>`).join("")}</ol><button class="civic-primary-button" type="button" data-v2-detail-id="${esc(bus.id)}" data-v2-detail-section="decision">資料と確認できない点を見る</button></article>` : `<div class="card info-card"><p>現在、表示できる市の動きを確認しています。</p></div>`}</section>`;
  }

  const civicPeopleHomeBase = politicsHome;
  function civicPeopleView() {
    const html = civicPeopleHomeBase();
    if (!html.includes("politics-page")) return html;
    return html.replace('<section class="page politics-page">', `<section class="page politics-page civic-people-page">${civicBackButton()}`);
  }

  function civicWorksView() {
    const works = state.civicPortal.works || [];
    return `<section class="page civic-page civic-subpage">${civicBackButton()}<header class="civic-sub-hero civic-works-hero"><div><p class="civic-eyebrow">暮らしに関わる工事</p><h1>公開資料で確認できた工事</h1><p>地図ではなく、工事名・場所・予定工期から探せます。</p></div><img src="${CIVIC_ASSETS.works}" alt="" aria-hidden="true"></header>${civicOfficialBanner()}<div class="civic-caution"><strong>すべての工事を載せた一覧ではありません</strong><p>市の発注見通しは原則として設計額400万円を超える工事が対象です。緊急工事など、掲載されない工事もあります。</p></div><div class="civic-work-list">${works.map((work) => `<article class="civic-work-detail"><div class="civic-work-detail-head"><span>${esc(work.status)}</span><small>${esc(work.location)}</small></div><h2>${esc(work.title)}</h2><dl><div><dt>入札日</dt><dd>${esc(work.bidDate)}</dd></div><div><dt>予定工期</dt><dd>${esc(work.plannedPeriod)}</dd></div><div><dt>契約予定額</dt><dd>${esc(work.plannedContractAmount)}</dd></div><div><dt>落札者</dt><dd>${esc(work.winningBidder)}</dd></div><div><dt>落札額</dt><dd>${esc(work.winningBidPretax)}（税抜）</dd></div></dl><p>${esc(work.note)}</p><div class="civic-source-links">${sourceLink(work.sourcePageUrl, "入札結果の一覧を見る")}${sourceLink(work.sourcePdfUrl, "入札調書PDFを開く")}${sourceLink(work.outlookPageUrl, "工事発注見通しを見る")}</div></article>`).join("")}</div></section>`;
  }

  function civicMoneyView() {
    const budget = state.civicPortal.budget || {};
    const categories = budget.categories || [];
    return `<section class="page civic-page civic-subpage civic-budget-page">${civicBackButton()}<header class="civic-sub-hero civic-budget-hero"><div><p class="civic-eyebrow">直方のお金</p><h1>${esc(budget.fiscalYear || "2026年度")}の当初予算</h1><p>最初に決めた使い道を、暮らしの言葉で見ます。</p></div><img src="${CIVIC_ASSETS.budget}" alt="" aria-hidden="true"></header>${civicOfficialBanner()}<article class="civic-budget-total"><small>一般会計・${esc(budget.kind || "当初予算")}</small><strong>${esc(budget.generalAccountLabel || "確認中")}</strong><p>年度の初めに予定した金額です。実際に使った金額は決算で確認します。</p></article><section class="civic-budget-breakdown" aria-labelledby="civic-budget-title"><div class="civic-section-heading"><div><p>金額が大きい順</p><h2 id="civic-budget-title">何に使う予定？</h2></div></div><div class="civic-budget-rows">${categories.map((item) => `<article><div><strong>${esc(item.friendly)}</strong><small>正式名称：${esc(item.official)}</small></div><div class="civic-budget-amount"><span>${esc(item.amountLabel)}</span><small>${Number(item.share).toFixed(1)}%</small></div><div class="civic-budget-bar"><i style="width:${Math.max(2, Number(item.share))}%"></i></div></article>`).join("")}</div></section><div class="civic-budget-terms"><article><strong>当初予算</strong><p>年度初めの予定</p></article><article><strong>補正予算</strong><p>途中で増減した予定</p></article><article><strong>契約金額</strong><p>業者と契約した金額</p></article><article><strong>決算</strong><p>実際に使った金額</p></article></div><div class="civic-source-links">${sourceLink(budget.sourcePageUrl, "令和8年度予算の公式ページ")}${sourceLink(budget.sourcePdfUrl, "予算参考資料PDFを開く")}</div></section>`;
  }

  const civicPoliticsRouterBase = politicsRouter;
  politicsRouter = function politicsRouterWithCivicPortal() {
    if (state.politicsSection === "home") return civicPortalHome();
    if (state.politicsSection === "upcoming") return civicUpcomingView();
    if (state.politicsSection === "decisions") return civicDecisionsView();
    if (state.politicsSection === "people") return civicPeopleView();
    if (state.politicsSection === "works") return civicWorksView();
    return civicPoliticsRouterBase();
  };

  politicsBackButton = function politicsBackButtonToPeople() {
    if (state.politicsSection === "home") return "";
    return `<button class="back-button" type="button" data-politics-section="people">‹ 市長・市議会へ</button>`;
  };

  moneyView = civicMoneyView;

  const civicHandleActionBase = v2HandleAction;
  v2HandleAction = function handleCivicAction(action) {
    if (action === "nearby" || action === "works") {
      v2CloseSheet(false);
      state.politicsSection = "works";
      return v2SetRoute({ tab: "politics", page: null, hash: "#works" });
    }
    if (action === "decision" || action === "council") {
      v2CloseSheet(false);
      state.politicsSection = "people";
      return v2SetRoute({ tab: "politics", page: null, hash: "#politics" });
    }
    if (action === "money") {
      v2CloseSheet(false);
      return v2SetRoute({ tab: "politics", page: null, view: "money", hash: "#money" });
    }
    return civicHandleActionBase(action);
  };

  const civicHandleNavBase = v2HandleNav;
  v2HandleNav = function handleCivicNav(nav) {
    if (nav === "civic") {
      state.politicsSection = "people";
      return v2SetRoute({ tab: "politics", page: null, hash: "#politics" });
    }
    return civicHandleNavBase(nav);
  };

  const civicActiveNavBase = v2ActiveNav;
  v2ActiveNav = function activeCivicNav() {
    if (state.tab === "politics" || state.view === "money") return "civic";
    return civicActiveNavBase();
  };

  const civicApplyHashRouteBase = v2ApplyHashRoute;
  v2ApplyHashRoute = function applyCivicHashRoute() {
    const hash = location.hash.replace("#", "");
    if (["politics", "people", "civic", "works", "nearby", "money"].includes(hash)) {
      state.tab = "politics";
      state.v2Page = null;
      state.selectedId = null;
      state.detailSection = null;
      if (hash === "money") {
        state.view = "money";
        state.politicsSection = "home";
      } else {
        state.view = "tab";
        if (hash === "works") state.politicsSection = "works";
        else if (hash === "civic") state.politicsSection = "home";
        else state.politicsSection = "people";
      }
      return;
    }
    civicApplyHashRouteBase();
  };

  document.addEventListener("click", (event) => {
    const reload = event.target.closest("[data-civic-reload]");
    if (!reload) return;
    state.civicPortalLoading = true;
    state.civicPortalLoadError = false;
    render();
    loadCivicPortalData();
  });

  async function loadCivicPortalData() {
    try {
      const response = await fetch(`./data/civic-portal.json?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.civicPortal = { ...CIVIC_FALLBACK, ...(await response.json()) };
      state.civicPortalLoadError = false;
    } catch (error) {
      console.warn("Civic portal data load failed", error);
      state.civicPortalLoadError = true;
    } finally {
      state.civicPortalLoading = false;
      render();
    }
  }

  v2ApplyHashRoute();
  render();
  loadCivicPortalData();
})();
