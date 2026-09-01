const state = {
  tab: "today",
  view: "tab",
  eventId: null,
  detailSection: null,
  nearbyFilter: "すべて",
  discoverCategory: null,
  notifications: false,
  locationUsed: false,
};

const demoEvents = [
  {
    id: "road-demo",
    icon: "🚧",
    type: "工事",
    category: "道路",
    title: "近くで道路工事があります",
    short: "何をしている工事なのか、理由やお金、決まり方までたどれる体験のデモです。",
    distance: "350m",
    status: "工事中・デモ",
    timing: "9月上旬〜10月下旬（デモ）",
    why: "実際のアプリでは、直方市などの公式資料で確認できた理由だけをここに表示します。現在はUI確認用のデモ説明です。",
    whyNow: "公開資料から『なぜ今なのか』が確認できた場合だけ表示します。確認できなければ、無理に推測しません。",
    cost: "1,200万円（デモ）",
    costNote: "予算額・事業費・契約額を混同せず、どの金額なのかを明示する想定です。",
    source: "デモデータ：実際の行政情報には未接続",
    timeline: [
      ["市が計画", "計画・事業の根拠を公式資料で確認"],
      ["予算", "いつ、どの予算に計上されたかを確認"],
      ["市議会", "審議・質問・採決を確認できる範囲で表示"],
      ["契約", "入札・契約情報が公開されている場合に接続"],
      ["工事", "期間・場所・施工者など確認できる情報を表示"],
    ],
  },
  {
    id: "event-demo",
    icon: "🎪",
    type: "イベント",
    category: "イベント",
    title: "今週末のまちイベント",
    short: "家族で行ける催しや地域イベントをまとめて見られるカードのデモです。",
    distance: "市内",
    status: "今週末・デモ",
    timing: "土・日（デモ）",
    why: "イベント情報は、政治に興味がない人にも毎週アプリを開く理由を作ります。",
    whyNow: "開催日が近い情報を優先して表示する想定です。",
    cost: "参加費などは公式情報がある場合のみ表示",
    costNote: "ここはデモのため実在イベントの費用ではありません。",
    source: "デモデータ",
    timeline: [],
  },
  {
    id: "support-demo",
    icon: "💰",
    type: "制度",
    category: "子育て",
    title: "使えるかもしれない制度があります",
    short: "『制度名を知っている人だけが探せる』状態をなくすための生活導線です。",
    distance: "あなた向け",
    status: "受付中・デモ",
    timing: "期限は公式情報から表示",
    why: "『子どもが生まれた』『引っ越した』など、生活の出来事から制度を見つけられるようにします。",
    whyNow: "受付開始・期限間近など、今見る意味があるときに表示します。",
    cost: "給付額などは公式条件を確認して表示",
    costNote: "対象者かどうかをAIだけで断定しない設計です。",
    source: "デモデータ",
    timeline: [],
  },
  {
    id: "opinion-demo",
    icon: "⏳",
    type: "まだ間に合う",
    category: "まちづくり",
    title: "まだ意見を出せる計画があります",
    short: "決まった後ではなく、まだ市民が意見を出せる段階を見つけやすくするデモです。",
    distance: "市内",
    status: "あと6日・デモ",
    timing: "締切まであと6日（デモ）",
    why: "決定前の情報を生活者の言葉で短く伝え、正式な提出先へつなげるためです。",
    whyNow: "期限が近いものはホームで目立たせます。",
    cost: "費用情報が公開されている場合のみ表示",
    costNote: "不明な数字は生成しません。",
    source: "デモデータ",
    timeline: [],
  },
];

const categories = [
  ["道路", "🚧"], ["子育て", "👶"], ["ごみ", "🗑️"], ["バス", "🚌"], ["公園", "🌳"], ["防災", "⛑️"],
  ["学校", "🏫"], ["イベント", "🎪"], ["税金", "💰"], ["高齢者", "🧓"], ["福祉", "🤝"], ["施設", "🏛️"],
];

const main = document.querySelector("#main");
const toast = document.querySelector("#toast");

