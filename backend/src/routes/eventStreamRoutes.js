const express = require('express');
const { query } = require('../config/db');
const { authenticateSse } = require('../middleware/sseAuth');
const { subscribeVisitEvents } = require('../services/visitEventBus');

const router = express.Router();

router.get('/stream', authenticateSse, async (req, res, next) => {
  try {
    const sinceId = Number(req.query.sinceId);
    const hasSinceId = Number.isInteger(sinceId) && sinceId > 0;

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (hasSinceId) {
      const backlog = await query(
        `SELECT id, visit_id, event_type, from_status, to_status, actor_type, agent_run_id, created_at
         FROM visit_events
         WHERE id > $1
         ORDER BY id ASC
         LIMIT 200`,
        [sinceId],
      );

      for (const row of backlog.rows) {
        const payload = {
          id: Number(row.id),
          visitId: Number(row.visit_id),
          eventType: row.event_type,
          fromStatus: row.from_status,
          toStatus: row.to_status,
          actorType: row.actor_type,
          agentRunId: row.agent_run_id,
          createdAt: row.created_at,
        };
        res.write(`id: ${payload.id}\n`);
        res.write('event: visit_event\n');
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    }

    const unsubscribe = subscribeVisitEvents((event) => {
      res.write(`id: ${event.id}\n`);
      res.write('event: visit_event\n');
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
