import fs from 'node:fs/promises';
import path from 'node:path';
import { loadCorpus } from './corpus.js';
import { compareToShakespeare } from './metrics.js';
import { saveReport } from './log.js';

function extractTextFromMarkdown(md) {
  const parts = md.split('\n---\n');
  return parts.length > 1 ? parts.slice(1).join('\n---\n').trim() : md.trim();
}

const corpusBundle = await loadCorpus();
const entries = await fs.readdir('logs');
const bases = entries.filter((name) => name.endsWith('.json') && !name.endsWith('.report.json'));

for (const base of bases) {
  const id = base.replace(/\.json$/i, '');
  const reportPath = path.join('logs', `${id}.report.json`);
  try {
    await fs.access(reportPath);
    console.log(`skip ${id} (report exists)`);
    continue;
  } catch {
    // backfill
  }

  const md = await fs.readFile(path.join('logs', `${id}.md`), 'utf8');
  const text = extractTextFromMarkdown(md);
  const report = compareToShakespeare(text, corpusBundle.normalized, corpusBundle.raw);
  const jsonPath = path.join('logs', base);
  await saveReport(jsonPath, { text, report });
  console.log(`backfilled ${id}`);
}
