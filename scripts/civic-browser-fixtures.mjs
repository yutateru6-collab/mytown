// Browser-only fixtures. Never written into the public feed or sent to a publisher.
export function civicBrowserFixtures(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const day = Date.parse(`${today}T00:00:00Z`);
  const offset = (days) => new Date(day + days * 86400000).toISOString().slice(0, 10);
  const base = {
    summary: 'ブラウザ回帰テスト専用の架空イベントです。',
    sourceType: 'community', sourceLabel: 'テスト用掲載元', publisherName: 'テスト用掲載元',
    category: 'イベント', status: 'scheduled', statusLabel: '開催予定', tags: [],
    location: 'テスト会場', contentStatus: 'verified', contentIssues: [],
  };
  const event = (id, title, days, extra = {}) => ({ ...base, id, title,
    startDate: offset(days), endDate: offset(days), when: offset(days),
    sourceUrl: `https://example.org/${id}`, ...extra });
  const futureDates = [2, 7, 8, 75, 96].map(offset);
  return {
    events: [
      event('qa-closed-event', 'テスト：申込締切を過ぎたイベント', 14, {
        applicationDeadline: offset(-1), applicationStatus: 'closed', statusLabel: '受付終了', money: '5,000円',
      }),
      event('qa-merchandise-event', 'テスト：商品購入額と参加費の区別', 15, {
        summary: '1,100円は商品の購入額です。イベントの参加費としては表示しません。',
      }),
      event('qa-reviewed-price-event', 'テスト：確認済み参加費', 16, { money: '1,000円' }),
      event('qa-calendar-event', 'テスト：複数開催日の保存とカレンダー', -1, {
        occurrences: [offset(-1), ...futureDates], endDate: futureDates.at(-1), when: '複数開催日のテスト',
      }),
    ],
    futureDates,
  };
}
