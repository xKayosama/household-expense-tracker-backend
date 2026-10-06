// Run OCR in an isolated child so malformed images cannot crash the API process
// and cancellation/timeout can terminate both OCR and its worker thread.
const { createWorker } = require('tesseract.js');
const language = require('@tesseract.js-data/eng');

async function main() {
  let worker;
  try {
    worker = await createWorker('eng', 1, {
      langPath: language.langPath,
      gzip: true,
      cacheMethod: 'none',
      errorHandler: () => {}
    });
    const texts = [], confidences = [];
    for (const image of process.argv.slice(2)) {
      const { data } = await worker.recognize(image);
      texts.push(data.text);
      confidences.push(data.confidence);
    }
    process.stdout.write(JSON.stringify({ text: texts.join('\n'), confidence: Math.min(...confidences) }));
  } finally {
    if (worker) await worker.terminate();
  }
}
main().catch(() => { process.exitCode = 1; });
