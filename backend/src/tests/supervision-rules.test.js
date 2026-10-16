const test = require('node:test');
const assert = require('node:assert/strict');
const { ruleConfigured } = require('../services/supervisionRulesService');

test('ruleConfigured rejects unapproved delay thresholds', () => {
  assert.equal(ruleConfigured({ enabled: true, minutes: 30, approved: false }), false);
  assert.equal(ruleConfigured({ enabled: true, minutes: 30, approved: true }), true);
  assert.equal(ruleConfigured({ enabled: false, minutes: 30, approved: true }), false);
});