function japaneseDate() {
  const d = new Date();
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short" }).format(d);
}

function demoBanner() {
  return `<div class="demo-banner"><span class="demo-badge">DEMO</span><span>現在はUI/UXを確認するMVPです。表示中の工事・制度・イベントはサンプルで、実在情報としては扱っていません。</span></div>`;
}

function eventCard(event) {
  return `
    <button class="action-card" type="button" data-event="${event.id}">
      <div class="card-row">
        <div class="card-icon ${event.category === "道路" ? "warm" : event.category === "子育て" ? "pink" : "blue"}" aria-hidden="true">${event.icon}</div>
        <div class="card-body">
          <div class="card-kicker">${event.type}</div>
          <h3 class="card-title">${event.title}</h3>
          <p class="card-copy">${event.short}</p>
          <div class="card-meta">
            <span class="pill">${event.distance}</span>
            <span class="pill demo">${event.status}</span>
          </div>
        </div>
        <span class="arrow" aria-hidden="true">›</span>
      </div>
    </button>`;
}

function todayView() {
  return `
    <section class="page">
      <div class="hero">
        <p class="eyebrow">${japaneseDate()}</p>
        <h1>今日の直方</h1>
        <p>暮らしのことから、街の「なんで？」まで。</p>
      </div>
      ${demoBanner()}

      <div class="section">
        <div class="section-head">
          <div><h2>あなたの近く</h2><p>まずは「これ何？」から</p></div>
        </div>
        ${eventCard(demoEvents[0])}
      </div>

      <div class="section">
        <div class="section-head"><h2>今日、知っておくと便利</h2></div>
        <div class="stack">
          ${eventCard(demoEvents[2])}
          ${eventCard(demoEvents[1])}
          ${eventCard(demoEvents[3])}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>すぐ見る</h2></div>
        <div class="quick-grid">
          <button class="quick-button" type="button" data-quick="nearby"><span>⌖</span><strong>近くで何してる？</strong></button>
          <button class="quick-button" type="button" data-quick="discover"><span>◎</span><strong>制度を見つける</strong></button>
          <button class="quick-button" type="button" data-quick="ask"><span>✦</span><strong>直方に聞く</strong></button>
          <button class="quick-button" type="button" data-quick="money"><span>¥</span><strong>直方のお金</strong></button>
        </div>
      </div>
    </section>`;
}

function nearbyView() {
  const filtered = state.nearbyFilter === "すべて" ? demoEvents : demoEvents.filter(e => e.category === state.nearbyFilter || e.type === state.nearbyFilter);
  return `
    <section class="page">
      <div class="hero"><p class="eyebrow">近くで何してる？</p><h1>この辺の動き</h1><p>位置情報を使わなくても見られる設計です。</p></div>
      ${demoBanner()}
      <div class="filter-row" role="group" aria-label="地図カテゴリ">
        ${["すべて","道路","イベント","子育て","まちづくり"].map(f => `<button class="filter-chip ${state.nearbyFilter===f?"is-active":""}" type="button" data-filter="${f}">${f}</button>`).join("")}
      </div>
      <div class="map-card" aria-label="直方市周辺をイメージしたデモ地図">
        <div class="map-river"></div><div class="map-road r1"></div><div class="map-road r2"></div>
        <button class="map-pin p1" type="button" data-event="road-demo" aria-label="道路工事のデモを見る"><span><b>🚧</b></span></button>
        <button class="map-pin p2" type="button" data-event="event-demo" aria-label="イベントのデモを見る"><span><b>🎪</b></span></button>
        <button class="map-pin p3" type="button" data-event="opinion-demo" aria-label="意見募集のデモを見る"><span><b>⏳</b></span></button>
      </div>
      <div class="section">
        <div class="section-head"><h2>表示中</h2><p>${filtered.length}件・デモ</p></div>
        <div class="stack">${filtered.map(eventCard).join("") || `<div class="card info-card"><p>このカテゴリのデモ情報はまだありません。</p></div>`}</div>
      </div>
      <div class="section">
        <button class="secondary-button" type="button" data-action="use-location">${state.locationUsed ? "✓ 現在地を取得しました" : "現在地を使う"}</button>
        <p class="muted" style="font-size:.78rem;margin:8px 2px 0;">許可した場合のみ端末の現在地を取得します。このMVPでは位置情報を保存しません。</p>
      </div>
    </section>`;
}

