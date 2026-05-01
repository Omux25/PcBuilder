-- Fix HTML entities in component names
UPDATE components SET 
  name = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    name,
    '&amp;', '&'),
    '&rsquo;', E'\''),
    '&quot;', '"'),
    '&Prime;', '″'),
    '&#8211;', '–'),
    '&laquo;', '«'),
    '&raquo;', '»'),
    '&nbsp;', ' ')
WHERE name LIKE '%&%';

-- Also fix slugs that may have been generated from HTML-entity names
UPDATE components SET
  slug = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    slug,
    '&amp;', '&'),
    '&rsquo;', ''),
    '&quot;', ''),
    '&Prime;', ''),
    '&#8211;', '-'),
    '&laquo;', ''),
    '&raquo;', ''),
    '&nbsp;', '-')
WHERE slug LIKE '%&%';

-- Verify the fix
SELECT id, name FROM components WHERE name LIKE '%&%' LIMIT 5;
