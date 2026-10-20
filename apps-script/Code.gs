/**
 * Onyx waitlist sheet, Apps Script web app (2026-10-17).
 *
 * The landing page (onyx-tech.ai) POSTs one JSON object per signup and GETs the count for
 * the "Join N others" line. Columns are found BY THEIR HEADER TEXT in row 1, so the sheet can
 * be reordered or given new columns without touching this file; a payload field with no
 * matching header is simply not written, and a header with no field stays blank.
 *
 * Headers it knows (case and punctuation do not matter):
 *   Name, Phone, Email, Business Name, Location, Date, Attribution, Campaign Name,
 *   Ad-Set Name, Ad Name, Status, Plan, Notes. Column A with a blank header gets the running
 *   number. Status and Plan are hand-kept (Sehaj, 2026-10-17); a new signup starts as
 *   Status "Waitlist" and Plan "N/a" so it reads like the rows around it.
 *
 * WHERE A SIGNUP GOES (2026-10-21): the first row from the top with no Name and no Email, NOT
 * appendRow. The tab is pre-numbered in column A (and pre-filled with Status/Plan) hundreds of
 * rows down, so appendRow's "below the last row with anything in it" put every signup from
 * 2026-10-20 at row 501+, out of sight under the list while the counter (which counts emails
 * anywhere in the tab) still went up. Only the data columns (A up to the last known header)
 * are written, so the summary table Sehaj keeps to the right is never touched.
 *
 * DEPLOYING: Deploy > Manage deployments > the pencil on the existing deployment > Version:
 * New version > Deploy. That keeps the /exec URL the page already has. A brand-new
 * deployment gets a new URL and the page would keep posting to the old code.
 */
var SHEET_NAME = 'WAITLIST';
var TIMEZONE = 'Australia/Sydney';

var FIELD_HEADERS = {
  name:     ['name', 'full name'],
  phone:    ['phone', 'phone number', 'mobile'],
  email:    ['email', 'email address'],
  business: ['business name', 'business', 'company'],
  location: ['location', 'country'],
  date:     ['date', 'signed up', 'joined'],
  ref:      ['attribution', 'ref', 'source', 'referrer'],
  campaign: ['campaign name', 'campaign'],
  adset:    ['ad-set name', 'ad set name', 'adset name', 'adset', 'ad set'],
  ad:       ['ad name', 'ad'],
  status:   ['status'],
  plan:     ['plan'],
  notes:    ['notes']
};
var DEFAULTS = { status: 'Waitlist', plan: 'N/a' };

function norm_(h) { return String(h || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

/** Which payload field each header column takes, from the header row text. */
function columnMap_(headerRow) {
  var map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var h = norm_(headerRow[c]);
    if (!h) continue;
    for (var field in FIELD_HEADERS) {
      if (FIELD_HEADERS[field].indexOf(h) > -1 && map[field] === undefined) { map[field] = c; break; }
    }
  }
  return map;
}

/** The row to append, as wide as the header row. Pure: tested outside Apps Script too. */
function buildRow(headerRow, payload, nextIndex, dateText) {
  var map = columnMap_(headerRow);
  var row = new Array(headerRow.length);
  for (var i = 0; i < row.length; i++) row[i] = '';
  if (headerRow.length && !norm_(headerRow[0])) row[0] = nextIndex;   // the running number in A
  var field;
  for (field in map) {
    if (field === 'date') { row[map.date] = dateText; continue; }
    var v = payload[field];
    if ((v === undefined || v === null || v === '') && DEFAULTS[field] !== undefined) v = DEFAULTS[field];
    if (v === undefined || v === null) continue;
    row[map[field]] = String(v).slice(0, 200);
  }
  return row;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function headerRow_(sh) {
  var last = Math.max(1, sh.getLastColumn());
  return sh.getRange(1, 1, 1, last).getValues()[0];
}

/** People on the list: rows below the header with an email in them. */
function count_(sh) {
  var map = columnMap_(headerRow_(sh));
  var col = map.email !== undefined ? map.email + 1 : 4;
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;
  var values = sh.getRange(2, col, lastRow - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < values.length; i++) if (String(values[i][0] || '').trim()) n++;
  return n;
}

/** 1-based row for the next signup: the first row below the header with no Name and no Email. */
function nextRow_(sh, map) {
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return 2;
  var cols = [map.email, map.name].filter(function (c) { return c !== undefined; });
  if (!cols.length) return lastRow + 1;
  var width = Math.max.apply(null, cols) + 1;
  var values = sh.getRange(2, 1, lastRow - 1, width).getValues();
  for (var i = 0; i < values.length; i++) {
    var taken = cols.some(function (c) { return String(values[i][c] || '').trim() !== ''; });
    if (!taken) return i + 2;
  }
  return lastRow + 1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return json_({ count: count_(sheet_()) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var payload = {};
    try { payload = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { payload = (e && e.parameter) || {}; }
    if (!payload.email) return json_({ ok: false, error: 'No email' });
    var sh = sheet_();
    var headers = headerRow_(sh);
    var when = payload.date ? new Date(payload.date) : new Date();
    if (isNaN(when.getTime())) when = new Date();
    var dateText = Utilities.formatDate(when, TIMEZONE, 'yyyy-MM-dd HH:mm');
    var map = columnMap_(headers);
    var nextIndex = count_(sh) + 1;
    var row = buildRow(headers, payload, nextIndex, dateText);
    // Data columns only: A through the last column a known header maps to.
    var width = 1;
    for (var f in map) width = Math.max(width, map[f] + 1);
    var target = nextRow_(sh, map);
    var cells = row.slice(0, width);
    // Keep anything pre-filled in a column this signup leaves blank (the row number in A, a
    // Status dropdown), so the row reads like the ones around it.
    var existing = target <= sh.getLastRow() ? sh.getRange(target, 1, 1, width).getValues()[0] : null;
    if (existing) {
      for (var i = 0; i < width; i++) if (cells[i] === '' && existing[i] !== '') cells[i] = existing[i];
      if (!norm_(headers[0]) && existing[0] !== '') cells[0] = existing[0];   // the sheet's own row number wins
    }
    sh.getRange(target, 1, 1, width).setValues([cells]);
    return json_({ ok: true, count: count_(sh) });
  } finally {
    lock.releaseLock();
  }
}
