import test from 'node:test';
import assert from 'node:assert/strict';

import { assertPromptIsClean, MONKEY_MESSAGES } from '../src/llm.js';
import {
  compareToShakespeare,
  longestSharedPhrase,
  accidentalQuotations,
  renderVerdict,
  jaccard,
  charNgrams
} from '../src/metrics.js';

test('LLM prompt does not mention the benchmark corpus', () => {
  assertPromptIsClean();
  assert.equal(MONKEY_MESSAGES.length, 2);
  assert.equal(MONKEY_MESSAGES[0].content, 'You are an infinity of monkeys at typewriters');
  assert.equal(MONKEY_MESSAGES[1].content, 'Write something');
});

test('jaccard scores overlap sensibly', () => {
  const a = charNgrams('to be or not to be', 3);
  const b = charNgrams('to be or not to bee', 3);
  const c = charNgrams('xyzzy plugh', 3);

  assert.ok(jaccard(a, b) > jaccard(a, c));
});

test('longest shared phrase finds verbatim overlap', () => {
  const candidate = 'well to be or not to be is the thing';
  const corpus = 'whether tis nobler to be or not to be that is the question';

  const phrase = longestSharedPhrase(candidate, corpus);

  assert.equal(phrase.text, 'to be or not to be');
  assert.equal(phrase.wordCount, 6);
});

test('accidental quotations find multiple non-overlapping lifts', () => {
  const candidate = 'to be or not to be and love looks not with the eyes';
  const corpus = 'to be or not to be that is the question love looks not with the eyes but with the mind';

  const quotes = accidentalQuotations(candidate, corpus);

  assert.ok(quotes.some((quote) => quote.text === 'to be or not to be'));
  assert.ok(quotes.some((quote) => quote.text === 'love looks not with the eyes'));
});

test('monkey output is scored against toy shakespeare', () => {
  const candidate = 'well to be or not to be is the thing';
  const rawCorpus = `
    THE TRAGEDY OF HAMLET, PRINCE OF DENMARK
    To be, or not to be, that is the question.
    Whether 'tis nobler in the mind to suffer.
  `;
  const corpus = rawCorpus.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const report = compareToShakespeare(candidate, corpus, rawCorpus);

  assert.equal(report.exactMatch, false);
  assert.ok(report.monkeyIndex > 0);
  assert.ok(report.closestPassage.similarity > 0);
  assert.equal(report.accidentalQuotations[0].text, 'to be or not to be');
  assert.ok(report.verdict.length > 0);
});

test('verdict calls out verbatim theft', () => {
  const verdict = renderVerdict({
    exactMatch: false,
    monkeyIndex: 0.2,
    play: 'Hamlet',
    similarity: 0.2,
    quotations: [{ text: 'to be or not to be', words: 6 }],
    wordsLifted: 14,
    elizabethan: { hits: [], rate: 0 },
    pentameter: { rate: 0.1, lines: 5, pentameterLines: 0 },
    canon: { rate: 0.9, alienWords: [] }
  });

  assert.match(verdict, /14 words were lifted/);
});
