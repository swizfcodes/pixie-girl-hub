/**
 * BullMQ processor: media-processing (V2.2 §6.4 self-hosted video).
 *
 * Payload: { brand, asset_id }. Moves a media_asset from 'pending' → 'ready'
 * by probing it, transcoding video to a web-friendly MP4, and generating a
 * poster + thumbnail. A deterministic FFmpeg failure marks the asset 'failed'
 * (no infinite retry); only the status row records the outcome.
 *
 * Concurrency is set in src/jobs/worker.js (default 4).
 */

"use strict";

const fs = require("fs/promises");
const path = require("path");
const { config } = require("../../config/env");
const { logger } = require("../../config/logger");
const repo = require("./media.repo");
const ffmpeg = require("./media.ffmpeg");

const abs = (rel) => path.join(config.STORAGE_LOCAL_ROOT, rel);
const stripExt = (p) => p.replace(/\.[^.]+$/, "");

module.exports = async function process(job) {
  const { brand, asset_id } = job.data || {};
  if (!brand || !asset_id) {
    logger.error({ jobId: job.id }, "media-processor: missing brand/asset_id");
    return;
  }

  const asset = await repo.findAsset({ brand, asset_id });
  if (!asset) {
    logger.warn({ brand, asset_id }, "media-processor: asset not found");
    return;
  }
  if (!["pending", "failed"].includes(asset.processing_status)) {
    logger.info(
      { brand, asset_id, status: asset.processing_status },
      "media-processor: already processed, skipping",
    );
    return;
  }
  // Claim it (idempotent under concurrency).
  const claimed = await repo.setProcessing({ brand, asset_id });
  if (!claimed) return;

  const dir = path.dirname(asset.storage_path);
  const base = stripExt(path.basename(asset.storage_path));
  const processedDir = path.join(dir, "processed");
  const inAbs = abs(asset.storage_path);

  try {
    await fs.mkdir(abs(processedDir), { recursive: true });

    if (asset.asset_kind === "video") {
      const meta = await ffmpeg.probe(inAbs);
      const processedRel = path.join(processedDir, `${base}.mp4`);
      const posterRel = path.join(processedDir, `${base}.poster.jpg`);
      const thumbRel = path.join(processedDir, `${base}.thumb.jpg`);
      const at = meta.duration_sec ? Math.min(1, meta.duration_sec / 2) : 1;

      await ffmpeg.transcodeVideo(inAbs, abs(processedRel));
      await ffmpeg.extractFrame(inAbs, abs(posterRel), {
        atSec: at,
        height: 720,
      });
      await ffmpeg.extractFrame(inAbs, abs(thumbRel), {
        atSec: at,
        height: 320,
      });
      const stat = await fs.stat(abs(processedRel));

      await repo.setReady({
        brand,
        asset_id,
        fields: {
          storage_path: processedRel,
          compressed_byte_size: stat.size,
          width: meta.width,
          height: meta.height,
          duration_sec: meta.duration_sec,
          poster_path: posterRel,
          thumbnail_path: thumbRel,
        },
      });
    } else if (asset.asset_kind === "image") {
      const meta = await ffmpeg
        .probe(inAbs)
        .catch(() => ({ width: null, height: null }));
      const thumbRel = path.join(processedDir, `${base}.thumb.jpg`);
      await ffmpeg.extractFrame(inAbs, abs(thumbRel), {
        atSec: 0,
        height: 320,
      });
      await repo.setReady({
        brand,
        asset_id,
        fields: {
          width: meta.width,
          height: meta.height,
          thumbnail_path: thumbRel,
        },
      });
    } else {
      // audio / document — nothing to transcode; mark ready as-is.
      await repo.setReady({ brand, asset_id, fields: {} });
    }

    logger.info({ brand, asset_id }, "media asset processed → ready");
  } catch (err) {
    await repo
      .setFailed({ brand, asset_id, log: err.message })
      .catch((e) =>
        logger.error({ err: e.message, brand, asset_id }, "markFailed failed"),
      );
    logger.error(
      { err: err.message, brand, asset_id },
      "media processing failed",
    );
    // Deterministic failure: do not rethrow (avoid endless retries).
  }
};
