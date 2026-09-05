/*
 * のおがた日和 — イベントの保存・確認と、写真付き「まちレポ」導線。
 *
 * このファイルは静的配信で安全に動く範囲だけを実装する。
 * - イベント情報提供は、公開GitHub IssueへURLを渡す試験受付。
 * - 締切通知は、アプリを開いた時の案内と .ics カレンダー通知。
 * - 写真と位置情報はこのアプリのサーバーへ送信・保存しない。
 * - 市役所や議会への送信先は、確認済みの公式窓口だけを案内する。
 */
"use strict";

(() => {
  const CA_SAVED_EVENTS_KEY = "mytown-saved-events-v1";
  const CA_EVENT_TIPS_KEY = "mytown-event-tips-v1";
  const CA_REPO_ISSUE_URL = "https://github.com/yutateru6-collab/mytown/issues/new";
  const CA_REPORT_ROUTES_URL = "./data/civic-report-routes.json";

  const CA_ROUTE_FALLBACK = Object.freeze({
    verifiedOn: "2026-09-03",
    routes: {
      road: {
        label: "道路の穴・落下物・危険箇所",
        office: "道路緊急ダイヤル #9910／直方市 土木課",
        phone: "#9910",
        primaryUrl: "https://www.mlit.go.jp/road/dia/",
        secondaryUrl: "https://www.city.nogata.fukuoka.jp/shisei/_1235/_2853/_2308/_2323/_2326.html",
        note: "事故は110番へ。運転中は操作せず、安全な場所に停車してください。",
        photoTransfer: "mlit-line",
      },
      park: {
        label: "公園・遊具・ベンチ・街路樹",
        office: "直方市 都市計画課 公園街路係",
        phone: "0949-25-2200",
        primaryUrl: "https://www.city.nogata.fukuoka.jp/shisei/_1235/_2853/_2308/_2334/_2336.html",
        note: "公式フォームに写真添付欄があることは確認できていません。本文をコピーして進みます。",
        photoTransfer: "share-separately",
      },
      publicFacility: {
        label: "公共施設・案内表示・その他の設備",
        office: "直方市 お問い合わせ窓口",
        phone: "0949-25-2000",
        primaryUrl: "https://www.city.nogata.fukuoka.jp/_1118.html",
        note: "担当部署が分からない場合の入口です。緊急の連絡は電話を利用してください。",
        photoTransfer: "share-separately",
      },
      cityOpinion: {
        label: "市政への提案・改善アイデア",
        office: "直方市 市政へのアイデア・意見",
        phone: "0949-25-2000",
        primaryUrl: "https://www.city.nogata.fukuoka.jp/shisei/_1238/_2493/_2721.html",
        note: "市長に回覧後、担当部署で検討されますが、個別回答は行わないと案内されています。",
        photoTransfer: "share-separately",
      },
      council: {
        label: "議会への正式な請願・陳情",
        office: "直方市議会事務局",
        phone: "0949-25-2342",
        primaryUrl: "https://www.city.nogata.fukuoka.jp/sigikai/_1256/_2764.html",
        note: "陳情は紹介議員が不要です。日常の設備不具合は、まず管理担当へ知らせる方が直接的です。",
        photoTransfer: "not-applicable",
      },
    },
  });

  const CA_EVENT_FIELD_LABELS = Object.freeze({
    title: "イベント名",
    startDate: "開催日",
    endDate: "終了日",
    when: "日時",
    location: "場所",
    money: "費用",
    applicationDeadline: "申込期限",
    statusLabel: "状態",
  });

  let caRoutes = CA_ROUTE_FALLBACK;
  let caDialogReturnFocus = null;
  let caReportPhoto = null;
  let caReportPhotoUrl = "";
  let caReportCoordinates = null;

  function caEscape(value = "") {
    if (typeof esc === "function") return esc(value);
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function caSafeJson(value, fallback) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function caReadList(key) {
    try {
      const value = caSafeJson(localStorage.getItem(key) || "[]", []);
      return Array.isArray(value) ? value : [];
    } catch (_error) {
      return [];
    }
  }

  function caWriteList(key, list) {
    try {
      localStorage.setItem(key, JSON.stringify(list));
      return true;
    } catch (error) {
      console.warn("Local civic data could not be saved", error);
      return false;
    }
  }

  function caToast(message) {
    if (typeof showToast === "function") {
      showToast(message);
      return;
    }
    const target = document.querySelector("#toast");
    if (!target) return;
    target.textContent = message;
    target.classList.add("is-visible");
    window.setTimeout(() => target.classList.remove("is-visible"), 2600);
  }

  function caTokyoDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function caDayNumber(dateKey) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey || ""));
    if (!match) return null;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
  }

  function caDateOffset(dateKey, offset) {
    const day = caDayNumber(dateKey);
    if (day === null) return "";
    return new Date((day + offset) * 86400000).toISOString().slice(0, 10);
  }

  function caDateLabel(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return value || "未確認";
    return `${Number(match[2])}月${Number(match[3])}日`;
  }

  function caDateTimeLabel(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function caNormalizeUrl(value = "") {
    try {
      const url = new URL(value, location.href);
      url.hash = "";
      return `${url.origin.toLowerCase()}${url.pathname.replace(/\/$/, "")}${url.search}`;
    } catch (_error) {
      return String(value || "").trim().replace(/\/$/, "");
    }
  }

  function caAllEvents() {
    return Array.isArray(state?.data?.communityEvents?.events)
      ? state.data.communityEvents.events
      : [];
  }

  function caEventId(event = {}) {
    return String(event.id || event.sourceUrl || `${event.title || "event"}|${event.startDate || ""}`);
  }

  function caEventSnapshot(event = {}) {
    return {
      title: String(event.title || ""),
      startDate: String(event.startDate || ""),
      endDate: String(event.endDate || ""),
      when: String(event.when || ""),
      location: String(event.location || ""),
      money: String(event.money || ""),
      applicationDeadline: String(event.applicationDeadline || ""),
      statusLabel: String(event.statusLabel || event.status || ""),
      occurrences: Array.isArray(event.occurrences) ? event.occurrences.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)) : [],
    };
  }

  function caSnapshotChanges(previous = {}, current = {}) {
    return Object.keys(CA_EVENT_FIELD_LABELS).flatMap((key) => {
      const before = String(previous[key] || "").trim();
      const after = String(current[key] || "").trim();
      if (before === after) return [];
      return [{ key, label: CA_EVENT_FIELD_LABELS[key], before: before || "記載なし", after: after || "記載なし" }];
    });
  }

  function caFindCurrentEvent(saved = {}) {
    const source = caNormalizeUrl(saved.sourceUrl || "");
    return caAllEvents().find((event) => caEventId(event) === saved.id)
      || caAllEvents().find((event) => source && caNormalizeUrl(event.sourceUrl || "") === source)
      || caAllEvents().find((event) => event.title === saved.title && event.startDate === saved.startDate)
      || null;
  }

  function caSavedEvents() {
    return caReadList(CA_SAVED_EVENTS_KEY);
  }

  function caIsSaved(event) {
    const id = caEventId(event);
    const source = caNormalizeUrl(event.sourceUrl || "");
    return caSavedEvents().some((saved) => saved.id === id || (source && caNormalizeUrl(saved.sourceUrl || "") === source));
  }

  function caSyncSavedEvents() {
    const saved = caSavedEvents();
    let changed = false;
    const next = saved.map((item) => {
      const current = caFindCurrentEvent(item);
      if (!current) return item;
      const latestSnapshot = caEventSnapshot(current);
      const baseline = item.lastSnapshot || caEventSnapshot(item);
      const pendingChanges = caSnapshotChanges(baseline, latestSnapshot);
      const nextItem = {
        ...item,
        title: current.title || item.title,
        sourceUrl: current.sourceUrl || item.sourceUrl,
        latestSnapshot,
        latestCheckedAt: current.lastCheckedAt || state.data?.communityEvents?.generatedAt || "",
        contentStatus: current.contentStatus || item.contentStatus || "",
        contentIssues: Array.isArray(current.contentIssues) ? current.contentIssues : (item.contentIssues || []),
        pendingChanges,
      };
      if (JSON.stringify(nextItem) !== JSON.stringify(item)) changed = true;
      return nextItem;
    });
    if (changed) caWriteList(CA_SAVED_EVENTS_KEY, next);
    return next;
  }

  function caSaveEvent(event) {
    const saved = caSavedEvents();
    const id = caEventId(event);
    const sourceUrl = event.sourceUrl || event.url || "";
    const existingIndex = saved.findIndex((item) => item.id === id || (sourceUrl && caNormalizeUrl(item.sourceUrl || "") === caNormalizeUrl(sourceUrl)));
    if (existingIndex >= 0) return saved[existingIndex];
    const snapshot = caEventSnapshot(event);
    const item = {
      id,
      ...snapshot,
      sourceUrl,
      publisherName: event.publisherName || event.organizerName || "",
      category: event.category || "イベント",
      tags: Array.isArray(event.tags) ? event.tags : [],
      occurrences: Array.isArray(event.occurrences) ? event.occurrences : [],
      savedAt: new Date().toISOString(),
      lastSnapshot: snapshot,
      latestSnapshot: snapshot,
      latestCheckedAt: event.lastCheckedAt || state.data?.communityEvents?.generatedAt || "",
      contentStatus: event.contentStatus || "",
      contentIssues: Array.isArray(event.contentIssues) ? event.contentIssues : [],
      pendingChanges: [],
      attendedAt: "",
    };
    saved.push(item);
    caWriteList(CA_SAVED_EVENTS_KEY, saved);
    return item;
  }

  function caRemoveSavedEvent(id) {
    const next = caSavedEvents().filter((item) => item.id !== id);
    caWriteList(CA_SAVED_EVENTS_KEY, next);
  }

  function caAcknowledgeSavedEvent(id) {
    const next = caSavedEvents().map((item) => {
      if (item.id !== id) return item;
      return {
        ...item,
        lastSnapshot: item.latestSnapshot || item.lastSnapshot,
        pendingChanges: [],
        acknowledgedAt: new Date().toISOString(),
      };
    });
    caWriteList(CA_SAVED_EVENTS_KEY, next);
  }

  function caMarkAttended(id) {
    const next = caSavedEvents().map((item) => item.id === id ? { ...item, attendedAt: new Date().toISOString() } : item);
    caWriteList(CA_SAVED_EVENTS_KEY, next);
  }

  function caReminderFor(item = {}) {
    const today = caDayNumber(caTokyoDateKey());
    const deadline = caDayNumber(item.applicationDeadline);
    const occurrenceKeys = Array.isArray(item.occurrences) ? item.occurrences.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort() : [];
    const nextOccurrence = occurrenceKeys.find((value) => caDayNumber(value) >= today);
    const startKey = nextOccurrence || item.startDate;
    const start = caDayNumber(startKey);
    if (today === null) return { tone: "neutral", label: "日程を確認", priority: 0 };
    if (deadline !== null) {
      const days = deadline - today;
      if (days === 0) return { tone: "danger", label: "申込期限は今日", priority: 100 };
      if (days <= 3) return { tone: "danger", label: `申込締切まであと${days}日`, priority: 90 - days };
      if (days <= 7) return { tone: "warning", label: `申込締切まであと${days}日`, priority: 70 - days };
      if (days < 0 && start !== null && start >= today) {
        const untilEvent = start - today;
        const eventLabel = untilEvent === 0 ? "今日開催" : untilEvent === 1 ? "明日開催" : `${caDateLabel(startKey)}開催`;
        return { tone: "muted", label: `受付終了・${eventLabel}`, priority: untilEvent <= 1 ? 50 : 10 };
      }
    }
    if (start !== null) {
      const days = start - today;
      if (days === 0) return { tone: "today", label: "今日開催", priority: 80 };
      if (days === 1) return { tone: "warning", label: "明日開催", priority: 70 };
      if (days > 1 && days <= 7) return { tone: "neutral", label: `開催まであと${days}日`, priority: 40 - days };
      if (days < 0 && !item.attendedAt) return { tone: "muted", label: "開催日を過ぎています", priority: 0 };
    }
    return { tone: "neutral", label: item.when || "日程を確認", priority: 0 };
  }

  function caSavedSummary(saved = caSyncSavedEvents()) {
    const reminders = saved.map((item) => ({ item, reminder: caReminderFor(item) })).sort((a, b) => b.reminder.priority - a.reminder.priority);
    return {
      count: saved.length,
      changed: saved.filter((item) => Array.isArray(item.pendingChanges) && item.pendingChanges.length).length,
      urgent: reminders.filter(({ reminder }) => reminder.priority >= 70).length,
      next: reminders[0] || null,
    };
  }

  function caRelatedEvents(saved) {
    const now = caTokyoDateKey();
    const savedTags = new Set(saved.tags || []);
    const ranked = caAllEvents()
      .filter((event) => caEventId(event) !== saved.id)
      .filter((event) => !event.endDate || event.endDate >= now)
      .map((event) => {
        const tagScore = (event.tags || []).filter((tag) => savedTags.has(tag)).length * 4;
        const categoryScore = event.category && event.category === saved.category ? 3 : 0;
        const locationScore = event.location && saved.location && event.location.includes(saved.location) ? 2 : 0;
        return { event, score: tagScore + categoryScore + locationScore };
      })
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || String(a.event.startDate || "").localeCompare(String(b.event.startDate || "")));
    const selected = [];
    const usedPublishers = new Set();
    ranked.forEach((candidate) => {
      const publisher = candidate.event.publisherName || candidate.event.organizerName || candidate.event.sourceUrl || "";
      if (selected.length < 3 && !usedPublishers.has(publisher)) {
        selected.push(candidate.event);
        usedPublishers.add(publisher);
      }
    });
    ranked.forEach((candidate) => {
      if (selected.length < 3 && !selected.includes(candidate.event)) selected.push(candidate.event);
    });
    return selected.slice(0, 3);
  }

  function caEnsureDialog() {
    let root = document.querySelector("#ca-dialog-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "ca-dialog-root";
    root.className = "ca-dialog-root";
    root.hidden = true;
    root.innerHTML = `<div class="ca-dialog-backdrop" data-ca-close></div><section class="ca-dialog" role="dialog" aria-modal="true" aria-labelledby="ca-dialog-title"><div class="ca-dialog-handle" aria-hidden="true"></div><header><h2 id="ca-dialog-title"></h2><button type="button" class="ca-dialog-close" data-ca-close aria-label="閉じる">×</button></header><div id="ca-dialog-body" class="ca-dialog-body"></div></section>`;
    document.body.appendChild(root);
    return root;
  }

  function caOpenDialog(title, html, className = "") {
    const root = caEnsureDialog();
    caDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = root.querySelector(".ca-dialog");
    dialog.className = `ca-dialog ${className}`.trim();
    root.querySelector("#ca-dialog-title").textContent = title;
    root.querySelector("#ca-dialog-body").innerHTML = html;
    root.hidden = false;
    document.body.classList.add("ca-dialog-open");
    requestAnimationFrame(() => {
      const first = root.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]");
      first?.focus();
    });
  }

  function caCloseDialog() {
    const root = document.querySelector("#ca-dialog-root");
    if (!root || root.hidden) return;
    root.hidden = true;
    root.querySelector("#ca-dialog-body").innerHTML = "";
    document.body.classList.remove("ca-dialog-open");
    if (caReportPhotoUrl) URL.revokeObjectURL(caReportPhotoUrl);
    caReportPhotoUrl = "";
    caReportPhoto = null;
    caReportCoordinates = null;
    caDialogReturnFocus?.focus?.();
    caDialogReturnFocus = null;
  }

  function caEventTipIssueUrl(eventUrl) {
    const body = [
      "## イベントURL",
      eventUrl,
      "",
      "## 確認事項",
      "- [ ] 公開ページまたは公開SNSのURLです",
      "- [ ] 個人の住所・電話番号などの非公開情報は含めていません",
      "",
      `アプリからの情報提供日時: ${new Date().toISOString()}`,
    ].join("\n");
    const params = new URLSearchParams({
      title: "イベント情報の提供",
      body,
      labels: "event-tip",
    });
    return `${CA_REPO_ISSUE_URL}?${params.toString()}`;
  }

  function caEventTipForm(prefill = "") {
    return `<div class="ca-intro-card"><span class="ca-intro-icon" aria-hidden="true">🎪</span><div><strong>現在はGitHubで試験受付中です</strong><p>主催者の公式ページや公開SNSのURLを送れます。日時・場所などは、公開情報を確認してから掲載候補にします。</p></div></div>
      <form id="ca-event-tip-form" class="ca-form">
        <label><span>イベントのURL</span><input name="eventUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://…" value="${caEscape(prefill)}" required></label>
        <button class="ca-primary-button" type="submit">GitHubで送る</button>
      </form>
      <div class="ca-note"><strong>GitHubアカウントが必要です</strong><p>送信先は公開GitHub Issueです。送ったURLも公開されます。個人情報や非公開の写真は送らないでください。</p></div>
      <button class="ca-secondary-button" type="button" data-ca-save-tip>この端末に下書き保存</button>`;
  }

  function caOpenEventTip(prefill = "") {
    caOpenDialog("このイベントも載せて！", caEventTipForm(prefill), "ca-dialog-medium");
  }

  function caChangeList(changes = []) {
    if (!changes.length) return "";
    return `<div class="ca-change-box"><strong>保存した後に変わった情報</strong><ul>${changes.map((change) => `<li><span>${caEscape(change.label)}</span><del>${caEscape(change.before)}</del><b>→</b><ins>${caEscape(change.after)}</ins></li>`).join("")}</ul></div>`;
  }

  function caRelatedMarkup(saved) {
    if (!saved.attendedAt) return "";
    const related = caRelatedEvents(saved);
    return `<div class="ca-related"><strong>参加した人に、次の候補</strong>${related.length ? `<div>${related.map((event) => `<a href="${caEscape(event.sourceUrl || "#")}" target="_blank" rel="noopener noreferrer"><span>${caEscape(caDateLabel(event.startDate))}</span><b>${caEscape(event.title || "イベント")}</b></a>`).join("")}</div>` : `<p>現在、関連する開催予定を確認できませんでした。</p>`}</div>`;
  }

  function caSavedEventsMarkup() {
    const saved = caSyncSavedEvents();
    if (!saved.length) {
      return `<div class="ca-empty"><span aria-hidden="true">🔖</span><h3>まだ保存したイベントはありません</h3><p>イベント一覧の「保存する」を押すと、締切や開催日をまとめて確認できます。</p></div>`;
    }
    return `<div class="ca-saved-explainer"><strong>見つけて終わりにしない</strong><p>アプリ内の締切案内と、カレンダー通知を組み合わせます。バックグラウンドのプッシュ通知はまだありません。</p></div>
      <div class="ca-saved-list">${saved.map((item) => {
        const reminder = caReminderFor(item);
        const latest = item.latestSnapshot || item.lastSnapshot || item;
        const issues = Array.isArray(item.contentIssues) ? item.contentIssues : [];
        return `<article class="ca-saved-card">
          <div class="ca-saved-card-head"><span class="ca-reminder ca-tone-${caEscape(reminder.tone)}">${caEscape(reminder.label)}</span>${item.pendingChanges?.length ? `<span class="ca-change-count">変更 ${item.pendingChanges.length}件</span>` : ""}</div>
          <h3>${caEscape(item.title || "イベント")}</h3>
          <dl>${latest.when ? `<div><dt>日時</dt><dd>${caEscape(latest.when)}</dd></div>` : ""}${latest.location ? `<div><dt>場所</dt><dd>${caEscape(latest.location)}</dd></div>` : ""}${latest.money ? `<div><dt>費用</dt><dd>${caEscape(latest.money)}</dd></div>` : ""}${latest.applicationDeadline ? `<div><dt>申込</dt><dd>${caEscape(caDateLabel(latest.applicationDeadline))}まで</dd></div>` : ""}</dl>
          ${issues.length ? `<div class="ca-data-warning"><strong>内容を再確認してください</strong><p>${caEscape(issues.join("／"))}</p></div>` : ""}
          ${caChangeList(item.pendingChanges || [])}
          <div class="ca-saved-actions">
            <button type="button" data-ca-calendar-id="${caEscape(item.id)}">カレンダーに追加</button>
            ${item.sourceUrl ? `<a href="${caEscape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">当日の変更を確認 ↗</a>` : ""}
            ${item.pendingChanges?.length ? `<button type="button" data-ca-ack-id="${caEscape(item.id)}">変更を確認済みにする</button>` : ""}
            ${item.attendedAt ? `<span class="ca-attended">参加済み</span>` : `<button type="button" data-ca-attended-id="${caEscape(item.id)}">参加した</button>`}
            <button class="ca-danger-link" type="button" data-ca-remove-id="${caEscape(item.id)}">保存を外す</button>
          </div>
          ${item.latestCheckedAt ? `<p class="ca-last-check">掲載情報の最終確認：${caEscape(caDateTimeLabel(item.latestCheckedAt))}</p>` : ""}
          ${caRelatedMarkup(item)}
        </article>`;
      }).join("")}</div>`;
  }

  function caOpenSavedEvents() {
    caOpenDialog("保存したイベント", caSavedEventsMarkup(), "ca-dialog-wide");
  }

  function caIcsEscape(value = "") {
    return String(value)
      .replaceAll("\\", "\\\\")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function caIcsDate(dateKey) {
    return String(dateKey || "").replaceAll("-", "");
  }

  function caIcsTimeRange(value = "") {
    const match = /(\d{1,2})[:時](\d{2})?\s*(?:〜|～|-|－|から)\s*(\d{1,2})[:時](\d{2})?/.exec(String(value));
    if (!match) return null;
    const startHour = Number(match[1]);
    const startMinute = Number(match[2] || 0);
    const endHour = Number(match[3]);
    const endMinute = Number(match[4] || 0);
    if (startHour > 23 || endHour > 23 || startMinute > 59 || endMinute > 59) return null;
    return {
      start: `${String(startHour).padStart(2, "0")}${String(startMinute).padStart(2, "0")}00`,
      end: `${String(endHour).padStart(2, "0")}${String(endMinute).padStart(2, "0")}00`,
    };
  }

  function caIcsEventBlock({ item, snapshot, dateKey, endDate, uid, nowStamp, description }) {
    const timeRange = caIcsTimeRange(snapshot.when);
    const dateLines = timeRange
      ? [`DTSTART;TZID=Asia/Tokyo:${caIcsDate(dateKey)}T${timeRange.start}`, `DTEND;TZID=Asia/Tokyo:${caIcsDate(dateKey)}T${timeRange.end}`]
      : [`DTSTART;VALUE=DATE:${caIcsDate(dateKey)}`, `DTEND;VALUE=DATE:${caIcsDate(caDateOffset(endDate || dateKey, 1))}`];
    return [
      "BEGIN:VEVENT",
      `UID:${uid}@mytown-nogata`,
      `DTSTAMP:${nowStamp}`,
      ...dateLines,
      `SUMMARY:${caIcsEscape(item.title || "直方のイベント")}`,
      snapshot.location ? `LOCATION:${caIcsEscape(snapshot.location)}` : "",
      description ? `DESCRIPTION:${caIcsEscape(description)}` : "",
      item.sourceUrl ? `URL:${caIcsEscape(item.sourceUrl)}` : "",
      "BEGIN:VALARM",
      "TRIGGER:-P1D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${caIcsEscape(`明日は「${item.title || "イベント"}」です。変更がないか掲載元を確認してください。`)}`,
      "END:VALARM",
      "END:VEVENT",
    ].filter(Boolean);
  }

  function caDownloadCalendar(item) {
    const snapshot = item.latestSnapshot || item.lastSnapshot || item;
    const today = caTokyoDateKey();
    const allOccurrenceDates = Array.isArray(snapshot.occurrences) && snapshot.occurrences.length
      ? snapshot.occurrences.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort()
      : Array.isArray(item.occurrences) ? item.occurrences.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort() : [];
    const occurrenceDates = allOccurrenceDates.filter((value) => value >= today);
    const startDate = snapshot.startDate || item.startDate;
    const dates = allOccurrenceDates.length ? occurrenceDates : (/^\d{4}-\d{2}-\d{2}$/.test(startDate || "") ? [startDate] : []);
    if (!dates.length) {
      caToast("開催日を確認できないため、カレンダーを作れませんでした");
      return;
    }
    const endDate = /^\d{4}-\d{2}-\d{2}$/.test(snapshot.endDate || "") ? snapshot.endDate : startDate;
    const uidBase = caEventId(item).replace(/[^a-zA-Z0-9.-]+/g, "-").slice(0, 90);
    const nowStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const description = [
      snapshot.when ? `日時: ${snapshot.when}` : "",
      snapshot.money ? `費用: ${snapshot.money}` : "",
      snapshot.applicationDeadline ? `申込期限: ${caDateLabel(snapshot.applicationDeadline)}` : "",
      item.sourceUrl ? `最新情報: ${item.sourceUrl}` : "",
    ].filter(Boolean).join("\n");
    const blocks = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//MYTOWN Nogata//Event Reminder//JA",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ].filter(Boolean);

    dates.forEach((dateKey, index) => {
      const eventEnd = occurrenceDates.length ? dateKey : endDate;
      blocks.push(...caIcsEventBlock({ item, snapshot, dateKey, endDate: eventEnd, uid: `${uidBase}-${index + 1}`, nowStamp, description }));
    });

    if (/^\d{4}-\d{2}-\d{2}$/.test(snapshot.applicationDeadline || "") && snapshot.applicationDeadline >= today) {
      blocks.push(
        "BEGIN:VEVENT",
        `UID:${uidBase}-deadline@mytown-nogata`,
        `DTSTAMP:${nowStamp}`,
        `DTSTART;VALUE=DATE:${caIcsDate(snapshot.applicationDeadline)}`,
        `DTEND;VALUE=DATE:${caIcsDate(caDateOffset(snapshot.applicationDeadline, 1))}`,
        `SUMMARY:${caIcsEscape(`申込締切：${item.title || "直方のイベント"}`)}`,
        item.sourceUrl ? `URL:${caIcsEscape(item.sourceUrl)}` : "",
        "BEGIN:VALARM",
        "TRIGGER:-P2D",
        "ACTION:DISPLAY",
        `DESCRIPTION:${caIcsEscape(`「${item.title || "イベント"}」の申込締切が近づいています。`)}`,
        "END:VALARM",
        "END:VEVENT",
      );
    }
    blocks.push("END:VCALENDAR", "");

    const blob = new Blob([blocks.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nogata-event-${dates[0]}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    caToast(dates.length > 1 ? `${dates.length}回分のカレンダーを作成しました` : "カレンダー用ファイルを作成しました");
  }

  function caReportForm() {
    return `<div class="ca-emergency-note"><strong>今すぐ人がけがをしそうな場合</strong><p>事故・事件は110番、火災・救急は119番へ。道路の穴・落下物などは #9910 でも24時間受け付けています。</p></div>
      <form id="ca-report-form" class="ca-form ca-report-form">
        <label><span>何が気になりますか？</span><select name="category" required><option value="park">公園・遊具・ベンチ・街路樹</option><option value="road">道路の穴・落下物・危険箇所</option><option value="publicFacility">公共施設・案内表示・その他の設備</option><option value="cityOpinion">市政への提案・改善アイデア</option></select></label>
        <label><span>写真（任意）</span><input id="ca-report-photo" name="photo" type="file" accept="image/*" capture="environment"><small>写真はこの端末内で確認するだけです。MYTOWNのサーバーには送信・保存しません。</small></label>
        <div id="ca-report-photo-preview" class="ca-photo-preview" hidden></div>
        <label><span>場所の目印</span><input name="locationText" type="text" autocomplete="street-address" placeholder="例：○○公園の入口近く"><small>場所の入力か「現在地を使う」の、どちらか一方が必要です。</small></label>
        <div class="ca-location-row"><button class="ca-secondary-button" type="button" data-ca-get-location>現在地を使う</button><span id="ca-location-status">位置情報は未使用です</span></div>
        <label><span>状況</span><textarea name="description" rows="5" maxlength="700" placeholder="例：ベンチの板が外れ、釘のような部分が出ています。子どもが触ると危ないです。" required></textarea></label>
        <label class="ca-check-row"><input name="danger" type="checkbox"><span>けがにつながる危険がある</span></label>
        <button class="ca-primary-button" type="submit">届け方を確認する</button>
      </form>
      <div class="ca-note"><strong>「担当議員」へ自動送信はしません</strong><p>直方市議会議員には地域別の公式な担当制が確認できないため、まず公園・道路などの管理担当へ正しく届けます。議会へ正式に要望する「陳情」の方法は別に案内します。</p></div>`;
  }

  function caOpenReport() {
    caReportPhoto = null;
    caReportCoordinates = null;
    caOpenDialog("まちの気になる場所を知らせる", caReportForm(), "ca-dialog-wide");
  }

  function caSelectedRoute(category) {
    return caRoutes?.routes?.[category] || CA_ROUTE_FALLBACK.routes.publicFacility;
  }

  function caReportText(formData, route) {
    const locationText = String(formData.get("locationText") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const coordinateText = caReportCoordinates
      ? `${caReportCoordinates.latitude.toFixed(6)}, ${caReportCoordinates.longitude.toFixed(6)}（精度 約${Math.round(caReportCoordinates.accuracy || 0)}m）`
      : "位置情報は添付していません";
    return [
      `【件名】${route.label}について`,
      "",
      `【場所の目印】${locationText || "記入なし"}`,
      `【位置情報】${coordinateText}`,
      `【状況】${description}`,
      `【危険性】${formData.get("danger") === "on" ? "けがにつながる危険があると感じます" : "緊急性は不明です"}`,
      `【写真】${caReportPhoto ? "撮影・選択済み（別途共有できる場合があります）" : "なし"}`,
      `【確認日時】${new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", dateStyle: "long", timeStyle: "short" }).format(new Date())}`,
      "",
      "現地と管理対象をご確認ください。",
    ].join("\n");
  }

  function caReportResultMarkup(category, reportText) {
    const route = caSelectedRoute(category);
    const council = caSelectedRoute("council");
    const secondary = route.secondaryUrl ? `<a class="ca-secondary-button" href="${caEscape(route.secondaryUrl)}" target="_blank" rel="noopener noreferrer">直方市の担当窓口も開く ↗</a>` : "";
    const danger = /【危険性】けがにつながる危険がある/.test(reportText)
      ? `<div class="ca-emergency-note"><strong>今すぐ人がけがをしそうな場合</strong><p>この画面から自動通報はされません。事故・事件は110番、火災・救急は119番へ連絡してください。</p></div>`
      : "";
    return `${danger}<div class="ca-route-summary"><span aria-hidden="true">📨</span><div><small>おすすめの届け先</small><h3>${caEscape(route.office)}</h3><p>${caEscape(route.note || "")}</p></div></div>
      <label class="ca-report-copy"><span>そのまま使える文面</span><textarea id="ca-report-output" rows="10" readonly>${caEscape(reportText)}</textarea></label>
      <div class="ca-result-actions">
        <button class="ca-primary-button" type="button" data-ca-copy-report>文面をコピー</button>
        <button class="ca-secondary-button" type="button" data-ca-share-report>共有先を選ぶ</button>
        <a class="ca-primary-link" href="${caEscape(route.primaryUrl)}" target="_blank" rel="noopener noreferrer">公式の届け先を開く ↗</a>
        ${secondary}
        ${route.phone ? `<a class="ca-phone-link" href="tel:${caEscape(route.phone.replace(/[^#0-9+]/g, ""))}">電話 ${caEscape(route.phone)}</a>` : ""}
      </div>
      <div class="ca-transfer-note"><strong>写真と共有先</strong><p>${route.photoTransfer === "mlit-line" ? "道路緊急ダイヤルの公式ページからLINE通報へ進むと、写真と位置情報を送れる案内があります。" : "共有ボタンを押した後、送信先は自分で選びます。直方市の確認済みフォームには写真添付欄があることを確認できないため、MYTOWNから自動送信はしません。"}</p></div>
      <details class="ca-council-details"><summary>市議会へ正式に要望する方法も見る</summary><p>設備の修繕依頼は、まず管理担当へ知らせるのが直接的です。行政対応や制度そのものについて議会へ正式に要望する場合は、誰でも陳情を提出できます。</p><a href="${caEscape(council.primaryUrl)}" target="_blank" rel="noopener noreferrer">請願・陳情の公式案内 ↗</a><span>議会事務局 ${caEscape(council.phone || "")}</span></details>
      <button class="ca-text-button" type="button" data-ca-report-again>内容を直す</button>`;
  }

  async function caCopyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      caToast("コピーしました");
      return true;
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      caToast(copied ? "コピーしました" : "コピーできませんでした");
      return copied;
    }
  }

  async function caShareReport(text) {
    if (!navigator.share) {
      await caCopyText(text);
      caToast("共有機能が使えないため、文面をコピーしました");
      return;
    }
    const payload = { title: "まちの気になる場所", text };
    if (caReportPhoto && navigator.canShare?.({ files: [caReportPhoto] })) payload.files = [caReportPhoto];
    try {
      await navigator.share(payload);
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Report share failed", error);
        caToast("共有できませんでした");
      }
    }
  }

  function caPreviewPhoto(file) {
    const preview = document.querySelector("#ca-report-photo-preview");
    if (!preview) return;
    if (caReportPhotoUrl) URL.revokeObjectURL(caReportPhotoUrl);
    caReportPhotoUrl = "";
    caReportPhoto = null;
    if (!file) {
      preview.hidden = true;
      preview.innerHTML = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      caToast("画像ファイルを選んでください");
      preview.hidden = true;
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      caToast("写真は15MB以下にしてください");
      preview.hidden = true;
      return;
    }
    caReportPhoto = file;
    caReportPhotoUrl = URL.createObjectURL(file);
    preview.hidden = false;
    preview.innerHTML = `<img src="${caEscape(caReportPhotoUrl)}" alt="選んだ現場写真の確認"><div><strong>${caEscape(file.name || "現場写真")}</strong><span>${Math.max(1, Math.round(file.size / 1024))}KB</span><button type="button" data-ca-remove-photo>写真を外す</button></div>`;
  }

  function caGetLocation() {
    const status = document.querySelector("#ca-location-status");
    if (!navigator.geolocation) {
      if (status) status.textContent = "この端末では位置情報を使えません";
      return;
    }
    if (status) status.textContent = "現在地を確認しています…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        caReportCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (status) status.textContent = `位置情報を取得しました（精度 約${Math.round(position.coords.accuracy)}m）`;
      },
      (error) => {
        caReportCoordinates = null;
        if (status) status.textContent = error.code === 1 ? "位置情報の利用が許可されませんでした" : "位置情報を取得できませんでした";
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  }

  function caFindEventForCard(card) {
    const title = card.querySelector("h3")?.textContent?.trim() || "";
    const sourceAnchor = Array.from(card.querySelectorAll("a[href]")).find((anchor) => /^https?:/.test(anchor.href));
    const source = sourceAnchor ? caNormalizeUrl(sourceAnchor.href) : "";
    return caAllEvents().find((event) => source && caNormalizeUrl(event.sourceUrl || "") === source)
      || caAllEvents().find((event) => event.title === title)
      || null;
  }

  function caLifecycleMarkup() {
    const steps = [
      ["1", "見つける"],
      ["2", "自分向けか判断"],
      ["3", "保存"],
      ["4", "締切を忘れない"],
      ["5", "カレンダー"],
      ["6", "当日の変更確認"],
      ["7", "次の場所・活動へ"],
    ];
    return `<section class="ca-lifecycle" aria-labelledby="ca-lifecycle-title"><div><small>見つけて終わりにしない</small><h2 id="ca-lifecycle-title">参加まで、参加した後まで</h2></div><ol>${steps.map(([number, label]) => `<li><span>${number}</span><b>${caEscape(label)}</b></li>`).join("")}</ol></section>`;
  }

  function caEnhanceEventsPage() {
    const page = document.querySelector(".v4-events-page");
    if (!page || page.dataset.caEnhanced === "true") return;
    page.dataset.caEnhanced = "true";

    const hero = page.querySelector(".v4-events-hero");
    hero?.insertAdjacentHTML("afterend", caLifecycleMarkup());

    const resultHead = page.querySelector(".v4-event-results-head");
    if (resultHead) {
      resultHead.insertAdjacentHTML("beforeend", `<button class="ca-saved-header-button" type="button" data-ca-open-saved>🔖 保存したイベント</button>`);
    }

    page.querySelectorAll(".v4-event-list-card").forEach((card) => {
      const event = caFindEventForCard(card);
      if (!event) return;
      const saved = caIsSaved(event);
      const saveAction = saved
        ? '<button type="button" data-ca-open-saved class="is-saved">✓ 保存済みを確認</button>'
        : `<button type="button" data-ca-save-event-id="${caEscape(caEventId(event))}">🔖 保存する</button>`;
      card.insertAdjacentHTML("beforeend", `<div class="ca-event-actions">${saveAction}<button type="button" data-ca-calendar-event-id="${caEscape(caEventId(event))}">カレンダー</button>${event.sourceUrl ? `<a href="${caEscape(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">当日の変更を確認 ↗</a>` : ""}</div>`);
      if (event.contentStatus === "needs_review" || (event.contentIssues || []).length) {
        card.insertAdjacentHTML("beforeend", `<p class="ca-card-quality-warning">⚠ 日時・料金・申込状況の一部を再確認中です。掲載元で最終確認してください。</p>`);
      }
    });

    const contribute = page.querySelector(".v4-event-contribute");
    if (contribute) {
      contribute.innerHTML = `<div><small>載っていないイベントがありますか？</small><h2>このイベントも載せて！</h2><p>現在はGitHubでの試験受付です。主催者の公式ページや公開SNSのURLを送れます。</p></div><form id="ca-event-tip-inline" class="ca-inline-tip-form"><input name="eventUrl" type="url" inputmode="url" placeholder="https://…" aria-label="イベントのURL" required><button type="submit">GitHubで送る</button></form><button class="ca-saved-inline-button" type="button" data-ca-open-saved>保存したイベントを見る</button><small class="ca-public-note">GitHubアカウントが必要です。送信したURLは公開されるため、個人情報は送らないでください。</small>`;
    }
  }

  function caEnhanceEventDetail() {
    if (state.view !== "detail") return;
    const item = caEventById(state.selectedId || "");
    if (!item || !isCommunityEventItem(item)) return;
    const layer = document.querySelector(".detail-layers .detail-layer");
    if (!layer || layer.querySelector(".ca-event-actions")) return;
    const saved = caIsSaved(item);
    const saveAction = saved
      ? '<button type="button" data-ca-open-saved class="is-saved">✓ 保存済みを確認</button>'
      : `<button type="button" data-ca-save-event-id="${caEscape(caEventId(item))}">🔖 保存する</button>`;
    layer.insertAdjacentHTML("beforeend", `<div class="ca-event-actions">${saveAction}<button type="button" data-ca-calendar-event-id="${caEscape(caEventId(item))}">カレンダーに追加</button><button type="button" data-v2-action="events">イベント一覧を見る</button></div>`);
  }

  function caHomeSavedMarkup(summary) {
    const next = summary.next;
    const title = summary.changed
      ? `保存した予定に変更 ${summary.changed}件`
      : summary.urgent
        ? `締切・開催が近い予定 ${summary.urgent}件`
        : `${summary.count}件の予定を保存中`;
    const note = next ? `${next.item.title}｜${next.reminder.label}` : "保存したイベントを確認";
    return `<section class="ca-home-saved"><button type="button" data-ca-open-saved><span aria-hidden="true">🔖</span><div><small>保存したイベント</small><strong>${caEscape(title)}</strong><b>${caEscape(note)}</b></div><i aria-hidden="true">›</i></button></section>`;
  }

  function caHomeToolsMarkup() {
    return `<section class="ca-home-tools" aria-labelledby="ca-home-tools-title"><div><small>直方の情報を、みんなで見つける</small><h2 id="ca-home-tools-title">載せる・知らせる</h2></div><div><button type="button" data-ca-open-event-tip><span aria-hidden="true">🎪</span><b>このイベントも載せて！</b><small>GitHubで提案</small></button><button type="button" data-ca-open-report><span aria-hidden="true">📷</span><b>まちの気になる場所</b><small>写真・場所・状況を整理</small></button></div></section>`;
  }

  function caEnhanceHome() {
    const page = document.querySelector(".v2-home-page");
    if (!page || page.dataset.caEnhanced === "true") return;
    page.dataset.caEnhanced = "true";
    const summary = caSavedSummary();
    const daily = page.querySelector(".v4-daily-briefing");
    if (daily && summary.count) daily.insertAdjacentHTML("afterend", caHomeSavedMarkup(summary));
    const participation = page.querySelector(".v4-participation-teaser");
    if (participation) participation.insertAdjacentHTML("beforebegin", caHomeToolsMarkup());
    else page.querySelector(".v4-ask-bar")?.insertAdjacentHTML("beforebegin", caHomeToolsMarkup());
  }

  function caEnhanceNearby() {
    if (state.tab !== "nearby" || state.view !== "tab") return;
    const page = document.querySelector("#main > .page");
    if (!page || page.querySelector(".ca-nearby-report")) return;
    const map = page.querySelector(".mytown-map-card") || page.querySelector(".hero");
    map?.insertAdjacentHTML("afterend", `<section class="ca-nearby-report"><div><span aria-hidden="true">📷</span><div><small>壊れたベンチ・道路の穴・危険な場所</small><h2>写真と場所から、届け先を探す</h2><p>担当課を知らなくても大丈夫。端末内で文面を作り、確認済みの公式窓口へ進めます。</p></div></div><button type="button" data-ca-open-report>まちの気になる場所を知らせる</button></section>`);
  }

  function caEnhancePage() {
    caSyncSavedEvents();
    caEnhanceHome();
    caEnhanceEventsPage();
    caEnhanceEventDetail();
    caEnhanceNearby();
  }

  function caEventById(id) {
    return caAllEvents().find((event) => caEventId(event) === id) || null;
  }

  function caRefreshSavedDialog() {
    const root = document.querySelector("#ca-dialog-root");
    if (!root || root.hidden || root.querySelector("#ca-dialog-title")?.textContent !== "保存したイベント") return;
    root.querySelector("#ca-dialog-body").innerHTML = caSavedEventsMarkup();
  }

  async function caLoadRoutes() {
    try {
      const response = await fetch(`${CA_REPORT_ROUTES_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data?.routes || typeof data.routes !== "object") throw new Error("Invalid route data");
      caRoutes = data;
    } catch (error) {
      console.warn("Civic report routes could not be loaded; using reviewed fallback", error);
      caRoutes = CA_ROUTE_FALLBACK;
    }
  }

  const caBaseRender = render;
  render = function renderWithCivicActions() {
    const result = caBaseRender();
    requestAnimationFrame(caEnhancePage);
    return result;
  };

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-ca-close]")) {
      event.preventDefault();
      caCloseDialog();
      return;
    }
    if (event.target.closest("[data-ca-open-event-tip]")) {
      event.preventDefault();
      caOpenEventTip();
      return;
    }
    if (event.target.closest("[data-ca-open-saved]")) {
      event.preventDefault();
      caOpenSavedEvents();
      return;
    }
    if (event.target.closest("[data-ca-open-report]")) {
      event.preventDefault();
      caOpenReport();
      return;
    }
    const saveButton = event.target.closest("[data-ca-save-event-id]");
    if (saveButton) {
      event.preventDefault();
      const item = caEventById(saveButton.dataset.caSaveEventId);
      if (!item) return caToast("イベント情報を確認できませんでした");
      caSaveEvent(item);
      caToast("イベントを保存しました");
      render();
      return;
    }
    const calendarEventButton = event.target.closest("[data-ca-calendar-event-id]");
    if (calendarEventButton) {
      event.preventDefault();
      const eventItem = caEventById(calendarEventButton.dataset.caCalendarEventId);
      if (!eventItem) return caToast("イベント情報を確認できませんでした");
      const saved = caIsSaved(eventItem) ? caSavedEvents().find((item) => item.id === caEventId(eventItem)) : caSaveEvent(eventItem);
      caDownloadCalendar(saved || { ...eventItem, id: caEventId(eventItem), lastSnapshot: caEventSnapshot(eventItem) });
      render();
      return;
    }
    const calendarSavedButton = event.target.closest("[data-ca-calendar-id]");
    if (calendarSavedButton) {
      event.preventDefault();
      const item = caSavedEvents().find((saved) => saved.id === calendarSavedButton.dataset.caCalendarId);
      if (item) caDownloadCalendar(item);
      return;
    }
    const removeButton = event.target.closest("[data-ca-remove-id]");
    if (removeButton) {
      event.preventDefault();
      caRemoveSavedEvent(removeButton.dataset.caRemoveId);
      caToast("保存から外しました");
      caRefreshSavedDialog();
      return;
    }
    const ackButton = event.target.closest("[data-ca-ack-id]");
    if (ackButton) {
      event.preventDefault();
      caAcknowledgeSavedEvent(ackButton.dataset.caAckId);
      caToast("変更を確認済みにしました");
      caRefreshSavedDialog();
      return;
    }
    const attendedButton = event.target.closest("[data-ca-attended-id]");
    if (attendedButton) {
      event.preventDefault();
      caMarkAttended(attendedButton.dataset.caAttendedId);
      caToast("参加済みにしました");
      caRefreshSavedDialog();
      return;
    }
    if (event.target.closest("[data-ca-get-location]")) {
      event.preventDefault();
      caGetLocation();
      return;
    }
    if (event.target.closest("[data-ca-remove-photo]")) {
      event.preventDefault();
      const input = document.querySelector("#ca-report-photo");
      if (input) input.value = "";
      caPreviewPhoto(null);
      return;
    }
    if (event.target.closest("[data-ca-copy-report]")) {
      event.preventDefault();
      caCopyText(document.querySelector("#ca-report-output")?.value || "");
      return;
    }
    if (event.target.closest("[data-ca-share-report]")) {
      event.preventDefault();
      caShareReport(document.querySelector("#ca-report-output")?.value || "");
      return;
    }
    if (event.target.closest("[data-ca-report-again]")) {
      event.preventDefault();
      caOpenReport();
      return;
    }
    if (event.target.closest("[data-ca-save-tip]")) {
      event.preventDefault();
      const input = document.querySelector('#ca-event-tip-form input[name="eventUrl"]');
      const url = input?.value?.trim() || "";
      if (!/^https?:\/\//i.test(url)) return caToast("公開ページのURLを入力してください");
      const drafts = caReadList(CA_EVENT_TIPS_KEY);
      drafts.unshift({ url, savedAt: new Date().toISOString(), status: "draft" });
      caWriteList(CA_EVENT_TIPS_KEY, drafts.slice(0, 20));
      caToast("この端末に下書き保存しました");
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.id !== "ca-report-photo") return;
    caPreviewPhoto(event.target.files?.[0] || null);
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id === "ca-event-tip-inline") {
      event.preventDefault();
      const data = new FormData(event.target);
      caOpenEventTip(String(data.get("eventUrl") || "").trim());
      return;
    }
    if (event.target.id === "ca-event-tip-form") {
      event.preventDefault();
      const formData = new FormData(event.target);
      const url = String(formData.get("eventUrl") || "").trim();
      if (!/^https?:\/\//i.test(url)) return caToast("公開ページのURLを入力してください");
      const tips = caReadList(CA_EVENT_TIPS_KEY);
      tips.unshift({ url, savedAt: new Date().toISOString(), status: "opened-for-submit" });
      caWriteList(CA_EVENT_TIPS_KEY, tips.slice(0, 20));
      const issueUrl = caEventTipIssueUrl(url);
      const opened = window.open(issueUrl, "_blank", "noopener,noreferrer");
      if (!opened) {
        caCopyText(url);
        caToast("送信画面を開けなかったため、URLをコピーしました");
      } else {
        caToast("送信画面を開きました");
      }
      return;
    }
    if (event.target.id === "ca-report-form") {
      event.preventDefault();
      const formData = new FormData(event.target);
      const locationText = String(formData.get("locationText") || "").trim();
      if (!locationText && !caReportCoordinates) {
        caToast("場所の目印を入力するか、現在地を使ってください");
        event.target.querySelector('[name="locationText"]')?.focus();
        return;
      }
      const category = String(formData.get("category") || "publicFacility");
      const route = caSelectedRoute(category);
      const reportText = caReportText(formData, route);
      caOpenDialog("届け先と文面を確認", caReportResultMarkup(category, reportText), "ca-dialog-wide");
    }
  });

  document.addEventListener("keydown", (event) => {
    const root = document.querySelector("#ca-dialog-root:not([hidden])");
    if (!root) return;
    if (event.key === "Escape") {
      event.preventDefault();
      caCloseDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  caEnsureDialog();
  caLoadRoutes();
  render();
})();