function discoverView() {
  const selected = state.discoverCategory;
  const results = selected ? demoEvents.filter(e => e.category === selected || (selected === "イベント" && e.type === "イベント")) : demoEvents;
  return `
    <section class="page">
      <div class="hero"><p class="eyebrow">見つける</p><h1>役所の言葉を知らなくて大丈夫</h1><p>生活の言葉から探せます。</p></div>
      <div class="search-box">
        <span aria-hidden="true">⌕</span>
        <input id="discover-search" type="search" placeholder="例：子供のお金、工事、バス" aria-label="街の情報を検索" />
        <button type="button" data-action="discover-search">探す</button>
      </div>
      <div class="section">
        <div class="section-head"><h2>気になることから</h2></div>
        <div class="category-grid">
          ${categories.map(([name,icon]) => `<button class="category-button" type="button" data-category="${name}"><span aria-hidden="true">${icon}</span><strong>${name}</strong></button>`).join("")}
        </div>
      </div>
      <div class="section">
        <div class="section-head"><h2>${selected ? `${selected} のデモ` : "こんな情報が見つかります"}</h2></div>
        <div class="stack">${results.length ? results.map(eventCard).join("") : `<div class="card info-card"><p>このカテゴリのデモ情報はまだありません。実データ接続後は、行政サービス・工事・議会などを横断して探します。</p></div>`}</div>
      </div>
    </section>`;
}

function askView(answer = "") {
  return `
    <section class="page">
      <div class="hero"><p class="eyebrow">直方に聞く</p><h1>検索より、ふつうに聞く。</h1><p>難しい制度名や議会用語を知らなくても大丈夫。</p></div>
      ${demoBanner()}
      <div class="ask-panel">
        <h2>何が気になる？</h2>
        <p>実データ接続後は、公式資料を根拠に短く答える想定です。</p>
        <form class="ask-form" id="ask-form">
          <input id="ask-input" type="text" placeholder="なんでこの道工事してるん？" autocomplete="off" aria-label="直方について質問" />
          <button class="primary-button" type="submit">聞く</button>
        </form>
        <div class="suggestion-list">
          <button class="suggestion-chip" type="button" data-question="なんでこの道工事してるん？">なんでこの道工事してるん？</button>
          <button class="suggestion-chip" type="button" data-question="子育てで使える制度ある？">子育てで使える制度ある？</button>
          <button class="suggestion-chip" type="button" data-question="誰が決めたん？">誰が決めたん？</button>
        </div>
      </div>
      ${answer}
    </section>`;
}

