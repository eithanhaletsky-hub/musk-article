// Parses an "article.yml" issue form and adds it to articles.json.
const fs = require('fs');

const CATEGORIES = ['טכנולוגיה', 'עסקים', 'חלל', 'פרופילים', 'כללי'];
const LABELS = {
  'כותרת': 'headline',
  'כותרת משנה': 'dek',
  'שם הכותב/ת': 'author',
  'מדור': 'category',
  'הכתבה עצמה': 'content',
  'מקורות': 'sources',
};

function parseIssueForm(body) {
  const out = {};
  const parts = String(body || '').replace(/\r/g, '').split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = part.slice(0, nl).trim();
    let value = part.slice(nl + 1).trim();
    if (value === '_No response_') value = '';
    if (LABELS[label]) out[LABELS[label]] = value;
  }
  return out;
}

function slugify(s, n) {
  const ascii = s.toLowerCase().replace(/[^a-z0-9֐-׿]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return `${ascii || 'article'}-${n}`;
}

module.exports = async ({ context, core }) => {
  const issue = context.payload.issue;
  const f = parseIssueForm(issue.body);

  if (!f.headline || !f.author || !f.content) {
    core.setFailed('Missing headline, author or content — is this issue from the article form?');
    return;
  }

  const list = JSON.parse(fs.readFileSync('articles.json', 'utf8'));
  const id = slugify(f.headline, issue.number);

  if (list.some(a => a.issue === issue.number)) {
    core.info('Already published');
    core.setOutput('changed', 'false');
    return;
  }

  const words = f.content.split(/\s+/).filter(Boolean).length;
  const sources = (f.sources || '').split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s));

  list.push({
    id,
    issue: issue.number,
    title: f.headline.slice(0, 160),
    dek: (f.dek || '').slice(0, 400),
    author: f.author.slice(0, 80),
    category: CATEGORIES.includes(f.category) ? f.category : 'כללי',
    date: new Date().toISOString().slice(0, 10),
    minutes: Math.max(1, Math.round(words / 200)),
    featured: (issue.labels || []).some(l => l.name === 'מובילה'),
    body: f.content,
    sources,
  });

  fs.writeFileSync('articles.json', JSON.stringify(list, null, 2) + '\n');
  core.setOutput('changed', 'true');
  core.setOutput('id', id);
  core.setOutput('title', f.headline.slice(0, 60).replace(/["`$\\]/g, ''));
};
