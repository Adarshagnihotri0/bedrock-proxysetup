/**
 * Evidence table structure check
 * 
 * Question: Does UNIQUE(content_hash) constraint exist?
 */

-- Check evidence table constraints
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'evidence'::regclass;

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'evidence';