function detailView(event) {
  if (!event) return todayView();
  const section = state.detailSection;
  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>
      <div class="detail-hero">
        <div class="big-icon" aria-hidden="true">${event.icon}</div>
        <p class="eyebrow">${event.type}・デモ</p>
        <h1>${event.title}</h1>
        <p>${event.short}</p>
        <div class="card-meta"><span class="pill">${event.distance}</span><span class="pill demo">${event.status}</span></div>
      </div>
      <div class="question-grid" aria-label="詳しく見る">
        <button class="question-button" type="button" data-section="what"><span>まず</span><strong>これ何？</strong></button>
        <button class="question-button" type="button" data-section="why"><span>理由を知る</span><strong>なんで？</strong></button>
        <button class="question-button" type="button" data-section="money"><span>お金を見る</span><strong>いくら？</strong></button>
        <button class="question-button" type="button" data-section="decision"><span>流れを見る</span><strong>誰が決めた？</strong></button>
      </div>
      ${renderDetailSection(event, section)}
    </section>`;
}

function renderDetailSection(event, section) {
  if (!section) {
    return `<div class="card info-card"><h2>30秒でいうと</h2><p>${event.short}</p><div class="source-note">${event.source}</div></div>`;
  }
  if (section === "what") {
    return `<div class="card info-card"><h2>これ何？</h2><p>${event.type === "工事" ? "道路工事の詳細画面を想定したデモです。実装時は工事名・場所・期間・施工者など、公開資料で確認できたものを整理します。" : event.short}</p><div class="source-note">いつ？ ${event.timing}<br>${event.source}</div></div>`;
  }
  if (section === "why") {
    return `<div class="stack"><div class="card info-card"><h2>なんで？</h2><p>${event.why}</p><div class="source-note">${event.source}</div></div><div class="card info-card"><h2>なんで今？</h2><p>${event.whyNow}</p></div></div>`;
  }
  if (section === "money") {
    return `<div class="card info-card"><h2>いくら？</h2><p style="font-size:1.4rem;font-weight:850;color:var(--accent-strong);">${event.cost}</p><p style="margin-top:8px;">${event.costNote}</p><div class="source-note">${event.source}</div></div>`;
  }
  if (section === "decision") {
    if (!event.timeline.length) {
      return `<div class="card info-card"><h2>誰が決めた？</h2><p>この種類のデモではタイムラインをまだ用意していません。実データ接続時は、確認できる範囲だけを表示し、不明な段階を推測で埋めません。</p></div>`;
    }
    return `<div class="card info-card"><h2>誰が決めた？</h2><p style="margin-bottom:16px;">出来事から、決定の流れをたどります。</p><div class="timeline">${event.timeline.map(([title,copy]) => `<div class="timeline-item"><strong>${title}</strong><small>公式資料で確認できた場合に表示</small><p>${copy}</p></div>`).join("")}</div><div class="source-note">現在はすべてデモ表示です。</div></div>`;
  }
  return "";
}

function moneyView() {
  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>
      <div class="hero"><p class="eyebrow">直方のお金・デモ</p><h1>むずかしい予算書を、生活の言葉へ。</h1><p>数値はまだ実データではありません。</p></div>
      ${demoBanner()}
      <div class="card info-card">
        <h2>市のお金を100万円に縮めると…</h2>
        <p>実データ接続後は、公式予算を検算したうえで、分野ごとの割合を分かりやすく表示します。</p>
        <div class="source-note">個人が払った税金と特定事業を直接結び付ける表示は行いません。</div>
      </div>
      <div class="section"><div class="stack">
        <div class="card info-card"><h2>去年より増えたもの</h2><p>公式年度データを接続後に表示。</p></div>
        <div class="card info-card"><h2>あなたの近くの事業</h2><p>地図・工事情報と予算を、確認できる範囲でつなげます。</p></div>
      </div></div>
    </section>`;
}

