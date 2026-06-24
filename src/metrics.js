import { buildPlayIndex, normalizeText, playAtOffset } from './corpus.js';

const ELIZABETHAN = new Set([
  'thou', 'thee', 'thy', 'thine', 'ye', 'hath', 'doth', 'dost', 'art', 'wert',
  'hast', 'oft', 'nay', 'aye', 'ay', 'prithee', 'forsooth', 'anon', 'hither',
  'thither', 'whence', 'wherefore', 'methinks', 'alas', 'fie', 'marry', 'troth',
  'verily', 'betwixt', 'ere', 'twixt', 'tis', 'twas', 'twere', 'taen', 'oer',
  'canst', 'shalt', 'wouldst', 'couldst', 'shouldst', 'didst', 'knowest'
]);

export function compareToShakespeare(candidateRaw, corpusRaw, rawCorpus = corpusRaw) {
  const candidate = normalizeText(candidateRaw);
  const corpus = normalizeText(corpusRaw);
  const plays = buildPlayIndex(corpus, rawCorpus);
  const bestMatch = findBestMatch(candidate, corpus);
  const quotations = accidentalQuotations(candidate, corpus);
  const longest = quotations[0] ?? { text: '', wordCount: 0 };
  const canon = canonVocabulary(candidate, corpus);
  const elizabethan = elizabethanRegister(candidate);
  const pentameter = pentameterDrift(candidateRaw);
  const wordsLifted = countWordsLifted(quotations);
  const monkeyIndex = scoreMonkeyIndex({
    exactMatch: corpus.includes(candidate),
    similarity: bestMatch.similarity,
    longestPhraseWords: longest.wordCount,
    wordsLifted,
    candidateWords: words(candidate),
    pentameterRate: pentameter.rate,
    elizabethanRate: elizabethan.rate,
    canonRate: canon.rate
  });

  const report = {
    monkeyIndex,
    verdict: renderVerdict({
      exactMatch: corpus.includes(candidate),
      monkeyIndex,
      play: playAtOffset(plays, bestMatch.offset),
      similarity: bestMatch.similarity,
      quotations,
      wordsLifted,
      elizabethan,
      pentameter,
      canon
    }),
    exactMatch: corpus.includes(candidate),
    closestPassage: {
      play: playAtOffset(plays, bestMatch.offset),
      similarity: round(bestMatch.similarity),
      excerpt: bestMatch.text.slice(0, 400)
    },
    accidentalQuotations: quotations.map((quote) => ({
      text: quote.text,
      words: quote.wordCount
    })),
    wordsLifted,
    canonVocabulary: {
      rate: round(canon.rate),
      alienWords: canon.alienWords
    },
    elizabethan: {
      hits: elizabethan.hits,
      rate: round(elizabethan.rate)
    },
    pentameter: {
      lines: pentameter.lines,
      pentameterLines: pentameter.pentameterLines,
      rate: round(pentameter.rate)
    }
  };

  return report;
}

export function renderVerdict({
  exactMatch,
  monkeyIndex,
  play,
  similarity,
  quotations,
  wordsLifted,
  elizabethan,
  pentameter,
  canon
}) {
  if (exactMatch) {
    return 'The monkeys have done it. Someone call the folio people.';
  }

  if (monkeyIndex >= 0.65) {
    return `Alarmingly close to ${play}. The theorem may be working.`;
  }

  if (quotations.length >= 3 || wordsLifted >= 12) {
    return `Not Shakespeare, but ${wordsLifted} words were lifted verbatim from the canon across ${quotations.length} accidental quotations.`;
  }

  if (similarity >= 0.35) {
    return `Strongest pull toward ${play} (${Math.round(similarity * 100)}% texture match). Still a monkey, but a cultured one.`;
  }

  if (pentameter.rate >= 0.35) {
    return 'Accidental iambic pentameter detected. Rhythm without genius.';
  }

  if (elizabethan.hits.length >= 2) {
    return `Elizabethan diction spotted (${elizabethan.hits.join(', ')}), but mostly modern monkey business.`;
  }

  if (canon.alienWords.length >= 8) {
    return `Largely alien vocabulary (${canon.alienWords.slice(0, 5).join(', ')}…). Pure monkey.`;
  }

  return 'No bard detected. Statistically, still mostly monkeys.';
}

function scoreMonkeyIndex({
  exactMatch,
  similarity,
  longestPhraseWords,
  wordsLifted,
  candidateWords,
  pentameterRate,
  elizabethanRate,
  canonRate
}) {
  if (exactMatch) return 1;

  const phraseScore = Math.min(longestPhraseWords / 15, 1);
  const liftScore = candidateWords ? Math.min(wordsLifted / candidateWords, 1) : 0;

  return round(
    similarity * 0.35
    + phraseScore * 0.25
    + liftScore * 0.2
    + pentameterRate * 0.1
    + Math.min(elizabethanRate * 8, 1) * 0.05
    + canonRate * 0.05
  );
}

