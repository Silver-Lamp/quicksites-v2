import { load } from 'cheerio';

export type ParsedPrice = {
  model_code: string;
  modality: 'chat'|'embeddings'|'image'|'audio_stt'|'audio_tts';
  input_per_1k_usd?: number | null;
  output_per_1k_usd?: number | null;
  image_base_usd?: number | null;
  image_per_mp_usd?: number | null;
  stt_per_min_usd?: number | null;
  tts_per_1k_chars_usd?: number | null;
};

const toNum = (s: string | null | undefined) => {
  if (!s) return null;
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? +n.toFixed(6) : null;
};
const per1MtoPer1K = (n: number | null) => (n == null ? null : +((n / 1000)).toFixed(6));

/** Try to get text with line breaks; supports either HTML or already-pasted text */
function extractText(html: string): string {
  try {
    const $ = load(html);
    const main = $('main').text();
    if (main && main.trim().length > 0) return main;
    const body = $('body').text();
    if (body && body.trim().length > 0) return body;
  } catch {
    /* not HTML */
  }
  return html;
}

const SECTION_BREAK = /^(Image tokens|Audio tokens|Fine[- ]?tuning|Built-in tools|Transcription and speech generation|Image generation|Embeddings|Moderation|Legacy models|Text tokens)$/i;

