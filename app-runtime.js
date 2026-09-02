// Runtime safeguards for synchronized official data.
if (typeof currentSelectedItem === "function" && typeof combinedSearchItems === "function") {
  currentSelectedItem = function currentSelectedItemFromAllSyncedData() {
    return combinedSearchItems().find((item) => item.id === state.selectedId) || null;
  };
}

if (typeof syncBanner === "function") {
  syncBanner = function syncBannerWithSourceHealth() {
    const { generatedAt, verifiedOn, sourceHealth = [] } = state.data;
    if (state.loadError) {
      return `<div class="sync-banner is-warning" role="status"><strong>市の情報を読み込めませんでした</strong><span>現在は一部の情報だけを表示しています。市のページで最新情報を確認してください。</span></div>`;
    }
    const failed = sourceHealth.filter((source) => source.status !== "ok");
    if (failed.length) {
      return `<div class="sync-banner is-warning" role="status"><div><span class="official-badge">一部更新できず</span><strong>${failed.length}件の情報を更新できませんでした</strong></div><span>確認できた情報は表示しています。大切な内容は市のページでも確認してください。</span></div>`;
    }
    return `<div class="sync-banner" role="status"><div><span class="official-badge">市の公開情報から</span><strong>直方市の情報を掲載</strong></div><span>最終更新：${generatedAt ? esc(formatDateTime(generatedAt)) : esc(verifiedOn || "確認済み")}</span></div>`;
  };
}
