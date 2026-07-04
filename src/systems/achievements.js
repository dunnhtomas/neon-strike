/* Neon Strike — Achievements system */
'use strict';

window.NeonAchievements = (function () {
  const list = [
    { id: 'first_goal',   name: 'First Blood', desc: 'Score your first goal' },
    { id: 'swish_100',    name: 'Century',     desc: 'Score 100 total goals' },
    { id: 'goal_40m',     name: 'From Range',  desc: 'Score from 40m+' },
    { id: 'streak_5',     name: 'On Fire',     desc: 'Reach a ×5 streak' },
    { id: 'perfect_10',   name: 'Perfectionist', desc: 'Score 10 perfect top-corner goals' },
    { id: 'storm_rider',  name: 'Storm Rider', desc: 'Score during the storm finale' },
  ];

  function freshRecord() {
    const r = {};
    list.forEach(a => { r[a.id] = { unlocked: false, at: null }; });
    return r;
  }

  function load(state) {
    if (!state.achievements) state.achievements = freshRecord();
    list.forEach(a => { if (!state.achievements[a.id]) state.achievements[a.id] = { unlocked: false, at: null }; });
  }

  function unlock(state, id) {
    if (!state.achievements) load(state);
    const rec = state.achievements[id];
    if (rec && !rec.unlocked) {
      rec.unlocked = true;
      rec.at = Date.now();
      return list.find(a => a.id === id) || null;
    }
    return null;
  }

  function check(state, event) {
    const newly = [];
    load(state);
    if (event.goal) {
      newly.push(unlock(state, 'first_goal'));
      if ((event.totalGoals || 0) >= 100) newly.push(unlock(state, 'swish_100'));
      if ((event.distance || 0) >= 40) newly.push(unlock(state, 'goal_40m'));
      if ((event.streak || 0) >= 5) newly.push(unlock(state, 'streak_5'));
      if ((event.perfectCount || 0) >= 10) newly.push(unlock(state, 'perfect_10'));
      if (event.storm) newly.push(unlock(state, 'storm_rider'));
    }
    return newly.filter(Boolean);
  }

  return { list, freshRecord, load, unlock, check };
})();
