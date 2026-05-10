-- Migration to fix concatenated category names in the components table
-- e.g. 'Ryzen 5 5600XTProcesseurs' -> 'Ryzen 5 5600XT'

UPDATE components
SET name = REGEXP_REPLACE(name, '(Processeurs?|Cartes?\s*Graphiques?|Cartes?\s*M[eè]res?|M[eé]moire\s*Vive|Disques?\s*Durs?|Alimentations?|[Bb]oîtiers?|Refroidissement|Ventilateurs?\s*Boîtier|P[âa]te\s*Thermique)\s*$', '', 'i')
WHERE name ~* '(Processeurs?|Cartes?\s*Graphiques?|Cartes?\s*M[eè]res?|M[eé]moire\s*Vive|Disques?\s*Durs?|Alimentations?|[Bb]oîtiers?|Refroidissement|Ventilateurs?\s*Boîtier|P[âa]te\s*Thermique)\s*$';
