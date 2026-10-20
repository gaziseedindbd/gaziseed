-- Applied after prepare on Production 2026-10-20; deliberately cannot authenticate.
-- No password belongs in this repository. Enable login only during secure provisioning.
CREATE ROLE cashfree_dispatch_writer NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT cashfree_evidence_writer TO cashfree_dispatch_writer;
