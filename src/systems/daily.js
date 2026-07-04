/* Neon Strike — Daily challenge helpers */
'use strict';

window.NeonDaily = (function () {
  // Return a deterministic integer seed from the current UTC date.
  function todaySeed() {
    const d = new Date();
    return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
  }

  // Simple LCG seeded random.
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Deterministic wind and wall count for the daily challenge.
  function getDailyConfig(seed) {
    const rand = rng(seed || todaySeed());
    return {
      seed: seed || todaySeed(),
      level: 1 + Math.floor(rand() * 5), // mix levels 1–5
      wind: (rand() < 0.5 ? -1 : 1) * (40 + Math.floor(rand() * 80)),
      wall: Math.floor(rand() * 3), // 0–2
      keeper: true,
    };
  }

  return { todaySeed, rng, getDailyConfig };
})();
