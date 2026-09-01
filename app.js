const state = {
  tab: "today",
  view: "tab",
  eventId: null,
  detailSection: null,
  nearbyFilter: "すべて",
  discoverCategory: null,
  discoverQuery: "",
  askAnswer: "",
  notifications: false,
};

const demoEvents = [
  {
    id: "road-demo",
    icon: "🚧",
    type: "工事",
    category: "道路",
    title: "近くの道路工事を調べる",
    short: "何をしている工事なのか、理由・お金・決まり方までたどれる体験のデモです。",
    distance: "距離はデモ",
    status: "工事情報・デモ",
    timing: "工期は実データ接続後に表示",
    why: "実際のアプリでは、直方市などの公式資料で確認できた理由だけを表示します。現在はUI確認用の説明です。",
    whyNow: "公開資料から「なぜ今なのか」まで確認できた場合だけ表示します。確認できなければ推測しません。",
    cost: "金額は実データ接続後に表示",
    costNote: "予算額・事業費・契約額は意味が違うため、種類を明示して表示します。",
    source: "デモデータ：実際の行政情報には未接続",
    mapEligible: true,
    map: { left: 39, top: 61 },
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
    distance: "場所はデモ",
    status: "今週末・デモ",
    timing: "開催日は公式情報から表示",
    why: "イベント情報は、政治に興味がない人にもアプリを開く理由を作る生活情報です。",
    whyNow: "開催日が近い情報を優先して表示する想定です。",
    cost: "参加費は公式情報がある場合のみ表示",
    costNote: "現在は実在イベントの費用を表示していません。",
    source: "デモデータ：実在イベントではありません",
    mapEligible: true,
    map: { left: 72, top: 43 },
    timeline: [],
  },
  {
    id: "park-demo",
    icon: "🌳",
    type: "場所",
    category: "公園",
    title: "公園や施設の変化も地図から",
    short: "公園の工事や施設の利用情報など、場所と結びつく情報を探す体験のデモです。",
    distance: "場所はデモ",
    status: "地域情報・デモ",
    timing: "期間は公式情報から表示",
    why: "場所から街の変化を見つけられるようにするためのデモです。",
    whyNow: "工事・休館・イベントなど、今見る意味がある情報を優先する想定です。",
    cost: "費用情報が公開されている場合のみ表示",
    costNote: "不明な数字は生成しません。",
    source: "デモデータ：実在施設の情報ではありません",
    mapEligible: true,
    map: { left: 56, top: 28 },
    timeline: [],
  },
  {
    id: "trash-demo",
    icon: "🗑️",
    type: "暮らし",
    category: "ごみ",
    title: "明日のごみ収集をひと目で",
    short: "毎日の生活に役立つ情報を、政治情報より先に見せるためのデモです。",
    distance: "地域設定後",
    status: "生活情報・デモ",
    timing: "収集日は地域設定と公式情報から表示",
    why: "「便利だから開く」を成立させるため、日常情報をホームの中心に置きます。",
    whyNow: "翌日の収集など、時間に関係する情報を優先する想定です。",
    cost: "該当なし",
    costNote: "この種類の情報で費用が重要でない場合は、無理に金額を表示しません。",
    source: "デモデータ：実際の収集日には未接続",
    mapEligible: false,
    timeline: [],
  },
  {
    id: "support-demo",
    icon: "💰",
    type: "制度",
    category: "子育て",
    title: "使えるかもしれない制度があります",
    short: "制度名を知らなくても、生活の出来事から支援制度を見つけるためのデモです。",
    distance: "条件から探す",
    status: "制度案内・デモ",
    timing: "期限は公式情報から表示",
    why: "「子どもが生まれた」「引っ越した」など、生活の出来事から制度を探せるようにします。",
    whyNow: "受付開始・期限間近など、今見る意味がある場合に優先します。",
    cost: "給付額などは公式条件を確認して表示",
    costNote: "対象になるかどうかをAIだけで断定しない設計です。",
    source: "デモデータ：実在制度には未接続",
    mapEligible: false,
    timeline: [],
  },
  {
    id: "opinion-demo",
    icon: "⏳",
    type: "まだ間に合う",
    category: "まちづくり",
    title: "まだ意見を出せる計画があります",
    short: "決まった後だけでなく、まだ市民が意見を出せる段階を見つけやすくするデモです。",
    distance: "市内全体の例",
    status: "意見募集・デモ",
    timing: "締切は公式情報から表示",
    why: "決定前の情報を生活者の言葉で短く伝え、正式な提出先へつなげるためです。",
    whyNow: "期限が近いものはホームで目立たせます。",
    cost: "費用情報が公開されている場合のみ表示",
    costNote: "不明な数字は生成しません。",
    source: "デモデータ：実在の意見募集ではありません",
    mapEligible: false,
    timeline: [],
  },
];

