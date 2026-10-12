function logVisitAction(payload) {
  const entry = {
    type: 'visit_action',
    ts: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(entry));
}

module.exports = { logVisitAction };
