const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePeriod,
  formatRate,
  fillSeries,
  completeCategories,
  orderedCounts,
} = require('../services/patientAnalyticsService');

test('normalizePeriod defaults to today and rejects unknown windows', () => {
  assert.equal(normalizePeriod(undefined), 'today');
  assert.equal(normalizePeriod('30d'), '30d');
  assert.throws(() => normalizePeriod('year'), (error) => error.status === 400);
});

test('formatRate returns one decimal share and null without a denominator', () => {
  assert.equal(formatRate(1, 4), 25);
  assert.equal(formatRate(1, 3), 33.3);
  assert.equal(formatRate(0, 0), null);
});

test('fillSeries keeps every hour and every day in the window', () => {
  const hours = fillSeries([{ bucket: '2026-10-14T09', count: 3 }], {
    granularity: 'hour',
    windowStart: '2026-10-14',
    windowEnd: '2026-10-14',
  });
  assert.equal(hours.length, 24);
  assert.equal(hours[0].count, 0);
  assert.equal(hours[9].count, 3);
  assert.equal(hours[9].label, '09 h');

  const days = fillSeries([{ bucket: '2026-10-13', count: 2 }], {
    granularity: 'day',
    windowStart: '2026-10-12',
    windowEnd: '2026-10-14',
  });
  assert.deepEqual(
    days.map((point) => point.bucket),
    ['2026-10-12', '2026-10-13', '2026-10-14']
  );
  assert.equal(days[1].count, 2);
});

test('category helpers keep a stable priority scale and drop empty outcomes', () => {
  assert.deepEqual(completeCategories([{ key: '2', count: 4 }], ['1', '2']), [
    { key: '1', count: 0 },
    { key: '2', count: 4 },
  ]);
  assert.deepEqual(
    orderedCounts([{ key: 'discharged', count: 2 }], ['open', 'discharged'], { hideZero: true }),
    [{ key: 'discharged', count: 2 }]
  );
});
