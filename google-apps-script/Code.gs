/** @OnlyCurrentDoc  Limits the script to this one spreadsheet — no access to the rest of the Google account. */

// EasyPublish — free "backend" on Google Sheets (no keys, no server).
// Paste into Extensions → Apps Script of a new Google Sheet, then Deploy → Web app (access: Anyone).
//
// Writers POST articles here → a new row appears in the sheet.
// You approve by ticking "אישור"; tick "מובילה" to feature it on the homepage.
// The site GETs only approved rows.

const SHEET = 'כתבות';
const HEADERS = ['תאריך', 'כותרת', 'כותרת משנה', 'שם', 'מדור', 'הכתבה', 'מקורות', 'אישור', 'מובילה', 'מזהה'];
const CATEGORIES = ['טכנולוגיה', 'עסקים', 'חלל', 'פרופילים', 'כללי'];
const COL = { date: 1, headline: 2, dek: 3, author: 4, category: 5, content: 6, sources: 7, approved: 8, featured: 9, id: 10 };

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sh.setRightToLeft(true);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clip_(v, n) { return String(v || '').trim().slice(0, n); }

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (d.website) return json_({ ok: true }); // honeypot: bots fill hidden fields

  const headline = clip_(d.headline, 160), author = clip_(d.author, 80), content = clip_(d.content, 40000);
  if (!headline || !author || content.length < 20) return json_({ ok: false, error: 'missing fields' });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet_();
    const id = Utilities.getUuid().slice(0, 8);
    // Leading apostrophe stops Sheets from treating text that starts with = + - @ as a formula
    const safe = s => /^[=+\-@]/.test(s) ? "'" + s : s;
    sh.appendRow([
      new Date(), safe(headline), safe(clip_(d.dek, 400)), safe(author),
      CATEGORIES.indexOf(d.category) >= 0 ? d.category : 'כללי',
      safe(content), safe(clip_(d.sources, 2000)), false, false, id
    ]);
    const row = sh.getLastRow();
    sh.getRange(row, COL.approved, 1, 2).insertCheckboxes();
    return json_({ ok: true, id: id });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('articles');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  const rows = sheet_().getDataRange().getValues().slice(1);
  const list = rows.filter(r => r[COL.approved - 1] === true).map(r => {
    const content = String(r[COL.content - 1]);
    return {
      id: String(r[COL.id - 1]),
      title: String(r[COL.headline - 1]),
      dek: String(r[COL.dek - 1]),
      author: String(r[COL.author - 1]),
      category: String(r[COL.category - 1]),
      date: Utilities.formatDate(new Date(r[COL.date - 1]), 'Asia/Jerusalem', 'yyyy-MM-dd'),
      minutes: Math.max(1, Math.round(content.split(/\s+/).filter(String).length / 200)),
      featured: r[COL.featured - 1] === true,
      body: content,
      sources: String(r[COL.sources - 1]).split('\n').map(s => s.trim()).filter(s => /^https?:\/\//i.test(s))
    };
  });
  const out = JSON.stringify(list);
  if (out.length < 90000) cache.put('articles', out, 60); // cache for a minute
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}
