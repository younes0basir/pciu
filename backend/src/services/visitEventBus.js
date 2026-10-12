const listeners = new Set();

function subscribeVisitEvents(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function publishVisitEvent(event) {
  if (!event || event.id == null) {
    return;
  }
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error(
        JSON.stringify({
          type: 'visit_event_bus_error',
          message: error instanceof Error ? error.message : 'listener failed',
        }),
      );
    }
  }
}

module.exports = {
  subscribeVisitEvents,
  publishVisitEvent,
};
