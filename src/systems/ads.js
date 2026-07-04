/* Neon Strike — Rewarded video mock (ad mediation stub) */
'use strict';

window.NeonAds = (function () {
  const Ads = {
    ready: true,
    shownCount: 0,
    removed: false,

    removeAds() { Ads.removed = true; },

    isReady() { return Ads.ready && !Ads.removed; },

    // Simulate a rewarded video. Calls onRewarded(granted) on completion.
    showRewarded(onRewarded) {
      if (!Ads.isReady()) { onRewarded(false); return; }
      Ads.shownCount++;
      // Mock network latency + user watches the full ad.
      setTimeout(() => {
        const granted = Math.random() > 0.05; // 95% fill
        if (onRewarded) onRewarded(granted);
      }, 300 + Math.random() * 700);
    },
  };
  return Ads;
})();
