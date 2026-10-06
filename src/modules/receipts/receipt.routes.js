const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../auth/auth.middleware');
const { groupAccess } = require('../groups/groupAccess.middleware');
const { receiptUpload } = require('./receipt.upload');
const { scanUploadedReceipt } = require('./receipt.controller');
const router = express.Router();

// Bound local OCR CPU usage and transient upload memory per process.
const requests = new Map();
let active = 0;
function scanAvailability(req, res, next) {
  const now = Date.now();
  for (const [userId, entry] of requests) if (entry.until <= now) requests.delete(userId);
  const userId = req.user._id.toString();
  const entry = requests.get(userId) || { count: 0, until: now + 60000 };
  if (entry.count >= 5 || active >= 4) {
    res.set('Retry-After', '60');
    return res.status(429).json({ success: false, message: 'Too many receipt scans. Please retry in a minute.' });
  }
  entry.count++;
  requests.set(userId, entry);
  active++;
  req.scanAbortController = new AbortController();
  let released = false;
  const release = () => { if (!released) { released = true; active--; } };
  res.once('finish', release);
  res.once('close', () => { req.scanAbortController.abort(); release(); });
  next();
}

router.post('/:id/receipts/scan', protect, (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid Group ID.' });
  next();
}, groupAccess, scanAvailability, receiptUpload, scanUploadedReceipt);

module.exports = router;