export function parseOpenAI(html: string): ParsedPrice[] {
  const text = extractText(html);
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const results: ParsedPrice[] = [];

  /* ---------------- Text tokens (chat) ---------------- */
  (() => {
    const hdrIdx = lines.findIndex(l => /^MODEL\s+INPUT\s+.*OUTPUT/i.test(l));
    if (hdrIdx >= 0) {
      for (let i = hdrIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (SECTION_BREAK.test(line)) break;
        // model   $in   $cached|-   $out
        const m = line.match(/^([A-Za-z0-9.\-]+)\s+\$([0-9.]+)\s+(?:\$([0-9.]+)|-)\s+\$([0-9.]+)/);
        if (!m) continue;
        const [, model, in1M, _cached, out1M] = m;
        const inputPer1K = per1MtoPer1K(toNum(in1M));
        const outputPer1K = per1MtoPer1K(toNum(out1M));
        if (inputPer1K != null || outputPer1K != null) {
          results.push({
            model_code: model,
            modality: 'chat',
            input_per_1k_usd: inputPer1K,
            output_per_1k_usd: outputPer1K,
          });
        }
      }
    }
  })();

  /* ---------------- Embeddings ---------------- */
  (() => {
    const embIdx = lines.findIndex(l => /^Embeddings$/i.test(l));
    if (embIdx >= 0) {
      const modelHdr = lines.findIndex((l, j) => j > embIdx && /^MODEL\s+/i.test(l));
      if (modelHdr > embIdx) {
        for (let i = modelHdr + 1; i < lines.length; i++) {
          const line = lines[i];
          if (SECTION_BREAK.test(line)) break;
          const m = line.match(/^([A-Za-z0-9.\-]+)\s+\$([0-9.]+)/);
          if (!m) continue;
          const [, model, cost1M] = m;
          const costPer1K = per1MtoPer1K(toNum(cost1M));
          if (costPer1K != null) {
            results.push({
              model_code: model,
              modality: 'embeddings',
              input_per_1k_usd: costPer1K,
            });
          }
        }
      }
    }
  })();

  /* ---------------- STT / TTS simple lines ---------------- */
  (() => {
    for (const line of lines) {
      // Whisper STT
      const w = line.match(/^Whisper\b.*\$\s*([0-9.]+)\s*\/\s*minute/i);
      if (w) {
        results.push({
          model_code: 'whisper',
          modality: 'audio_stt',
          stt_per_min_usd: toNum(w[1]),
        });
      }
      // TTS per 1M chars -> per 1k chars
      const t = line.match(/^TTS(?:\s+HD)?\b.*\$\s*([0-9.]+)\s*\/\s*(?:1M|1,?000,?000)\s*characters?/i);
      if (t) {
        const per1K = per1MtoPer1K(toNum(t[1]));
        results.push({
          model_code: line.toLowerCase().includes('hd') ? 'tts-hd' : 'tts',
          modality: 'audio_tts',
          tts_per_1k_chars_usd: per1K ?? undefined,
        });
      }
    }
  })();

  /* ---------------- Image generation (per image, multiple sizes) ----------------
     We approximate a per-megapixel price for each (model, quality) by averaging
     price/MP across the available columns.

     Example tables:

     MODEL  QUALITY  1024 X 1024  1024 X 1536  1536 X 1024
     GPT Image 1  Low     $0.011       $0.016       $0.016
                 Medium   $0.042       $0.063       $0.063
                 High     $0.167       $0.25        $0.25

     MODEL  QUALITY  1024 X 1024  1024 X 1792  1792 X 1024
     DALL·E 3  Standard  $0.04     $0.08        $0.08
               HD        $0.08     $0.12        $0.12
  */
  (() => {
    const imgIdx = lines.findIndex(l => /^Image generation$/i.test(l));
    if (imgIdx < 0) return;

    function normalizeModelName(s: string): string {
      const v = s.toLowerCase().replace(/·/g, '').replace(/\s+/g, ' ').trim();
      if (v.includes('gpt image 1')) return 'gpt-image-1';
      if (v.includes('dall e 3') || v.includes('dalle 3') || v.includes('dall-e 3')) return 'dall-e-3';
      if (v.includes('dall e 2') || v.includes('dalle 2') || v.includes('dall-e 2')) return 'dall-e-2';
      return v.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    // walk forward through one or more MODEL/QUALITY + dims tables
    let i = imgIdx + 1;
    let currentModel: string | null = null;
    let mpCols: number[] = [];

    const dimReGlobal = /(\d{3,5})\s*[xX]\s*(\d{3,5})/g;

    const isHeaderWithDims = (l: string) =>
      /^MODEL\s+QUALITY/i.test(l) && dimReGlobal.test(l);

    function parseHeaderDims(l: string): number[] {
      const dims = [...l.matchAll(dimReGlobal)].map(m => {
        const w = parseInt(m[1], 10);
        const h = parseInt(m[2], 10);
        return (w * h) / 1_000_000; // megapixels
      });
      return dims;
    }

    while (i < lines.length && !/^Embeddings$/i.test(lines[i]) && !/^Moderation$/i.test(lines[i])) {
      const line = lines[i];
      if (isHeaderWithDims(line)) {
        // Start (or restart) a table
        mpCols = parseHeaderDims(line);
        currentModel = null;
        i++;
        continue;
      }

      if (SECTION_BREAK.test(line)) break;

      // Rows: could be "GPT Image 1  Low  $..." or just "Medium  $..."
      // Extract $ prices in row
      const priceMatches = [...line.matchAll(/\$([0-9.]+)/g)].map(m => parseFloat(m[1]));
      if (priceMatches.length >= 1) {
        // Get model+quality
        let model: string | null = currentModel;
        let quality = '';

        // If the line starts with a model-ish token, capture it and the next token as quality
        const modelQuality = line.match(/^([A-Za-z0-9 .·\-]+?)\s+(Low|Medium|High|Standard|HD)\b/i);
        if (modelQuality) {
          model = normalizeModelName(modelQuality[1]);
          quality = modelQuality[2].toLowerCase();
          currentModel = model;
        } else {
          // no model on this line; must be continuing same model with a new quality
          const qOnly = line.match(/^(Low|Medium|High|Standard|HD)\b/i);
          if (qOnly) {
            quality = qOnly[1].toLowerCase();
          }
        }

        if (model && quality) {
          // average price per MP across the present columns
          const perMP: number[] = [];
          for (let k = 0; k < Math.min(mpCols.length, priceMatches.length); k++) {
            const mp = mpCols[k];
            const p = priceMatches[k];
            if (mp > 0 && Number.isFinite(p)) perMP.push(p / mp);
          }
          if (perMP.length) {
            const avg = perMP.reduce((a, b) => a + b, 0) / perMP.length;
            results.push({
              model_code: `${model}:${quality}`, // e.g., 'gpt-image-1:medium'
              modality: 'image',
              image_base_usd: 0,
              image_per_mp_usd: +avg.toFixed(6),
            });
          }
        }
      }

      i++;
    }
  })();

  return results;
}
