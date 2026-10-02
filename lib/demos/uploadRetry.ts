// lib/demos/uploadRetry.ts
//
// Which storage-upload failures are worth retrying.
//
// ⚠️ ONE `fetch failed` ABORTED A WHOLE RUN and left storage ahead of the database: the first
// clip's video, poster and manifest uploaded, the second died mid-upload, and the attach step —
// which runs after ALL uploads — never happened. A manifest sat in storage that no row pointed
// at, so the narration studio still said "no cues" for a clip that had them. Re-running fixed
// it, but nothing told the operator that re-running was the remedy.

/**
 * Transport failures only.
 *
 * ⚠️ Retrying a rejection the server MEANT — a 413, a bad key, an unsupported type — just delays
 * the same error by three waits and buries the real cause under "after retries".
 */
export function isTransientUploadError(message: string): boolean {
  return /fetch failed|network|socket|ETIMEDOUT|ECONNRESET|EAI_AGAIN|503|502|504/i.test(message);
}
