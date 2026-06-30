// Service worker - currently only keeps extension lifecycle hooks in one place.
chrome.runtime.onInstalled.addListener(() => {
  console.log("Session Vault installed.");
});
