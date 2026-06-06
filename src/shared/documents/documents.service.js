/**
 * Documents (V2.2 §6.13) — the SINGLE gateway for files.
 *
 * EVERY uploaded or generated file in the platform MUST be persisted via
 * `store()`: it writes bytes through the storage abstraction AND registers a
 * row in shared.documents (number, SHA-256 hash, size, mime, reference, actor)
 * so the file is archived, auditable and discoverable. Modules then reference
 * the returned `document_id` rather than holding raw paths.
 *
 * Other modules import this service and call `store(...)` — they must not
 * call services/storage.service directly.
 */

"use strict";

const crypto = require("crypto");
const path = require("path");
const repo = require("./documents.repo");
const events = require("./documents.events");
const storage = require("../../services/storage.service");
const { audit } = require("../../middleware/audit");
const { transaction } = require("../../config/database");
const { NotFoundError, AppError } = require("../../utils/errors");

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function extFor(filename, mime) {
  return (filename && path.extname(filename)) || EXT_BY_MIME[mime] || "";
}

/**
 * Persist a file. Pass a Buffer (from an upload or generated in-process).
 * @returns {Promise<{document_id, document_number, title, mime_type, file_size_bytes, url, reference_type, reference_id}>}
 */
async function store({
  brand,
  user_id = null,
  buffer,
  filename,
  mime_type = "application/octet-stream",
  document_type = "document",
  title,
  reference_type = null,
  reference_id = null,
  client,
  request_id = null,
}) {
  if (!Buffer.isBuffer(buffer))
    throw new AppError("INVALID_FILE", "store() requires a Buffer", 400);

  const run = async (c) => {
    const document_number = await repo.nextNumber({ client: c, brand });
    const key = `${brand}/documents/${document_number}${extFor(filename, mime_type)}`;
    const stored = await storage.put(buffer, { key, contentType: mime_type });
    const doc = await repo.insert({
      client: c,
      row: {
        document_number,
        business: brand,
        document_type,
        title: title || filename || document_number,
        file_path: stored.key,
        file_size_bytes: buffer.length,
        mime_type,
        content_hash: sha256(buffer),
        reference_type,
        reference_id,
        uploaded_by: user_id,
      },
    });
    await audit({
      business: brand,
      user_id,
      action_key: "documents.store",
      target_type: "document",
      target_id: doc.document_id,
      after: { document_number, document_type, reference_type, reference_id },
      request_id,
    });
    events.emit("stored", {
      brand,
      document_id: doc.document_id,
      reference_type,
      reference_id,
    });
    return { ...doc, url: stored.public_url };
  };

  return client ? run(client) : transaction(run);
}

async function getById({ brand, id }) {
  const d = await repo.findById({ brand, id });
  if (!d) throw new NotFoundError("Document");
  return d;
}

function list({ brand, filters, page, page_size }) {
  const offset = (page - 1) * page_size;
  return repo.findAll({ brand, filters, page, page_size, offset });
}

const listForReference = ({ brand, reference_type, reference_id }) =>
  repo.listByReference({ brand, reference_type, reference_id });

async function download({ brand, id }) {
  const d = await repo.findById({ brand, id });
  if (!d) throw new NotFoundError("Document");
  const buffer = await storage.get(d.file_path);
  return {
    buffer,
    mime_type: d.mime_type,
    filename: `${d.document_number}${extFor(null, d.mime_type)}`,
    title: d.title,
  };
}

async function remove({ brand, user, request_id, id }) {
  const ok = await repo.softDelete({ brand, id });
  if (!ok) throw new NotFoundError("Document");
  await audit({
    business: brand,
    user_id: user.user_id,
    action_key: "documents.delete",
    target_type: "document",
    target_id: id,
    request_id,
  });
  events.emit("deleted", { brand, id });
}

module.exports = { store, getById, list, listForReference, download, remove };
