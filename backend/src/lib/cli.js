const APP_NAME = 'PICU API';

const useColor =
  process.stdout.isTTY === true &&
  process.env.NO_COLOR === undefined &&
  process.env.FORCE_COLOR !== '0';

const esc = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

function visibleLength(text) {
  return text.replace(ANSI_PATTERN, '').length;
}

const styles = {
  bold: (text) => esc('1', text),
  dim: (text) => esc('2', text),
  cyan: (text) => esc('36', text),
  green: (text) => esc('32', text),
  yellow: (text) => esc('33', text),
  red: (text) => esc('31', text),
  magenta: (text) => esc('35', text),
};

function padLine(text, innerWidth) {
  const padding = Math.max(0, innerWidth - visibleLength(text));
  return ` ${text}${' '.repeat(padding)} `;
}

function drawBox(title, rows) {
  const innerWidth = Math.max(
    visibleLength(title) + 2,
    ...rows.map((row) => visibleLength(row) + 2),
    42,
  );
  const top = `╭${'─'.repeat(innerWidth)}╮`;
  const bottom = `╰${'─'.repeat(innerWidth)}╯`;
  const titleLine = `│${padLine(styles.bold(title), innerWidth)}│`;
  const divider = `├${'─'.repeat(innerWidth)}┤`;
  const body = rows.map((row) => `│${padLine(row, innerWidth)}│`);

  return [top, titleLine, divider, ...body, bottom].join('\n');
}

function maskDatabaseUrl(connectionString) {
  if (!connectionString) {
    return null;
  }

  try {
    const url = new URL(connectionString);
    if (url.password) {
      url.password = '••••';
    }
    return `${url.hostname}${url.pathname}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

function colorStatus(statusCode) {
  const code = String(statusCode);
  if (statusCode >= 500) {
    return styles.red(code);
  }
  if (statusCode >= 400) {
    return styles.yellow(code);
  }
  if (statusCode >= 300) {
    return styles.cyan(code);
  }
  return styles.green(code);
}

function logLine(prefix, message, style = (text) => text) {
  console.log(`${style(prefix)} ${message}`);
}

function logSuccess(message) {
  logLine('✔', message, styles.green);
}

function logWarn(message) {
  logLine('⚠', message, styles.yellow);
}

function logError(message) {
  logLine('✖', message, styles.red);
}

function logInfo(message) {
  logLine('→', message, styles.dim);
}

function printStartupBanner({ port, nodeEnv, baseUrl, databaseHost }) {
  const envLabel =
    nodeEnv === 'production' ? styles.magenta(nodeEnv) : styles.cyan(nodeEnv || 'development');

  const rows = [
    `${styles.dim('Environment')}  ${envLabel}`,
    `${styles.dim('Listening')}    ${styles.bold(baseUrl)}`,
    `${styles.dim('Health')}       ${styles.dim('GET /api/health')}`,
  ];

  if (databaseHost) {
    rows.push(`${styles.dim('Database')}     ${databaseHost}`);
  }

  console.log('');
  console.log(drawBox(APP_NAME, rows));
  console.log('');
}

function printHttpLog({ timestamp, method, url, status, responseTimeMs }) {
  const methodColors = {
    GET: styles.green,
    POST: styles.cyan,
    PUT: styles.yellow,
    PATCH: styles.yellow,
    DELETE: styles.red,
  };
  const paintMethod = methodColors[method] ?? styles.bold;

  console.log(
    [
      styles.dim(timestamp),
      paintMethod(method.padEnd(7)),
      url,
      colorStatus(status),
      styles.dim(`${responseTimeMs}ms`),
    ].join(' '),
  );
}

function printShutdown(signal) {
  console.log('');
  logInfo(`Received ${signal}, shutting down gracefully…`);
}

function printFatal(error) {
  console.log('');
  logError('Server failed to start');
  console.error(styles.dim(error.stack || error.message));
  process.exit(1);
}

module.exports = {
  APP_NAME,
  colorStatus,
  drawBox,
  logError,
  logInfo,
  logSuccess,
  logWarn,
  maskDatabaseUrl,
  printFatal,
  printHttpLog,
  printShutdown,
  printStartupBanner,
  styles,
};
