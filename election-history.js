const ELECTION_HISTORY_FALLBACK = { election: null, candidates: [], labels: {} };
state.electionHistory = ELECTION_HISTORY_FALLBACK;
state.electionHistoryLoading = true;

async function loadElectionHistory() {
  try {
    const response = await fetch(`./data/election-2023.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.electionHistory = await response.json();
  } catch (error) {
    console.warn("Election history load failed", error);
    state.electionHistory = ELECTION_HISTORY_FALLBACK;
  } finally {
    state.electionHistoryLoading = false;
    render();
  }
}

function electionRecordForMember(name) {
  return (state.electionHistory?.candidates || []).find((x) => x.currentName === name) || null;
}

function formatVotes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "確認できず";
  return Number.isInteger(n) ? `${n.toLocaleString("ja-JP")}票` : `${n.toLocaleString("ja-JP", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}票`;
}

function electionStatusExplanation(record) {
  if (!record) return "";
  if (record.statusBefore === "新") return "2023年市議選では『新人』として立候補し、当選しました。";
  if (record.statusBefore === "元") return "2023年市議選では『元職』として立候補し、当選しました。以前に議員経験があったことは確認できますが、この資料だけでは通算何期目かまでは分かりません。";
  if (record.statusBefore === "現") return "2023年市議選では『現職』として立候補し、当選しました。2023年より前から議員だったことは確認できますが、この資料だけでは通算何期目かまでは分かりません。";
  return "";
}

function electionHistoryCard(record) {
  if (!record) return `<div class="card info-card"><h2>2023年市議選</h2><p>現在の議員名と2023年の公式選挙資料を安全に対応付けできませんでした。推測では補いません。</p></div>`;
  return `<div class="card election-history-card">
    <div class="split-head"><div><span class="pill verified">2023年公式選挙資料</span><h2>この人、前回の市議選では？</h2></div><strong>${esc(record.result === "当" ? "当選" : "落選")}</strong></div>
    <p class="history-note">${esc(electionStatusExplanation(record))}</p>
    <div class="election-fact-grid">
      <div><small>得票</small><strong>${esc(formatVotes(record.votes))}</strong></div>
      <div><small>立候補時の区分</small><strong>${esc(record.statusBefore)}</strong><span>${esc(state.electionHistory.labels?.[record.statusBefore] || "")}</span></div>
      <div><small>2023年4月時点の年齢</small><strong>${Number(record.age)}歳</strong><span>現在の年齢ではありません</span></div>
      <div><small>立候補届出時の党派</small><strong>${esc(record.party)}</strong><span>現在の所属を示すものではありません</span></div>
      <div class="wide"><small>立候補届出時の職業</small><strong>${esc(record.occupation)}</strong><span>2023年4月16日の届出資料に書かれた内容です</span></div>
    </div>
    ${guideBubble("『現』って書いてあるから何期目か分かる？ 実は分からない。『その時すでに現職だった』までは言えるけど、通算期数は別の過去資料が必要です。")}
  </div>`;
}

const originalMemberViewForElectionHistory = memberView;
memberView = function memberViewWithElectionHistory() {
  const c = state.politics.council || {};
  const m = (c.members || []).find((x) => x.name === state.selectedPolitician);
  if (!m) return membersView();
  const faction = factionForMember(m.name);
  const record = electionRecordForMember(m.name);
  return `<section class="page politics-page"><button class="back-button" type="button" data-politics-section="members">‹ 議員一覧へ</button><div class="hero"><p class="eyebrow">${esc(m.role)}</p><h1>${esc(m.name)}</h1><p>${esc(m.nameNote || "")}</p></div>
    <div class="profile-facts">
      <div class="card info-card"><small>役割</small><strong>${esc(m.role)}</strong></div>
      <div class="card info-card"><small>担当チーム</small><strong>${esc(m.committee || "確認できず")}</strong></div>
      ${m.steering ? `<div class="card info-card"><small>議会の進め方チーム</small><strong>${esc(m.steering)}</strong></div>` : ""}
      <div class="card info-card"><small>会派</small><strong>${esc(faction?.name || "公式一覧から確認できず")}</strong></div>
    </div>
    ${faction ? `<div class="caution-card"><strong>⚠️ 会派の所属は基準日に注意</strong><p>この所属は直方市公式の会派一覧（${esc(state.politics.factions.membershipBasisDate)}現在）を基にしています。現在の所属と同じとは断定しません。</p></div>` : ""}

    ${electionHistoryCard(record)}

    <div class="section"><div class="section-head"><div><h2>最近、何を質問した？</h2><p>${esc(m.recentQuestionsLabel || "2026年6月定例会")}</p></div></div>${m.recentQuestions?.length ? `<div class="question-topic-list">${m.recentQuestions.map((q) => `<div class="topic-card"><span>🙋</span><p>${esc(q)}</p></div>`).join("")}</div>` : `<div class="card info-card"><p>2026年6月定例会の一般質問通告一覧では、この議員の一般質問を確認できませんでした。</p><p class="muted">これは「活動していない」という意味ではありません。</p></div>`}${sourceLink(c.questionsSourceUrl, "2026年6月 一般質問の公式一覧")}</div>

    <div class="card info-card"><h2>じゃあ「何期目」なの？</h2><p>${record ? esc(electionStatusExplanation(record)) : esc(c.historyNote || "現在の資料だけでは確認できません。")}</p><p class="muted">MYTOWNでは、過去の選挙資料をさかのぼって連続して確認できた場合にだけ、期数を表示します。</p>${guideBubble("ここは盛らない。『たぶん3期目』みたいなのはナシ。確認できた選挙履歴を1個ずつ積み上げます。")}</div>
    ${sourceLink(c.membersSourceUrl, "現在の公式議員名簿")}
    ${sourceLink(state.electionHistory?.election?.resultSourceUrl, "2023年市議選・確定開票結果")}
    ${sourceLink(state.electionHistory?.election?.filingSourceUrl, "2023年市議選・立候補届出資料")}
  </section>`;
};

function electionCandidateRow(candidate) {
  const resultClass = candidate.result === "当" ? "won" : "lost";
  return `<div class="candidate-row ${resultClass}">
    <div class="candidate-order">${Number(candidate.order)}</div>
    <div class="candidate-main"><div><strong>${esc(candidate.electionName)}</strong>${candidate.currentName ? `<span class="current-member-badge">現職議員</span>` : ""}</div><small>${esc(candidate.party)} ・ ${esc(candidate.statusBefore)}（${esc(state.electionHistory.labels?.[candidate.statusBefore] || "") }）</small></div>
    <div class="candidate-result"><strong>${esc(formatVotes(candidate.votes))}</strong><span>${candidate.result === "当" ? "当選" : "落選"}</span></div>
  </div>`;
}

const originalElectionsViewForElectionHistory = electionsView;
electionsView = function electionsViewWithHistory() {
  const e = state.politics.elections || {};
  const history = state.electionHistory || ELECTION_HISTORY_FALLBACK;
  const past = history.election;
  return `<section class="page politics-page">${politicsBackButton()}<div class="hero"><p class="eyebrow">🗳️ 選挙</p><h1>次の選挙と、前回の結果</h1><p>「次いつ？」だけじゃなく、「前回どう選ばれた？」まで透明にします。</p></div>
    ${guideBubble("『任期満了日』は投票日じゃない。それと、前回の得票は“人気ランキング”じゃなく、その選挙で実際に投じられた票の記録として見よう。")}
    <div class="election-list">${(e.items || []).map((x) => `<div class="card election-card"><span class="pill verified">公式確認</span><h2>${esc(x.name)}</h2><div class="election-date"><small>任期が終わる日</small><strong>${esc(x.termEnd)}</strong></div><div class="election-date"><small>投票日</small><strong>${x.scheduledDate ? esc(x.scheduledDate) : "まだ公式発表なし"}</strong></div></div>`).join("")}</div>
    <div class="card beginner-card"><h2>そもそも「任期」って？</h2><p>その役職を担当する期間のこと。「任期満了日」は今の期間がいったん終わる日です。</p><p><strong>大事：</strong>任期満了日と選挙の投票日は同じとは限りません。</p></div>
    ${sourceLink(e.sourceUrl, "直方市・今後の選挙予定")}

    ${past ? `<div class="section election-history-section"><div class="section-head"><div><h2>2023年の市議選を振り返る</h2><p>確定開票結果＋立候補届出資料</p></div></div>
      <div class="card election-overview-card"><div><small>投票日</small><strong>2023年4月23日</strong></div><div><small>議席</small><strong>${Number(past.seats)}人</strong></div><div><small>立候補</small><strong>${Number(past.candidateCount)}人</strong></div><div><small>有効投票</small><strong>${Number(past.validVotes).toLocaleString("ja-JP")}票</strong></div></div>
      <div class="card info-card"><h2>「新・現・元」って何？</h2><div class="status-explain"><p><strong>新</strong>＝${esc(history.labels?.新 || "新人")}</p><p><strong>現</strong>＝${esc(history.labels?.現 || "現職")}</p><p><strong>元</strong>＝${esc(history.labels?.元 || "元職")}</p></div>${guideBubble("『現』＝何期目、ではないよ。前回の選挙時点ですでに議員だった、という意味。")}</div>
      <div class="card info-card"><h2>なんで票が「903.421票」みたいに小数になるの？</h2><p>${esc(past.fractionalVotes?.easy || "")}</p><p>${esc(past.fractionalVotes?.explain || "")}</p>${sourceLink(past.fractionalVotes?.sourceUrl, past.fractionalVotes?.sourceLabel || "按分票の説明")}</div>
      <div class="candidate-list"><div class="candidate-list-head"><strong>候補者24人</strong><span>公式の届出順</span></div>${(history.candidates || []).map(electionCandidateRow).join("")}</div>
      <div class="card info-card"><h2>この表の年齢・職業は「現在」ではありません</h2><p>${esc(past.note || "")}</p>${guideBubble("2023年の資料を2026年のプロフィールみたいに見せたらアウト。いつ時点の情報かを必ずセットで出します。")}</div>
      ${sourceLink(past.resultSourceUrl, "2023年市議選・確定開票結果")}${sourceLink(past.filingSourceUrl, "2023年市議選・立候補届出資料")}
    </div>` : `<div class="card info-card"><p>2023年市議選の公式履歴データを読み込めませんでした。</p></div>`}
  </section>`;
};

loadElectionHistory();
