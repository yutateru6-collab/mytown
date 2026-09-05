/* MYTOWN P0 stabilization — fixes audited navigation, date-state, search and preference regressions. */
"use strict";

(() => {
  const PREF_KEY = "mytown-preferences-v1";
  const ALLOWED_INTERESTS = ["子育て", "学校", "高齢者", "公共交通", "ごみ", "防災", "イベント", "税金・予算"];
  const REGION_SHORTCUTS = ["直方駅周辺", "感田", "植木", "頓野", "新入"];

  function p0TokyoDateKey(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function p0ReadSavedPreferences() {
    try {
      const raw = JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (_error) {
      return {};
    }
  }

  function p0ValidInterests(value) {
    return Array.isArray(value) ? value.filter((item) => ALLOWED_INTERESTS.includes(item)) : [];
  }

  function p0RestorePreferences() {
    const saved = p0ReadSavedPreferences();
    const savedInterests = p0ValidInterests(saved.interests);
    if (!state.v2Preferences) return;
    state.v2Preferences = {
      ...state.v2Preferences,
      ...saved,
      garbageArea: ["east", "west"].includes(saved.garbageArea) ? saved.garbageArea : (state.v2Preferences.garbageArea || ""),
      interests: savedInterests,
      civicDigest: saved.civicDigest === "off" ? "off" : (saved.civicDigest || state.v2Preferences.civicDigest || "weekly"),
      lifeNotifications: saved.lifeNotifications !== false,
    };
  }

  function p0CouncilSourceLabel(council) {
    if (!council) return "";
    if (!council.p0SourceNextDateLabel) council.p0SourceNextDateLabel = council.nextDateLabel || "";
    if (!council.p0SourceNextSummary) council.p0SourceNextSummary = council.nextSummary || "";
    if (!council.p0SourceStatus) council.p0SourceStatus = council.status || "";
    return council.p0SourceNextDateLabel;
  }

  function p0NormalizeCouncilState() {
    const council = state.data?.council;
    if (!council) return;
    const sourceLabel = p0CouncilSourceLabel(council);
    const match = /^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/.exec(sourceLabel);
    if (!match) return;
    const today = p0TokyoDateKey();
    const year = Number(today.slice(0, 4));
    const dateKey = `${year}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
    const time = match[3] ? `${Number(match[3])}:${match[4]}` : "";

    if (dateKey < today) {
      council.nextDateLabel = "次回日程を確認中";
      council.nextSummary = "公表済みの日程を再確認しています。最新の日程は直方市議会の公式ページで確認できます。";
      council.status = "日程確認中";
      council.p0TimingState = "stale";
      return;
    }
    if (dateKey === today) {
      council.nextDateLabel = time ? `本日 ${time}` : "本日";
      council.nextSummary = council.p0SourceNextSummary;
      council.status = "本日予定";
      council.p0TimingState = "today";
      return;
    }
    council.nextDateLabel = council.p0SourceNextDateLabel;
    council.nextSummary = council.p0SourceNextSummary;
    council.status = council.p0SourceStatus;
    council.p0TimingState = "future";
  }

  function p0NormalizeSearchUrl(item = {}) {
    return item.sourceUrl || item.url || item.websiteUrl || item.officialUrl || item.sourcePageUrl || "";
  }

  function p0SearchId(prefix, item, index) {
    const seed = String(item.id || item.title || item.name || index).normalize("NFKC").replace(/[^\p{L}\p{N}-]+/gu, "-").slice(0, 70);
    return `${prefix}-${seed || index}`;
  }

  if (typeof combinedSearchItems === "function") {
    const baseCombinedSearchItems = combinedSearchItems;
    combinedSearchItems = function combinedSearchItemsAcrossMytown() {
      const base = baseCombinedSearchItems();
      const communityEvents = Array.isArray(state.data?.communityEvents?.events) ? state.data.communityEvents.events : [];
      const communityActivities = Array.isArray(state.data?.community?.activities) ? state.data.community.activities : [];
      const communityOrganizations = Array.isArray(state.data?.community?.organizations) ? state.data.community.organizations : [];
      const works = Array.isArray(state.civicPortal?.works) ? state.civicPortal.works : [];
      const members = Array.isArray(state.politics?.council?.members) ? state.politics.council.members : [];
      const memberSource = state.politics?.council?.membersSourceUrl || "";
      const garbage = state.data?.garbage || null;
      const population = state.data?.population || null;

      const extras = [
        ...(garbage?.sourceUrl ? [{
          id: "utility-garbage",
          title: "ごみ・資源リサイクルの収集日",
          summary: garbage.summary || "地域ごとの収集日と分別方法を確認できます。",
          category: "ごみ",
          sourceUrl: garbage.sourceUrl,
          searchTerms: "ごみの出し方 捨て方 分別 収集日 燃えるごみ もやせるごみ 粗大ごみ",
        }] : []),
        ...(population?.sourceUrl ? [{
          id: "utility-population",
          title: "直方市の人口と世帯数",
          summary: `${population.asOf || "最新公表時点"}の人口は${Number(population.total || 0).toLocaleString("ja-JP")}人、世帯数は${Number(population.households || 0).toLocaleString("ja-JP")}世帯です。`,
          category: "その他",
          sourceUrl: population.sourceUrl,
          searchTerms: "人口 何人 世帯数",
        }] : []),
        ...communityEvents.map((item, index) => ({
          ...item,
          id: item.id || p0SearchId("event", item, index),
          title: item.title || "地域イベント",
          summary: item.summary || [item.when, item.location, item.money].filter(Boolean).join("｜") || "地域で公開されているイベント情報です。",
          category: "観光・イベント",
          sourceUrl: p0NormalizeSearchUrl(item),
          published: item.published || item.sourceUpdated || "",
        })),
        ...communityActivities.map((item, index) => ({
          ...item,
          id: p0SearchId("activity", item, index),
          title: item.title || item.name || "地域活動",
          summary: item.summary || item.description || item.note || "地域団体が公開している活動情報です。",
          category: "地域活動",
          sourceUrl: p0NormalizeSearchUrl(item),
        })),
        ...communityOrganizations.map((item, index) => ({
          ...item,
          id: p0SearchId("organization", item, index),
          title: item.name || item.title || "地域団体",
          summary: item.summary || item.description || item.activity || "直方で活動している団体の公開情報です。",
          category: "地域活動",
          sourceUrl: p0NormalizeSearchUrl(item),
        })),
        ...works.map((item, index) => ({
          ...item,
          id: p0SearchId("work", item, index),
          title: item.title || "工事情報",
          summary: item.note || [item.location, item.plannedPeriod].filter(Boolean).join("｜"),
          category: "工事・道路",
          sourceUrl: item.sourcePageUrl || item.sourcePdfUrl || "",
          published: item.bidDate || "",
        })),
        ...members.map((item, index) => ({
          ...item,
          id: p0SearchId("council-member", item, index),
          title: `${item.name || "市議会議員"}${item.role && item.role !== "議員" ? `（${item.role}）` : ""}`,
          summary: [item.committee, ...(Array.isArray(item.recentQuestions) ? item.recentQuestions.slice(0, 2) : [])].filter(Boolean).join("｜") || "直方市議会の公開名簿に掲載されている議員です。",
          category: "議会",
          sourceUrl: memberSource,
        })),
      ];

      const seen = new Set();
      return [...base, ...extras].filter((item) => {
        const key = `${String(item.title || "").normalize("NFKC")}|${p0NormalizeSearchUrl(item)}`;
        if (!item.title || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
  }

  if (typeof askView === "function") {
    const baseAskView = askView;
    askView = function askViewWithAccurateScope(answer = "") {
      return baseAskView(answer)
        .replace("市の資料から答えを探します", "よくある質問から探す")
        .replace("現在取り込んでいる市の資料から、答えを探します。", "現在確認できている定型情報から探します。資料横断の自由質問検索は準備中です。")
        .replace("何が気になる？", "何を確認する？");
    };
  }

  function p0EnhanceSettings() {
    const form = document.querySelector("#v2-preferences-form");
    if (!form) return;

    const district = form.querySelector('input[name="district"]');
    if (district && !form.querySelector(".p0-region-shortcuts")) {
      const shortcuts = document.createElement("div");
      shortcuts.className = "p0-region-shortcuts";
      shortcuts.setAttribute("aria-label", "よく見る地域の候補");
      shortcuts.innerHTML = REGION_SHORTCUTS.map((value) => `<button type="button" data-p0-region="${esc(value)}">${esc(value)}</button>`).join("");
      district.closest("label")?.append(shortcuts);
    }

    if (!form.querySelector(".p0-interest-fieldset")) {
      const displayFieldset = Array.from(form.querySelectorAll("fieldset")).find((fieldset) => fieldset.querySelector("legend")?.textContent?.includes("表示の設定"));
      const selected = new Set(state.v2Preferences?.interests || []);
      const fieldset = document.createElement("fieldset");
      fieldset.className = "p0-interest-fieldset";
      fieldset.innerHTML = `<legend>気になること</legend><small>ホームや検索で、関係しそうな情報を優先するために使います。</small><div class="p0-interest-grid">${ALLOWED_INTERESTS.map((interest) => `<label><input type="checkbox" name="interests" value="${esc(interest)}" ${selected.has(interest) ? "checked" : ""}><span>${esc(interest)}</span></label>`).join("")}</div>`;
      if (displayFieldset) form.insertBefore(fieldset, displayFieldset);
      else form.querySelector("button[type=submit]")?.before(fieldset);
    }
  }

  function p0FixRemovedHomeLabels() {
    document.querySelector('.v2-hero-actions [data-v2-nav="notifications"]')?.remove();
    document.querySelector(".v2-data-note")?.remove();

    const daily = document.querySelector(".v4-daily-briefing");
    if (daily) {
      daily.removeAttribute("aria-labelledby");
      daily.setAttribute("aria-label", "今日の生活情報");
      daily.querySelector(".v4-daily-heading")?.remove();
      daily.querySelector(".v4-daily-note")?.remove();
      const newest = Array.isArray(state.data?.latest) ? state.data.latest[0] : null;
      const todaysLatest = (state.data?.latest || []).some((item) => item.date === p0TokyoDateKey());
      if (!state.priorVisitAt && !todaysLatest) {
        const firstKicker = daily.querySelector(".v4-daily-copy small");
        if (firstKicker?.textContent?.trim() === "今日の新着") firstKicker.textContent = newest ? "最新の更新" : "更新情報";
      }
    }

    const eventFeature = document.querySelector(".v4-event-feature");
    if (eventFeature) {
      eventFeature.removeAttribute("aria-labelledby");
      eventFeature.setAttribute("aria-label", "直方のイベント");
      eventFeature.querySelector("#v4-event-feature-title")?.remove();
    }
  }

  function p0EnhanceAccessibility() {
    document.querySelectorAll(".ca-lifecycle ol, .v4-event-filter-row, .v4-event-quick-filters").forEach((element) => {
      if (!element.hasAttribute("tabindex")) element.tabIndex = 0;
    });
    document.querySelector(".ca-lifecycle ol")?.setAttribute("aria-label", "イベントを見つけてから参加後までの流れ");
    document.querySelectorAll(".bottom-nav [data-v2-nav]").forEach((button) => {
      const active = typeof v2ActiveNav === "function" ? v2ActiveNav() : "home";
      button.setAttribute("aria-current", button.dataset.v2Nav === active ? "page" : "false");
    });
    document.querySelectorAll(".filter-chip, [data-v4-event-filter], [data-v4-community-filter]").forEach((button) => {
      button.setAttribute("aria-pressed", button.classList.contains("is-active") ? "true" : "false");
    });
  }

  function p0EnhanceInstallHelp() {
    const menu = document.querySelector(".v4-menu-sections") || document.querySelector(".v4-menu-grid, .v2-menu-grid");
    if (!menu || document.querySelector(".p0-install-help")) return;
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (standalone) return;
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent || "");
    const details = document.createElement("details");
    details.className = "p0-install-help card info-card";
    details.innerHTML = isAppleMobile
      ? "<summary>ホーム画面に追加する方法</summary><p>Safariでこのページを開き、共有ボタンから『ホーム画面に追加』を選びます。次からアプリのようにすぐ開けます。</p>"
      : "<summary>ホーム画面に追加する方法</summary><p>ブラウザのメニューから『アプリをインストール』または『ホーム画面に追加』を選びます。</p>";
    menu.insertAdjacentElement("afterend", details);
  }

  function p0UpdateCouncilLabels() {
    const timing = state.data?.council?.p0TimingState;
    if (!timing) return;
    const replacement = timing === "today" ? "本日の市議会" : timing === "stale" ? "次回の市議会" : "次の市議会";
    document.querySelectorAll("h1,h2,h3,strong,small,span,p").forEach((element) => {
      if (element.children.length) return;
      if (element.textContent?.trim() === "次の市議会") element.textContent = replacement;
    });
  }

  function p0PostRender() {
    document.body.classList.toggle("p0-returning", Boolean(state.priorVisitAt));
    p0FixRemovedHomeLabels();
    p0EnhanceSettings();
    p0EnhanceAccessibility();
    p0EnhanceInstallHelp();
    p0UpdateCouncilLabels();
  }

  document.addEventListener("click", (event) => {
    const region = event.target.closest("[data-p0-region]");
    if (!region) return;
    event.preventDefault();
    const input = document.querySelector('#v2-preferences-form input[name="district"]');
    if (input) {
      input.value = region.dataset.p0Region || "";
      input.focus();
    }
  });

  document.addEventListener("submit", (event) => {
    if (event.target.id !== "v2-preferences-form") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const formData = new FormData(event.target);
    const garbageArea = String(formData.get("garbageArea") || "");
    const interests = p0ValidInterests(formData.getAll("interests").map(String));
    state.v2Preferences = {
      district: String(formData.get("district") || "").trim(),
      garbageArea: ["east", "west"].includes(garbageArea) ? garbageArea : "",
      interests,
      lifeNotifications: formData.get("lifeNotifications") === "on",
      civicDigest: String(formData.get("civicDigest") || "weekly") === "off" ? "off" : "weekly",
    };
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(state.v2Preferences));
      if (typeof showToast === "function") showToast("設定を保存しました");
    } catch (error) {
      console.warn("Preference save failed", error);
      if (typeof showToast === "function") showToast("今回は反映しましたが、次に開くと元に戻ります");
    }
    render();
  }, true);

  p0RestorePreferences();

  const baseRender = render;
  render = function renderWithP0Stability() {
    p0NormalizeCouncilState();
    const result = baseRender();
    p0PostRender();
    requestAnimationFrame(p0PostRender);
    return result;
  };

  if (typeof v2ApplyHashRoute === "function") v2ApplyHashRoute();
  render();
})();
