/* MYTOWN Home v4 — events first, everyday usefulness, civic depth in the same screen. */
"use strict";

(() => {
  state.v4EventFilter = state.v4EventFilter || "all";
  state.v4CommunityFilter = state.v4CommunityFilter || "activities";

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
    let official = [];
    if (typeof combinedSearchItems === "function") official = combinedSearchItems();
    else {
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
      official = [...featured, ...latest];
    }
    const community = Array.isArray(state.data?.communityEvents?.events) ? state.data.communityEvents.events : [];
    return [...community, ...official];
  }

  function v4IsEvent(item = {}) {
    const text = v4Text(item);
    if (!item.title || V4_EVENT_EXCLUDE_PATTERN.test(text)) return false;
    if (["community", "tourism", "commercial", "cultural"].includes(item.sourceType)) return true;
    if (/観光・イベント|健康・スポーツ/.test(item.category || "")) return true;
    return V4_EVENT_PATTERN.test(text);
  }

  function v4EventDateKeys(item = {}) {
    if (Array.isArray(item.occurrences) && item.occurrences.length) {
      return item.occurrences.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();
    }
    const explicit = [item.startDate, item.endDate].filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
    if (explicit.length) return [...new Set(explicit)].sort();
    const text = String(item.when || "");
    const full = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
    const short = text.match(/(\d{1,2})月(\d{1,2})日/);
    const year = full ? Number(full[1]) : Number(v4TokyoDateKey().slice(0, 4));
    const month = Number(full ? full[2] : short?.[1]);
    const day = Number(full ? full[3] : short?.[2]);
    if (!month || !day) return [];
    return [`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`];
  }

  function v4EventHappensOn(item, dateKey) {
    const occurrences = Array.isArray(item.occurrences) ? item.occurrences : [];
    if (occurrences.length) return occurrences.includes(dateKey);
    const dates = v4EventDateKeys(item);
    if (!dates.length) return false;
    const start = item.startDate || dates[0];
    const end = item.endDate || dates.at(-1) || start;
    return dateKey >= start && dateKey <= end;
  }

  function v4EventNextDate(item, today = v4TokyoDateKey()) {
    const occurrences = Array.isArray(item.occurrences) ? item.occurrences.filter((value) => value >= today).sort() : [];
    if (occurrences.length) return occurrences[0];
    const dates = v4EventDateKeys(item);
    if (!dates.length) return "";
    const start = item.startDate || dates[0];
    const end = item.endDate || dates.at(-1) || start;
    if (end < today) return "";
    return start < today ? today : start;
  }

  function v4WeekendKeys(today = v4TokyoDateKey()) {
    const dayNumber = v4IsoDayNumber(today);
    if (dayNumber === null) return [];
    const weekday = new Date(dayNumber * 86400000).getUTCDay();
    const untilSaturday = (6 - weekday + 7) % 7;
    const saturday = v4DateKeyOffset(today, untilSaturday);
    return [saturday, v4DateKeyOffset(saturday, 1)];
  }

  function v4IsCommunityEvent(item = {}) {
    return ["community", "tourism"].includes(item.sourceType);
  }

  function v4EventSourceLabel(item = {}) {
    if (item.sourceLabel) return item.sourceLabel;
    if (item.sourceType === "commercial") return "商業施設";
    if (item.sourceType === "community") return "地域団体";
    if (item.sourceType === "tourism") return "観光・地域";
    return "直方市";
  }

  function v4EventSourceKey(item = {}) {
    // 主催者が別でも、同じ施設・媒体から届いた情報は同じ掲載元として扱う。
    // ホームの3件を一つの掲載元だけで埋めないためのキー。
    return item.publisherName || item.organizerName || item.sourceType || "直方市";
  }

  function v4NormalizedEventTitle(item = {}) {
    return String(item.title || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/20\d{2}年|\d{1,2}月\d{1,2}日/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
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
    if (v4IsCommunityEvent(item)) score += 8;
    return score;
  }

  function v4EventItems() {
    const seen = new Set();
    const today = v4TokyoDateKey();
    return v4AllItems()
      .filter(v4IsEvent)
      .filter((item) => {
        const dates = v4EventDateKeys(item);
        if (!dates.length) return true;
        return Boolean(v4EventNextDate(item, today));
      })
      .filter((item) => {
        const key = `${v4NormalizedEventTitle(item)}|${v4EventNextDate(item, today) || "date-unknown"}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        const aDate = v4EventNextDate(a, today) || "9999-12-31";
        const bDate = v4EventNextDate(b, today) || "9999-12-31";
        const dateDiff = aDate.localeCompare(bDate);
        if (dateDiff) return dateDiff;
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

  function v4TokyoDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function v4ChangesSinceLastVisit() {
    if (typeof v2ChangesSinceLastVisit === "function") return v2ChangesSinceLastVisit();
    const prior = state.priorVisitAt ? new Date(state.priorVisitAt) : null;
    if (!prior || Number.isNaN(prior.getTime())) return [];
    return (state.data?.changes?.changes || []).filter((item) => {
      const detected = new Date(item.detectedAt || "");
      return !Number.isNaN(detected.getTime()) && detected > prior;
    });
  }

  function v4IsoDayNumber(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
    if (!match) return null;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
  }

  function v4DeadlineNote(item) {
    if (!item || item.needsReview) return item?.status || "受付状況と期限は公式ページで確認";
    const today = v4IsoDayNumber(v4TokyoDateKey());
    const starts = v4IsoDayNumber(item.applicationStarts);
    const deadline = v4IsoDayNumber(item.applicationDeadline);
    if (today === null || deadline === null) return item.status ? `掲載状態：${item.status}` : "受付状況と期限は公式ページで確認";
    if (starts !== null && today < starts) return `受付開始まであと${starts - today}日`;
    if (today > deadline) return "受付期間は終了";
    if (today === deadline) return "申込期限は今日";
    return `締切まであと${deadline - today}日`;
  }

  function v4DateKeyOffset(dateKey, offset) {
    const day = v4IsoDayNumber(dateKey);
    if (day === null) return "";
    return new Date((day + offset) * 86400000).toISOString().slice(0, 10);
  }

  function v4GarbageTypesForDate(schedule, area, dateKey) {
    if (!schedule || !area || dateKey < schedule.validFrom || dateKey > schedule.validThrough) return [];
    const [year, month, day] = dateKey.split("-").map(Number);
    if (schedule.yearEndNeedsSeparateNotice && ((month === 12 && day >= 29) || (month === 1 && day <= 3))) return [];
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    const types = [];
    if ((area.burnableWeekdays || []).includes(weekday)) types.push("もやせるごみ");
    if ((area.cansAndBottles || []).includes(dateKey)) types.push("カン・ビン");
    if ((area.nonBurnable || []).includes(dateKey)) types.push("もやせないごみ");
    return types;
  }

  function v4GarbageBrief(garbage) {
    const areaId = state.v2Preferences?.garbageArea || "";
    const schedule = garbage?.schedule || null;
    const area = schedule?.areas?.[areaId] || null;
    if (!areaId) {
      return { kicker: "ごみ収集", title: "収集エリアを設定", note: "設定後は、ここに今日・明日の収集を表示", action: "settings" };
    }
    if (!schedule || schedule.status !== "verified" || !area) {
      return { kicker: "ごみ収集", title: "収集日程を確認中", note: "公式日程の更新を確認しています", action: "settings" };
    }

    const today = v4TokyoDateKey();
    const tomorrow = v4DateKeyOffset(today, 1);
    const todayTypes = v4GarbageTypesForDate(schedule, area, today);
    const tomorrowTypes = v4GarbageTypesForDate(schedule, area, tomorrow);
    const cutoff = schedule.putOutBy || "08:30";
    if (todayTypes.length) {
      const tomorrowNote = tomorrowTypes.length ? `／明日：${tomorrowTypes.join("・")}` : "";
      return { kicker: `${area.label}のごみ`, title: `今日：${todayTypes.join("・")}`, note: `${cutoff}まで${tomorrowNote}`, action: "settings" };
    }
    if (tomorrowTypes.length) {
      return { kicker: `${area.label}のごみ`, title: `明日：${tomorrowTypes.join("・")}`, note: `${cutoff}までに指定の場所へ`, action: "settings" };
    }

    for (let offset = 2; offset <= 35; offset += 1) {
      const nextDate = v4DateKeyOffset(today, offset);
      const nextTypes = v4GarbageTypesForDate(schedule, area, nextDate);
      if (!nextTypes.length) continue;
      const [, month, day] = nextDate.split("-").map(Number);
      return { kicker: `${area.label}のごみ`, title: `次回 ${month}/${day}：${nextTypes.join("・")}`, note: `${cutoff}までに指定の場所へ`, action: "settings" };
    }
    return { kicker: `${area.label}のごみ`, title: "次の収集日を確認中", note: "公開済みの日程内では確認できません", action: "settings" };
  }

  function v4DailyBriefItem({ tone, icon, kicker, title, note, action, href }) {
    const inner = `<span class="v4-daily-icon" aria-hidden="true">${esc(icon)}</span><span class="v4-daily-copy"><small>${esc(kicker)}</small><strong>${esc(title)}</strong><span>${esc(note)}</span></span><b aria-hidden="true">${href ? "↗" : "›"}</b>`;
    if (href) return `<a class="v4-daily-item tone-${esc(tone)}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
    const route = action === "notifications" ? `data-v2-nav="notifications"` : `data-v2-action="${esc(action)}"`;
    return `<button class="v4-daily-item tone-${esc(tone)}" type="button" ${route}>${inner}</button>`;
  }

  function v4TodayBriefing() {
    if (state.loadError) {
      return `<section class="v4-daily-briefing" aria-labelledby="v4-daily-title"><div class="v4-daily-heading"><div><p>自分に関係する情報から</p><h2 id="v4-daily-title">今日、見ておくこと</h2></div></div><div class="v4-daily-error" role="status"><strong>市の情報を読み込めませんでした</strong><span>確認できていない内容は表示しません。</span><button type="button" data-v2-action="reload">もう一度読み込む</button></div></section>`;
    }
    const changes = v4ChangesSinceLastVisit();
    const today = v4TokyoDateKey();
    const todaysLatest = (state.data?.latest || []).filter((item) => item.date === today);
    const newest = changes[0] || todaysLatest[0] || (state.data?.latest || [])[0] || null;
    const deadline = (typeof v2FindDeadlines === "function" ? v2FindDeadlines() : [])[0] || null;
    const garbage = state.data?.garbage || null;
    const garbageBrief = v4GarbageBrief(garbage);
    const hasPriorVisit = Boolean(state.priorVisitAt);

    const updateTitle = hasPriorVisit
      ? changes.length ? `${changes.length}件の追加・更新` : "新しい追加はありません"
      : todaysLatest.length ? `${todaysLatest.length}件届いています` : "市の新着情報を見る";
    const updateNote = newest?.title
      ? v4Short(newest.title, 46)
      : "直方市が公開した情報を確認できます。";

    const items = [
      {
        tone: "mint",
        icon: changes.length ? "✨" : "🔔",
        kicker: hasPriorVisit ? "前回見たあと" : "今日の新着",
        title: updateTitle,
        note: updateNote,
        action: "notifications",
      },
      {
        tone: "pink",
        icon: "⏳",
        kicker: "申し込み・募集",
        title: deadline ? v4Short(deadline.title, 40) : "締切のある情報を探す",
        note: v4DeadlineNote(deadline),
        action: "deadline",
      },
      {
        tone: "yellow",
        icon: "🗑️",
        ...garbageBrief,
      },
    ];

    return `<section class="v4-daily-briefing" aria-labelledby="v4-daily-title">
      <div class="v4-daily-heading"><h2 id="v4-daily-title">今日、見ておくこと</h2><span>${items.length}件</span></div>
      <div class="v4-daily-list">${items.map(v4DailyBriefItem).join("")}</div>
      <p class="v4-daily-note">確認できた情報だけを表示しています。</p>
    </section>`;
  }

  function v4EventFeature() {
    const events = v4EventItems();
    const selected = v4HomeEventItems(events);
    const quickFilters = v4EventFilterDefinitions(events).filter((filter) => ["today", "weekend", "family", "participate"].includes(filter.id));

    return `<section class="v4-event-feature" aria-labelledby="v4-event-feature-title">
      <div class="v4-event-feature-head">
        <div class="v4-event-copy">
          <div class="v4-event-topline"><span>直方のイベント</span><small>${events.length ? `${events.length}件掲載中` : "更新中"}</small></div>
          <h2 id="v4-event-feature-title">直方で、なにする？</h2>
          <p>市・地域団体・施設の情報を、近い日から3件。</p>
        </div>
        <div class="v4-event-art" aria-hidden="true"><img src="${V4_ASSETS.event}" alt="" decoding="async" fetchpriority="high"></div>
      </div>
      <div class="v4-event-quick-filters" aria-label="イベントをすぐに絞る">
        ${quickFilters.map((filter) => `<button type="button" data-v4-home-event-filter="${esc(filter.id)}" ${filter.count ? "" : "disabled"}>${esc(filter.label)} <span>${filter.count}</span></button>`).join("")}
      </div>
      <div class="v4-home-event-list">
        ${selected.length ? selected.map(v4HomeEventCard).join("") : `<p class="v4-home-event-empty">現在、日付を確認できるイベントはありません。</p>`}
      </div>
      <button class="v4-primary-cta" type="button" data-v2-action="events">すべてのイベントを見る${events.length ? `　全${events.length}件` : ""} <span aria-hidden="true">→</span></button>
    </section>`;
  }

  function v4HomeEventItems(events) {
    const selected = [];
    const selectedIds = new Set();
    const usedSources = new Set();
    const add = (item) => {
      if (!item || selectedIds.has(item.id || item.sourceUrl || item.title)) return;
      const identity = item.id || item.sourceUrl || item.title;
      selected.push(item);
      selectedIds.add(identity);
      usedSources.add(v4EventSourceKey(item));
    };
    const today = v4TokyoDateKey();
    const tomorrow = v4DateKeyOffset(today, 1);
    add(events.find((item) => v4EventHappensOn(item, today) || v4EventHappensOn(item, tomorrow)) || events[0]);
    add(events.find((item) => v4IsCommunityEvent(item) && !usedSources.has(v4EventSourceKey(item))));
    add(events.find((item) => !usedSources.has(v4EventSourceKey(item))));
    events.forEach((item) => {
      if (selected.length < 3 && !usedSources.has(v4EventSourceKey(item))) add(item);
    });
    events.forEach((item) => {
      if (selected.length < 3) add(item);
    });
    return selected.slice(0, 3).sort((a, b) => (v4EventNextDate(a) || "9999-12-31").localeCompare(v4EventNextDate(b) || "9999-12-31"));
  }

  function v4EventReason(item) {
    const today = v4TokyoDateKey();
    const tomorrow = v4DateKeyOffset(today, 1);
    if (v4EventHappensOn(item, today)) return "今日開催";
    if (v4EventHappensOn(item, tomorrow)) return "明日開催";
    if (v4WeekendKeys(today).some((dateKey) => v4EventHappensOn(item, dateKey))) return "今週末";
    if (v4IsCommunityEvent(item)) return "地域から";
    if (/親子|子ども|こども|家族/.test(v4Text(item))) return "親子向け";
    const nextDate = v4EventNextDate(item, today);
    if (nextDate) {
      const [, month, day] = nextDate.split("-").map(Number);
      return `${month}/${day}開催`;
    }
    return "新着イベント";
  }

  function v4HomeEventCard(item) {
    const meta = [item.when ? v4Short(item.when, 25) : "", item.location ? v4Short(item.location, 24) : ""].filter(Boolean).join("｜");
    return `<button type="button" class="v4-home-event-card" data-v2-action="events">
      <span class="v4-home-event-date">${esc(v4EventReason(item))}</span>
      <span class="v4-home-event-main"><strong>${esc(v4Short(item.title || "イベント情報", 42))}</strong>${meta ? `<small>${esc(meta)}</small>` : ""}</span>
      <span class="v4-home-event-source">${esc(v4EventSourceLabel(item))}</span>
      <b aria-hidden="true">›</b>
    </button>`;
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
        action: "works",
        tone: "mint",
        icon: V4_ASSETS.decision,
        kicker: "予算・市議会・工事",
        title: "市政・工事を見る",
        note: localMatch ? v4Short(localMatch.title, 26) : "直方で何が動いているか",
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
    const bus = (state.data?.featured || []).find((item) => /バス|路線と時刻表/.test(v4Text(item)));
    return `<div class="v4-life-strip" aria-label="暮らしの確認">
      ${bus
        ? `<button type="button" data-v2-detail-id="${esc(bus.id)}" data-v2-detail-section="what"><span aria-hidden="true">🚌</span><div><small>公共交通</small><strong>バスの時刻表・変更を見る</strong></div><b aria-hidden="true">›</b></button>`
        : `<button type="button" data-v2-query="バス 時刻表"><span aria-hidden="true">🚌</span><div><small>公共交通</small><strong>バス情報を探す</strong></div><b aria-hidden="true">›</b></button>`}
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
        <div><p>知ると景色が変わる</p><h2 id="v4-civic-title"><span aria-hidden="true">🌱</span> 今日の直方を1つ知る</h2></div>
        <button type="button" data-v2-action="decision">市政をもっと知る</button>
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
    return `<section class="v4-participation-teaser" aria-labelledby="v4-participation-title">
      <div><small>まちに関わるきっかけ</small><strong id="v4-participation-title">今日から、直方に関わる</strong><span>参加できる催しや、公開中の募集を探せます。</span></div>
      <div class="v4-participation-actions"><button type="button" data-v2-action="events">イベントを見る</button><button type="button" data-v2-action="participate">地域活動を見る</button></div>
    </section>`;
  }

  function v4HomeLoading() {
    return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content v4-home-content"><section class="v4-event-feature is-loading" aria-label="情報を読み込み中"><div class="v4-event-art"></div><div class="v4-event-copy"><div class="loading-line"></div><div class="loading-line short"></div><p>イベントと暮らしの情報を更新しています…</p></div></section></div></section>`;
  }

  todayV2View = function todayHomeV4() {
    if (state.loading) return v4HomeLoading();
    return `<section class="page v2-page v2-home-page">${v2Hero()}<div class="v2-content v4-home-content">
      ${v4TodayBriefing()}
      ${v4EventFeature()}
      ${v4BentoOverview()}
      ${v4LifeStrip()}
      <div class="v2-sync-wrap v4-sync-wrap">${syncBanner()}</div>
      ${state.v2Preferences?.civicDigest === "off" ? "" : v4CivicLayer()}
      ${v4ParticipationTeaser()}
      ${v4AskBar()}
      ${v2LifeAndLatest()}
      <p class="v2-disclaimer">のおがた日和は、直方市・地域団体・施設などの公開情報をもとにした非公式アプリです。掲載範囲は、現在取り込めた情報に限られます。手続き・期限・選挙は直方市、イベントは主催者または掲載元のページで最終確認してください。</p>
    </div></section>`;
  };

  function v4EventFilterDefinitions(items) {
    const today = v4TokyoDateKey();
    const weekend = v4WeekendKeys(today);
    const definitions = [
      { id: "all", label: "すべて", test: () => true },
      { id: "today", label: "今日", test: (item) => v4EventHappensOn(item, today) },
      { id: "weekend", label: "今週末", test: (item) => weekend.some((dateKey) => v4EventHappensOn(item, dateKey)) },
      { id: "family", label: "親子・子ども", test: (item) => item.tags?.includes("family") || /親子|子ども|こども|幼児|小学生|家族/.test(v4Text(item)) },
      { id: "participate", label: "地域参加", test: (item) => item.tags?.includes("participation") || /ボランティア|清掃|献血|地域参加|意見募集/.test(v4Text(item)) },
      { id: "free", label: "無料", test: (item) => item.tags?.includes("free") || /無料/.test(`${item.money || ""} ${v4Text(item)}`) },
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
      item.organizerName ? `<span><b>主催</b>${esc(v4Short(item.organizerName, 38))}</span>` : item.publisherName ? `<span><b>掲載</b>${esc(v4Short(item.publisherName, 38))}</span>` : "",
    ].filter(Boolean);
    const icon = /地域参加/.test(category) ? "🤝" : /親子|子ども/.test(category) ? "🎈" : /音楽|文化/.test(category) ? "🎵" : /スポーツ|健康/.test(category) ? "🏃" : /講座|体験|学/.test(v4Text(item)) ? "🎨" : "🎪";
    const controlLabel = v4IsFeaturedItem(item) ? "30秒で見る" : item.sourceType ? "掲載元で確認" : "直方市のページで確認";
    return `<article class="v4-event-list-card">
      <div class="v4-event-list-icon" aria-hidden="true">${icon}</div>
      <div class="v4-event-list-copy">
        <div class="v4-event-list-meta"><span>${esc(category)}</span><span class="is-source">${esc(v4EventSourceLabel(item))}</span>${item.statusLabel ? `<strong>${esc(item.statusLabel)}</strong>` : ""}</div>
        <h3>${esc(item.title || "イベント情報")}</h3>
        <p>${esc(v4Short(item.summary || "日時や場所など、確認できた情報を掲載しています。", 104))}</p>
        ${facts.length ? `<div class="v4-event-facts">${facts.join("")}</div>` : ""}
        ${v4ItemControl(item, controlLabel, "what", "v4-event-card-cta")}
      </div>
    </article>`;
  }

  function v4EventDataNote() {
    const community = state.data?.communityEvents || {};
    const health = Array.isArray(community.sourceHealth) ? community.sourceHealth : [];
    const failed = health.filter((source) => source.status !== "ok");
    const updated = community.generatedAt && typeof formatDateTime === "function" ? formatDateTime(community.generatedAt) : "確認中";
    if (failed.length) {
      return `<div class="v4-event-data-note is-warning" role="status"><strong>一部の掲載元を更新できませんでした</strong><span>確認済みの情報は表示しています。開催前に掲載元でも確認してください。</span></div>`;
    }
    return `<div class="v4-event-data-note" role="status"><strong>市・地域の公開情報から掲載</strong><span>地域イベントの最終更新：${esc(updated)}</span></div>`;
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
        <div><p class="eyebrow">直方のイベント</p><h1>イベント・体験を探す</h1><p>市、地域団体、NPO、施設などが公開した情報をまとめています。</p></div>
        <img src="${V4_ASSETS.event}" alt="" aria-hidden="true" decoding="async">
      </div>
      ${v4EventDataNote()}
      <div class="v4-event-page-note"><strong>掲載について</strong><p>日時・場所・主催者などを確認できた情報だけを掲載します。すべてのイベントを網羅しているわけではありません。</p></div>
      <div class="v4-event-filter-row" aria-label="イベントの種類で絞る">${filters.map((filter) => `<button type="button" class="${active === filter.id ? "is-active" : ""}" data-v4-event-filter="${esc(filter.id)}">${esc(filter.label)} <span>${filter.count}</span></button>`).join("")}</div>
      <div class="v4-event-results-head"><h2>${active === "all" ? "掲載中のイベント" : `${esc(activeFilter.label)}のイベント`}</h2><span>${shown.length}件</span></div>
      <div class="v4-event-list">${shown.length ? shown.map(v4EventListCard).join("") : emptyCard("この種類のイベントは見つかりませんでした。上の分類から別の種類を選んでください。")}</div>
      <section class="v4-event-contribute"><div><small>載っていないイベントがありますか？</small><h2>イベント情報の受付は準備中です</h2><p>主催者や市民からの情報受付は、確認方法と安全対策を整えてから始めます。</p></div><button type="button" data-v2-action="participate">準備中の内容を見る →</button></section>
    </section>`;
  }

  function v4CommunityRecords() {
    const community = state.data?.community || {};
    const activities = Array.isArray(community.activities)
      ? community.activities.map((item) => ({ ...item, recordType: "activity" }))
      : [];
    const organizations = Array.isArray(community.organizations)
      ? community.organizations.map((item) => ({ ...item, recordType: "organization", title: item.name }))
      : [];
    return [...activities, ...organizations];
  }

  function v4CommunityFilters(items) {
    const definitions = [
      { id: "activities", label: "活動・募集", test: (item) => item.recordType === "activity" },
      { id: "children", label: "こども食堂", test: (item) => item.activityType === "child-cafeteria" || item.activityType === "child-support" },
      { id: "volunteer", label: "ボランティア募集", test: (item) => item.activityType === "volunteer" },
      { id: "groups", label: "ボランティア団体", test: (item) => item.recordType === "organization" && item.directoryType === "volunteer" },
      { id: "sdgs", label: "SDGsパートナー", test: (item) => item.recordType === "organization" && item.directoryType === "sdgs" },
    ];
    return definitions.map((definition) => ({ ...definition, count: items.filter(definition.test).length }));
  }

  function v4CommunitySourceHubs() {
    const hubs = Array.isArray(state.data?.community?.sourceHubs) ? state.data.community.sourceHubs : [];
    const icons = { volunteer: "🤝", children: "🍚", sdgs: "🌱" };
    return `<section class="v4-community-sources" aria-labelledby="v4-community-sources-title">
      <div class="v4-event-results-head"><h2 id="v4-community-sources-title">4つの掲載元から探す</h2><span>${hubs.length}件</span></div>
      <div class="v4-community-source-grid">${hubs.length ? hubs.map((hub) => `<a href="${esc(hub.url)}" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">${icons[hub.kind] || "📌"}</span><div><strong>${esc(hub.name)}</strong><small>${esc(hub.description || "掲載元の情報を確認できます。")}${hub.dataAsOf ? ` ${esc(hub.dataAsOf)}。` : ""}</small></div><b aria-hidden="true">↗</b></a>`).join("") : emptyCard("掲載元の情報を読み込めませんでした。")}</div>
    </section>`;
  }

  function v4CommunityDataNote() {
    const community = state.data?.community || {};
    const health = Array.isArray(community.sourceHealth) ? community.sourceHealth : [];
    const failed = health.filter((source) => source.status === "error");
    const updated = community.generatedAt && typeof formatDateTime === "function" ? formatDateTime(community.generatedAt) : "確認中";
    if (failed.length) {
      return `<div class="v4-event-data-note is-warning" role="status"><strong>一部の掲載元を更新できませんでした</strong><span>確認済みの情報は残しています。参加前に掲載元で最新情報を確認してください。</span></div>`;
    }
    return `<div class="v4-event-data-note" role="status"><strong>市・社会福祉協議会の公開情報から掲載</strong><span>地域活動の最終更新：${esc(updated)}</span></div>`;
  }

  function v4CommunityCard(item) {
    const isOrganization = item.recordType === "organization";
    const icon = item.directoryType === "sdgs" ? "🌱" : item.activityType?.startsWith("child-") ? "🍚" : "🤝";
    const tags = [
      item.category ? `<span>${esc(item.category)}</span>` : "",
      item.dataAsOf ? `<span class="is-source">${esc(item.dataAsOf)}</span>` : "",
      item.registrationNumber ? `<span class="is-source">登録 ${esc(item.registrationNumber)}</span>` : "",
    ].filter(Boolean).join("");
    const facts = [
      item.industry ? `<span><b>分野</b>${esc(item.industry)}</span>` : "",
      item.sourceName ? `<span><b>掲載</b>${esc(item.sourceName)}</span>` : "",
    ].filter(Boolean).join("");
    const primaryUrl = item.profileUrl || item.sourceUrl;
    const primaryLabel = isOrganization ? "公開情報で確認" : "日時・参加方法を確認";
    return `<article class="v4-community-card">
      <div class="v4-community-card-icon" aria-hidden="true">${icon}</div>
      <div class="v4-community-card-copy">
        <div class="v4-event-list-meta">${tags}</div>
        <h3>${esc(item.title || item.name || "地域活動")}</h3>
        <p>${esc(item.summary || "公開されている地域活動の情報です。")}</p>
        ${facts ? `<div class="v4-event-facts">${facts}</div>` : ""}
        ${item.currentnessNote ? `<small class="v4-community-currentness">${esc(item.currentnessNote)}</small>` : ""}
        <div class="v4-community-links">${primaryUrl ? `<a href="${esc(primaryUrl)}" target="_blank" rel="noopener noreferrer">${primaryLabel} <span aria-hidden="true">↗</span></a>` : ""}${item.websiteUrl ? `<a class="is-secondary" href="${esc(item.websiteUrl)}" target="_blank" rel="noopener noreferrer">団体サイト <span aria-hidden="true">↗</span></a>` : ""}</div>
      </div>
    </article>`;
  }

  function v4ParticipationView() {
    const records = v4CommunityRecords();
    const filters = v4CommunityFilters(records);
    const active = filters.some((filter) => filter.id === state.v4CommunityFilter) ? state.v4CommunityFilter : "activities";
    const activeFilter = filters.find((filter) => filter.id === active) || filters[0];
    const shown = records.filter(activeFilter.test);
    const organizationCount = records.filter((item) => item.recordType === "organization").length;
    const activityCount = records.filter((item) => item.recordType === "activity").length;

    return `<section class="page v2-page v2-inner-page v4-participation-page">
      <button class="back-button" type="button" data-v2-action="back-route">‹ 戻る</button>
      <div class="v2-inner-hero v4-community-hero"><div><p class="eyebrow">まちに参加する</p><h1>地域活動・ボランティアを探す</h1><p>こども食堂、ボランティア団体、募集中の活動、SDGsパートナーをまとめています。</p></div><div class="v4-community-totals"><span><strong>${activityCount}</strong>活動・募集</span><span><strong>${organizationCount}</strong>団体・企業</span></div></div>
      ${v4CommunityDataNote()}
      ${v4CommunitySourceHubs()}
      <div class="v4-event-filter-row v4-community-filter-row" aria-label="地域活動の種類で絞る">${filters.map((filter) => `<button type="button" class="${active === filter.id ? "is-active" : ""}" data-v4-community-filter="${esc(filter.id)}">${esc(filter.label)} <span>${filter.count}</span></button>`).join("")}</div>
      <div class="v4-event-results-head"><h2>${esc(activeFilter.label)}</h2><span>${shown.length}件</span></div>
      <div class="v4-community-list">${shown.length ? shown.map(v4CommunityCard).join("") : emptyCard("この種類の情報は、まだ取得できていません。掲載元のページも確認してください。")}</div>
      <section class="v4-event-contribute"><div><small>この活動も載せて！</small><h2>URLでの情報提供は準備中です</h2><p>市民や主催者からURLを受け取り、日時・場所・主催者を確認してから掲載する仕組みを準備しています。</p></div><button type="button" data-v2-action="events">現在のイベントを見る →</button></section>
      <div class="card info-card v4-safety-card"><h2>参加前に掲載元で確認してください</h2><p>団体一覧は活動への参加を保証するものではありません。募集状況、開催日時、対象、費用、連絡方法は変わることがあります。</p></div>
    </section>`;
  }

  v2SearchIntro = function v4SearchIntro() {
    const deadlines = typeof v2FindDeadlines === "function" ? v2FindDeadlines().slice(0, 2) : [];
    const eventCount = v4EventItems().length;
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;
    return `<div class="v2-search-intro"><section class="v2-popular-search" aria-labelledby="v2-popular-title"><h2 id="v2-popular-title">検索の例</h2><div class="v2-query-chips">${["イベント", "バス", "ごみ", "子育て", "学校"].map((query) => `<button type="button" data-v2-query="${esc(query)}">${esc(query)}</button>`).join("")}</div></section>
      <section class="v2-search-groups" aria-label="探し方"><button type="button" data-v2-action="events"><strong>イベント</strong><span>${eventCount ? `${eventCount}件掲載中` : "イベント・体験を探す"}</span></button><button type="button" data-v2-action="participate"><strong>地域活動</strong><span>こども食堂・ボランティア</span></button><button type="button" data-v2-action="deadline"><strong>締切のある情報</strong><span>${deadlines.length ? `${deadlines.length}件掲載中` : "募集・申し込みを探す"}</span></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><span>子育て・暮らしの手続き</span></button><button type="button" data-v2-action="works"><strong>工事情報</strong><span>直方市の公開資料から確認</span></button><button type="button" data-v2-action="decision"><strong>市政</strong><span>予算・議会・決まったこと</span></button>${bulletin ? `<button type="button" data-v2-action="bulletin"><strong>市報</strong><span>${esc(bulletin.title || "最新号")}</span></button>` : ""}</section><p class="v2-search-note">現在取り込んでいる市・地域の公開情報から検索します。</p></div>`;
  };

  v2MenuView = function v4MenuView() {
    const eventCount = v4EventItems().length;
    const communityCount = v4CommunityRecords().length;
    const bulletin = typeof v2CurrentBulletin === "function" ? v2CurrentBulletin() : null;
    return `<section class="page v2-page v2-inner-page"><div class="v2-inner-hero"><div><p class="eyebrow">メニュー</p><h1>やりたいことから選ぶ</h1><p>イベント、暮らし、市の動きをまとめて探せます。</p></div></div><div class="v2-menu-grid v4-menu-grid"><button type="button" data-v2-action="events"><strong>イベント・おでかけ</strong><small>${eventCount ? `${eventCount}件掲載中` : "体験・教室も探す"}</small></button><button type="button" data-v2-action="works"><strong>工事情報</strong><small>直方市の公開資料から</small></button><button type="button" data-v2-action="deadline"><strong>締切のある情報</strong><small>申し込み・募集・意見募集</small></button><button type="button" data-v2-action="services"><strong>制度・手続き</strong><small>子育て・暮らしから</small></button>${bulletin ? `<button type="button" data-v2-action="bulletin"><strong>市報のおがた</strong><small>${esc(bulletin.title || "最新号")}</small></button>` : ""}<button type="button" data-v2-action="decision"><strong>市政</strong><small>予算・市長・市議会</small></button><button type="button" data-v2-action="ask"><strong>まちナビに聞く</strong><small>市の資料から答えを探す</small></button><button type="button" data-v2-action="participate"><strong>地域活動・ボランティア</strong><small>${communityCount ? `${communityCount}件掲載中` : "団体・活動を探す"}</small></button><button type="button" data-v2-action="settings"><strong>地域と表示順を設定</strong><small>このブラウザだけに保存</small></button><button type="button" data-v2-action="glossary"><strong>役所ことば図鑑</strong><small>難しい言葉をやさしく</small></button><button type="button" data-v2-action="money"><strong>直方市の予算</strong><small>市の資料と照合した数字だけ</small></button></div><div class="v2-menu-note card info-card"><h2>のおがた日和の約束</h2><p>公開資料で確認できないことは、推測で補いません。人物の評価や採点はしません。大切な情報には、確認に使った直方市のページへのリンクを付けます。</p></div></section>`;
  };

  function v4PatchActionSheet() {
    const list = document.querySelector("#v2-action-sheet .v2-sheet-list");
    if (!list || list.querySelector('[data-v2-action="events"]')) return;
    list.insertAdjacentHTML("afterbegin", `<button type="button" data-v2-action="events"><div><strong>イベント・おでかけ</strong><small>直方のイベント・体験を探す</small></div><b>›</b></button>`);
    list.insertAdjacentHTML("beforeend", `<button type="button" data-v2-action="participate"><div><strong>地域活動・ボランティア</strong><small>こども食堂や団体を探す</small></div><b>›</b></button>`);
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
    const quickFilter = event.target.closest("[data-v4-home-event-filter]");
    if (quickFilter) {
      event.preventDefault();
      state.v4EventFilter = quickFilter.dataset.v4HomeEventFilter || "all";
      return v2SetRoute({ tab: "today", page: "events", hash: "#events" });
    }
    const filter = event.target.closest("[data-v4-event-filter]");
    if (filter) {
      event.preventDefault();
      state.v4EventFilter = filter.dataset.v4EventFilter || "all";
      render();
      return;
    }
    const communityFilter = event.target.closest("[data-v4-community-filter]");
    if (!communityFilter) return;
    event.preventDefault();
    state.v4CommunityFilter = communityFilter.dataset.v4CommunityFilter || "activities";
    render();
  });

  v4PatchActionSheet();
  v2ApplyHashRoute();
  render();
})();
