import fs from 'node:fs/promises';
import path from 'node:path';

function dateStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function titleDateFromBasename(base) {
  return base.replace(/^(\d{4}-\d{2}-\d{2})(?:-(\d{2})(\d{2})(\d{2}))?$/, (_, date, hh, mm, ss) => {
    if (!hh) return date;
    return `${date} ${hh}:${mm}:${ss} UTC`;
  });
}

export function sanitizeResponseForLog(raw, now = new Date()) {
  const json = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw);
  const runId = `run-${now.toISOString().replace(/[:.]/g, '-')}`;

  delete json.system_fingerprint;
  delete json.request_id;
  delete json.requestID;
  delete json.service_tier;

  json.id = runId;
  json.created = Math.floor(now.getTime() / 1000);

  return json;
}

function renderLogMarkdown(json, titleDate) {
  const choice = json.choices?.[0];
  const content = choice?.message?.content?.trim() ?? '';
  const model = json.model ?? 'unknown';
  const created = json.created
    ? new Date(json.created * 1000).toUTCString()
    : null;
  const finishReason = choice?.finish_reason ?? 'unknown';
  const usage = json.usage;

  const lines = [
    '# The monkeys wrote',
    '',
    ...(titleDate ? [`**Run:** ${titleDate}`, ''] : []),
    ...(created ? [`**Completed:** ${created}`, ''] : []),
    `**Model:** ${model}`,
    `**Finish:** ${finishReason}`
  ];

  if (usage) {
    lines.push(
      `**Tokens:** ${usage.total_tokens ?? '?'} (${usage.prompt_tokens ?? '?'} prompt, ${usage.completion_tokens ?? '?'} completion)`
    );
  }

  lines.push('', '---', '', content, '');
  return lines.join('\n');
}

export async function saveRawRun(raw, now = new Date()) {
  await fs.mkdir('logs', { recursive: true });

  let jsonPath = path.join('logs', `${dateStamp(now)}.json`);

  try {
    await fs.access(jsonPath);
    const time = now.toISOString().slice(11, 19).replaceAll(':', '');
    jsonPath = path.join('logs', `${dateStamp(now)}-${time}.json`);
  } catch {
    // first run for this date
  }

  const sanitized = sanitizeResponseForLog(raw, now);
  const payload = `${JSON.stringify(sanitized, null, 2)}\n`;
  const mdPath = jsonPath.replace(/\.json$/i, '.md');
  const titleDate = titleDateFromBasename(path.basename(jsonPath, '.json'));

  await fs.writeFile(jsonPath, payload, 'utf8');
  await fs.writeFile(mdPath, renderLogMarkdown(sanitized, titleDate), 'utf8');

  return jsonPath;
}

export async function saveReport(jsonPath, { text, report }) {
  const reportPath = jsonPath.replace(/\.json$/i, '.report.json');
  await fs.writeFile(
    reportPath,
    `${JSON.stringify({ text, report, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  );
  return reportPath;
}
