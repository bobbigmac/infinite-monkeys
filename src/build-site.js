import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LOG_DIR = 'logs';
const DOCS_DIR = 'docs';
const DATA_DIR = path.join(DOCS_DIR, 'data');

function runIdFromBasename(base) {
  return base.replace(/\.json$/i, '');
}

function displayDate(id) {
  const match = id.match(/^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2})(\d{2})(\d{2}))?$/);
  if (!match) return id;

  const [, year, month, day, hh, mm, ss] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const formatted = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });

  if (!hh) return formatted;
  return `${formatted}, ${hh}:${mm}:${ss} UTC`;
}

function extractTextFromMarkdown(md) {
  const parts = md.split('\n---\n');
  return parts.length > 1 ? parts.slice(1).join('\n---\n').trim() : md.trim();
}

function emptyReport() {
  return {
    monkeyIndex: 0,
    verdict: 'Historical run — audit data was not archived for this attempt.',
    exactMatch: false,
    closestPassage: { play: 'Unknown', similarity: 0, excerpt: '' },
    accidentalQuotations: [],
    wordsLifted: 0,
    canonVocabulary: { rate: 0, alienWords: [] },
    elizabethan: { hits: [], rate: 0 },
    pentameter: { lines: 0, pentameterLines: 0, rate: 0 }
  };
}

async function loadRun(base) {
  const id = runIdFromBasename(base);
  const jsonPath = path.join(LOG_DIR, `${id}.json`);
  const reportPath = path.join(LOG_DIR, `${id}.report.json`);
  const mdPath = path.join(LOG_DIR, `${id}.md`);

  let text;
  let report;

  try {
    const saved = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    text = saved.text;
    report = saved.report;
  } catch {
    const md = await fs.readFile(mdPath, 'utf8');
    text = extractTextFromMarkdown(md);
    report = emptyReport();
  }

  let model = 'unknown';
  try {
    const json = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    model = json.model ?? model;
  } catch {
    // report-only fallback
  }

  return {
    id,
    date: id.slice(0, 10),
    displayDate: displayDate(id),
    model,
    text,
    report
  };
}

export async function buildSite() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const entries = await fs.readdir(LOG_DIR);
  const bases = entries
    .filter((name) => name.endsWith('.json') && !name.endsWith('.report.json'))
    .map((name) => runIdFromBasename(name))
    .sort((a, b) => b.localeCompare(a));

  const runs = [];

  for (const base of bases) {
    const run = await loadRun(base);
    runs.push({
      id: run.id,
      date: run.date,
      displayDate: run.displayDate,
      monkeyIndex: run.report.monkeyIndex,
      verdict: run.report.verdict,
      exactMatch: run.report.exactMatch
    });

    await fs.writeFile(
      path.join(DATA_DIR, `${run.id}.json`),
      `${JSON.stringify(run, null, 2)}\n`,
      'utf8'
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const manifest = {
    generatedAt: new Date().toISOString(),
    today,
    latestRunId: runs[0]?.id ?? null,
    todayRunId: runs.find((run) => run.date === today)?.id ?? runs[0]?.id ?? null,
    runs
  };

  await fs.writeFile(
    path.join(DATA_DIR, 'runs.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildSite();
  console.log(`Built site data for ${manifest.runs.length} run(s) -> ${DATA_DIR}/`);
}
