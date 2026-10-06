const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const scanner = require('../src/modules/receipts/receipt.service');
const ocr = require('../src/modules/receipts/receipt.ocr');
const originalScan = scanner.scanReceipt;
const originalRecognize = ocr.recognizeReceipt;
const { receiptSchema, validateReceipt } = require('../src/modules/receipts/receipt.schema');
const { scanUploadedReceipt } = require('../src/modules/receipts/receipt.controller');
const User = require('../src/modules/users/User');
const Group = require('../src/modules/groups/Group');
const Member = require('../src/modules/groups/GroupMember');
const RevokedToken = require('../src/modules/auth/RevokedToken');
const nativeFetch = global.fetch;
const originalKey = process.env.OPENAI_API_KEY;
const originalJwt = process.env.JWT_SECRET;
afterEach(() => {
  mock.restoreAll();
  scanner.scanReceipt = originalScan;
  ocr.recognizeReceipt = originalRecognize;
  for (const [name, value] of [['OPENAI_API_KEY', originalKey], ['JWT_SECRET', originalJwt]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
const receipt = () => ({ isReceipt: true, merchant: 'Cafe', date: '2026-10-05', currency: 'PHP', subtotal: 200, tax: 24, tip: null, total: 224, items: [{ description: 'Lunch', quantity: 1, unitPrice: 200, total: 200 }], warnings: [] });
const file = () => ({ mimetype: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test('local scanner returns a receipt object without keys or network calls', async () => {
  const ocr = require('../src/modules/receipts/receipt.ocr');
  delete process.env.OPENAI_API_KEY;
  mock.method(global, 'fetch', () => assert.fail('No remote scan allowed'));
  mock.method(ocr, 'recognizeReceipt', async () => ({ text: 'CAFE\nRECEIPT\n2026-10-05\nLunch 200.00\nSUBTOTAL PHP 200.00\nTAX 24.00\nTOTAL PHP 224.00', confidence: 95 }));
  const result = await scanner.scanReceipt(file());
  assert.equal(result.total, 224); assert.equal(result.merchant, 'CAFE'); assert.equal(result.date, '2026-10-05'); assert.equal(result.currency, 'PHP');
});
test('local OCR errors are sanitized and missing PDF renderer is explained', async () => {
  const ocr = require('../src/modules/receipts/receipt.ocr');
  for (const [error, status] of [[Object.assign(new Error('private path'), { code: 'ENOENT' }), 503], [Object.assign(new Error('private path'), { name: 'AbortError' }), 504], [new Error('private path'), 422]]) {
    mock.method(ocr, 'recognizeReceipt', async () => { throw error; });
    await assert.rejects(scanner.scanReceipt(file()), result => result.status === status && !result.message.includes('private path'));
  }
});
test('parser handles totals, items, explicit quantities and readable dates', () => {
  const { parseReceipt } = require('../src/modules/receipts/receipt.parser');
  const result = parseReceipt('MY CAFE\nRECEIPT\nOct 5, 2026\n2 x 50.00 Coffee 100.00\nSUBTOTAL PHP 100.00\nVAT 12.00\nTIP 5.00\nGRAND TOTAL PHP 117.00\nCASH 200.00\nCHANGE 83.00');
  assert.equal(result.isReceipt, true); assert.equal(result.date, '2026-10-05'); assert.equal(result.total, 117); assert.equal(result.tax, 12); assert.equal(result.tip, 5);
  assert.deepEqual(result.items, [{ description: 'Coffee', quantity: 2, unitPrice: 50, total: 100 }]);
});
test('parser leaves ambiguous dates, currencies and conflicting totals unknown', () => {
  const { parseReceipt } = require('../src/modules/receipts/receipt.parser');
  const result = parseReceipt('CAFE\nRECEIPT\n05/10/2026\nLunch $10.00\nTOTAL $10.00\nTOTAL $20.00', 50);
  assert.equal(result.date, null); assert.equal(result.currency, null); assert.equal(result.total, null); assert.ok(result.warnings.length > 3);
  assert.equal(parseReceipt('hello world').isReceipt, false);
  assert.equal(parseReceipt('Invoice\nLunch 10.00\nTOTAL ITEMS 2\nTOTAL SAVINGS 5.00').total, null);
  assert.equal(parseReceipt('Receipt\nLunch 1000.00\nTOTAL PHP 1,000.00').total, 1000);
  assert.equal(parseReceipt('Receipt\nLunch 10.00\n2026-02-30\nTOTAL EUR 10.00').date, null);
});
test('unknown fields are null and extra fields are rejected', () => {
  assert.equal(validateReceipt({ ...receipt(), merchant: null, date: null, currency: null, total: null }).total, null);
  assert.throws(() => validateReceipt({ ...receipt(), groupId: 'injected' }));
});
test('controller returns review data only, rejects nonreceipts and releases upload buffer', async () => {
  mock.method(scanner, 'scanReceipt', async () => receipt());
  const request = { group: { _id: 'group' }, file: file() }; const res = response();
  await scanUploadedReceipt(request, res);
  assert.equal(res.body.data.requiresReview, true); assert.equal(res.body.data.groupId, 'group'); assert.deepEqual(res.body.data.receipt, receipt());
  assert.equal(request.file.buffer, undefined);
  mock.method(scanner, 'scanReceipt', async () => ({ ...receipt(), isReceipt: false }));
  const rejected = response(); await scanUploadedReceipt({ ...request, file: file() }, rejected); assert.equal(rejected.statusCode, 422);
});

test('HTTP scan validates authentication, Group access, multipart files and limits', async () => {
  process.env.JWT_SECRET = 'receipt-tests-only'; delete process.env.OPENAI_API_KEY;
  let user = 0;
  mock.method(User, 'findById', () => ({ select: async () => ({ _id: `user-${++user}` }) }));
  mock.method(RevokedToken, 'exists', async () => false);
  const groupId = '012345678901234567890123';
  mock.method(Group, 'findById', async () => ({ _id: groupId }));
  mock.method(Member, 'findOne', async filter => { assert.equal(filter.groupId, groupId); assert.equal(filter.status, 'ACTIVE'); return { role: 'MEMBER' }; });
  let calls = 0; mock.method(scanner, 'scanReceipt', async () => { calls++; return receipt(); });
  const server = require('../src/app').listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const base = `http://127.0.0.1:${server.address().port}/api/groups`;
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: 'u' }, process.env.JWT_SECRET)}` };
  const form = (type = 'image/png', bytes = file().buffer, field = 'receipt') => { const body = new FormData(); body.append(field, new Blob([bytes], { type }), 'receipt'); return body; };
  const post = (body, id = groupId, auth = headers) => nativeFetch(`${base}/${id}/receipts/scan`, { method: 'POST', headers: auth, body });
  try {
    assert.equal((await post(form(), groupId, {})).status, 401);
    assert.equal((await post(form(), 'bad-id')).status, 400);
    let result = await post(form()); assert.equal(result.status, 200); assert.equal((await result.json()).data.requiresReview, true); assert.equal(calls, 1);
    for (const [type, data] of [['application/pdf', '%PDF-1.7'], ['image/jpeg', Buffer.from([255, 216, 255])], ['image/webp', 'RIFF0000WEBP']]) assert.equal((await post(form(type, data))).status, 200);
    assert.equal((await post(new FormData())).status, 400);
    assert.equal((await post(form('text/plain', 'not a receipt'))).status, 415);
    assert.equal((await post(form('image/png', 'spoofed content'))).status, 415);
    assert.equal((await post(form('image/png', file().buffer, 'wrongField'))).status, 400);
    assert.equal((await post(form('image/png', Buffer.alloc(10 * 1024 * 1024 + 1)))).status, 413);
    mock.method(Member, 'findOne', async () => null);
    assert.equal((await post(form())).status, 403);
    mock.method(Group, 'findById', async () => null);
    assert.equal((await post(form())).status, 404);
    mock.method(Group, 'findById', async () => ({ _id: groupId })); mock.method(Member, 'findOne', async () => ({}));
    delete process.env.OPENAI_API_KEY; assert.equal((await post(form())).status, 200);
    mock.method(User, 'findById', () => ({ select: async () => ({ _id: 'throttled-user' }) }));
    for (let n = 0; n < 5; n++) assert.equal((await post(form())).status, 200);
    result = await post(form()); assert.equal(result.status, 429); assert.equal(result.headers.get('retry-after'), '60');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('real local OCR extracts a generated receipt image', async () => {
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const result = await scanner.scanReceipt({ mimetype: 'image/png', buffer: await fs.readFile(path.join(__dirname, 'fixtures/receipt.png')) });
  assert.equal(result.merchant, 'CAFE DIVVY'); assert.equal(result.total, 224);
  assert.equal(result.tax, 24); assert.equal(result.currency, 'PHP'); assert.equal(result.date, '2026-10-05');
});
test('cancelled OCR removes its temporary directory', async () => {
  const fs = require('node:fs/promises'); const os = require('node:os');
  const before = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('divvy-receipt-')).sort();
  const controller = new AbortController(); controller.abort();
  await assert.rejects(scanner.scanReceipt(file(), { signal: controller.signal }), error => error.status === 504);
  const after = (await fs.readdir(os.tmpdir())).filter(name => name.startsWith('divvy-receipt-')).sort();
  assert.deepEqual(after, before);
});
