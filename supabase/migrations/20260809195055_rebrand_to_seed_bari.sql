/*
# Rebrand: GAZI SEED → SEED BARI

1. Updates the default website_name in site_settings from 'GAZI SEED' to 'SEED BARI'.
   This only affects the DEFAULT value for new rows; existing rows are NOT changed.
2. Updates any existing site_settings row where website_name = 'GAZI SEED' to 'SEED BARI'.
3. No tables, columns, or IDs are renamed. No data is lost.
*/

ALTER TABLE site_settings
  ALTER COLUMN website_name SET DEFAULT 'SEED BARI';

UPDATE site_settings SET website_name = 'SEED BARI' WHERE website_name = 'GAZI SEED';
