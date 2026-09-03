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
    return `<div class="sync-banner is-warning"><strong>市長・市議会の情報を読み込めませんでした</strong><button class="text-button" type="button" data-politics-reload>もう一度読み込む</button><a href="https://www.city.nogata.fukuoka.jp/sigikai/" target="_blank" rel="noopener noreferrer">直方市議会のページを開く ↗</a></div>`;
  }
  return `<div class="sync-banner"><div><span class="official-badge">市の資料から</span><strong>市長・市議会の情報</strong></div><span>最終確認：${esc(p.verifiedOn || "確認中")}</span></div>`;
}

function politicsBackButton() {
  if (state.politicsSection === "home") return "";
  return `<button class="back-button" type="button" data-politics-section="home">‹ 市長・市議会トップへ</button>`;
}

function politicsSourceLinks(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<div class="source-stack">${items.map((x) => sourceLink(x.url, x.label)).join("")}</div>`;
}

function politicsJapaneseDate(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "確認中";
  return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

function politicsHome() {
  const p = state.politics;
  if (state.politicsLoading) return `<section class="page"><div class="hero"><p class="eyebrow">市長・議会</p><h1>市長・市議会を知る</h1><p>公式資料を読み込んでいます。</p></div><div class="card info-card"><div class="loading-line"></div><div class="loading-line short"></div></div></section>`;
  const mayor = p.mayor || {};
  return `<section class="page politics-page">
    <div class="hero politics-hero"><p class="eyebrow">🏛 市長・議会</p><h1>市長・市議会を知る</h1><p>市長や議員の役割、会派、選挙などを、直方市の資料をもとに案内します。</p></div>
    ${politicsDataBanner()}
    ${guideBubble("役割、議員、会派、選挙など、知りたいところから見られます。")}

    <div class="politics-stats" aria-label="直方の市長と議会の概要">
      <button type="button" class="stat-card" data-politics-section="mayor"><span>市長</span><strong>${esc(mayor.name || "確認中")}</strong><small>${esc(mayor.term || "")}</small></button>
      <button type="button" class="stat-card" data-politics-section="members"><span>市議会</span><strong>${Number(p.council?.seats || 19)}人</strong><small>議長 ${esc(p.council?.chair || "")}</small></button>
      <button type="button" class="stat-card" data-politics-section="factions"><span>会派</span><strong>${Number(p.factions?.count || 0)}グループ</strong><small>所属情報の日付に注意</small></button>
      <button type="button" class="stat-card" data-politics-section="elections"><span>次の選挙</span><strong>2027年</strong><small>投票日は未発表</small></button>
    </div>

    ${state.data?.council ? councilPreview(state.data.council) : ""}

    <div class="section">
      <div class="section-head"><div><h2>何を見たい？</h2><p>知りたいことから選べます</p></div></div>
      <div class="politics-menu-grid">
        <button type="button" class="politics-menu-card" data-politics-section="mayor"><span>👤</span><strong>市長って誰？</strong><small>任期・経歴を見る</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="members"><span>👥</span><strong>議員19人を見る</strong><small>所属委員会・質問テーマ</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="factions"><span>🤝</span><strong>会派って何？</strong><small>議会の中のグループ</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="committees"><span>🔎</span><strong>委員会って何？</strong><small>分野ごとの担当</small></button>
        <button type="button" class="politics-menu-card" data-politics-section="money"><span>💰</span><strong>議員活動に使うお金</strong><small>政務活動費を分かりやすく</small></button>
        <button type="button" class="politics-menu-card wide" data-politics-section="glossary"><span>📚</span><strong>役所・議会ことば図鑑</strong><small>難しい言葉をやさしく</small></button>
      </div>
    </div>

    <details class="quiz-card">
      <summary>🦖 10秒クイズ：市長が提案すれば、何でもすぐ決まる？</summary>
      <div><strong>答え：すぐに決まるとは限りません。</strong><p>予算や条例は、市議会の決定が必要な場合があります。のおがた日和では、市長側の提案と市議会の決定を分けて表示します。</p></div>
    </details>
  </section>`;
}

function mayorView() {
  const m = state.politics.mayor || {};
  const election = state.politics.elections?.items?.find((x) => /市長/.test(x.name)) || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">市長</p><h1>${esc(m.name || "市長")}</h1><p>${esc(m.reading || "")} ${m.term ? `・${esc(m.term)}` : ""}</p></div>
    ${guideBubble("市長は、市の仕事全体を進める責任者です。ただし、予算や条例などは市議会の決定が必要です。")}
    <div class="card info-card"><h2>基本情報</h2><p><strong>氏名：</strong>${esc(m.name || "")}市長</p><p><strong>何期目：</strong>${esc(m.term || "確認中")}</p><p><strong>今の任期が終わる日：</strong>${esc(election.termEnd || m.termEnd || "確認中")}</p><p class="muted">選挙の投票日は現時点で公式発表されていません。</p></div>
    <div class="section"><div class="section-head"><h2>市の資料で確認できた経歴</h2></div><div class="timeline">${(m.career || []).map((x) => `<div class="timeline-item"><strong>${esc(x.date)}</strong><p>${esc(x.label)}</p><small>${esc(x.source)}</small></div>`).join("")}</div></div>
    <div class="card info-card"><h2>掲載している経歴について</h2><p>${esc(m.careerNote || "確認できる公式資料だけを掲載します。")}</p>${guideBubble("確認できない経歴は、推測で追加しません。")}</div>
    ${politicsSourceLinks(m.sources)}
  </section>`;
}

