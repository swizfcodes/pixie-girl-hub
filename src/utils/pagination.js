"use strict";

function parsePagination(query) {
  const page = Math.max(parseInt(query.page || "1", 10), 1);
  const page_size = Math.min(
    Math.max(parseInt(query.page_size || "25", 10), 1),
    100,
  );
  const offset = (page - 1) * page_size;
  return { page, page_size, offset };
}

module.exports = { parsePagination };
