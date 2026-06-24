const manifestUrl = new URL('data/runs.json', import.meta.url);

let manifest = null;

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function runFromHash() {
  const hash = window.location.hash.replace(/^#/, '').trim();
  return hash || null;
}

function setHash(runId) {
  const next = `#${runId}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

async function loadManifest() {
  const res = await fetch(manifestUrl);
  if (!res.ok) throw new Error(`Failed to load manifest (${res.status})`);
  return res.json();
}

async function loadRun(runId) {
  const res = await fetch(new URL(`data/${runId}.json`, import.meta.url));
  if (!res.ok) throw new Error(`Failed to load run ${runId}`);
  return res.json();
}

function renderArchive(activeId) {
  const nav = document.getElementById('archive-list');
  nav.innerHTML = manifest.runs.map((run) => {
    const active = run.id === activeId ? ' active' : '';
    const todayMark = run.date === manifest.today ? ' · today' : '';
    return `
      <a class="day-link${active}" href="#${run.id}">
        ${escapeHtml(run.displayDate.split(',')[0])}${todayMark}
        <small>${escapeHtml(run.verdict)}</small>
      </a>
    `;
  }).join('');
}

function renderReport(run, isToday) {
  const { report, text, displayDate } = run;
  const headline = document.getElementById('headline');
  const subhead = document.getElementById('subhead');

  headline.textContent = isToday
    ? 'Did the monkeys write Shakespeare today?'
    : 'Did the monkeys write Shakespeare on this day?';
  subhead.textContent = `${displayDate} — ${report.verdict}`;

  const quotes = report.accidentalQuotations.length
    ? `<ul class="quote-list">${report.accidentalQuotations.map((quote) =>
      `<li>&ldquo;${escapeHtml(quote.text)}&rdquo; (${quote.words} words)</li>`
    ).join('')}</ul>`
    : '<p class="empty-state">None. Pure original monkey noise.</p>';

  document.getElementById('report').innerHTML = `
    <div class="verdict-card">
      <h2>${report.exactMatch ? 'Yes. Unfortunately.' : 'No. Not today.'}</h2>
      <p>${escapeHtml(report.verdict)}</p>
    </div>

    <div class="meta-row">
      <span class="chip"><strong>Monkey index</strong> ${report.monkeyIndex.toFixed(2)}</span>
      <span class="chip"><strong>Closest play</strong> ${escapeHtml(report.closestPassage.play)}</span>
      <span class="chip"><strong>Similarity</strong> ${pct(report.closestPassage.similarity)}</span>
    </div>

    <div class="meter">
      <div class="meter-label">
        <span>Monkey</span>
        <span>Shakespeare</span>
      </div>
      <div class="meter-track" aria-hidden="true">
        <div class="meter-fill" style="width: ${Math.max(4, report.monkeyIndex * 100)}%"></div>
      </div>
    </div>

    <div class="grid">
      <article class="stat">
        <h3>Accidental quotations</h3>
        <p>${report.accidentalQuotations.length} lifts, ${report.wordsLifted} words stolen</p>
        ${quotes}
      </article>
      <article class="stat">
        <h3>Closest passage</h3>
        <p>${pct(report.closestPassage.similarity)} similar to <em>${escapeHtml(report.closestPassage.play)}</em></p>
        <p class="excerpt">&ldquo;${escapeHtml(report.closestPassage.excerpt.slice(0, 180))}…&rdquo;</p>
      </article>
      <article class="stat">
        <h3>Canon vocabulary</h3>
        <p>${pct(report.canonVocabulary.rate)} Shakespeare-attested</p>
        ${report.canonVocabulary.alienWords.length
          ? `<p class="excerpt">Alien words: ${escapeHtml(report.canonVocabulary.alienWords.join(', '))}</p>`
          : ''}
      </article>
      <article class="stat">
        <h3>Elizabethan register</h3>
        <p>${(report.elizabethan.rate * 100).toFixed(1)}%${report.elizabethan.hits.length
          ? ` (${escapeHtml(report.elizabethan.hits.join(', '))})`
          : ''}</p>
      </article>
      <article class="stat">
        <h3>Pentameter drift</h3>
        <p>${report.pentameter.pentameterLines}/${report.pentameter.lines} lines accidentally iambic</p>
      </article>
    </div>

    <section class="prose">
      <h2>What the monkeys wrote</h2>
      <div class="prose-body">${escapeHtml(text)}</div>
    </section>
  `;
}

async function showRun(runId) {
  if (!manifest.runs.some((run) => run.id === runId)) {
    runId = manifest.todayRunId || manifest.latestRunId;
  }

  if (!runId) {
    document.getElementById('report').innerHTML = '<p class="empty-state">No runs yet. The monkeys are still warming up.</p>';
    return;
  }

  const run = await loadRun(runId);
  const isToday = run.date === manifest.today;
  renderArchive(runId);
  renderReport(run, isToday);
}

async function init() {
  manifest = await loadManifest();
  const initial = runFromHash() || manifest.todayRunId || manifest.latestRunId;
  await showRun(initial);

  window.addEventListener('hashchange', async () => {
    await showRun(runFromHash() || manifest.todayRunId || manifest.latestRunId);
  });
}

init().catch((error) => {
  document.getElementById('report').innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`;
});
