#!/bin/bash
cd /mnt/c/Headquarters/Projects/PcBuilder/apps/backend
source .env

echo "=== Category counts ==="
PGPASSWORD=$PGPASSWORD psql -U $PGUSER -d $PGDATABASE -c "SELECT category, COUNT(*) as total FROM components GROUP BY category ORDER BY category"

echo ""
echo "=== Cases in cooling ==="
PGPASSWORD=$PGPASSWORD psql -U $PGUSER -d $PGDATABASE -c "SELECT id, name FROM components WHERE category = 'cooling' AND (name ILIKE '%boitier%' OR name ILIKE '%case%' OR name ILIKE '%tower%' OR name ILIKE '%chassis%') LIMIT 20"

echo ""
echo "=== PSUs in wrong categories ==="
PGPASSWORD=$PGPASSWORD psql -U $PGUSER -d $PGDATABASE -c "SELECT id, name, category FROM components WHERE category != 'psu' AND (name ~* '\d{3,4}W') AND (name ILIKE '%gold%' OR name ILIKE '%bronze%' OR name ILIKE '%platinum%') LIMIT 20"

echo ""
echo "=== Cooling in case category ==="
PGPASSWORD=$PGPASSWORD psql -U $PGUSER -d $PGDATABASE -c "SELECT id, name FROM components WHERE category = 'case' AND (name ILIKE '%aio%' OR name ILIKE '%liquid%' OR name ILIKE '%cooler%' OR name ILIKE '%ventirad%') LIMIT 20"
