// 🧵 Worker-friendly version of the /block-qr route
import { createCanvas } from 'canvas';
import QRCode from 'qrcode';
import fs from 'node:fs/promises';
import archiver from 'archiver';
import { parentPort, workerData } from 'worker_threads';

// Simulate payload and QR logic here for off-main-thread execution.
async function run() {
  const { blockId, handle, label, ...options } = workerData;
  // You would re-import and reuse helpers here
  const url = `https://quicksites.ai/world/${handle}#block-${blockId}`;
  const canvas = createCanvas(512, 512);
  await QRCode.toCanvas(canvas, url);
  const buffer = canvas.toBuffer();
  await fs.writeFile(`./output/${handle}-${blockId}.png`, buffer);
  parentPort?.postMessage({ ok: true });
}
run().catch(err => parentPort?.postMessage({ error: err.message }));