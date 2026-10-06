const scanner = require('./receipt.service');

async function scanUploadedReceipt(req, res) {
  try {
    const receipt = await scanner.scanReceipt(req.file, { signal: req.scanAbortController?.signal });
    if (!receipt.isReceipt) return res.status(422).json({ success: false, message: 'The upload could not be identified as a receipt.' });
    return res.status(200).json({
      success: true,
      message: 'Receipt scanned. Review the extracted values before creating an expense.',
      data: { groupId: req.group._id, requiresReview: true, receipt }
    });
  } catch (error) {
    return res.status(error instanceof scanner.ReceiptScanError ? error.status : 500).json({
      success: false,
      message: error instanceof scanner.ReceiptScanError ? error.message : 'Something went wrong while scanning the receipt.'
    });
  } finally {
    // Upload is transient, with no public file URL or database attachment.
    if (req.file) delete req.file.buffer;
  }
}

module.exports = { scanUploadedReceipt };
