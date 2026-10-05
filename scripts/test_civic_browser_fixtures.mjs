import assert from 'node:assert/strict';
import { civicBrowserFixtures } from './civic-browser-fixtures.mjs';
for (const now of ['2026-10-05T13:00:00Z', '2026-12-31T15:01:00Z', '2027-04-01T00:00:00Z']) {
  const f = civicBrowserFixtures(new Date(now));
  assert.equal(f.events.length, 4);
  assert.equal(f.futureDates.length, 5);
  const calendar = f.events.at(-1);
  assert.ok(f.events[0].applicationDeadline < f.events[0].startDate);
  assert.equal(new Set(calendar.occurrences).size, 6);
  assert.ok(calendar.startDate < f.futureDates[0]);
  assert.deepEqual(calendar.occurrences.slice(1), f.futureDates);
  assert.ok(f.events.every((event) => event.sourceUrl.startsWith('https://example.org/')));
}
console.log('Date-relative browser fixture checks passed');
