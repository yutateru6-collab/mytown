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
      return `<div class="sync-banner is-warning" role="status"><strong>公式データを読み込めませんでした</strong><span>現在は最低限の初期情報を表示しています。公式ページで最新情報を確認してください。</span></div>`;
    }
    const failed = sourceHealth.filter((source) => source.status !== "ok");
    if (failed.length) {
      return `<div class="sync-banner is-warning" role="status"><div><span class="official-badge">一部確認できず</span><strong>${failed.length}件の情報源で更新確認に失敗</strong></div><span>確認済みデータは表示していますが、各公式ページもご確認ください。</span></div>`;
    }
    return `<div class="sync-banner" role="status"><div><span class="official-badge">公式情報ベース</span><strong>直方市の公開情報を表示</strong></div><span>データ更新：${generatedAt ? esc(formatDateTime(generatedAt)) : esc(verifiedOn || "確認済み")}</span></div>`;
  };
}
