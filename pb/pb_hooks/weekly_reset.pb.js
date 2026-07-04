// PocketBase JS hook: clear daily leaderboards every Monday at 00:00 UTC.
// Place in pb/pb_hooks/ and restart PocketBase.
cronAdd('weekly-leaderboard-reset', '0 0 * * 1', () => {
  try {
    $app.dao().db()
      .newQuery('DELETE FROM scores WHERE dailySeed IS NOT NULL AND created < datetime("now", "-7 days")')
      .execute();
    console.log('Weekly daily leaderboard reset completed');
  } catch (e) {
    console.error('Weekly reset failed:', e);
  }
});
