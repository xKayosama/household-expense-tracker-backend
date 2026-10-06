const ocr = require('./receipt.ocr');
const { parseReceipt } = require('./receipt.parser');

class ReceiptScanError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function scanReceipt(file, { signal } = {}) {
  try {
    const { text, confidence, warnings = [] } = await ocr.recognizeReceipt(file, { signal });
    const receipt = parseReceipt(text, confidence);
    receipt.warnings.push(...warnings);
    return receipt;
  } catch (error) {
    if (error.code === 'ENOENT') throw new ReceiptScanError(503, 'PDF scanning requires Poppler (pdftoppm) installed on the server.');
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.killed || signal?.aborted) {
      throw new ReceiptScanError(504, 'Receipt scanning timed out or was cancelled. Please retry.');
    }
    throw new ReceiptScanError(422, 'The receipt could not be read. Upload a clearer, valid image or PDF.');
  }
}

module.exports = { scanReceipt, ReceiptScanError };
