/* MYTOWN in-app bulletin reader. Keeps the official PDF inside the app when supported. */
"use strict";

(() => {
  function bulletinData() {
    return state.data?.bulletin || {};
  }

  function bulletinIssue() {
    return bulletinData().currentIssue || null;
  }

  function formatBulletinDate(value = "") {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
  }

  function bulletinDisplayTitle(issue = {}) {
    const title = issue.title || "最新号";
    const match = String(issue.published || "").match(/^(\d{4})-(\d{2})-/);
    if (!match || /\d{4}年/.test(title)) return title;
    return `${title}（${Number(match[1])}年${Number(match[2])}月号）`;
  }

  function normalizeBulletinLabel(value = "") {
    return String(value || "市報ページ")
      .replace(/\s*[-－]\s*/g, "〜")
      .replace(/\s+ページ/g, "ページ");
  }

  function currentIssuePdfUrl(value, issue) {
    // The official page contains old, unnamed PDF anchors. Reject them even
    // when a stale data file incorrectly assigns them to the current issue.
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.host !== "www.city.nogata.fukuoka.jp") return null;
      const match = url.pathname.match(/^\/library\/data\/siseijouhou\/PDF\/shihounoogata\/R0*(\d+)\/(?:(\d{2}|\d{4})\/)?(\d{2})(\d{2})(\d{2})_shiho_web_(all|\d{1,3}(?:-\d{1,3})?)\.pdf$/i);
      if (!match) return null;
      const [, directoryYear, directoryMonth, fileYear, fileMonth, day] = match;
      const eraYear = Number(fileYear);
      const month = Number(fileMonth);
      if (Number(directoryYear) !== eraYear || month < 1 || month > 12) return null;
      if (directoryMonth && directoryMonth !== fileMonth && directoryMonth !== `${fileYear}${fileMonth}`) return null;
      const date = new Date(Date.UTC(2018 + eraYear, month - 1, Number(day)));
      if (date.getUTCFullYear() !== 2018 + eraYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== Number(day)) return null;
      if (`R${eraYear}-${fileMonth}` !== issue.issueKey) return null;
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return null;
    }
  }

  function bulletinDocuments() {
    const issue = bulletinIssue();
    if (!issue) return [];
    const docs = [];
    const seen = new Set();
    const wholePdfUrl = currentIssuePdfUrl(issue.wholePdfUrl, issue);
    if (wholePdfUrl && /_all\.pdf$/i.test(wholePdfUrl)) {
      docs.push({ label: "全ページ", title: bulletinDisplayTitle(issue), url: wholePdfUrl });
      seen.add(wholePdfUrl);
    }
    for (const page of bulletinData().pages || []) {
      if (!page?.pdfUrl || page.issueKey !== issue.issueKey) continue;
      const url = currentIssuePdfUrl(page.pdfUrl, issue);
      if (!url || seen.has(url) || /_all\.pdf$/i.test(url)) continue;
      seen.add(url);
      docs.push({
        label: normalizeBulletinLabel(page.pageLabel),
        title: page.sourceDescription || page.title || "市報",
        url,
      });
    }
    return docs;
  }

  function selectedBulletinDocument() {
    const docs = bulletinDocuments();
    if (!docs.length) return null;
    const selected = docs.find((doc) => doc.url === state.bulletinReaderUrl) || docs[0];
    state.bulletinReaderUrl = selected.url;
    return selected;
  }

  function bulletinReaderView() {
    const issue = bulletinIssue();
    const docs = bulletinDocuments();
    const selected = selectedBulletinDocument();
    if (!issue || !selected) {
      const archiveUrl = bulletinData().archiveUrl;
      return `<section class="page v2-page v2-inner-page bulletin-reader-page"><button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button><div class="bulletin-reader-hero"><p class="eyebrow">市報のおがた</p><h1>市報を読む</h1><p>直方市が公開している市報を案内します。</p></div><div class="card info-card"><h2>最新号を表示できませんでした</h2><p>このアプリでは、最新号のPDF情報を確認できませんでした。</p>${archiveUrl ? `<a class="source-link" href="${esc(archiveUrl)}" target="_blank" rel="noopener noreferrer">直方市の市報ページを開く <span aria-hidden="true">↗</span></a>` : ""}</div></section>`;
    }

    return `<section class="page v2-page v2-inner-page bulletin-reader-page">
      <button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button>
      <div class="bulletin-reader-hero"><p class="eyebrow">市報のおがた</p><h1>${esc(bulletinDisplayTitle(issue))}</h1><p>直方市が公開した市報PDFです。この画面で読めない場合は、PDFを別画面で開けます。</p></div>
      <section class="bulletin-page-picker" aria-labelledby="bulletin-page-picker-title">
        <div class="bulletin-page-picker-head"><div><h2 id="bulletin-page-picker-title">読みたいページを選ぶ</h2><p>見出しから選べます</p></div><span>${docs.length}件</span></div>
        <div class="bulletin-page-buttons">${docs.map((doc) => `<button class="bulletin-page-button ${doc.url === selected.url ? "is-active" : ""}" type="button" data-bulletin-pdf="${esc(doc.url)}" data-bulletin-label="${esc(doc.label)}"><span>${esc(doc.label)}</span><strong>${esc(doc.title)}</strong><b aria-hidden="true">›</b></button>`).join("")}</div>
      </section>
      <div class="bulletin-reader-card">
        <div class="bulletin-reader-topline"><span data-bulletin-current-label>${esc(selected.label)}</span><small>${esc(issue.published ? `${formatBulletinDate(issue.published)}公開` : "直方市が公開")}</small></div>
        <p class="bulletin-reader-fallback">この画面で読めない場合は、<a href="${esc(selected.url)}" target="_blank" rel="noopener noreferrer" data-bulletin-fallback>PDFを別画面で開く ↗</a></p>
        <div class="bulletin-reader-frame-wrap"><iframe class="bulletin-reader-frame" src="${esc(selected.url)}" title="${esc(`${issue.title || "市報"} ${selected.label}`)}"></iframe></div>
      </div>
      <div class="bulletin-reader-actions">
        ${issue.sourceUrl ? `<a href="${esc(issue.sourceUrl)}" target="_blank" rel="noopener noreferrer">直方市の市報ページを開く ↗</a>` : ""}
        ${bulletinData().archiveUrl ? `<a href="${esc(bulletinData().archiveUrl)}" target="_blank" rel="noopener noreferrer">過去の市報を開く ↗</a>` : ""}
      </div>
    </section>`;
  }

  if (typeof v2LifeAndLatest === "function") {
    const baseLifeAndLatestForBulletin = v2LifeAndLatest;
    v2LifeAndLatest = function v2LifeAndLatestWithReader() {
      const html = baseLifeAndLatestForBulletin();
      return html.replace(/<a class="v2-bulletin-link"[^>]*>([\s\S]*?)<\/a>/, (_match, inner) => `<button class="v2-bulletin-link v2-bulletin-button" type="button" data-v2-action="bulletin">${inner.replace("↗", "›")}</button>`);
    };
  }

  if (typeof v2HandleAction === "function") {
    const baseHandleActionForBulletin = v2HandleAction;
    v2HandleAction = function handleBulletinAction(action) {
      if (action === "bulletin") {
        state.bulletinReaderUrl = bulletinIssue()?.wholePdfUrl || null;
        return v2SetRoute({ tab: "today", page: "bulletin", hash: "#bulletin" });
      }
      return baseHandleActionForBulletin(action);
    };
  }

  if (typeof v2ApplyHashRoute === "function") {
    const baseApplyHashRouteForBulletin = v2ApplyHashRoute;
    v2ApplyHashRoute = function applyBulletinHashRoute() {
      if (location.hash.replace("#", "") === "bulletin") {
        state.view = "tab";
        state.tab = "today";
        state.v2Page = "bulletin";
        state.selectedId = null;
        state.detailSection = null;
        return;
      }
      return baseApplyHashRouteForBulletin();
    };
  }

  const baseRenderForBulletin = render;
  render = function renderWithBulletinReader() {
    if (state.view === "tab" && state.tab === "today" && state.v2Page === "bulletin") {
      main.innerHTML = bulletinReaderView();
      window.scrollTo({ top: 0, behavior: "auto" });
      if (typeof v2SyncNav === "function") v2SyncNav();
      return;
    }
    return baseRenderForBulletin();
  };

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-bulletin-pdf]");
    if (!button) return;
    event.preventDefault();
    const url = button.dataset.bulletinPdf || "";
    const selected = bulletinDocuments().find((doc) => doc.url === url);
    if (!selected) return;
    state.bulletinReaderUrl = url;
    const frame = document.querySelector(".bulletin-reader-frame");
    const fallback = document.querySelector("[data-bulletin-fallback]");
    const label = document.querySelector("[data-bulletin-current-label]");
    if (frame) frame.src = url;
    if (frame) frame.title = `${bulletinIssue()?.title || "市報"} ${selected.label}`;
    if (fallback) fallback.href = url;
    if (label) label.textContent = selected.label;
    document.querySelectorAll("[data-bulletin-pdf]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
    document.querySelector(".bulletin-reader-card")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });

  v2ApplyHashRoute();
  render();
})();
