import fs from 'node:fs/promises';

const START_MARKERS = [
  '*** START OF THE PROJECT GUTENBERG EBOOK',
  '*** START OF THIS PROJECT GUTENBERG EBOOK'
];

const END_MARKERS = [
  '*** END OF THE PROJECT GUTENBERG EBOOK',
  '*** END OF THIS PROJECT GUTENBERG EBOOK'
];

export async function loadShakespeare(path = 'corpus/shakespeare.txt') {
  const { normalized } = await loadCorpus(path);
  return normalized;
}

export async function loadCorpus(path = 'corpus/shakespeare.txt') {
  const file = await fs.readFile(path, 'utf8');
  const raw = stripGutenbergWrapper(file);
  return { raw, normalized: normalizeText(raw) };
}

export function stripGutenbergWrapper(raw) {
  let text = raw.replace(/\r\n/g, '\n');

  const start = firstIndexOfAny(text, START_MARKERS);
  if (start !== -1) {
    const afterStartLine = text.indexOf('\n', start);
    text = text.slice(afterStartLine + 1);
  }

  const end = firstIndexOfAny(text, END_MARKERS);
  if (end !== -1) {
    text = text.slice(0, end);
  }

  return text;
}

export function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPlayIndex(normalizedCorpus, rawCorpus) {
  const plays = [];

  for (const line of rawCorpus.split('\n')) {
    const title = line.trim();
    if (!isPlayTitle(title)) continue;

    const offset = normalizedCorpus.indexOf(normalizeText(title));
    if (offset >= 0) {
      plays.push({ title: titleCase(title), offset });
    }
  }

  return plays.sort((a, b) => a.offset - b.offset);
}

export function playAtOffset(plays, offset) {
  let play = 'the canon (unplaced)';
  for (const entry of plays) {
    if (entry.offset <= offset) play = entry.title;
    else break;
  }
  return play;
}

function isPlayTitle(line) {
  if (line.length < 12 || line.length > 90) return false;
  if (!/^[A-Z][A-Z0-9\s,';&\-]+$/.test(line)) return false;
  if (/GUTENBERG|EBOOK|CONTENTS|START OF|END OF|WILLIAM SHAKESPEARE/.test(line)) return false;

  return (
    line.startsWith('THE ')
    || line.startsWith("ALL'S ")
    || line.startsWith('AS YOU ')
    || line.startsWith('KING ')
    || line.startsWith("LOVE'S ")
    || line.startsWith('A MIDSUMMER')
    || line.startsWith('A LOVER')
    || line.startsWith('THE SONNETS')
    || line.includes('TRAGEDY')
    || line.includes('COMEDY')
    || line.includes('LIFE OF')
    || line.includes('LIFE AND DEATH')
  );
}

function titleCase(title) {
  return title
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function firstIndexOfAny(text, needles) {
  const hits = needles
    .map((needle) => text.indexOf(needle))
    .filter((index) => index >= 0);

  return hits.length ? Math.min(...hits) : -1;
}
