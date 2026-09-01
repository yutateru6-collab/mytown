// Small compatibility layer kept separate so synced RSS search results can open
// a detail view without duplicating the main application bundle.
if (typeof currentSelectedItem === "function" && typeof combinedSearchItems === "function") {
  currentSelectedItem = function currentSelectedItemFromAllSyncedData() {
    return combinedSearchItems().find((item) => item.id === state.selectedId) || null;
  };
}
