const multer = require('multer');
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const supported = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, callback) {
    if (!supported.has(file.mimetype)) return callback(Object.assign(new Error('Use a JPEG, PNG, WebP, or PDF receipt.'), { status: 415 }));
    callback(null, true);
  }
}).single('receipt');

function detectMime(buffer) {
  if (buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function receiptUpload(req, res, next) {
  upload(req, res, error => {
    if (error) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : error.status || 400).json({
        success: false,
        message: tooLarge ? 'Receipt must be no larger than 10 MB.' : error.status ? error.message : 'Upload exactly one file using the receipt field, with no other form fields.'
      });
    }
    if (!req.file || req.file.size === 0) return res.status(400).json({ success: false, message: 'A receipt file is required.' });
    if (detectMime(req.file.buffer) !== req.file.mimetype) return res.status(415).json({ success: false, message: 'Receipt content does not match a supported file type.' });
    next();
  });
}

module.exports = { receiptUpload, detectMime, MAX_RECEIPT_BYTES };