function settingsView() {
  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>
      <div class="hero"><p class="eyebrow">設定</p><h1>自分にちょうどいい直方へ</h1><p>最初から住所やアカウント登録を強制しません。</p></div>
      <div class="settings-list">
        <div class="card setting-row"><div><strong>生活通知</strong><small>工事・防災・期限など</small></div><button class="toggle ${state.notifications ? "is-on" : ""}" type="button" data-action="toggle-notifications" aria-pressed="${state.notifications}" aria-label="生活通知を切り替える"></button></div>
        <div class="card setting-row"><div><strong>おおまかな地域</strong><small>未設定でも利用できます</small></div><button class="secondary-button" type="button" data-action="region-demo">設定</button></div>
        <div class="card setting-row"><div><strong>気になるテーマ</strong><small>子育て・道路・イベントなど</small></div><button class="secondary-button" type="button" data-action="theme-demo">選ぶ</button></div>
      </div>
    </section>`;
}

function answerFor(question) {
  const q = question.trim();
  if (!q) return "";
  let body;
  if (/工事|道路|道/.test(q)) {
    body = `<h3>ひとことで</h3><p>このMVPでは実際の工事データにまだ接続していないため、工事理由は断定できません。</p><h3>本番では</h3><p>直方市などの公式資料で工事件名・場所・理由を照合し、確認できた説明だけを短く表示します。</p>`;
  } else if (/子育て|補助|制度|お金/.test(q)) {
    body = `<h3>ひとことで</h3><p>現在はデモ版のため、あなたが利用できる制度を確定できません。</p><h3>本番では</h3><p>生活状況に近い制度を候補として出し、「対象となる可能性があります。公式条件をご確認ください」と案内します。</p>`;
  } else if (/誰|決め/.test(q)) {
    body = `<h3>ひとことで</h3><p>案件によって決まり方は違います。</p><h3>本番では</h3><p>市の計画、予算、議会審議、採決、契約など、公式資料で確認できた段階だけをタイムラインで示します。</p>`;
  } else {
    body = `<h3>ひとことで</h3><p>今はUI確認用のデモなので、その質問に事実として回答できる実データがありません。</p><h3>大切にすること</h3><p>分からないことを勝手に補わず、公式資料で確認できる情報だけを回答します。</p>`;
  }
  return `<div class="card answer-card"><span class="pill demo">デモ回答</span>${body}<div class="answer-source">どこ情報？ 現在は実データ未接続。今後、一次資料URL・公開日・最終確認日を表示します。</div></div>`;
}

function render() {
  document.querySelectorAll("[data-tab]").forEach(btn => btn.classList.toggle("is-active", state.view === "tab" && btn.dataset.tab === state.tab));
  if (state.view === "detail") main.innerHTML = detailView(demoEvents.find(e => e.id === state.eventId));
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
  render();
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) return goTab(tab.dataset.tab);

  const eventButton = event.target.closest("[data-event]");
  if (eventButton) {
    state.eventId = eventButton.dataset.event;
    state.detailSection = null;
    state.view = "detail";
    return render();
  }

  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    state.detailSection = sectionButton.dataset.section;
    return render();
  }

  const quick = event.target.closest("[data-quick]");
  if (quick) {
    if (quick.dataset.quick === "money") { state.view = "money"; return render(); }
    return goTab(quick.dataset.quick);
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) { state.nearbyFilter = filter.dataset.filter; return render(); }

  const category = event.target.closest("[data-category]");
  if (category) { state.discoverCategory = category.dataset.category; return render(); }

  const question = event.target.closest("[data-question]");
  if (question) {
    main.innerHTML = askView(answerFor(question.dataset.question));
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;
  const name = action.dataset.action;
  if (name === "go-home") return goTab("today");
  if (name === "open-settings") { state.view = "settings"; return render(); }
  if (name === "back") { state.view = "tab"; return render(); }
  if (name === "toggle-notifications") { state.notifications = !state.notifications; showToast(state.notifications ? "生活通知をオンにしました（デモ）" : "生活通知をオフにしました"); return render(); }
  if (name === "region-demo") return showToast("地域設定は次の開発段階で実データと接続します");
  if (name === "theme-demo") return goTab("discover");
  if (name === "discover-search") {
    const query = document.querySelector("#discover-search")?.value.trim();
    if (!query) return showToast("気になる言葉を入れてください");
    state.discoverCategory = categories.find(([name]) => query.includes(name))?.[0] || null;
    if (/工事|道/.test(query)) state.discoverCategory = "道路";
    if (/子|補助|給付/.test(query)) state.discoverCategory = "子育て";
    render();
    if (!state.discoverCategory) showToast("実データ接続後は、曖昧な言葉でも横断検索します");
  }
  if (name === "use-location") {
    if (!navigator.geolocation) return showToast("この端末では位置情報を利用できません");
    navigator.geolocation.getCurrentPosition(
      () => { state.locationUsed = true; render(); showToast("現在地を取得しました。MVPでは保存しません"); },
      () => showToast("位置情報を使わなくても利用できます"),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
    );
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "ask-form") return;
  event.preventDefault();
  const input = document.querySelector("#ask-input");
  main.innerHTML = askView(answerFor(input?.value || ""));
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

render();
