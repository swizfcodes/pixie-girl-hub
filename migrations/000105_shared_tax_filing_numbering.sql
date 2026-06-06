-- ============================================================
-- 000105_shared_tax_filing_numbering
-- Adds the 'tax_filing' document-numbering sequence for each business.
-- The {{BUSINESS}}.tax_filings.filing_number column is NOT NULL UNIQUE and
-- is issued via fn_next_document_number('tax_filing'); the base seed
-- (000035) shipped bank_reconciliation but not tax_filing, so backfill it.
-- Idempotent: ON CONFLICT (business, document_type) DO NOTHING.
-- ============================================================

INSERT INTO shared.document_numbering (business, document_type, prefix, padding, next_number)
VALUES
  ('pixiegirl',   'tax_filing', 'PXG-TAX', 4, 1),
  ('faitlynhair', 'tax_filing', 'FLH-TAX', 4, 1)
ON CONFLICT (business, document_type) DO NOTHING;
