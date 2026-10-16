const { query } = require('../config/db');
const nim = require('../ai/providers/nim/nim.provider');

async function searchProtocolChunks(queryText, { limit = 5 } = {}) {
  const trimmed = String(queryText || '').trim();
  if (!trimmed) return [];

  let embedding;
  try {
    const embedRes = await nim.embed(trimmed);
    embedding = embedRes?.data?.[0]?.embedding;
  } catch {
    return fallbackTextSearch(trimmed, limit);
  }

  if (!embedding) {
    return fallbackTextSearch(trimmed, limit);
  }

  const vectorLiteral = `[${embedding.join(',')}]`;
  const result = await query(
    `SELECT c.id, c.section_title, c.content, d.title AS document_title,
            (c.embedding <=> $1::vector) AS distance
     FROM protocol_chunks c
     JOIN protocol_documents d ON d.id = c.document_id
     WHERE c.embedding IS NOT NULL
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    [vectorLiteral, limit],
  );

  return result.rows.map((row) => ({
    chunkId: row.id,
    documentTitle: row.document_title,
    sectionTitle: row.section_title,
    content: row.content,
    distance: Number(row.distance),
  }));
}

async function fallbackTextSearch(queryText, limit) {
  const result = await query(
    `SELECT c.id, c.section_title, c.content, d.title AS document_title
     FROM protocol_chunks c
     JOIN protocol_documents d ON d.id = c.document_id
     WHERE c.content ILIKE $1
     LIMIT $2`,
    [`%${queryText.slice(0, 80)}%`, limit],
  );
  return result.rows.map((row) => ({
    chunkId: row.id,
    documentTitle: row.document_title,
    sectionTitle: row.section_title,
    content: row.content,
  }));
}

async function getProtocolSection(chunkId) {
  const result = await query(
    `SELECT c.id, c.section_title, c.content, d.title AS document_title, d.slug
     FROM protocol_chunks c
     JOIN protocol_documents d ON d.id = c.document_id
     WHERE c.id = $1`,
    [chunkId],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    chunkId: row.id,
    documentTitle: row.document_title,
    slug: row.slug,
    sectionTitle: row.section_title,
    content: row.content,
  };
}

async function ingestProtocolDocument({ slug, title, chunks }) {
  const docRes = await query(
    `INSERT INTO protocol_documents (slug, title, approved_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (slug) DO UPDATE SET title = EXCLUDED.title
     RETURNING id`,
    [slug, title],
  );
  const documentId = docRes.rows[0].id;
  await query('DELETE FROM protocol_chunks WHERE document_id = $1', [documentId]);

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    let embedding = null;
    try {
      const embedRes = await nim.embed(chunk.content);
      embedding = embedRes?.data?.[0]?.embedding;
    } catch {
      embedding = null;
    }
    if (embedding) {
      await query(
        `INSERT INTO protocol_chunks (document_id, chunk_index, section_title, content, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [documentId, i, chunk.sectionTitle || null, chunk.content, `[${embedding.join(',')}]`],
      );
    } else {
      await query(
        `INSERT INTO protocol_chunks (document_id, chunk_index, section_title, content)
         VALUES ($1, $2, $3, $4)`,
        [documentId, i, chunk.sectionTitle || null, chunk.content],
      );
    }
  }
  return { documentId, chunkCount: chunks.length };
}

module.exports = {
  searchProtocolChunks,
  getProtocolSection,
  ingestProtocolDocument,
};
