ALTER USER pc_builder_user WITH PASSWORD 'changeme';
CREATE DATABASE pc_builder OWNER pc_builder_user;
GRANT ALL PRIVILEGES ON DATABASE pc_builder TO pc_builder_user;
