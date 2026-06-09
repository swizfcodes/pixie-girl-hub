/**
 * UGC ingestion sweep (V2.2 §6.4 — UGC pipeline). Every 10 min, drains
 * `queued` rows from each brand's ugc_ingestion_queue:
 *   - direct_url: download the bytes → register a media_asset (which enqueues
 *     FFmpeg processing) → mark the queue row 'ready_for_moderation' with the
 *     linked asset, leaving moderation_status='pending' for a human.
 *   - instagram/tiktok/x/facebook: need the platform connector (not yet
 *     integrated) → marked 'failed' with the attempt counted, so they don't
 *     loop forever. This is the integration point for the social APIs.
 *
 * Each row is independent; one bad URL never fails the batch.
 */

"use strict";

const https = require("https");
const http = require("http");
const { URL } = require("url");
const { config } = require("../../config/env");
const { logger } = require("../../config/logger");
const { listBrands } = require("../../config/brands");
const mediaRepo = require("../processors/media.repo");
const mediaService = require("../../services/media.service");

const MAX_BYTES = (config.MEDIA_MAX_FILE_SIZE_MB || 200) * 1024 * 1024;

/** GET a URL into a Buffer (follows up to `redirects` hops; size-capped). */
function downloadToBuffer(url, redirects = 2) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      const code = res.statusCode;
      if (
        [301, 302, 303, 307, 308].includes(code) &&
        res.headers.location &&
        redirects > 0
      ) {
        res.resume();
        resolve(
          downloadToBuffer(
            new URL(res.headers.location, url).toString(),
            redirects - 1,
          ),
        );
        return;
      }
      if (code !== 200) {
        res.resume();
        reject(new Error(`HTTP ${code}`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_BYTES) {
          req.destroy();
          reject(new Error("media exceeds MEDIA_MAX_FILE_SIZE_MB"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () =>
        resolve({
          buffer: Buffer.concat(chunks),
          mimetype: res.headers["content-type"],
        }),
      );
    });
    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error("download timeout"));
    });
  });
}

async function runUgcIngestionSweep() {
  let ingested = 0;
  let failed = 0;
  for (const brand of listBrands()) {
    let items = [];
    try {
      items = await mediaRepo.listQueuedUgc({ brand, limit: 10 });
    } catch (err) {
      logger.error({ err: err.message, brand }, "ugc: queue read failed");
      continue;
    }

    for (const item of items) {
      try {
        await mediaRepo.setUgcStatus({
          brand,
          ingestion_id: item.ingestion_id,
          status: "downloading",
          fields: { download_attempts: (item.download_attempts || 0) + 1 },
        });

        if (item.source_platform !== "direct_url") {
          // Platform capture needs the social-API connector (future work).
          await mediaRepo.setUgcStatus({
            brand,
            ingestion_id: item.ingestion_id,
            status: "failed",
          });
          failed += 1;
          continue;
        }

        const { buffer, mimetype } = await downloadToBuffer(
          item.source_post_url,
        );
        const asset = await mediaService.registerRemoteAsset({
          brand,
          buffer,
          mimetype,
          source: {
            source_kind: "ugc_form_submission",
            source_external_url: item.source_post_url,
            source_creator_handle: item.source_creator_handle,
            source_creator_contact_id: item.source_creator_contact_id,
            caption: item.source_caption,
          },
        });
        await mediaRepo.setUgcStatus({
          brand,
          ingestion_id: item.ingestion_id,
          status: "ready_for_moderation",
          fields: {
            media_asset_id: asset.asset_id,
            downloaded_at: new Date().toISOString(),
          },
        });
        ingested += 1;
      } catch (err) {
        await mediaRepo
          .setUgcStatus({
            brand,
            ingestion_id: item.ingestion_id,
            status: "failed",
          })
          .catch(() => {});
        logger.error(
          { err: err.message, brand, ingestion_id: item.ingestion_id },
          "ugc ingest failed",
        );
        failed += 1;
      }
    }
  }
  logger.info({ ingested, failed }, "ugc ingestion sweep done");
  return { ingested, failed };
}

module.exports = { runUgcIngestionSweep };
