const POLITICS_FALLBACK = {
  verifiedOn: null,
  mayor: null,
  council: { seats: 19, members: [] },
  factions: { count: 0, items: [] },
  committees: { items: [] },
  elections: { items: [] },
  politicalMoney: null,
  glossary: [],
};

state.politics = POLITICS_FALLBACK;
state.politicsLoading = true;
state.politicsLoadError = false;
state.politicsSection = "home";
state.selectedPolitician = null;

async function loadPoliticsData() {
  try {
    const response = await fetch(`./data/politics.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const raw = await response.json();
    state.politics = { ...POLITICS_FALLBACK, ...raw };
    state.politicsLoadError = false;
  } catch (error) {
    console.warn("Politics data load failed", error);
    state.politicsLoadError = true;
  } finally {
    state.politicsLoading = false;
    render();
  }
}

function guideBubble(message, note = "") {
  return `<div class="guide-bubble"><div class="guide-avatar" aria-hidden="true">🦖</div><div><strong>まちナビ</strong><p>${esc(message)}</p>${note ? `<small>${esc(note)}</small>` : ""}</div></div>`;
}

function politicsDataBanner() {
  const p = state.politics;
  if (state.politicsLoadError) {
    return `<div class="sync-banner is-warning"><strong>市長・議会データを読み込めませんでした</strong><span>公式ページへのリンクから確認できます。</span></div>`;
  }
  return `<div class="sync-banner"><div><span class="official-badge">公式資料ベース</span><strong>市長・議会の情報</strong></div><span>確認日：${esc(p.verifiedOn || "確認中")}</span></div>`;
}

function politicsBackButton() {
  if (state.politicsSection === "home") return "";
  return `<button class="back-button" type="button" data-politics-section="home">‹ 市長・議会トップへ</button>`;
}

function politicsSourceLinks(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<div class="source-stack">${items.map((x) => sourceLink(x.url, x.label)).join("")}</div>`;
}

function politicsHome() {
  const p = state.politics;
  if (state.politicsLoading) return `<section class="page"><div class="hero"><p class="eyebrow">市長・議会</p><h1>直方を動かす人と、決まり方</h1><p>公式資料を読み込んでいます。</p></div><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div></div></section>`;
  const mayor = p.mayor || {};
  const electionMayor = p.elections?.items?.find((x) => /市長/.test(x.name)) || {};
  const electionCouncil = p.elections?.items?.find((x) => /市議会/.test(x.name)) || {};
  return `<section class="page politics-page">
    <div class="hero politics-hero"><p class="eyebrow">🏛 市長・議会</p><h1>直方を動かす人と、決まり方</h1><p>「政治わからん」を前提に、ゼロから見られるページです。</p></div>
    ${politicsDataBanner()}
    ${guideBubble("ここは『政治に詳しい人のページ』じゃないよ。市長って何する人？ 議員って誰？ から始めればOK。難しい言葉はこっちでほどきます。")}

    <div class="politics-stats" aria-label="直方の市長と議会の概要">
      <button type="button" class="stat-card" data-politics-section="mayor"><span>市長</span><strong>${esc(mayor.name || "確認中")}</strong><small>${esc(mayor.term || "")}</small></button>
      <button type="button" class="stat-card" data-politics-section="members"><span>市議会</span><strong>${Number(p.council?.seats || 19)}人</strong><small>議長 ${esc(p.council?.chair || "")}</small></button>
      <button type="button" class="stat-card" data-politics-section="factions"><span>会派</span><strong>${Number(p.factions?.count || 0)}チーム</strong><small>所属基準日に注意</small></button>
      <button type="button" class="stat-card" data-politics-section="elections"><span>次の選挙</span><strong>2027年</strong><small>投票日は未発表</small></button>
    </div>

    <div class="card beginner-card">
      <span class="beginner-kicker">まず1個だけ</span>
      <h2>「2026年」と「2026年度」は違う</h2>
      <div class="year-compare"><div><small>2026年</small><strong>1月 → 12月</strong></div><div><small>2026年度</small><strong>2026年4月 → 2027年3月</strong></div></div>
      ${guideBubble("2027年1月なのに『2026年度』って書いてあることがある。間違いじゃないよ。年度は4月スタートだから。", "正式には、2026年度＝2026年4月1日〜2027年3月31日")}
      <button class="text-button" type="button" data-politics-section="glossary">ほかの難しい言葉も見る →</button>
    </div>

    ${state.data?.council ? `<div class="section"><div class="section-head"><div><h2>次の市議会</h2><p>今いつ何する？</p></div></div>${councilPreview(state.data.council)}</div>` : ""}

    <div class="section">
      <div class="section-head"><div><h2>何を見たい？</h2><p>役所の分類じゃなく、疑問から</p></div></div>
      <div class="politics-menu-grid">
        <button type="button" class="politics-menu-card" data-politics-section="mayor"><span>👤</span><strong>市長って誰？</strong><small>何期目？経歴は？</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="members"><span>👥</span><strong>議員19人を見る</strong><small>委員会・最近の質問</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="factions"><span>🤝</span><strong>会派って何？</strong><small>議会の中のチーム</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="committees"><span>🔎</span><strong>委員会って何？</strong><small>テーマ別に詳しく見る</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="elections"><span>🗳️</span><strong>次の選挙は？</strong><small>市長選・市議選</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="money"><span>💰</span><strong>議会のお金</strong><small>政務活動費をやさしく</small></button>
        <button type="button" class="politics-menu-card wide" data-politics-section="glossary"><span>📚</span><strong>政治ことば図鑑</strong><small>前提知識ゼロでOK</small></button>
      </div>
    </div>

    <div class="card election-teaser">
      <div><span class="pill verified">公式確認</span><h2>次の直方市長選・市議選</h2></div>
      <p><strong>市長の任期満了：</strong>${esc(electionMayor.termEnd || "確認中")}</p>
      <p><strong>市議の任期満了：</strong>${esc(electionCouncil.termEnd || "確認中")}</p>
      <p class="muted">投票日（選挙執行予定日）は、直方市公式ページでは現時点で「－」。決まったら更新します。</p>
      ${guideBubble("『任期が終わる日』と『投票する日』は別モノ。ここ、かなり間違えやすい。")}
      <button class="text-button" type="button" data-politics-section="elections">選挙ページへ →</button>
    </div>

    <details class="quiz-card">
      <summary>🦖 10秒クイズ：市長が「やりたい」と言えば、何でもすぐ決まる？</summary>
      <div><strong>答え：そうとは限りません。</strong><p>予算や条例など、市議会の議決が必要なものがあります。MYTOWNでは「市長側の提案」と「議会が決めたこと」を混ぜずに表示します。</p></div>
    </details>
  </section>`;
}

function mayorView() {
  const m = state.politics.mayor || {};
  const election = state.politics.elections?.items?.find((x) => /市長/.test(x.name)) || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">市長</p><h1>${esc(m.name || "市長")}</h1><p>${esc(m.reading || "")} ${m.term ? `・${esc(m.term)}` : ""}</p></div>
    ${guideBubble("市長は市政運営を担う人。でも『市長が言った＝全部決定』ではないよ。議会で決める必要があることもあります。")}
    <div class="card info-card"><h2>まず3行で</h2><p><strong>現在：</strong>${esc(m.name || "")}市長</p><p><strong>何期目：</strong>${esc(m.term || "確認中")}</p><p><strong>今の任期の満了日：</strong>${esc(election.termEnd || m.termEnd || "確認中")}</p><p class="muted">選挙の投票日は現時点で公式発表されていません。</p></div>
    <div class="section"><div class="section-head"><h2>公式資料で確認できる経歴</h2></div><div class="timeline">${(m.career || []).map((x) => `<div class="timeline-item"><strong>${esc(x.date)}</strong><p>${esc(x.label)}</p><small>${esc(x.source)}</small></div>`).join("")}</div></div>
    <div class="card info-card"><h2>載せていない経歴がある理由</h2><p>${esc(m.careerNote || "確認できる公式資料だけを掲載します。")}</p>${guideBubble("空欄をそれっぽく埋めるより、『分からない』を見えるようにする方が大事。")}</div>
    ${politicsSourceLinks(m.sources)}
  </section>`;
}

function membersView() {
  const c = state.politics.council || {};
  const members = c.members || [];
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">直方市議会</p><h1>議員19人、全員を見る</h1><p>名前だけで終わらず、「何を担当して、最近何を質問した？」まで。</p></div>
    ${guideBubble("議員の名前を知らなくて普通。まず『この人、何について質問しとるん？』から見たらOK。")}
    <div class="card info-card"><div class="split-head"><div><span class="pill verified">公式名簿</span><h2>議長 ${esc(c.chair || "")}</h2><p>副議長 ${esc(c.viceChair || "")}</p></div><strong>${Number(c.seats || members.length)}人</strong></div><p class="muted">名簿更新日：${esc(c.membersSourceUpdated || "")}</p>${sourceLink(c.membersSourceUrl, "公式の議員名簿")}</div>
    <div class="member-list">${members.map((m) => `<button class="member-card" type="button" data-politician="${esc(m.name)}"><div><span class="pill ${m.role !== "議員" ? "verified" : ""}">${esc(m.role)}</span><h3>${esc(m.name)}</h3><p>${esc(m.committee || "委員会情報なし")}</p></div><div class="member-meta">${m.recentQuestions?.length ? `<span>${m.recentQuestions.length}件<br><small>6月一般質問</small></span>` : `<span>—<br><small>6月質問記載なし</small></span>`}<b aria-hidden="true">›</b></div></button>`).join("")}</div>
    <div class="card info-card"><h2>「質問なし」＝仕事してない？</h2><p>いいえ。ここに表示しているのは2026年6月定例会の一般質問通告一覧だけです。質問が掲載されていないことから、議員活動全体を評価してはいけません。</p>${guideBubble("1枚の資料だけで人を採点しない。MYTOWNの大事なルール。")}</div>
  </section>`;
}

function factionForMember(name) {
  return state.politics.factions?.items?.find((f) => (f.members || []).includes(name)) || null;
}

function memberView() {
  const c = state.politics.council || {};
  const m = (c.members || []).find((x) => x.name === state.selectedPolitician);
  if (!m) return membersView();
  const faction = factionForMember(m.name);
  return `<section class="page politics-page"><button class="back-button" type="button" data-politics-section="members">‹ 議員一覧へ</button><div class="hero"><p class="eyebrow">${esc(m.role)}</p><h1>${esc(m.name)}</h1><p>${esc(m.nameNote || "")}</p></div>
    <div class="profile-facts">
      <div class="card info-card"><small>役割</small><strong>${esc(m.role)}</strong></div>
      <div class="card info-card"><small>担当チーム</small><strong>${esc(m.committee || "確認できず")}</strong></div>
      ${m.steering ? `<div class="card info-card"><small>議会の進め方チーム</small><strong>${esc(m.steering)}</strong></div>` : ""}
      <div class="card info-card"><small>会派</small><strong>${esc(faction?.name || "公式一覧から確認できず")}</strong></div>
    </div>
    ${faction ? `<div class="caution-card"><strong>⚠️ 会派の所属は基準日に注意</strong><p>この所属は直方市公式の会派一覧（${esc(state.politics.factions.membershipBasisDate)}現在）を基にしています。現在の所属と同じとは断定しません。</p></div>` : ""}
    <div class="section"><div class="section-head"><div><h2>最近、何を質問した？</h2><p>${esc(m.recentQuestionsLabel || "2026年6月定例会")}</p></div></div>${m.recentQuestions?.length ? `<div class="question-topic-list">${m.recentQuestions.map((q) => `<div class="topic-card"><span>🙋</span><p>${esc(q)}</p></div>`).join("")}</div>` : `<div class="card info-card"><p>2026年6月定例会の一般質問通告一覧では、この議員の一般質問を確認できませんでした。</p><p class="muted">これは「活動していない」という意味ではありません。</p></div>`}${sourceLink(c.questionsSourceUrl, "2026年6月 一般質問の公式一覧")}</div>
    <div class="card info-card"><h2>経歴・何期目？</h2><p>${esc(c.historyNote || "現在の公式名簿だけでは確認できません。")}</p>${guideBubble("分からんところを埋めない。選挙結果などで裏付けできたら追加していきます。")}</div>
    ${sourceLink(c.membersSourceUrl, "公式の議員名簿")}
  </section>`;
}

function factionsView() {
  const f = state.politics.factions || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">会派</p><h1>議会の中の「チーム」</h1><p>正式名称だけ見ても分かりにくいので、まず意味から。</p></div>
    ${guideBubble("会派。いきなり固い言葉きたね。ざっくり『議会の中のチーム』。ただし政党と同じとは限りません。")}
    <div class="caution-card"><strong>⚠️ ここ、透明化ポイント</strong><p>${esc(f.warning || "")}</p></div>
    <div class="faction-list">${(f.items || []).map((x) => `<div class="card faction-card"><div class="split-head"><div><small>会派</small><h2>${esc(x.name)}</h2></div><span class="pill">${x.members?.length || 0}人</span></div><p><strong>代表：</strong>${esc(x.representative || "")}</p><div class="name-chips">${(x.members || []).map((n) => `<span>${esc(n)}</span>`).join("")}</div></div>`).join("")}</div>
    ${sourceLink(f.currentCountSourceUrl, "現在の会派数を確認する公式ページ")}${sourceLink(f.membershipSourceUrl, "会派所属一覧の公式ページ")}
  </section>`;
}

function committeesView() {
  const data = state.politics.committees || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">委員会</p><h1>テーマ別に詳しく見るチーム</h1><p>「19人で何でも全部」ではなく、分野ごとに分担します。</p></div>
    ${guideBubble("全員で全部を細かく見ると、会議が終わらん。なので担当ごとのチームで詳しくチェックします。")}
    <div class="committee-list">${(data.items || []).map((x) => `<div class="card committee-card"><span class="easy-label">やさしく言うと</span><h2>${esc(x.easy)}</h2><p class="formal-name">正式名称：${esc(x.name)}</p><div class="name-chips">${(x.members || []).map((n) => `<span>${esc(n)}</span>`).join("")}</div></div>`).join("")}</div>
    ${sourceLink(data.sourceUrl, "公式の委員会構成")}
  </section>`;
}

function electionsView() {
  const e = state.politics.elections || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">🗳️ 選挙</p><h1>次の市長選・市議選は？</h1><p>分かっている日と、まだ決まっていない日を分けます。</p></div>
    ${guideBubble("『任期満了日』って書いてあると、その日が投票日っぽく見える。でも別モノ。選挙日が未発表なら、未発表と書きます。")}
    <div class="election-list">${(e.items || []).map((x) => `<div class="card election-card"><span class="pill verified">公式確認</span><h2>${esc(x.name)}</h2><div class="election-date"><small>任期が終わる日</small><strong>${esc(x.termEnd)}</strong></div><div class="election-date"><small>投票日</small><strong>${x.scheduledDate ? esc(x.scheduledDate) : "まだ公式発表なし"}</strong></div></div>`).join("")}</div>
    <div class="card beginner-card"><h2>そもそも「任期」って？</h2><p>その役職を担当する期間のこと。「任期満了日」は今の期間がいったん終わる日です。</p><p><strong>大事：</strong>任期満了日と選挙の投票日は同じとは限りません。</p></div>
    ${sourceLink(e.sourceUrl, "直方市・今後の選挙予定")}
  </section>`;
}

function politicalMoneyView() {
  const m = state.politics.politicalMoney || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">💰 議会のお金</p><h1>政務活動費って何？</h1><p>名前だけだと分かりにくいので、まず普通の言葉で。</p></div>
    ${guideBubble("『議員が自由に使えるお小遣い？』ではないよ。調査や研究などに使う公費で、使い道の基準と報告があります。")}
    <div class="card money-hero"><small>議員1人あたり</small><strong>年 ${Number(m.annualPerMember || 0).toLocaleString("ja-JP")}円</strong><span>月額換算 ${Number(m.monthlyPerMember || 0).toLocaleString("ja-JP")}円</span></div>
    <div class="card info-card"><h2>小学生向けに言うと</h2><p>${esc(m.easy || "")}</p><p><strong>給料とは別。</strong>何に使っていいかルールがあります。</p></div>
    <div class="section"><div class="section-head"><h2>何に使える？</h2></div><div class="name-chips large">${(m.uses || []).map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>
    <div class="card info-card"><h2>使った後は？</h2><p>${esc(m.report || "")}</p><p>直方市公式では、年度終了後4月30日までに収支報告書を提出し、領収書などの証拠書類を添付する必要があると案内されています。</p></div>
    <div class="card beginner-card"><h2>ここでも「年度」が出た</h2><p>2026年度なら2026年4月1日〜2027年3月31日。その年度が終わった後の4月に報告する、という流れです。</p></div>
    ${sourceLink(m.sourceUrl, "政務活動費の公式ページ")}
  </section>`;
}

function glossaryView() {
  const list = state.politics.glossary || [];
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">📚 政治ことば図鑑</p><h1>「それ何？」から始める</h1><p>前提知識はゼロでOK。正式名称より先に普通の言葉で説明します。</p></div>
    ${guideBubble("分からないのが普通。『説明なしでも分かるやろ』は禁止でいきます。役所語の方にこっちへ寄ってきてもらおう。")}
    <div class="glossary-list">${list.map((x, i) => `<details class="glossary-card" ${i === 0 ? "open" : ""}><summary><div><span class="easy-label">やさしく言うと</span><strong>${esc(x.easy)}</strong><small>正式名称：${esc(x.formal)}</small></div><span class="plus" aria-hidden="true">＋</span></summary><div class="glossary-body"><p>${esc(x.explain)}</p><div class="guide-mini"><span aria-hidden="true">🦖</span><p>${esc(x.guide)}</p></div><div class="example-box"><small>直方・今回の例</small><strong>${esc(x.example)}</strong></div></div></details>`).join("")}</div>
  </section>`;
}

function politicsRouter() {
  if (state.politicsSection === "mayor") return mayorView();
  if (state.politicsSection === "members") return membersView();
  if (state.politicsSection === "member") return memberView();
  if (state.politicsSection === "factions") return factionsView();
  if (state.politicsSection === "committees") return committeesView();
  if (state.politicsSection === "elections") return electionsView();
  if (state.politicsSection === "money") return politicalMoneyView();
  if (state.politicsSection === "glossary") return glossaryView();
  return politicsHome();
}

const baseRenderForPolitics = render;
render = function renderWithPolitics() {
  if (state.tab === "politics" && state.view === "tab") {
    document.querySelectorAll("[data-tab]").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === "politics"));
    main.innerHTML = politicsRouter();
    window.scrollTo({ top: 0, behavior: "auto" });
    return;
  }
  return baseRenderForPolitics();
};

const baseTodayViewForPolitics = todayView;
todayView = function todayViewWithPolitics() {
  const html = baseTodayViewForPolitics();
  const preview = `<div class="section politics-preview"><div class="section-head"><div><h2>🏛 市長・議会をのぞく</h2><p>名前を知らなくても大丈夫</p></div></div><button class="politics-preview-card" type="button" data-tab="politics"><div><span class="pill verified">専用ページ</span><h3>誰が、何を、どう決めてる？</h3><p>市長・議員19人・選挙・会派・委員会・お金を、普通の言葉で見られます。</p></div><span aria-hidden="true">›</span></button></div>`;
  return html.replace(/<\/section>\s*$/, `${preview}</section>`);
};

const baseAnswerForPolitics = answerFor;
answerFor = function answerForWithPolitics(question) {
  const q = normalizeQuery(question);
  const p = state.politics;
  const glossary = p.glossary || [];
  const term = glossary.find((x) => q.includes(normalizeQuery(x.formal)) || q.includes(normalizeQuery(x.easy).slice(0, 5)));
  if (/市長/.test(q) && /誰|だれ|名前|氏名|現在|今の|任期|何期/.test(q) && p.mayor) {
    return `<div class="card answer-card" role="status"><span class="pill verified">質問に対応する公式情報</span><h3>今の直方市長は ${esc(p.mayor.name)}</h3><p>${esc(p.mayor.term || "任期情報を確認中です")}。</p><button class="text-button" type="button" data-tab="politics" data-open-politics="mayor">市長ページで詳しく見る →</button></div>`;
  }
  if (/市長/.test(q)) {
    return `<div class="card answer-card" role="status"><span class="pill">公開資料で確認できず</span><h3>その市長に関する質問は、現在の公開資料から確認できません</h3><p>市長という言葉だけを手掛かりに、基本プロフィールを質問への答えとして表示することはしません。</p><button class="text-button" type="button" data-tab="politics" data-open-politics="mayor">参考として市長の基本情報を見る →</button></div>`;
  }
  if (/選挙|市議選|市長選|任期/.test(q) && /いつ|次|日|予定|投票|満了/.test(q)) {
    const mayorE = p.elections?.items?.[0]; const councilE = p.elections?.items?.[1];
    return `<div class="card answer-card"><span class="pill verified">公式資料ベース</span><h3>次の市長選・市議選</h3><p>市長の任期満了は ${esc(mayorE?.termEnd || "確認中")}、市議会議員は ${esc(councilE?.termEnd || "確認中")}。投票日は現時点で公式発表されていません。</p><p class="muted">任期満了日と投票日は別です。</p></div>`;
  }
  if (term && /何|なに|意味|とは|教え|わから|どういう/.test(q)) {
    return `<div class="card answer-card"><span class="pill">正式名称：${esc(term.formal)}</span><h3>${esc(term.easy)}</h3><p>${esc(term.explain)}</p><div class="guide-mini"><span>🦖</span><p>${esc(term.guide)}</p></div></div>`;
  }
  return baseAnswerForPolitics(question);
};

document.addEventListener("click", (event) => {
  const openPolitics = event.target.closest("[data-open-politics]");
  if (openPolitics) {
    state.tab = "politics";
    state.view = "tab";
    state.politicsSection = openPolitics.dataset.openPolitics || "home";
    render();
    return;
  }
  const section = event.target.closest("[data-politics-section]");
  if (section) {
    state.tab = "politics";
    state.view = "tab";
    state.politicsSection = section.dataset.politicsSection || "home";
    state.selectedPolitician = null;
    render();
    return;
  }
  const politician = event.target.closest("[data-politician]");
  if (politician) {
    state.tab = "politics";
    state.view = "tab";
    state.selectedPolitician = politician.dataset.politician;
    state.politicsSection = "member";
    render();
  }
});

window.addEventListener("popstate", () => {
  if (location.hash === "#politics") {
    state.tab = "politics";
    state.view = "tab";
    render();
  }
});

loadPoliticsData();
