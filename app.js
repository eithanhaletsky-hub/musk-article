// EasyPublish — shared helpers

// Web-app URL of the Google Apps Script (google-apps-script/Code.gs). Empty = submissions off.
const SCRIPT_URL = '';
const CATEGORIES = ['טכנולוגיה', 'עסקים', 'חלל', 'פרופילים', 'כללי'];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

// Inline formatting on already-escaped text: **bold** and [text](https://url)
function inline(escaped) {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, text, href) => {
      const ok = safeUrl(href.replace(/&amp;/g, '&'));
      return ok ? `<a href="${esc(ok)}" target="_blank" rel="noopener nofollow">${text}</a>` : m;
    });
}

// Very small markdown: blank line = new paragraph, "## " = subheading, "> " = pull quote
function renderBody(text) {
  return String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean).map(block => {
    if (block.startsWith('## ')) return `<h2>${inline(esc(block.slice(3).trim()))}</h2>`;
    if (block.startsWith('> ')) return `<p class="pull">${inline(esc(block.replace(/^>\s?/gm, '').trim()))}</p>`;
    return `<p>${inline(esc(block)).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}

function readingTime(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return iso; }
}

function articleHref(a) {
  return a.url ? a.url : `article.html?id=${encodeURIComponent(a.id)}`;
}

// Site articles (articles.json) + approved community articles (Google Sheet)
async function loadArticles() {
  const local = fetch('articles.json?v=' + Date.now(), { cache: 'no-store' }).then(r => r.ok ? r.json() : []).catch(() => []);
  const remote = SCRIPT_URL ? fetch(SCRIPT_URL).then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]);
  const [a, b] = await Promise.all([local, remote]);
  const list = [...a, ...(Array.isArray(b) ? b : [])];
  if (!list.length) throw new Error('load failed');
  return list.sort((x, y) => String(y.date).localeCompare(String(x.date)));
}

async function submitArticle(data) {
  const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || 'failed');
  return out;
}

function todayHe() {
  return new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
  const t = document.getElementById('today');
  if (t) t.textContent = todayHe();
});