function membersView() {
  const c = state.politics.council || {};
  const members = c.members || [];
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">直方市議会</p><h1>直方市議会の議員</h1><p>2026年6月定例会で、一般質問として通告したテーマを確認できます。</p></div>
    ${guideBubble("議員を選ぶと、所属委員会と2026年6月定例会の質問テーマを見られます。")}
    <div class="card info-card"><div class="split-head"><div><span class="pill verified">市の議員名簿</span><p><strong>議長：</strong>${esc(c.chair || "")}</p><p><strong>副議長：</strong>${esc(c.viceChair || "")}</p></div><strong>${Number(c.seats || members.length)}人</strong></div><p class="muted">名簿の更新日：${esc(c.membersSourceUpdated || "")}</p>${sourceLink(c.membersSourceUrl, "市の議員名簿を見る")}</div>
    <div class="section"><div class="section-head"><h2>議員一覧</h2></div><div class="member-list">${members.map((m) => `<button class="member-card" type="button" data-politician="${esc(m.name)}"><div><span class="pill ${m.role !== "議員" ? "verified" : ""}">${esc(m.role)}</span><h3>${esc(m.name)}</h3><p>${esc(m.committee || "委員会情報なし")}</p></div><div class="member-meta">${m.recentQuestions?.length ? `<span>${m.recentQuestions.length}件<br><small>6月定例会の質問</small></span>` : `<span>—<br><small>6月定例会の一覧には記載なし</small></span>`}<b aria-hidden="true">›</b></div></button>`).join("")}</div></div>
    <div class="card info-card"><h2>この一覧に質問が載っていない場合</h2><p>ここに表示しているのは、2026年6月定例会の一般質問通告一覧だけです。議員の活動全体を示すものではありません。</p>${guideBubble("一つの資料だけで、議員の活動全体を評価しません。")}</div>
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
      <div class="card info-card"><small>所属委員会</small><strong>${esc(m.committee || "確認できず")}</strong></div>
      ${m.steering ? `<div class="card info-card"><small>議会運営委員会</small><strong>${esc(m.steering)}</strong></div>` : ""}
      <div class="card info-card"><small>会派</small><strong>${esc(faction?.name || "公式一覧から確認できず")}</strong></div>
    </div>
    ${faction ? `<div class="caution-card"><strong>会派所属は${esc(politicsJapaneseDate(state.politics.factions.membershipBasisDate))}時点</strong><p>直方市の会派一覧で確認した所属です。現在の所属と異なる場合があります。</p></div>` : ""}
    <div class="section"><div class="section-head"><div><h2>2026年6月の一般質問</h2><p>${esc(m.recentQuestionsLabel || "2026年6月定例会")}</p></div></div>${m.recentQuestions?.length ? `<div class="question-topic-list">${m.recentQuestions.map((q) => `<div class="topic-card"><span>🙋</span><p>${esc(q)}</p></div>`).join("")}</div>` : `<div class="card info-card"><p>2026年6月の一般質問通告一覧に、この議員の記載はありませんでした。</p><p class="muted">これは「活動していない」という意味ではありません。</p></div>`}${sourceLink(c.questionsSourceUrl, "2026年6月の一般質問通告一覧")}</div>
    <div class="card info-card"><h2>経歴・当選回数</h2><p>${esc(c.historyNote || "現在の市の議員名簿だけでは確認できません。")}</p>${guideBubble("確認できない経歴や当選回数は、推測で追加しません。")}</div>
    ${sourceLink(c.membersSourceUrl, "市の議員名簿を見る")}
  </section>`;
}

function factionsView() {
  const f = state.politics.factions || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">会派</p><h1>議会の中の「チーム」</h1><p>正式名称だけ見ても分かりにくいので、まず意味から。</p></div>
    ${guideBubble("会派は、議会の中で一緒に活動するグループです。政党と同じとは限りません。")}
    <div class="caution-card"><strong>⚠️ 所属情報の日付に注意</strong><p>${esc(f.warning || "")}</p></div>
    <div class="faction-list">${(f.items || []).map((x) => `<div class="card faction-card"><div class="split-head"><div><small>会派</small><h2>${esc(x.name)}</h2></div><span class="pill">${x.members?.length || 0}人</span></div><p><strong>代表：</strong>${esc(x.representative || "")}</p><div class="name-chips">${(x.members || []).map((n) => `<span>${esc(n)}</span>`).join("")}</div></div>`).join("")}</div>
    ${sourceLink(f.currentCountSourceUrl, "市の会派数を見る")}${sourceLink(f.membershipSourceUrl, "市の会派所属一覧を見る")}
  </section>`;
}