const categories = [
  ["道路", "🚧"], ["子育て", "👶"], ["ごみ", "🗑️"], ["バス", "🚌"], ["公園", "🌳"], ["防災", "⛑️"],
  ["学校", "🏫"], ["イベント", "🎪"], ["税金", "💰"], ["高齢者", "🧓"], ["福祉", "🤝"], ["施設", "🏛️"],
];

const searchAliases = [
  ["道路", /道路|工事|道|舗装|通行/],
  ["子育て", /子育て|子供|子ども|こども|赤ちゃん|保育|助成|給付|補助/],
  ["ごみ", /ごみ|ゴミ|粗大|資源|収集|捨て/],
  ["バス", /バス|交通|電車|駅|移動/],
  ["公園", /公園|遊具|広場/],
  ["防災", /防災|災害|避難|台風|大雨|地震/],
  ["学校", /学校|教育|小学校|中学校|高校/],
  ["イベント", /イベント|祭り|まつり|催し|週末/],
  ["税金", /税金|予算|決算|市のお金|お金の使い道/],
  ["高齢者", /高齢|介護|シニア|老人/],
  ["福祉", /福祉|障害|相談|生活支援/],
  ["施設", /施設|体育館|図書館|市役所|会館/],
];

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

function japaneseDate() {
  const d = new Date();
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

function demoBanner() {
  return `<div class="demo-banner" role="note">
    <span class="demo-badge">DEMO</span>
    <span>直方市公式アプリではない、非公式のUI/UX確認用MVPです。表示中の工事・制度・イベント・距離はサンプルで、実在情報ではありません。</span>
  </div>`;
}

function eventCard(event) {
  return `
    <button class="action-card" type="button" data-event="${esc(event.id)}">
      <div class="card-row">
        <div class="card-icon ${event.category === "道路" ? "warm" : event.category === "子育て" ? "pink" : "blue"}" aria-hidden="true">${esc(event.icon)}</div>
        <div class="card-body">
          <div class="card-kicker">${esc(event.type)}</div>
          <h3 class="card-title">${esc(event.title)}</h3>
          <p class="card-copy">${esc(event.short)}</p>
          <div class="card-meta">
            <span class="pill">${esc(event.distance)}</span>
            <span class="pill demo">${esc(event.status)}</span>
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
        <p class="eyebrow">${esc(japaneseDate())}</p>
        <h1>今日の直方</h1>
        <p>暮らしのことから、街の「なんで？」まで。</p>
      </div>

      ${demoBanner()}

      <div class="section">
        <div class="section-head">
          <div><h2>近くで起きていること</h2><p>まずは「これ何？」から</p></div>
        </div>
        ${eventCard(demoEvents.find((e) => e.id === "road-demo"))}
      </div>

      <div class="section">
        <div class="section-head"><h2>今日、知っておくと便利</h2></div>
        <div class="stack">
          ${eventCard(demoEvents.find((e) => e.id === "trash-demo"))}
          ${eventCard(demoEvents.find((e) => e.id === "event-demo"))}
          ${eventCard(demoEvents.find((e) => e.id === "support-demo"))}
          ${eventCard(demoEvents.find((e) => e.id === "opinion-demo"))}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>すぐ見る</h2></div>
        <div class="quick-grid">
          <button class="quick-button" type="button" data-quick="nearby"><span aria-hidden="true">⌖</span><strong>近くで何してる？</strong></button>
          <button class="quick-button" type="button" data-quick="discover"><span aria-hidden="true">◎</span><strong>制度を見つける</strong></button>
          <button class="quick-button" type="button" data-quick="ask"><span aria-hidden="true">✦</span><strong>直方のことを聞く</strong></button>
          <button class="quick-button" type="button" data-quick="money"><span aria-hidden="true">¥</span><strong>直方のお金</strong></button>
        </div>
      </div>
    </section>`;
}

function nearbyView() {
  const mapEvents = demoEvents.filter((e) => e.mapEligible);
  const filters = ["すべて", ...new Set(mapEvents.map((e) => e.category))];
  const filtered = state.nearbyFilter === "すべて"
    ? mapEvents
    : mapEvents.filter((e) => e.category === state.nearbyFilter);

  const pins = filtered.map((event) => `
    <button
      class="map-pin"
      type="button"
      data-event="${esc(event.id)}"
      aria-label="${esc(event.title)}のデモを見る"
      style="left:${Number(event.map.left)}%;top:${Number(event.map.top)}%;"
    ><span><b aria-hidden="true">${esc(event.icon)}</b></span></button>
  `).join("");

  return `
    <section class="page">
      <div class="hero">
        <p class="eyebrow">近くで何してる？</p>
        <h1>この辺の動き</h1>
        <p>場所と結びつく情報だけを、地図と一覧で見ます。</p>
      </div>

      ${demoBanner()}

      <div class="filter-row" role="group" aria-label="地図カテゴリ">
        ${filters.map((f) => `
          <button
            class="filter-chip ${state.nearbyFilter === f ? "is-active" : ""}"
            type="button"
            data-filter="${esc(f)}"
            aria-pressed="${state.nearbyFilter === f}"
          >${esc(f)}</button>
        `).join("")}
      </div>

      <div class="map-card" aria-label="位置を模式的に表したデモ地図">
        <div class="map-river" aria-hidden="true"></div>
        <div class="map-road r1" aria-hidden="true"></div>
        <div class="map-road r2" aria-hidden="true"></div>
        ${pins}
        ${pins ? "" : `<div class="map-empty">このカテゴリの地図デモはありません</div>`}
      </div>

      <div class="section">
        <div class="section-head"><h2>表示中</h2><p>${filtered.length}件・デモ</p></div>
        <div class="stack">
          ${filtered.length
            ? filtered.map(eventCard).join("")
            : `<div class="card info-card empty-state"><h2>表示できる情報がありません</h2><p>別のカテゴリを選んでください。</p></div>`}
        </div>
      </div>

      <div class="card info-card privacy-note">
        <h2>現在地について</h2>
        <p>このMVPでは距離計算がまだ未接続なので、位置情報の許可は求めません。実データの地図と距離計算を接続した段階で、許可した人だけ現在地を使えるようにします。</p>
      </div>
    </section>`;
}

function detectCategory(query) {
  const q = query.trim();
  if (!q) return null;
  return searchAliases.find(([, pattern]) => pattern.test(q))?.[0] ?? null;
}

function discoverResults() {
  const q = state.discoverQuery.trim();
  if (!q && !state.discoverCategory) return demoEvents;

  const category = state.discoverCategory || detectCategory(q);
  if (category) {
    return demoEvents.filter((event) => event.category === category);
  }

  const lowered = q.toLocaleLowerCase("ja");
  return demoEvents.filter((event) =>
    [event.title, event.short, event.type, event.category]
      .some((value) => String(value).toLocaleLowerCase("ja").includes(lowered))
  );
}

function discoverView() {
  const results = discoverResults();
  const label = state.discoverCategory || (state.discoverQuery ? `「${esc(state.discoverQuery)}」` : "");

  return `
    <section class="page">
      <div class="hero">
        <p class="eyebrow">見つける</p>
        <h1>役所の言葉を知らなくて大丈夫</h1>
        <p>「ゴミ」「子供のお金」「工事」みたいな言葉から探せます。</p>
      </div>

      <div class="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          id="discover-search"
          type="search"
          value="${esc(state.discoverQuery)}"
          placeholder="例：子供のお金、ゴミ、工事"
          aria-label="街の情報を検索"
        />
        <button type="button" data-action="discover-search">探す</button>
      </div>

      ${(state.discoverQuery || state.discoverCategory) ? `
        <div class="search-summary">
          <span>${label ? `${label} の結果` : "検索結果"}：${results.length}件・デモ</span>
          <button type="button" data-action="clear-discover">クリア</button>
        </div>
      ` : ""}

      <div class="section">
        <div class="section-head"><h2>気になることから</h2></div>
        <div class="category-grid">
          ${categories.map(([name, icon]) => `
            <button
              class="category-button ${state.discoverCategory === name ? "is-active" : ""}"
              type="button"
              data-category="${esc(name)}"
              aria-pressed="${state.discoverCategory === name}"
            >
              <span aria-hidden="true">${esc(icon)}</span>
              <strong>${esc(name)}</strong>
            </button>
          `).join("")}
        </div>
      </div>

      <div class="section">
        <div class="section-head"><h2>${label ? `${label} のデモ` : "こんな情報が見つかります"}</h2></div>
        <div class="stack">
          ${results.length
            ? results.map(eventCard).join("")
            : `<div class="card info-card empty-state"><h2>このデモではまだ見つかりません</h2><p>実データ接続後は、行政サービス・工事・議会・予算などを横断して探します。</p></div>`}
        </div>
      </div>
    </section>`;
}

function askView() {
  return `
    <section class="page">
      <div class="hero">
        <p class="eyebrow">直方のことを聞く</p>
        <h1>検索より、ふつうに聞く。</h1>
        <p>難しい制度名や議会用語を知らなくても大丈夫。</p>
      </div>

      ${demoBanner()}

      <div class="ask-panel">
        <h2>何が気になる？</h2>
        <p>今は回答UIのデモです。本番では公式資料を根拠に、短い答え→理由→一次資料の順で返します。</p>
        <form class="ask-form" id="ask-form">
          <input id="ask-input" type="text" placeholder="なんでこの道工事してるん？" autocomplete="off" aria-label="直方について質問" />
          <button class="primary-button" type="submit">聞く</button>
        </form>
        <div class="suggestion-list">
          <button class="suggestion-chip" type="button" data-question="なんでこの道工事してるん？">なんでこの道工事してるん？</button>
          <button class="suggestion-chip" type="button" data-question="子育てで使える制度ある？">子育てで使える制度ある？</button>
          <button class="suggestion-chip" type="button" data-question="直方って何にお金使ってる？">直方って何にお金使ってる？</button>
          <button class="suggestion-chip" type="button" data-question="誰が決めたん？">誰が決めたん？</button>
        </div>
      </div>

      ${state.askAnswer}
    </section>`;
}

function detailView(event) {
  if (!event) return todayView();
  const section = state.detailSection;

  const questionButton = (key, hint, title) => `
    <button
      class="question-button ${section === key ? "is-active" : ""}"
      type="button"
      data-section="${key}"
      aria-pressed="${section === key}"
    ><span>${hint}</span><strong>${title}</strong></button>`;

  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>

      <div class="detail-hero">
        <div class="big-icon" aria-hidden="true">${esc(event.icon)}</div>
        <p class="eyebrow">${esc(event.type)}・デモ</p>
        <h1>${esc(event.title)}</h1>
        <p>${esc(event.short)}</p>
        <div class="card-meta">
          <span class="pill">${esc(event.distance)}</span>
          <span class="pill demo">${esc(event.status)}</span>
        </div>
      </div>

      <div class="question-grid" aria-label="詳しく見る">
        ${questionButton("what", "まず", "これ何？")}
        ${questionButton("why", "理由を知る", "なんで？")}
        ${questionButton("money", "お金を見る", "いくら？")}
        ${questionButton("decision", "流れを見る", "誰が決めた？")}
      </div>

      ${renderDetailSection(event, section)}
    </section>`;
}

function renderDetailSection(event, section) {
  if (!section) {
    return `<div class="card info-card">
      <h2>30秒でいうと</h2>
      <p>${esc(event.short)}</p>
      <div class="source-note">${esc(event.source)}</div>
    </div>`;
  }

  if (section === "what") {
    const copy = event.type === "工事"
      ? "道路工事の詳細画面を想定したデモです。本番では工事名・場所・期間・施工者など、公開資料で確認できたものだけを整理します。"
      : event.short;

    return `<div class="card info-card">
      <h2>これ何？</h2>
      <p>${esc(copy)}</p>
      <div class="source-note">いつ？ ${esc(event.timing)}<br>${esc(event.source)}</div>
    </div>`;
  }

  if (section === "why") {
    return `<div class="stack">
      <div class="card info-card">
        <h2>なんで？</h2>
        <p>${esc(event.why)}</p>
        <div class="source-note">${esc(event.source)}</div>
      </div>
      <div class="card info-card">
        <h2>なんで今？</h2>
        <p>${esc(event.whyNow)}</p>
      </div>
    </div>`;
  }

  if (section === "money") {
    return `<div class="card info-card">
      <h2>いくら？</h2>
      <p class="key-number">${esc(event.cost)}</p>
      <p class="detail-note">${esc(event.costNote)}</p>
      <div class="source-note">${esc(event.source)}</div>
    </div>`;
  }

  if (section === "decision") {
    if (!event.timeline.length) {
      return `<div class="card info-card empty-state">
        <h2>誰が決めた？</h2>
        <p>この種類のデモではタイムラインをまだ用意していません。本番では確認できる段階だけを表示し、不明な部分を推測で埋めません。</p>
      </div>`;
    }

    return `<div class="card info-card">
      <h2>誰が決めた？</h2>
      <p class="timeline-intro">出来事から、決定の流れをたどります。</p>
      <div class="timeline">
        ${event.timeline.map(([title, copy]) => `
          <div class="timeline-item">
            <strong>${esc(title)}</strong>
            <small>公式資料で確認できた場合に表示</small>
            <p>${esc(copy)}</p>
          </div>
        `).join("")}
      </div>
      <div class="source-note">現在はすべてデモ表示です。</div>
    </div>`;
  }

  return "";
}

function moneyView() {
  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>
      <div class="hero">
        <p class="eyebrow">直方のお金・デモ</p>
        <h1>むずかしい予算書を、生活の言葉へ。</h1>
        <p>数値はまだ実データではありません。</p>
      </div>

      ${demoBanner()}

      <div class="card info-card">
        <h2>市のお金を100万円に縮めると…</h2>
        <p>実データ接続後は、公式予算を検算したうえで、分野ごとの割合を分かりやすく表示します。</p>
        <div class="source-note">個人が払った税金と特定事業を直接結び付ける表示は行いません。</div>
      </div>

      <div class="section">
        <div class="stack">
          <div class="card info-card"><h2>去年より増えたもの</h2><p>公式年度データを接続後に表示します。</p></div>
          <div class="card info-card"><h2>あなたの近くの事業</h2><p>場所が確認できる事業だけを、地図・工事情報と予算につなげます。</p></div>
        </div>
      </div>
    </section>`;
}

function settingsView() {
  return `
    <section class="page">
      <button class="back-button" type="button" data-action="back">‹ 戻る</button>
      <div class="hero">
        <p class="eyebrow">設定</p>
        <h1>自分にちょうどいい直方へ</h1>
        <p>最初から住所やアカウント登録を強制しません。</p>
      </div>

      <div class="settings-list">
        <div class="card setting-row">
          <div><strong>生活通知（デモ）</strong><small>工事・防災・期限など</small></div>
          <button
            class="toggle ${state.notifications ? "is-on" : ""}"
            type="button"
            data-action="toggle-notifications"
            aria-pressed="${state.notifications}"
            aria-label="生活通知のデモ設定を切り替える"
          ></button>
        </div>

        <div class="card setting-row">
          <div><strong>おおまかな地域</strong><small>未設定でも利用できます</small></div>
          <button class="secondary-button" type="button" data-action="region-demo">設定</button>
        </div>

        <div class="card setting-row">
          <div><strong>気になるテーマ</strong><small>子育て・道路・イベントなど</small></div>
          <button class="secondary-button" type="button" data-action="theme-demo">選ぶ</button>
        </div>
      </div>
    </section>`;
}

function answerFor(question) {
  const q = question.trim();
  if (!q) return "";

  let body;

  if (/工事|道路|道/.test(q)) {
    if (/いくら|費用|金額|予算/.test(q)) {
      body = `<h3>ひとことで</h3><p>このMVPは実際の工事費にまだ接続していないため、金額は答えられません。</p><h3>本番では</h3><p>予算額・事業費・契約額を区別し、公式資料で確認できた金額だけを表示します。</p>`;
    } else {
      body = `<h3>ひとことで</h3><p>このMVPは実際の工事データにまだ接続していないため、工事理由は断定できません。</p><h3>本番では</h3><p>工事件名・場所・理由を公式資料で照合し、確認できた説明だけを短く表示します。</p>`;
    }
  } else if (/子育て|子ども|子供|こども|赤ちゃん|補助|給付|助成/.test(q)) {
    body = `<h3>ひとことで</h3><p>現在はデモ版のため、あなたが利用できる制度を確定できません。</p><h3>本番では</h3><p>生活状況に近い制度を候補として出し、「対象となる可能性があります。公式条件をご確認ください」と案内します。</p>`;
  } else if (/何に.*(お金|使)|市.*(お金|使)|直方.*(お金|使)|税金|予算|決算/.test(q)) {
    body = `<h3>ひとことで</h3><p>現在は直方市の実際の予算データにまだ接続していないため、支出先を事実として回答できません。</p><h3>本番では</h3><p>公式の予算・決算を年度と単位まで確認し、分野別の支出や増減を分かりやすく示します。</p>`;
  } else if (/ごみ|ゴミ|粗大|捨て/.test(q)) {
    body = `<h3>ひとことで</h3><p>現在は地域別の実際の収集日・分別データにまだ接続していません。</p><h3>本番では</h3><p>おおまかな地域設定と公式情報を使い、収集日や分別方法へすぐたどれるようにします。</p>`;
  } else if (/誰|決め|議会/.test(q)) {
    body = `<h3>ひとことで</h3><p>案件によって決まり方は違うため、一律には答えません。</p><h3>本番では</h3><p>市の計画、予算、議会審議、採決、契約など、公式資料で確認できた段階だけをタイムラインで示します。</p>`;
  } else if (/市長|議員/.test(q)) {
    body = `<h3>ひとことで</h3><p>現在は市長・議員の最新の実データにまだ接続していません。</p><h3>本番では</h3><p>公式プロフィール、一般質問、議案、会議録など確認できる公開記録を整理し、人物評価は行いません。</p>`;
  } else {
    body = `<h3>ひとことで</h3><p>今はUI確認用のデモなので、その質問に事実として答えられる実データがありません。</p><h3>大切にすること</h3><p>分からないことを勝手に補わず、公式資料で確認できる情報だけを回答します。</p>`;
  }

  return `<div class="card answer-card">
    <span class="pill demo">デモ回答</span>
    ${body}
    <div class="answer-source">どこ情報？ 現在は実データ未接続。本番では一次資料URL・公開日・最終確認日を表示します。</div>
  </div>`;
}

function routeSnapshot() {
  return {
    tab: state.tab,
    view: state.view,
    eventId: state.eventId,
    detailSection: state.detailSection,
  };
}

function restoreRoute(route) {
  if (!route) return;
  state.tab = route.tab || "today";
  state.view = route.view || "tab";
  state.eventId = route.eventId || null;
  state.detailSection = route.detailSection || null;
}

function setHistory(mode = "push") {
  const currentDepth = Number(history.state?.depth || 0);
  const payload = {
    mytown: true,
    depth: mode === "push" ? currentDepth + 1 : currentDepth,
    route: routeSnapshot(),
  };
  if (mode === "replace") history.replaceState(payload, "", location.href);
  else history.pushState(payload, "", location.href);
}

function render({ focusMain = false } = {}) {
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    const active = btn.dataset.tab === state.tab;
    btn.classList.toggle("is-active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  if (state.view === "detail") main.innerHTML = detailView(demoEvents.find((e) => e.id === state.eventId));
  else if (state.view === "money") main.innerHTML = moneyView();
  else if (state.view === "settings") main.innerHTML = settingsView();
  else if (state.tab === "nearby") main.innerHTML = nearbyView();
  else if (state.tab === "discover") main.innerHTML = discoverView();
  else if (state.tab === "ask") main.innerHTML = askView();
  else main.innerHTML = todayView();

  window.scrollTo({ top: 0, behavior: "auto" });

  if (focusMain) {
    requestAnimationFrame(() => main.focus({ preventScroll: true }));
  }
}

function navigate(patch, { replace = false } = {}) {
  Object.assign(state, patch);
  render({ focusMain: true });
  setHistory(replace ? "replace" : "push");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function goTab(tab) {
  if (state.view === "tab" && state.tab === tab) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  navigate({
    tab,
    view: "tab",
    eventId: null,
    detailSection: null,
  });
}

function goBack() {
  const depth = Number(history.state?.depth || 0);
  if (depth > 0) {
    history.back();
    return;
  }

  navigate({
    tab: "today",
    view: "tab",
    eventId: null,
    detailSection: null,
  }, { replace: true });
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) return goTab(tab.dataset.tab);

  const eventButton = event.target.closest("[data-event]");
  if (eventButton) {
    return navigate({
      view: "detail",
      eventId: eventButton.dataset.event,
      detailSection: null,
    });
  }

  const sectionButton = event.target.closest("[data-section]");
  if (sectionButton) {
    state.detailSection = sectionButton.dataset.section;
    render();
    return;
  }

  const quick = event.target.closest("[data-quick]");
  if (quick) {
    if (quick.dataset.quick === "money") return navigate({ view: "money" });
    return goTab(quick.dataset.quick);
  }

  const filter = event.target.closest("[data-filter]");
  if (filter) {
    state.nearbyFilter = filter.dataset.filter;
    render();
    return;
  }

  const category = event.target.closest("[data-category]");
  if (category) {
    state.discoverCategory = category.dataset.category;
    state.discoverQuery = "";
    render();
    return;
  }

  const question = event.target.closest("[data-question]");
  if (question) {
    state.askAnswer = answerFor(question.dataset.question);
    render();
    requestAnimationFrame(() => document.querySelector(".answer-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }

  const action = event.target.closest("[data-action]");
  if (!action) return;

  const name = action.dataset.action;

  if (name === "go-home") return goTab("today");
  if (name === "open-settings") return navigate({ view: "settings" });
  if (name === "back") return goBack();

  if (name === "toggle-notifications") {
    state.notifications = !state.notifications;
    render();
    showToast(state.notifications
      ? "通知設定のイメージをオンにしました。実際の通知はまだ送信されません。"
      : "通知設定のイメージをオフにしました。");
    return;
  }

  if (name === "region-demo") {
    showToast("地域設定は実データ接続時に追加します。現在地の許可はまだ求めません。");
    return;
  }

  if (name === "theme-demo") return goTab("discover");

  if (name === "clear-discover") {
    state.discoverQuery = "";
    state.discoverCategory = null;
    render();
    return;
  }

  if (name === "discover-search") {
    const query = document.querySelector("#discover-search")?.value.trim() || "";
    if (!query) {
      showToast("気になる言葉を入れてください。");
      return;
    }

    state.discoverQuery = query;
    state.discoverCategory = detectCategory(query);
    render();

    if (!discoverResults().length) {
      showToast("このデモには該当データがありません。実データ接続後は横断検索します。");
    }
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "ask-form") return;
  event.preventDefault();

  const input = document.querySelector("#ask-input");
  const question = input?.value.trim() || "";

  if (!question) {
    showToast("気になることを入力してください。");
    return;
  }

  state.askAnswer = answerFor(question);
  render();
  requestAnimationFrame(() => document.querySelector(".answer-card")?.scrollIntoView({ behavior: "smooth", block: "start" }));
});

window.addEventListener("popstate", (event) => {
  if (!event.state?.mytown) return;
  restoreRoute(event.state.route);
  render({ focusMain: true });
});

history.replaceState({
  mytown: true,
  depth: 0,
  route: routeSnapshot(),
}, "", location.href);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then((registration) => registration.update())
      .catch(() => {});
  });
}

render();
