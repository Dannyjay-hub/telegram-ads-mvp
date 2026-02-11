-- Fix category and language columns: text -> jsonb
-- This ensures arrays are stored properly (not double-serialized)
-- Also fix existing corrupted data

-- Step 1: Convert columns from text to jsonb
ALTER TABLE channels 
  ALTER COLUMN category TYPE jsonb USING 
    CASE 
      WHEN category IS NULL THEN NULL
      WHEN category LIKE '[%' THEN category::jsonb
      ELSE to_jsonb(ARRAY[category])
    END,
  ALTER COLUMN language TYPE jsonb USING 
    CASE 
      WHEN language IS NULL THEN NULL  
      WHEN language LIKE '[%' THEN language::jsonb
      ELSE to_jsonb(ARRAY[language])
    END;

-- Step 2: Fix any double-wrapped values like ["[\"Crypto\"]"]
-- These happen when a JSON string like '["Crypto"]' was stored in text, 
-- then the text column was converted, resulting in a jsonb array containing a string
UPDATE channels 
SET category = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem #>> '{}' LIKE '[%' THEN (elem #>> '{}')::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(category) AS elem
)
WHERE category IS NOT NULL 
  AND jsonb_typeof(category) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(category) AS t WHERE t LIKE '[%'
  );

UPDATE channels 
SET language = (
  SELECT jsonb_agg(
    CASE 
      WHEN elem #>> '{}' LIKE '[%' THEN (elem #>> '{}')::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(language) AS elem
)
WHERE language IS NOT NULL 
  AND jsonb_typeof(language) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(language) AS t WHERE t LIKE '[%'
  );

-- Step 3: Flatten any remaining nested arrays (e.g., [["Crypto","Gaming"]] -> ["Crypto","Gaming"])
-- Uses a recursive approach that avoids set-returning functions in CASE
UPDATE channels
SET category = (
  SELECT jsonb_agg(val)
  FROM (
    -- Get scalar elements directly
    SELECT elem AS val
    FROM jsonb_array_elements(category) AS elem
    WHERE jsonb_typeof(elem) != 'array'
    UNION ALL
    -- Flatten nested array elements
    SELECT inner_elem AS val
    FROM jsonb_array_elements(category) AS elem,
         LATERAL jsonb_array_elements(elem) AS inner_elem
    WHERE jsonb_typeof(elem) = 'array'
  ) sub
)
WHERE category IS NOT NULL 
  AND jsonb_typeof(category) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(category) AS t WHERE jsonb_typeof(t) = 'array'
  );

UPDATE channels
SET language = (
  SELECT jsonb_agg(val)
  FROM (
    SELECT elem AS val
    FROM jsonb_array_elements(language) AS elem
    WHERE jsonb_typeof(elem) != 'array'
    UNION ALL
    SELECT inner_elem AS val
    FROM jsonb_array_elements(language) AS elem,
         LATERAL jsonb_array_elements(elem) AS inner_elem
    WHERE jsonb_typeof(elem) = 'array'
  ) sub
)
WHERE language IS NOT NULL 
  AND jsonb_typeof(language) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(language) AS t WHERE jsonb_typeof(t) = 'array'
  );