function committeesView() {
  const data = state.politics.committees || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">委員会</p><h1>分野ごとに詳しく調べる委員会</h1><p>市の仕事を分野ごとに分担して調べます。</p></div>
    ${guideBubble("議員全員で細かく調べる前に、分野ごとの委員会で詳しく確認します。")}
    <div class="committee-list">${(data.items || []).map((x) => `<div class="card committee-card"><span class="easy-label">かんたんに言うと</span><h2>${esc(x.easy)}</h2><p class="formal-name">正式名称：${esc(x.name)}</p><div class="name-chips">${(x.members || []).map((n) => `<span>${esc(n)}</span>`).join("")}</div></div>`).join("")}</div>
    ${sourceLink(data.sourceUrl, "市の委員会一覧を見る")}
  </section>`;
}

function electionsView() {
  const e = state.politics.elections || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">🗳️ 選挙</p><h1>次の市長選・市議選は？</h1><p>任期満了日は確認できます。次回選挙の投票日は、まだ公式発表されていません。</p></div>
    ${guideBubble("任期が終わる日と投票日は同じとは限りません。投票日が未発表なら、そのまま未発表と表示します。")}
    <div class="election-list">${(e.items || []).map((x) => `<div class="card election-card"><span class="pill verified">市の資料で確認</span><h2>${esc(x.name)}</h2><div class="election-date"><small>任期が終わる日</small><strong>${esc(x.termEnd)}</strong></div><div class="election-date"><small>投票日</small><strong>${x.scheduledDate ? esc(x.scheduledDate) : "まだ公式発表なし"}</strong></div></div>`).join("")}</div>
    <div class="card beginner-card"><h2>そもそも「任期」って？</h2><p>その役職を担当する期間のこと。「任期満了日」は今の期間がいったん終わる日です。</p><p><strong>大事：</strong>任期満了日と選挙の投票日は同じとは限りません。</p></div>
    ${sourceLink(e.sourceUrl, "市の今後の選挙予定を見る")}
  </section>`;
}

