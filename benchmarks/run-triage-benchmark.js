#!/usr/bin/env node
/**
 * Triage benchmark runner — calls NIM structured output and records latency.
 * Usage: from repo root, with backend .env loaded:
 *   node benchmarks/run-triage-benchmark.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const fs = require('fs');
const path = require('path');
const nim = require('../backend/src/ai/providers/nim/nim.provider');
const schema = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../backend/src/ai/schemas/triage-recommendation.schema.json'),
    'utf8',
  ),
);

async function main() {
  const cases = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'triage/sample-cases.json'), 'utf8'),
  );
  const registry = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'model_registry.json'), 'utf8'),
  );
  const model =
    registry.models.find((m) => m.profile === 'reasoning')?.id ||
    process.env.AI_REASONING_MODEL;

  const results = [];
  for (const testCase of cases) {
    const started = Date.now();
    try {
      const { parsed } = await nim.structured(
        [
          {
            role: 'system',
            content: 'Emergency triage assistant. JSON schema output. French context.',
          },
          { role: 'user', content: JSON.stringify(testCase) },
        ],
        schema,
        { schemaName: 'triage_benchmark', model },
      );
      results.push({
        id: testCase.id,
        ok: true,
        latencyMs: Date.now() - started,
        suggestedPriority: parsed.suggested_priority,
      });
    } catch (error) {
      results.push({
        id: testCase.id,
        ok: false,
        latencyMs: Date.now() - started,
        error: error.message,
      });
    }
  }

  const outPath = path.join(__dirname, 'triage', 'last-run.json');
  fs.writeFileSync(outPath, JSON.stringify({ model, at: new Date().toISOString(), results }, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