export function findBestMatch(candidate, corpus) {
  if (!candidate.length) {
    return { offset: 0, text: '', similarity: 0 };
  }

  const size = clamp(candidate.length * 2, 500, 5000);
  const step = Math.max(100, Math.floor(size / 3));
  const candidateGrams = charNgrams(candidate, 3);

  let best = {
    offset: 0,
    text: corpus.slice(0, size),
    similarity: 0
  };

  for (let offset = 0; offset < corpus.length; offset += step) {
    const text = corpus.slice(offset, offset + size);
    const similarity = jaccard(candidateGrams, charNgrams(text, 3));

    if (similarity > best.similarity) {
      best = { offset, text, similarity };
    }
  }

  return best;
}

export function accidentalQuotations(candidate, corpus, minWords = 3) {
  const tokens = candidate.match(/[a-z0-9']+/g) ?? [];
  const longestFromStart = new Map();

  for (let start = 0; start < tokens.length; start++) {
    let best = null;

    for (let end = start + minWords; end <= tokens.length; end++) {
      const phrase = tokens.slice(start, end).join(' ');
      if (corpus.includes(phrase)) {
        best = { text: phrase, wordCount: end - start, start };
        continue;
      }
      break;
    }

    if (best) longestFromStart.set(best.text, best);
  }

  const sorted = [...longestFromStart.values()].sort((a, b) => b.wordCount - a.wordCount);
  const maximal = [];

  for (const quote of sorted) {
    const covered = maximal.some((existing) =>
      quote.start >= existing.start
      && quote.start + quote.wordCount <= existing.start + existing.wordCount
    );
    if (!covered) maximal.push(quote);
  }

  return maximal.sort((a, b) => a.start - b.start);
}

export function longestSharedPhrase(candidate, corpus) {
  const quotes = accidentalQuotations(candidate, corpus, 1);
  const longest = quotes.sort((a, b) => b.wordCount - a.wordCount)[0];
  return longest ?? { text: '', wordCount: 0 };
}

function canonVocabulary(candidate, corpus) {
  const corpusWords = new Set(corpus.match(/[a-z0-9']+/g) ?? []);
  const candidateWords = candidate.match(/[a-z0-9']+/g) ?? [];
  const alien = [];

  for (const word of new Set(candidateWords)) {
    if (!corpusWords.has(word)) alien.push(word);
  }

  const attested = candidateWords.filter((word) => corpusWords.has(word)).length;

  return {
    rate: candidateWords.length ? attested / candidateWords.length : 0,
    alienWords: alien.sort((a, b) => a.localeCompare(b)).slice(0, 12)
  };
}

function elizabethanRegister(candidate) {
  const tokens = candidate.match(/[a-z0-9']+/g) ?? [];
  const hits = [...new Set(tokens.filter((word) => ELIZABETHAN.has(word)))];

  return {
    hits,
    rate: tokens.length ? hits.length / tokens.length : 0
  };
}

function pentameterDrift(text) {
  const lines = text
    .split(/\n+|[.!?]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let pentameterLines = 0;

  for (const line of lines) {
    const syllables = syllableCount(line);
    if (syllables >= 9 && syllables <= 11) pentameterLines++;
  }

  return {
    lines: lines.length,
    pentameterLines,
    rate: lines.length ? pentameterLines / lines.length : 0
  };
}

function syllableCount(text) {
  const tokens = text.match(/[a-z0-9']+/gi) ?? [];
  return tokens.reduce((sum, token) => sum + countWordSyllables(token), 0);
}

function countWordSyllables(word) {
  let token = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!token) return 0;
  if (token.length <= 3) return 1;

  token = token.replace(/e$/g, '');
  const groups = token.match(/[aeiouy]+/g);
  return Math.max(1, groups?.length ?? 1);
}

function countWordsLifted(quotations) {
  const lifted = new Set();
  for (const quote of quotations) {
    for (let i = 0; i < quote.wordCount; i++) {
      lifted.add(`${quote.start}:${i}`);
    }
  }
  return lifted.size;
}

function words(text) {
  return text.match(/[a-z0-9']+/g)?.length ?? 0;
}

export function charNgrams(text, n) {
  const grams = new Set();

  if (text.length < n) {
    if (text.length) grams.add(text);
    return grams;
  }

  for (let i = 0; i <= text.length - n; i++) {
    grams.add(text.slice(i, i + n));
  }

  return grams;
}

export function jaccard(a, b) {
  if (!a.size && !b.size) return 1;

  let intersection = 0;

  for (const value of a) {
    if (b.has(value)) intersection++;
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
