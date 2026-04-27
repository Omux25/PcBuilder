-- Drop and recreate with explicit password encoding
DROP USER IF EXISTS pc_builder_user;
CREATE USER pc_builder_user WITH PASSWORD 'pc_builder_pass_2024';
GRANT ALL PRIVILEGES ON DATABASE pc_builder TO pc_builder_user;
\c pc_builder
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pc_builder_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pc_builder_user;
