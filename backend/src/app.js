const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { printHttpLog } = require('./lib/cli');

const app = express();

// --------------- Middleware ---------------
app.use(helmet());
app.use(cors());
app.use(
  morgan((tokens, req, res) => {
    printHttpLog({
      timestamp: tokens.date(req, res, 'iso'),
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: Number(tokens.status(req, res)),
      responseTimeMs: tokens['response-time'](req, res),
    });
    return null;
  }),
);
app.use(express.json());

// --------------- API Routes ---------------
const apiRouter = require('./routes');
app.use('/api', apiRouter);

// --------------- 404 ---------------
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// --------------- Error handler ---------------
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
