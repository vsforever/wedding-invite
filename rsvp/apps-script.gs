/**
 * Wishes & blessings backend for the Vivek & Srishti invite (Google Apps Script web app).
 *
 * Messages are appended to the existing "RSVPs" tab, then the sheet is emailed as Excel.
 * Keep the legacy Name/Guests columns and earlier responses; new messages leave them blank.
 *
 * Setup (either way works):
 *   A) Google Sheet → Extensions → Apps Script → paste this file (leave SPREADSHEET_ID empty).
 *   B) script.google.com → New project → paste this file → set SPREADSHEET_ID to the ID in the
 *      sheet URL: docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
 * Then Deploy → New deployment → type "Web app", Execute as "Me", Who has access "Anyone"
 * → copy the /exec URL into RSVP_ENDPOINT in scripts/config.js.
 * For an existing deployment, Deploy → Manage deployments → Edit → New version → Deploy.
 * Redeploy before publishing the wishes-only form; older versions require name and guest count.
 */
const SPREADSHEET_ID = ''; // only needed for setup B (standalone script)
const NOTIFY_EMAIL = 'vivekindia136@gmail.com';
const SHEET_NAME = 'RSVPs';
const HEADERS = ['Submitted at', 'Name', 'Guests', 'Wishes & blessings'];
const MAX_WISHES_LENGTH = 2000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const params = (e && e.parameter) || {};

    // Honeypot: real guests never see or fill the "website" field.
    if (params.website) return json_({ ok: true });

    const wishes = String(params.wishes || '').trim();
    if (!wishes) return json_({ ok: false, error: 'wishes_required' });
    if (wishes.length > MAX_WISHES_LENGTH) return json_({ ok: false, error: 'wishes_too_long' });

    const sheet = getSheet_();
    sheet.appendRow([new Date(), '', '', escapeFormula_(wishes)]);
    SpreadsheetApp.flush();

    emailWorkbook_(sheet, wishes);
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  } finally {
    lock.releaseLock();
  }
}

// Lets you open the /exec URL in a browser to confirm the deployment is live.
function doGet() {
  return json_({ ok: true, service: 'wishes' });
}

function getSheet_() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd mmm yyyy, hh:mm');
  } else {
    // Extend the original three-column guest list without changing existing replies.
    sheet.getRange(1, 4).setValue(HEADERS[3]);
  }
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  return sheet;
}

// Stops messages like "=HYPERLINK(...)" from being treated as spreadsheet formulas.
function escapeFormula_(value) {
  return /^[=+\-@]/.test(value) ? "'" + value : value;
}

function emailWorkbook_(sheet, wishes) {
  const ss = sheet.getParent();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const xlsx = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob().setName('Vivek-Srishti-Wishes.xlsx');

  // DriveApp is referenced so Apps Script grants the Drive scope the export URL needs.
  const sheetLink = DriveApp.getFileById(ss.getId()).getUrl();

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: 'A little love for our new beginning — new wishes & blessings',
    htmlBody:
      '<p>Someone shared a little love for your new beginning.</p>' +
      '<p><b>Wishes &amp; blessings:</b><br>' + htmlEscape_(wishes).replace(/\r?\n/g, '<br>') + '</p>' +
      '<p>The full collection, including earlier responses, is attached as an Excel sheet. Live sheet: <a href="' + sheetLink + '">open in Google Sheets</a>.</p>',
    attachments: [xlsx]
  });
}

function htmlEscape_(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
