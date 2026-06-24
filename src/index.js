import { askTheMonkeys } from './llm.js';
import { loadCorpus } from './corpus.js';
import { compareToShakespeare } from './metrics.js';
import { saveRawRun, saveReport } from './log.js';

const { text: candidate, raw } = await askTheMonkeys();
const logPath = await saveRawRun(raw);
const { raw: corpusRaw, normalized } = await loadCorpus();

const report = compareToShakespeare(candidate, normalized, corpusRaw);
await saveReport(logPath, { text: candidate, report });

console.log(`\nLogged to ${logPath}\n`);
console.log('=== THE MONKEYS WROTE ===\n');
console.log(candidate);
console.log('\n=== SHAKESPEARE AUDIT ===\n');
console.log(`Monkey index: ${report.monkeyIndex} / 1.00`);
console.log(`Verdict: ${report.verdict}\n`);

console.log(`Closest passage: ${report.closestPassage.play} (${Math.round(report.closestPassage.similarity * 100)}% similar)`);
console.log(`"${report.closestPassage.excerpt.slice(0, 200)}…"\n`);

if (report.accidentalQuotations.length) {
  console.log(`Accidental quotations (${report.accidentalQuotations.length}, ${report.wordsLifted} words lifted):`);
  for (const quote of report.accidentalQuotations) {
    console.log(`  • "${quote.text}" (${quote.words} words)`);
  }
  console.log('');
} else {
  console.log('Accidental quotations: none\n');
}

console.log(`Canon vocabulary: ${Math.round(report.canonVocabulary.rate * 100)}% Shakespeare-attested`);
if (report.canonVocabulary.alienWords.length) {
  console.log(`Alien words: ${report.canonVocabulary.alienWords.join(', ')}`);
}

console.log(`Elizabethan register: ${Math.round(report.elizabethan.rate * 1000) / 10}%${report.elizabethan.hits.length ? ` (${report.elizabethan.hits.join(', ')})` : ''}`);
console.log(`Pentameter drift: ${report.pentameter.pentameterLines}/${report.pentameter.lines} lines accidentally iambic`);

console.log('\n=== RAW REPORT ===\n');
console.log(JSON.stringify(report, null, 2));
