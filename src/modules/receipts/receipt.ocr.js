const childProcess = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const execFile = promisify(childProcess.execFile);

async function recognizeReceipt(file, { signal } = {}) {
  const deadline = AbortSignal.timeout(60000);
  const cancellation = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'divvy-receipt-'));
  try {
    cancellation.throwIfAborted();
    const input = path.join(directory, 'receipt');
    await fs.writeFile(input, file.buffer, { mode: 0o600 });
    let images = [input];
    const warnings = [];
    if (file.mimetype === 'application/pdf') {
      const prefix = path.join(directory, 'page');
      // No shell invocation. Render only a bounded number of bounded-size pages.
      await execFile(process.env.PDFTOPPM_PATH || 'pdftoppm',
        ['-f', '1', '-l', '3', '-scale-to', '2000', '-png', input, prefix],
        { signal: cancellation, timeout: 60000, maxBuffer: 1024 * 1024, killSignal: 'SIGKILL' });
      images = (await fs.readdir(directory)).filter(name => /^page-\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(name => path.join(directory, name));
      if (!images.length) throw new Error('No PDF pages rendered.');
      warnings.push('PDF scanning reads at most the first three pages. Upload one receipt per request.');
    }
    const { stdout } = await execFile(process.execPath,
      ['--max-old-space-size=512', path.join(__dirname, 'receipt.ocr-worker.js'), ...images],
      { signal: cancellation, timeout: 60000, maxBuffer: 1024 * 1024, killSignal: 'SIGKILL' });
    return { ...JSON.parse(stdout), warnings };
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

module.exports = { recognizeReceipt };