function politicalMoneyView() {
  const m = state.politics.politicalMoney || {};
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">💰 議員活動に使うお金</p><h1>政務活動費とは？</h1><p>議員が調査や政策研究に使う公費です。</p></div>
    ${guideBubble("議員が自由に使えるお金ではありません。使い道の基準があり、報告も必要です。")}
    <div class="card money-hero"><small>議員1人あたり</small><strong>年 ${Number(m.annualPerMember || 0).toLocaleString("ja-JP")}円</strong><span>月額換算 ${Number(m.monthlyPerMember || 0).toLocaleString("ja-JP")}円</span></div>
    <div class="card info-card"><h2>かんたんに言うと</h2><p>${esc(m.easy || "")}</p><p><strong>議員報酬とは別のお金です。</strong>何に使っていいかルールがあります。</p></div>
    <div class="section"><div class="section-head"><h2>何に使える？</h2></div><div class="name-chips large">${(m.uses || []).map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>
    <div class="card info-card"><h2>使った後は？</h2><p>${esc(m.report || "")}</p><p>直方市の案内では、年度終了後4月30日までに収支報告書を提出し、領収書などの証拠書類を添付する必要があります。</p></div>
    <div class="card beginner-card"><h2>「年度」の数え方</h2><p>2026年度なら2026年4月1日〜2027年3月31日。その年度が終わった後の4月に報告する、という流れです。</p></div>
    ${sourceLink(m.sourceUrl, "政務活動費の公式ページ")}
  </section>`;
}

function glossaryView() {
  const list = state.politics.glossary || [];
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">📚 役所・議会ことば図鑑</p><h1>「それ何？」から始める</h1><p>難しい言葉を、ふだんの言葉から説明します。</p></div>
    ${guideBubble("分からない言葉は、その場でかんたんに確認できます。正式名称も一緒に表示します。")}
    <div class="glossary-list">${list.map((x, i) => `<details class="glossary-card" ${i === 0 ? "open" : ""}><summary><div><span class="easy-label">かんたんに言うと</span><strong>${esc(x.easy)}</strong><small>正式名称：${esc(x.formal)}</small></div><span class="plus" aria-hidden="true">＋</span></summary><div class="glossary-body"><p>${esc(x.explain)}</p><div class="guide-mini"><span aria-hidden="true">🦖</span><p>${esc(x.guide)}</p></div><div class="example-box"><small>直方での例</small><strong>${esc(x.example)}</strong></div></div></details>`).join("")}</div>
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
  const preview = `<div class="section politics-preview"><div class="section-head"><div><h2>🏛 市長・市議会を見る</h2><p>名前を知らなくても大丈夫</p></div></div><button class="politics-preview-card" type="button" data-tab="politics"><div><span class="pill verified">市の人と仕組み</span><h3>誰が、何を、どう決める？</h3><p>市長、市議会議員、選挙、会派、委員会を分かりやすく確認できます。</p></div><span aria-hidden="true">›</span></button></div>`;
  return html.replace(/<\/section>\s*$/, `${preview}</section>`);
};

const baseAnswerForPolitics = answerFor;
answerFor = function answerForWithPolitics(question) {
  const q = normalizeQuery(question);
  const p = state.politics;
  const glossary = p.glossary || [];
  const term = glossary.find((x) => q.includes(normalizeQuery(x.formal)) || q.includes(normalizeQuery(x.easy).slice(0, 5)));
  if (/市長/.test(q) && /誰|だれ|名前|氏名|現在|今の|任期|何期/.test(q) && p.mayor) {
    return `<div class="card answer-card" role="status"><span class="pill verified">直方市の資料で確認</span><h3>今の直方市長は ${esc(p.mayor.name)}</h3><p>${esc(p.mayor.term || "任期情報を確認中です")}。</p><button class="text-button" type="button" data-tab="politics" data-open-politics="mayor">市長ページで詳しく見る →</button></div>`;
  }
  if (/市長/.test(q)) {
    return `<div class="card answer-card" role="status"><span class="pill">確認できませんでした</span><h3>その市長に関する質問は、現在取り込んでいる資料では確認できません</h3><p>質問に合わない基本情報を、答えの代わりには表示しません。</p><button class="text-button" type="button" data-tab="politics" data-open-politics="mayor">参考として市長の基本情報を見る →</button></div>`;
  }
  if (/選挙|市議選|市長選|任期/.test(q) && /いつ|次|日|予定|投票|満了/.test(q)) {
    const mayorE = p.elections?.items?.[0]; const councilE = p.elections?.items?.[1];
    return `<div class="card answer-card"><span class="pill verified">市の資料から</span><h3>次の市長選・市議選</h3><p>市長の任期満了は ${esc(mayorE?.termEnd || "確認中")}、市議会議員は ${esc(councilE?.termEnd || "確認中")}。投票日は現時点で公式発表されていません。</p><p class="muted">任期満了日と投票日は別です。</p></div>`;
  }
  if (term && /何|なに|意味|とは|教え|わから|どういう/.test(q)) {
    return `<div class="card answer-card"><span class="pill">正式名称：${esc(term.formal)}</span><h3>${esc(term.easy)}</h3><p>${esc(term.explain)}</p><div class="guide-mini"><span>🦖</span><p>${esc(term.guide)}</p></div></div>`;
  }
  return baseAnswerForPolitics(question);
};

document.addEventListener("click", (event) => {
  const reloadPolitics = event.target.closest("[data-politics-reload]");
  if (reloadPolitics) {
    state.politicsLoading = true;
    state.politicsLoadError = false;
    render();
    loadPoliticsData();
    return;
  }
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
