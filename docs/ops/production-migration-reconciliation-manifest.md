# Production Migration Reconciliation Manifest

**Purpose:** Read-only evidence map for planning reconciliation between Production Supabase migration history and GitHub `main`. This document is not an SQL migration or a repair script. It does not authorize `supabase migration repair`, `db push`, or direct Production SQL changes.

## Audit scope and result

- Production history: **265 rows**.
- GitHub `main`: **119 SQL migration files**.
- Normalized-name matches: **39** (includes one repeated name in the Production history).
- Both version and normalized name match: **6**.
- Same normalized name, different version: **33**.
- Repository files with no normalized-name match in Production history: **81**.
- SQL token-fingerprint comparison against all 265 stored Production statements found **7 exact SQL matches under a different name/version**.
- Two other repository files are comment-only no-op migrations (zero executable SQL tokens).
- The remaining **72** files have no exact SQL-token fingerprint match in stored history; this does **not** prove their intended effects are absent from the live schema.
- All **265** Production rows have non-empty stored SQL in `supabase_migrations.schema_migrations`; approximate stored SQL volume is **576,638 characters**.
- Name-matched files are marked `MATCH_SQL_EXACT`, `SQL_DIFF`, or `PENDING_SQL_COMPARE` according to the completed comparisons. Additionally, the separate [SQL fingerprint index](migration-content-fingerprint-index.json) covers all 119 repository migration files and records 7 matching fingerprints found within Production history.

## Interpretation rules

1. Name similarity alone is not evidence that two migrations are equivalent.
2. A version mismatch alone does not prove that the schema is incorrect.
3. `MATCH_SQL_EXACT` means the SQL token sequence was compared after ignoring whitespace and SQL comments. It is not proof that the entire application/schema is healthy.
4. `SQL_DIFF` means there is a substantive token difference or a missing/extra SQL statement. Review it against the live schema, triggers, policies, functions, indexes, and data before deciding how to reconcile it.
5. Do not replay historical migrations on Production to make the filenames match. Prefer a reviewed forward migration after establishing the current live state.

## Key confirmed differences

- **Cashfree future payment recovery (`20261010033247`):** stored SQL specifies `timeout_milliseconds := 60000`; the current repository migration specifies `120000`. The live cron job is active every five minutes and currently uses `120000`. Therefore the active cron currently matches the repository value, not the originally stored SQL.
- **COD advance support (`20260911041117`):** Production stored SQL contains only a short supporting-index statement. The same-name repository file includes additional function/grant SQL. Do not treat these as equivalent; later migrations/functions may have installed some of that behavior.
- **Duplicate external-message index (`20260912050259`):** the stored statement drops `ai_messages_external_message_uq`, while one repository revision refers to `ai_messages_external_message_unique`. A later Production record does match the latter name; the currently live unique index is `ai_messages_external_message_id_uidx`. Reconcile in chronological order before editing history.
- **Messenger order confirmation (`20261001052620`):** stored function includes a non-empty customer-phone guard that is absent in the current same-name repository migration version. Preserve the live guard; never reconstruct the trigger from the repository file without checking subsequent migrations.
- **COD due settlement (`20260912051336`):** SQL token comparison indicates a substantive difference in the stored function body; requires manual review before any version/name correction.
- The first whitespace-only comparison flagged `remove_multiple_permissive_rls_overlaps` as different, but a SQL-token comparison confirmed the stored statement and repository file are equivalent despite formatting.

## Production-to-repository map

| Production version | Production migration name | Repository version / filename | Version match | SQL comparison |
|---|---|---|---|---|
| `20260909103902` | `fix_referral_code_brand_prefix` | `20260909150000` / `20260909150000_fix_referral_code_brand_prefix.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20260911041117` | `add_cod_advance_payment_support` | `20260911041600` / `20260911041600_add_cod_advance_payment_support.sql` | no | SQL_DIFF (repository adds function and grants not in stored SQL) |
| `20260912050259` | `remove_duplicate_ai_messages_external_index` | `20261002154500` / `20261002154500_remove_duplicate_ai_messages_external_index.sql` | no | SQL_DIFF (index name differs; later stored migration is exact token match) |
| `20260912051336` | `add_admin_cod_due_settlement` | `20260912105000` / `20260912105000_add_admin_cod_due_settlement.sql` | no | SQL_DIFF (PL/pgSQL token/text difference; manual review required) |
| `20260925070940` | `add_messenger_message_id_idempotency` | `20260925070940` / `20260925070940_add_messenger_message_id_idempotency.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001052620` | `messenger_order_confirmation_notifications` | `20261001104900` / `20261001104900_messenger_order_confirmation_notifications.sql` | no | SQL_DIFF (stored function contains customer-phone guard missing from repo version) |
| `20261001075834` | `messenger_order_status_notifications` | `20261001132000` / `20261001132000_messenger_order_status_notifications.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001091247` | `add_packed_order_status_notification` | `20261001143000` / `20261001143000_add_packed_order_status_notification.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001142713` | `messenger_transliteration_search` | `20261001143000` / `20261001143000_messenger_transliteration_search.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001142741` | `fix_messenger_transliteration` | `20261001144000` / `20261001144000_fix_messenger_transliteration.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001152352` | `normalize_india_product_prices` | `20261001160000` / `20261001160000_normalize_india_product_prices.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261001152732` | `sync_india_cashfree_delivery_rules` | `20261001163000` / `20261001163000_sync_india_cashfree_delivery_rules.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002150843` | `allow_unknown_messenger_rate_limit_country` | `20261002150843` / `20261002150843_allow_unknown_messenger_rate_limit_country.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002151225` | `optimize_messenger_customer_profiles_rls` | `20261002153000` / `20261002153000_optimize_messenger_customer_profiles_rls.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002151516` | `remove_duplicate_ai_messages_external_index` | `20261002154500` / `20261002154500_remove_duplicate_ai_messages_external_index.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002151921` | `remove_multiple_permissive_rls_overlaps` | `20261002160000` / `20261002160000_remove_multiple_permissive_rls_overlaps.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002151954` | `finish_multiple_permissive_rls_overlaps` | `20261002161500` / `20261002161500_finish_multiple_permissive_rls_overlaps.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002152736` | `remove_redundant_translation_cache_index` | `20261002163500` / `20261002163500_remove_redundant_translation_cache_index.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002163620` | `secure_internal_service_role_only_tables` | `20261002164500` / `20261002164500_secure_internal_service_role_only_tables.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261002165739` | `harden_messenger_profile_trigger_search_path` | `20261002170500` / `20261002170500_harden_messenger_profile_trigger_search_path.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261003022537` | `restrict_messenger_trigger_function_execute` | `20261003033000` / `20261003033000_restrict_messenger_trigger_function_execute.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261003031027` | `restrict_legacy_public_order_rpcs` | `20261003090000` / `20261003090000_restrict_legacy_public_order_rpcs.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261003033220` | `harden_public_order_rpc_context` | `20261003093000` / `20261003093000_harden_public_order_rpc_context.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261003102717` | `add_meta_capi_purchase_events` | `20261003160000` / `20261003160000_add_meta_capi_purchase_events.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261004170452` | `add_product_promotional_spotlight_hindi_and_language_images` | `20261004223000` / `20261004223000_add_product_promotional_spotlight_hindi_and_language_images.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261006035157` | `fix_bulk_pricing_country_visibility` | `20261006010000` / `20261006010000_fix_bulk_pricing_country_visibility.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261006113634` | `fix_public_banner_select` | `20261006053000` / `20261006053000_fix_public_banner_select.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261006124815` | `disable_missing_home_banner` | `20261006124815` / `20261006124815_disable_missing_home_banner.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |
| `20261008121106` | `add_sending_state_to_messenger_order_status_notifications` | `20261008123000` / `20261008123000_add_sending_state_to_messenger_order_status_notifications.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261008141346` | `fix_admin_branch_access_and_inventory` | `20261008190000` / `20261008190000_fix_admin_branch_access_and_inventory.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261008150205` | `allow_public_active_landing_pages` | `20261008201500` / `20261008201500_allow_public_active_landing_pages.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261008153249` | `grant_public_ads_order_rpc` | `20261008153430` / `20261008153430_grant_public_ads_order_rpc.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261008165055` | `india_cashfree_campaign_payments` | `20261008161145` / `20261008161145_india_cashfree_campaign_payments.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261009021411` | `add_landing_faq_translations` | `20261009021411` / `20261009021411_add_landing_faq_translations.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |
| `20261009025432` | `public_read_active_animated_landings` | `20261009025432` / `20261009025432_public_read_active_animated_landings.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |
| `20261010033247` | `cashfree_future_payment_recovery` | `20261010033111` / `20261010033111_cashfree_future_payment_recovery.sql` | no | SQL_DIFF (stored cron timeout 60000 ms; repo migration says 120000 ms) |
| `20261010034929` | `harden_cod_advance_and_due_integrity` | `20261010034249` / `20261010034249_harden_cod_advance_and_due_integrity.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261010041019` | `payment_security_audit_log` | `20261010035233` / `20261010035233_payment_security_audit_log.sql` | no | MATCH_SQL_EXACT (normalized token comparison) |
| `20261011045154` | `add_product_faq_hindi` | `20261011045154` / `20261011045154_add_product_faq_hindi.sql` | yes | MATCH_SQL_EXACT (normalized token comparison) |

## SQL fingerprint matches under different Production names/versions

The following repository files are listed as having no same-name Production record, but their SQL token fingerprints match stored SQL from an existing Production migration-history row. Do not apply these again just to make the history names line up.

| Repository file | Matching Production version | Production record name | Result |
|---|---|---|---|
| `20260929140000_add_messenger_customer_profiles.sql` | `20260929132935` | `20260929140000_add_messenger_customer_profiles` | `SQL_FINGERPRINT_MATCH` |
| `20260929170000_messenger_product_search_optimization.sql` | `20260929140411` | `20260929170000_messenger_product_search_optimization` | `SQL_FINGERPRINT_MATCH` |
| `20261001173000_preserve_cashfree_order_source.sql` | `20261001171349` | `preserve_cashfree_order_source` | `SQL_FINGERPRINT_MATCH` |
| `20261003210000_add_meta_ads_insights.sql` | `20261003163727` | `add_meta_ads_insights_daily` | `SQL_FINGERPRINT_MATCH` |
| `20261007123000_add_bulk_offer_free_item_text.sql` | `20261007064522` | `add_bulk_pricing_free_item_text` | `SQL_FINGERPRINT_MATCH` |
| `20261008160000_fix_ads_offer_order_totals.sql` | `20261008155002` | `fix_ads_package_item_totals` | `SQL_FINGERPRINT_MATCH` |
| `20261008183000_add_messenger_order_notification_sending_state.sql` | `20261008115546` | `allow_messenger_notification_sending_state` | `SQL_FINGERPRINT_MATCH` |

SQL fingerprints ignore comments/whitespace while preserving SQL tokens and quoted strings. A matching FNV-1a 64-bit fingerprint plus token count is strong evidence, not a collision-proof proof of identity; compare the full stored and repository token streams for these pairs before making any reconciliation decision.

## Production history without a same-name repository file

| Production version | Production migration name | Status |
|---|---|---|
| `20260903141234` | `initial_seed_commerce_platform` | `NO_LOCAL_NAME_MATCH` |
| `20260903141310` | `secure_rls_policies` | `NO_LOCAL_NAME_MATCH` |
| `20260903141632` | `step2_app_foundation` | `NO_LOCAL_NAME_MATCH` |
| `20260903142500` | `step3_commerce_checkout` | `NO_LOCAL_NAME_MATCH` |
| `20260903142632` | `checkout_transactional_flow` | `NO_LOCAL_NAME_MATCH` |
| `20260903142736` | `fix_checkout_schema_and_shipping` | `NO_LOCAL_NAME_MATCH` |
| `20260903142748` | `checkout_public_tracking_and_shipping` | `NO_LOCAL_NAME_MATCH` |
| `20260903143311` | `admin_product_management_support` | `NO_LOCAL_NAME_MATCH` |
| `20260903143321` | `product_image_storage` | `NO_LOCAL_NAME_MATCH` |
| `20260903143547` | `admin_order_management` | `NO_LOCAL_NAME_MATCH` |
| `20260903143724` | `production_order_management` | `NO_LOCAL_NAME_MATCH` |
| `20260903143731` | `order_customer_payment_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260903143910` | `customer_management` | `NO_LOCAL_NAME_MATCH` |
| `20260903144249` | `production_product_inventory` | `NO_LOCAL_NAME_MATCH` |
| `20260903144337` | `fix_inventory_movement_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260903144345` | `product_bulk_actions` | `NO_LOCAL_NAME_MATCH` |
| `20260903144451` | `combo_advanced_inventory_v2` | `NO_LOCAL_NAME_MATCH` |
| `20260903144629` | `transactional_combo_order_inventory_v3` | `NO_LOCAL_NAME_MATCH` |
| `20260903144746` | `inventory_bulk_import_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260903145822` | `admin_only_inventory_summary` | `NO_LOCAL_NAME_MATCH` |
| `20260903145900` | `combo_stock_alert_dashboard` | `NO_LOCAL_NAME_MATCH` |
| `20260903150008` | `production_combo_checkout_restore` | `NO_LOCAL_NAME_MATCH` |
| `20260903150025` | `automatic_inventory_restore_on_order_status_v2` | `NO_LOCAL_NAME_MATCH` |
| `20260903150104` | `production_inventory_audit_hardening` | `NO_LOCAL_NAME_MATCH` |
| `20260903150147` | `inventory_public_stock_hardening` | `NO_LOCAL_NAME_MATCH` |
| `20260903150244` | `production_bulk_inventory_import` | `NO_LOCAL_NAME_MATCH` |
| `20260903150307` | `inventory_order_restore_bulk_hardening` | `NO_LOCAL_NAME_MATCH` |
| `20260903150648` | `inventory_atomic_stock_set_and_acl` | `NO_LOCAL_NAME_MATCH` |
| `20260903155256` | `secure_checkout_shipping_calculation` | `NO_LOCAL_NAME_MATCH` |
| `20260903155640` | `lockdown_admin_rpc_execute_permissions` | `NO_LOCAL_NAME_MATCH` |
| `20260903155657` | `remove_public_admin_rpc_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260903155718` | `lockdown_remaining_admin_rpcs` | `NO_LOCAL_NAME_MATCH` |
| `20260904022514` | `harden_customer_rls_and_sensitive_grants` | `NO_LOCAL_NAME_MATCH` |
| `20260904022744` | `security_hardening_round_2` | `NO_LOCAL_NAME_MATCH` |
| `20260904022758` | `harden_create_customer_order_search_path` | `NO_LOCAL_NAME_MATCH` |
| `20260904024250` | `harden_checkout_quantity_limit` | `NO_LOCAL_NAME_MATCH` |
| `20260904024404` | `payment_architecture_hardening` | `NO_LOCAL_NAME_MATCH` |
| `20260904024619` | `payment_status_processing_cancelled` | `NO_LOCAL_NAME_MATCH` |
| `20260904024627` | `payment_webhook_retry_refund_foundation` | `NO_LOCAL_NAME_MATCH` |
| `20260904024655` | `allow_guest_payment_transaction` | `NO_LOCAL_NAME_MATCH` |
| `20260904052658` | `seed_bari_referral_attribution` | `NO_LOCAL_NAME_MATCH` |
| `20260904052806` | `allow_country_scoped_or_global_coupons` | `NO_LOCAL_NAME_MATCH` |
| `20260904052858` | `harden_seed_bari_admin_hierarchy` | `NO_LOCAL_NAME_MATCH` |
| `20260905065616` | `clean_public_for_superking_seed_import` | `NO_LOCAL_NAME_MATCH` |
| `20260905150834` | `add_country_branch_foundation` | `NO_LOCAL_NAME_MATCH` |
| `20260905150949` | `add_country_aware_admin_access` | `NO_LOCAL_NAME_MATCH` |
| `20260905152645` | `enforce_country_scoped_admin_access` | `NO_LOCAL_NAME_MATCH` |
| `20260905152656` | `remove_legacy_unscoped_country_admin_policies` | `NO_LOCAL_NAME_MATCH` |
| `20260905153850` | `branch_aware_product_country_trigger` | `NO_LOCAL_NAME_MATCH` |
| `20260905160937` | `master_branch_aware_product_trigger` | `NO_LOCAL_NAME_MATCH` |
| `20260905162446` | `master_branch_aware_product_currency` | `NO_LOCAL_NAME_MATCH` |
| `20260905163439` | `allow_service_country_for_product_trigger` | `NO_LOCAL_NAME_MATCH` |
| `20260905164141` | `visitor_country_public_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260905164914` | `lock_checkout_to_visitor_country` | `NO_LOCAL_NAME_MATCH` |
| `20260905165341` | `country_delivery_charge` | `NO_LOCAL_NAME_MATCH` |
| `20260905165650` | `seed_india_delivery_zones` | `NO_LOCAL_NAME_MATCH` |
| `20260905170528` | `harden_country_aware_order_creation` | `NO_LOCAL_NAME_MATCH` |
| `20260905170711` | `restrict_admin_catalog_by_country` | `NO_LOCAL_NAME_MATCH` |
| `20260905171414` | `sync_master_admin_branch_country` | `NO_LOCAL_NAME_MATCH` |
| `20260905173716` | `scope_master_admin_by_selected_branch` | `NO_LOCAL_NAME_MATCH` |
| `20260905173956` | `scope_master_admin_by_selected_branch` | `NO_LOCAL_NAME_MATCH` |
| `20260905174128` | `scope_order_history_by_country` | `NO_LOCAL_NAME_MATCH` |
| `20260905174632` | `secure_country_branches_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260905175102` | `scope_product_children_by_country` | `NO_LOCAL_NAME_MATCH` |
| `20260905175428` | `make_combo_system_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260905175706` | `make_reviews_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260905175837` | `make_delivery_settings_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260905175943` | `make_promotions_and_gifts_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260905180220` | `make_marketing_branch_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906005940` | `add_country_scope_referral_wallet` | `NO_LOCAL_NAME_MATCH` |
| `20260906010057` | `branch_scope_homepage_sections` | `NO_LOCAL_NAME_MATCH` |
| `20260906010157` | `make_navigation_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906010249` | `make_pages_custom_pages_services_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906010346` | `make_support_tickets_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906010526` | `make_site_settings_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906010644` | `country_scope_contact_messages` | `NO_LOCAL_NAME_MATCH` |
| `20260906010728` | `scope_admin_audit_notifications_by_country` | `NO_LOCAL_NAME_MATCH` |
| `20260906010845` | `make_ai_system_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906011014` | `make_landing_tracking_branch_aware_v2` | `NO_LOCAL_NAME_MATCH` |
| `20260906011119` | `make_testimonials_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906011212` | `finish_shared_child_isolation` | `NO_LOCAL_NAME_MATCH` |
| `20260906011343` | `tighten_bulk_pricing_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260906011439` | `remove_remaining_broad_child_policies` | `NO_LOCAL_NAME_MATCH` |
| `20260906011618` | `make_blogs_country_aware` | `NO_LOCAL_NAME_MATCH` |
| `20260906011923` | `scope_ai_delivery_zones_by_visitor_country` | `NO_LOCAL_NAME_MATCH` |
| `20260906012030` | `lock_ai_order_creators_to_visitor_country` | `NO_LOCAL_NAME_MATCH` |
| `20260906012324` | `harden_combo_offer_order_country_v2` | `NO_LOCAL_NAME_MATCH` |
| `20260906014647` | `allow_country_site_settings_rows` | `NO_LOCAL_NAME_MATCH` |
| `20260906040038` | `set_product_country_on_insert` | `NO_LOCAL_NAME_MATCH` |
| `20260906040256` | `auto_set_category_country` | `NO_LOCAL_NAME_MATCH` |
| `20260906042135` | `fix_landing_faq_country_isolation` | `NO_LOCAL_NAME_MATCH` |
| `20260906151145` | `allow_authenticated_product_image_uploads` | `NO_LOCAL_NAME_MATCH` |
| `20260907025843` | `sync_admin_site_logo_on_upload` | `NO_LOCAL_NAME_MATCH` |
| `20260907040400` | `route_admin_site_settings_by_branch` | `NO_LOCAL_NAME_MATCH` |
| `20260907040422` | `isolate_india_admin_logo_updates` | `NO_LOCAL_NAME_MATCH` |
| `20260909103530` | `enable_referral_settings` | `NO_LOCAL_NAME_MATCH` |
| `20260909103724` | `fix_referral_code_generation_trigger_and_backfill` | `NO_LOCAL_NAME_MATCH` |
| `20260909114757` | `add_homepage_promos` | `NO_LOCAL_NAME_MATCH` |
| `20260909114908` | `lock_homepage_promos_to_admins` | `NO_LOCAL_NAME_MATCH` |
| `20260909122409` | `add_country_delivery_charges` | `NO_LOCAL_NAME_MATCH` |
| `20260909122527` | `allow_admin_manage_delivery_charges` | `NO_LOCAL_NAME_MATCH` |
| `20260909154008` | `create_video_library` | `NO_LOCAL_NAME_MATCH` |
| `20260909160101` | `fix_referral_signup_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260909161615` | `fix_country_aware_referral_signup_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260910083810` | `add_cashfree_checkout_quote_and_payment_intents` | `NO_LOCAL_NAME_MATCH` |
| `20260910083841` | `cashfree_payment_intent_status_fields` | `NO_LOCAL_NAME_MATCH` |
| `20260910083855` | `grant_cashfree_intent_service_access` | `NO_LOCAL_NAME_MATCH` |
| `20260910093123` | `add_cashfree_paid_order_completion` | `NO_LOCAL_NAME_MATCH` |
| `20260910101208` | `add_product_free_delivery` | `NO_LOCAL_NAME_MATCH` |
| `20260910101316` | `apply_product_free_delivery_to_cashfree_quote` | `NO_LOCAL_NAME_MATCH` |
| `20260910123729` | `fix_cashfree_quote_delivery_country` | `NO_LOCAL_NAME_MATCH` |
| `20260910124855` | `add_atomic_cashfree_order_completion` | `NO_LOCAL_NAME_MATCH` |
| `20260910124905` | `grant_atomic_cashfree_completion_service_role` | `NO_LOCAL_NAME_MATCH` |
| `20260910124925` | `record_cashfree_atomic_completion_version` | `NO_LOCAL_NAME_MATCH` |
| `20260910130445` | `fix_cashfree_atomic_completion_country_and_quote` | `NO_LOCAL_NAME_MATCH` |
| `20260911041144` | `add_atomic_cod_order_completion` | `NO_LOCAL_NAME_MATCH` |
| `20260912033717` | `revoke_public_execute_trigger_security_definers` | `NO_LOCAL_NAME_MATCH` |
| `20260912033727` | `remove_public_execute_trigger_security_definers` | `NO_LOCAL_NAME_MATCH` |
| `20260912033743` | `harden_generate_referral_code_search_path` | `NO_LOCAL_NAME_MATCH` |
| `20260912033801` | `revoke_execute_all_public_trigger_functions` | `NO_LOCAL_NAME_MATCH` |
| `20260912051004` | `harden_remaining_function_search_paths` | `NO_LOCAL_NAME_MATCH` |
| `20260912051120` | `revoke_auto_confirm_user_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912051151` | `harden_create_referral_code_trigger_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912051234` | `revoke_public_execute_qualify_referral_trigger` | `NO_LOCAL_NAME_MATCH` |
| `20260912052339` | `revoke_route_admin_site_settings_trigger_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912052409` | `revoke_public_execute_set_animated_landing_country_code` | `NO_LOCAL_NAME_MATCH` |
| `20260912052558` | `revoke_public_execute_set_animated_landing_package_country_code` | `NO_LOCAL_NAME_MATCH` |
| `20260912052643` | `harden_set_category_country_trigger` | `NO_LOCAL_NAME_MATCH` |
| `20260912052830` | `harden_set_child_country_from_product_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912052905` | `revoke_trigger_execute_set_landing_faq_country` | `NO_LOCAL_NAME_MATCH` |
| `20260912053202` | `harden_set_landing_page_view_country_code_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912053530` | `revoke_execute_set_product_country_code` | `NO_LOCAL_NAME_MATCH` |
| `20260912053649` | `revoke_support_ticket_country_trigger_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912053842` | `revoke_sync_admin_site_logo_trigger_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912054220` | `revoke_public_execute_sync_order_status_fields` | `NO_LOCAL_NAME_MATCH` |
| `20260912054320` | `harden_sync_referral_feature_flag_trigger_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912054504` | `optimize_order_items_customer_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912150100` | `optimize_orders_customer_select_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912150129` | `optimize_wishlists_owner_policy_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912150202` | `optimize_homepage_promos_admin_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912150256` | `optimize_order_status_history_customer_select_rls_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912150358` | `optimize_admin_users_select_policy_auth_calls` | `NO_LOCAL_NAME_MATCH` |
| `20260912150521` | `optimize_customer_addresses_self_delete_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912150628` | `optimize_customer_addresses_self_insert_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912150734` | `optimize_customer_addresses_self_select_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912151149` | `optimize_customer_addresses_self_update` | `NO_LOCAL_NAME_MATCH` |
| `20260912151325` | `optimize_addresses_self_delete_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912151435` | `optimize_addresses_self_insert_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912151534` | `optimize_addresses_self_select_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912151630` | `optimize_addresses_self_update_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912151711` | `optimize_reviews_authenticated_insert_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912151750` | `optimize_referrals_participant_select_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912151900` | `optimize_referral_codes_owner_select_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912151952` | `optimize_referral_rewards_owner_select_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260912152040` | `optimize_wallet_transactions_owner_select_auth_uid` | `NO_LOCAL_NAME_MATCH` |
| `20260912152305` | `optimize_wallet_reservations_owner_select` | `NO_LOCAL_NAME_MATCH` |
| `20260912152412` | `revoke_unused_referral_signup_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912152509` | `restrict_generate_referral_code_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912152520` | `remove_public_generate_referral_code_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912152826` | `restrict_ensure_referral_code_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912153338` | `lock_down_unused_lookup_referral_code_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260912153510` | `harden_referral_wallet_balance_rpc_access` | `NO_LOCAL_NAME_MATCH` |
| `20260912153551` | `harden_get_referral_wallet_max_usage_exec` | `NO_LOCAL_NAME_MATCH` |
| `20260912153746` | `lock_down_referral_wallet_summary` | `NO_LOCAL_NAME_MATCH` |
| `20260912153841` | `harden_is_referral_wallet_unlocked_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912154010` | `restrict_combo_feature_flag_rpc` | `NO_LOCAL_NAME_MATCH` |
| `20260912154140` | `harden_referral_signup_anon_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260912154534` | `remove_redundant_delivery_zones_admin_policy` | `NO_LOCAL_NAME_MATCH` |
| `20260912154633` | `remove_duplicate_landing_faq_admin_policy` | `NO_LOCAL_NAME_MATCH` |
| `20260912154818` | `remove_redundant_quantity_offers_admin_policy` | `NO_LOCAL_NAME_MATCH` |
| `20260912161844` | `drop_redundant_blog_slug_index` | `NO_LOCAL_NAME_MATCH` |
| `20260912162006` | `remove_redundant_ai_conversations_index` | `NO_LOCAL_NAME_MATCH` |
| `20260912162334` | `remove_unused_order_items_bundle_index` | `NO_LOCAL_NAME_MATCH` |
| `20260912162456` | `drop_unused_order_items_variant_index` | `NO_LOCAL_NAME_MATCH` |
| `20260921052653` | `20260921090000_harden_cashfree_payment_intents_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260921053125` | `20260921093000_restrict_admin_rpc_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260921053155` | `20260921094500_lock_ai_internal_rpcs` | `NO_LOCAL_NAME_MATCH` |
| `20260921053301` | `20260921_lock_cashfree_intents_to_service_role` | `NO_LOCAL_NAME_MATCH` |
| `20260921054223` | `fix_public_catalog_country_rls_after_admin_rpc_hardening` | `NO_LOCAL_NAME_MATCH` |
| `20260921054955` | `cleanup_gazi_seed_production_branding_and_test_catalog` | `NO_LOCAL_NAME_MATCH` |
| `20260921060140` | `harden_order_user_binding_and_rpc_privileges` | `NO_LOCAL_NAME_MATCH` |
| `20260921060230` | `lock_internal_admin_rpc_helpers` | `NO_LOCAL_NAME_MATCH` |
| `20260921180542` | `harden_admin_branch_and_optimize_rls_indexes` | `NO_LOCAL_NAME_MATCH` |
| `20260921180547` | `allow_admin_branch_context_read` | `NO_LOCAL_NAME_MATCH` |
| `20260921180643` | `consolidate_permissive_rls_policies_v3` | `NO_LOCAL_NAME_MATCH` |
| `20260921204034` | `add_multilingual_content_layer` | `NO_LOCAL_NAME_MATCH` |
| `20260922005843` | `create_order_sms_logs` | `NO_LOCAL_NAME_MATCH` |
| `20260922012906` | `add_india_sms_settings` | `NO_LOCAL_NAME_MATCH` |
| `20260922013104` | `india_mobile_verification_otp` | `NO_LOCAL_NAME_MATCH` |
| `20260922014611` | `add_india_otp_delivery_logs` | `NO_LOCAL_NAME_MATCH` |
| `20260922162107` | `allow_public_site_settings_select` | `NO_LOCAL_NAME_MATCH` |
| `20260922162954` | `grant_admin_rpc_execute_permissions` | `NO_LOCAL_NAME_MATCH` |
| `20260922163512` | `auto_seo_product_metadata_v1` | `NO_LOCAL_NAME_MATCH` |
| `20260923152025` | `harden_track_order_and_index_otp_logs` | `NO_LOCAL_NAME_MATCH` |
| `20260923152033` | `tighten_track_order_execute_privilege` | `NO_LOCAL_NAME_MATCH` |
| `20260923155114` | `add_whatsapp_ai_channel` | `NO_LOCAL_NAME_MATCH` |
| `20260924044312` | `add_branch_aware_admin_order_update_policies` | `NO_LOCAL_NAME_MATCH` |
| `20260924045028` | `fix_branch_aware_marketing_settings` | `NO_LOCAL_NAME_MATCH` |
| `20260924091504` | `fix_content_branch_rls_and_homepage_promos` | `NO_LOCAL_NAME_MATCH` |
| `20260924091638` | `tighten_homepage_promos_branch_read_policy` | `NO_LOCAL_NAME_MATCH` |
| `20260924092153` | `fix_promotions_branch_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260924093048` | `fix_settings_branch_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260924101016` | `fix_delivery_branch_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260924101433` | `sync_delivery_charge_with_admin_rules` | `NO_LOCAL_NAME_MATCH` |
| `20260924103148` | `fix_products_branch_write_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260924103510` | `fix_product_faq_bulk_branch_rls` | `NO_LOCAL_NAME_MATCH` |
| `20260926065907` | `grant_authenticated_track_order_execute` | `NO_LOCAL_NAME_MATCH` |
| `20260929132935` | `20260929140000_add_messenger_customer_profiles` | `NO_LOCAL_NAME_MATCH` |
| `20260929140411` | `20260929170000_messenger_product_search_optimization` | `NO_LOCAL_NAME_MATCH` |
| `20260929142852` | `20260929145000_messenger_rate_limit_abuse_protection` | `NO_LOCAL_NAME_MATCH` |
| `20261001070238` | `enable_pg_net_for_database_webhooks` | `NO_LOCAL_NAME_MATCH` |
| `20261001090307` | `add_meta_message_id_to_messenger_order_status_notifications` | `NO_LOCAL_NAME_MATCH` |
| `20261001171349` | `20261001173000_preserve_cashfree_order_source` | `NO_LOCAL_NAME_MATCH` |
| `20261002045645` | `fix_bd_checkout_rpc_security_and_idempotency` | `NO_LOCAL_NAME_MATCH` |
| `20261002045649` | `remove_legacy_bd_checkout_rpc_overload` | `NO_LOCAL_NAME_MATCH` |
| `20261003092352` | `allow_public_marketing_settings_read` | `NO_LOCAL_NAME_MATCH` |
| `20261003163727` | `add_meta_ads_insights_daily` | `NO_LOCAL_NAME_MATCH` |
| `20261004090735` | `optimize_marketing_settings_select_policy` | `NO_LOCAL_NAME_MATCH` |
| `20261004132344` | `add_reviews_admin_branch_select_policy` | `NO_LOCAL_NAME_MATCH` |
| `20261004153454` | `add_product_promotional_spotlight_fields` | `NO_LOCAL_NAME_MATCH` |
| `20261004153504` | `add_product_promotional_spotlight_english_fields` | `NO_LOCAL_NAME_MATCH` |
| `20261007064522` | `add_bulk_pricing_free_item_text` | `NO_LOCAL_NAME_MATCH` |
| `20261008115546` | `allow_messenger_notification_sending_state` | `NO_LOCAL_NAME_MATCH` |
| `20261008155002` | `fix_ads_package_item_totals` | `NO_LOCAL_NAME_MATCH` |
| `20261009115024` | `allow_anon_read_active_country_combo_packs` | `NO_LOCAL_NAME_MATCH` |
| `20261010030214` | `guard_cashfree_verified_india_dispatch_20261010` | `NO_LOCAL_NAME_MATCH` |

## Repository files without a same-name Production record

| Repository version | Repository file | Status |
|---|---|---|
| `20260801130143` | `20260801130143_create_core_schema.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260801130235` | `20260801130235_create_rls_and_order_function.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260801134623` | `20260801134623_add_ads_landing_system.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260802023332` | `20260802023332_add_landing_content_seo_fields.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260802023348` | `20260802023348_add_storage_policies.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260802023552` | `20260802023552_fix_create_order_bundle_stock.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260802024630` | `20260802024630_add_quantity_offers_table.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260802024653` | `20260802024653_update_create_order_quantity_offers.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260803004029` | `20260803004029_fix_order_items_quantity_offer_and_address_fields.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260803004049` | `20260803004049_fix_create_order_quantity_offer_id.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260803014748` | `20260803014748_add_admin_audit_log_and_master_admin.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260803020458` | `20260803020458_add_review_management_and_master_admin.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260803021435` | `20260803021435_fix_reviews_rls_and_contact_messages.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260804011846` | `20260804011846_add_growth_features_tables.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260804013805` | `20260804013805_add_sales_operations_upgrade.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260809193316` | `20260809193316_final_master_upgrade.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260809195055` | `20260809195055_rebrand_to_seed_bari.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260809202738` | `20260809202738_add_ai_settings_foundation.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260809205944` | `20260809205944_add_themes_popups_notifications.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260809212905` | `20260809212905_clear_old_products_preserve_reviews_inventory.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260810184101` | `20260810184101_add_watermark_settings.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812205315` | `20260812205315_20260812190000_add_referral_program_foundation.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812205724` | `20260812205724_20260812210000_add_referral_code_auto_generation.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812211208` | `20260812211208_add_referral_terms_column.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812211600` | `20260812211600_add_referral_qualification_logic.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812212031` | `20260812212031_add_referral_reward_calculation.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812212843` | `20260812212843_add_referral_reward_issue_ledger.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260812212916` | `20260812212916_fix_reward_ledger_trigger_timing.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260814204631` | `20260814204631_fix_referral_trigger_search_path.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260815114254` | `20260815114254_create_fresh_master_admin_account.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260815114950` | `20260815114950_create_product_images_bucket.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817020243` | `20260817020243_create_master_admin_seedbari_account.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817020658` | `20260817020658_fix_admin_rpc_search_path.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044128` | `20260817044128_20260812212031_add_referral_reward_calculation.sql.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044137` | `20260817044137_20260812212843_add_referral_reward_issue_ledger.sql.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044143` | `20260817044143_20260812212916_fix_reward_ledger_trigger_timing.sql.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044149` | `20260817044149_20260814204631_fix_referral_trigger_search_path.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044158` | `20260817044158_20260815114254_create_fresh_master_admin_account.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044206` | `20260817044206_20260815114950_create_product_images_bucket.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044213` | `20260817044213_20260817020243_create_master_admin_seedbari_account.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260817044220` | `20260817044220_20260817020658_fix_admin_rpc_search_path.sql.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824012900` | `20260824012900_secure_offer_order_dispatch.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824015000` | `20260824015000_remove_legacy_delivery_zone_order_rpc.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824020000` | `20260824020000_enforce_single_master_admin.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824023000` | `20260824023000_harden_last_master_admin_guard.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824024500` | `20260824024500_restrict_admin_helper_rpc.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824031000` | `20260824031000_fix_addresses_rls.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824033000` | `20260824033000_harden_customers_rls.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824035000` | `20260824035000_harden_legacy_delivery_rls.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824041000` | `20260824041000_harden_order_user_ownership.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824043000` | `20260824043000_harden_last_master_admin_privilege.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824044500` | `20260824044500_restrict_order_ownership_trigger.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824050000` | `20260824050000_harden_auto_confirm_user.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824052000` | `20260824052000_harden_update_updated_at.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824053500` | `20260824053500_harden_set_order_number.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824054500` | `20260824054500_harden_calculate_delivery_charge.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824055500` | `20260824055500_harden_is_admin_search_path.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824061000` | `20260824061000_harden_is_master_admin_search_path.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824063000` | `20260824063000_harden_public_order_user_identity.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824065000` | `20260824065000_fix_combo_order_item_line_total.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824090000` | `20260824090000_add_feature_toggle_columns.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824104500` | `20260824104500_harden_rls_auth_initplan.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260824220000` | `20260824220000_referral_reward_safety.sql` | `COMMENT_ONLY_NOOP_NO_EXECUTABLE_SQL` |
| `20260824221500` | `20260824221500_referral_reward_issuance.sql` | `COMMENT_ONLY_NOOP_NO_EXECUTABLE_SQL` |
| `20260824230000` | `20260824230000_complete_referral_program.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260825041143` | `20260825041143_harden_storage_object_policies.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260825093000` | `20260825093000_fix_referral_wallet_balance_ledger_usage.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260929140000` | `20260929140000_add_messenger_customer_profiles.sql` | `SQL_FINGERPRINT_MATCH_AT_PROD_VERSION_20260929132935` |
| `20260929145000` | `20260929145000_messenger_rate_limit_abuse_protection.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20260929170000` | `20260929170000_messenger_product_search_optimization.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20260929140411` |
| `20261001173000` | `20261001173000_preserve_cashfree_order_source.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20261001171349` |
| `20261003100000` | `20261003100000_harden_public_rpc_rate_limits.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261003210000` | `20261003210000_add_meta_ads_insights.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20261003163727` |
| `20261007120000` | `20261007120000_add_product_growing_types.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261007123000` | `20261007123000_add_bulk_offer_free_item_text.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20261007064522` |
| `20261008093000` | `20261008093000_fix_ai_settings_country_key.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261008095500` | `20261008095500_move_ai_keys_to_vault.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261008102000` | `20261008102000_scope_messenger_profiles_by_country.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261008103500` | `20261008103500_disable_unconfigured_generic_ai.sql` | `REPO_ONLY_OR_RENAMED_NOT_YET_MAPPED` |
| `20261008160000` | `20261008160000_fix_ads_offer_order_totals.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20261008155002` |
| `20261008183000` | `20261008183000_add_messenger_order_notification_sending_state.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20261008115546` |

## Safe reconciliation sequence

1. Complete token comparison for every `PENDING_SQL_COMPARE` name-matched pair.
2. For each `NO_LOCAL_NAME_MATCH` row, search Git history/branches and compare stored SQL; recover a canonical migration file only after determining where the effect currently exists.
3. Compare `SQL_DIFF` rows with `pg_proc`, `pg_policies`, `pg_indexes`, trigger definitions, constraints, and the current migration/job state. Use no customer/order/payment rows for this task.
4. Review repo-only files in chronological order to identify work applied through another filename/version or not yet applied.
5. Create a separate reviewed reconciliation PR; keep Production migration history unchanged until the mapping and rollout plan are approved.

## Audit limits

This is a point-in-time read-only inventory. It does not prove that all columns, functions, constraints, policies, triggers, or data effects are correct. The content comparison is complete only for rows explicitly marked above; pending comparisons remain unverified.

## Live-schema effect review — batch 1 (10 of 72 unmatched files)

**Method:** read the first ten unmatched migration files and compare their expected objects with Production's current catalog (public tables/views, 1,189 columns, 103 functions, 216 indexes, 201 public policies, 65 public triggers, 246 constraints, plus Storage bucket/policy metadata). Catalog counts are a snapshot, not a health score. No customer/order/payment rows were read. No Production data or schema was changed.

| Repository migration | Intended effect vs current Production catalog | Result / follow-up |
|---|---|---|
| `20260801130143_create_core_schema.sql` | Foundational commerce tables and most core indexes exist. Examples of equivalent constraints/indexes: `products_slug_key` for the old product-slug uniqueness/index intent; `orders_order_number_key` for order number uniqueness; `blog_posts_slug_key` for blog-post slug uniqueness. Most named indexes remain. | **Present, evolved.** Current order-number generation is `set_order_number()` with `orders.trigger_set_order_number`, not the old `generate_order_number()` helper. Current `create_order` signatures and several table columns differ from this early schema. Do not replay the bootstrap SQL. |
| `20260801130235_create_rls_and_order_function.sql` | Commerce tables have current policies, but the legacy policy names (such as `public_read_products` / `admin_write_products`) have been consolidated/renamed into current branch-aware policies. Current order RPCs exist under newer signatures. | **Mostly superseded.** `generate_order_number()` is absent but replaced by the trigger-based `set_order_number()`. Exact old policy/function-name absence is not evidence of missing security behavior; policy predicates and live RPC definitions must be compared semantically. |
| `20260801134623_add_ads_landing_system.sql` | `products.is_ads_only`, `landing_pages.landing_name`, `landing_pages.landing_slug`, `landing_pages.status`, `landing_pages.views`, and `landing_page_views` exist. `is_default_selected` and `custom_delivery_charge` are now on `quantity_offers`, not `bundle_offers`. Current `landing_page_views` records country/IP/user-agent fields; its old UTM/fbclid/gclid columns are not present. The historical landing-page and view index names were not found as exact/equivalent indexes in the current catalog. | **Partially superseded; verify analytics/indexing.** The main ads/landing concepts exist, but legacy attribution columns and several expected indexes have no direct catalog match. Inspect current application reads/writes and query plans before deciding whether forward fixes are warranted. |
| `20260802023332_add_landing_content_seo_fields.sql` | `landing_reviews` and `landing_faqs` exist, but several fields added historically to `landing_pages` (`seo_title`, `meta_description`, `og_title`, `og_description`, `og_image`, `section_order`, `offer_headline`, `offer_badge`, `discount_label`) are not present on that table. Product-level `seo_title` / `meta_description` exist, which is not proof that page-level SEO is replaced. Current review/FAQ columns and policies differ from the historical definitions; no current index equivalent for `idx_lr_landing` / `idx_lf_landing` was identified. | **Partial / manual review required.** Check current landing-page metadata generation and whether the missing `landing_page_id` indexes are needed. Current `landing_reviews` and `landing_faqs` policy snapshots show authenticated-only select policies; no anon select policy was found in this catalog query. Verify the live public-page data path before changing RLS. |
| `20260802023348_add_storage_policies.sql` | `product-images` bucket exists and is `public=true`. Current Storage policies allow authenticated upload/delete and also authenticated update, under newer names. No explicit anon SELECT policy exists in `storage.objects`. | **Public-read outcome appears present via public bucket configuration; upload/delete intent is present under renamed policies.** Keep public-bucket configuration and policy behavior under review; do not add a second policy by blindly replaying the old SQL. |
| `20260802023552_fix_create_order_bundle_stock.sql` | The old RPC signature is absent, but current `create_offer_order` loads quantity/price server-side for bundle/quantity-offer paths and deducts the resolved quantity from stock. | **Core bundle-stock intent present through the newer offer RPC.** Current RPC implementation differs from the historical body; review both offer and ordinary checkout paths separately before marking this historical file equivalent in the migration ledger. |
| `20260802024630_add_quantity_offers_table.sql` | `quantity_offers` exists with `quantity`, `offer_price`, `custom_delivery_charge`, `is_default_selected`, and active state. `idx_quantity_offers_landing_page_id` and `idx_quantity_offers_product_id` replace the old `idx_qo_landing` / `idx_qo_product` by intent. No `idx_qo_active` equivalent was identified. The current policies on the table in this snapshot apply to authenticated roles; no anon SELECT policy was found. | **Table present; review index and anonymous read path.** The absence of the old index names is not itself a gap. Confirm whether public pages read offers directly or rely on server-side/landing-page JSON fallbacks. |
| `20260802024653_update_create_order_quantity_offers.sql` | The currently deployed `create_offer_order` RPC finds active `quantity_offers` by landing page, product and quantity, then uses the database-side offer price/quantity and deducts stock. | **Core price/quantity security intent present through the newer RPC. Potential gap:** the current RPC's quantity-offer SELECT does not fetch/use `custom_delivery_charge`; it calculates delivery from offer price/free-delivery instead. This is a behavior difference to verify in checkout and fix only with a reviewed forward migration if confirmed. |
| `20260803004029_fix_order_items_quantity_offer_and_address_fields.sql` | Structured address columns (`label`, `division`, `district`, `thana`, `postal_code`) exist on `customer_addresses`. `order_items.quantity_offer_id` is absent. | **Address-field intent present; order-item linkage design changed.** Current offer RPC writes a price/quantity snapshot to `order_items` and does not use `quantity_offer_id`. Check application/admin order display and reconciliation needs before concluding the missing foreign-key-like reference is a defect. |
| `20260803004049_fix_create_order_quantity_offer_id.sql` | The historical function writes a quantity-offer reference into `order_items.quantity_offer_id`. Current `create_offer_order` uses a different signature and stores snapshot values; current `order_items` has no `quantity_offer_id` column. | **Appears superseded by current order-line model; not safe to replay.** Confirm reporting/audit needs for tracing which offer created each line, then decide whether snapshot-only persistence is sufficient. |

### Batch 1 conclusions

- These ten files do **not** imply ten missing migrations. Several expected behaviors are demonstrably implemented with newer table layouts, policy names, RPC signatures, or triggers.
- **Highest-priority follow-ups found:** missing page-level landing SEO fields (unless intentionally moved elsewhere); possible anonymous-read gaps for landing reviews/FAQs and quantity offers (depending on the website's current read path); unmatched landing/view/quantity-offer indexes; and `quantity_offers.custom_delivery_charge` not being consumed by the current `create_offer_order` implementation.
- Those are catalog/code-review candidates, not instructions to mutate Production. The next batch should continue with files 11–20 and use the same semantic check before drawing conclusions.

## Live-schema effect review — batch 2 (20 of 72 unmatched files)

**Method:** read migrations 11–20 from the no-fingerprint-match set and compare their expected objects with the current Production catalog. This remains a read-only catalog check; no customer/order/payment rows were queried and no Production DDL/DML was executed.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260803014748_add_admin_audit_log_and_master_admin.sql` | `admin_audit_log`, `admin_users.role`, the three audit indexes, and `is_master_admin()` exist. Current audit policies are country/branch-scoped. | **Mostly present, evolved.** `admin_users.last_login_at` is absent in the current catalog; `role` is nullable now, unlike this migration's NOT NULL/default definition. Confirm whether the login timestamp was intentionally dropped and whether nullable role is guarded elsewhere. |
| `20260803020458_add_review_management_and_master_admin.sql` | `reviews.admin_reply`, `verified_purchase`, `user_id`, `status`, and `is_approved` exist. Current public SELECT policy limits rows by `is_approved = true` and visitor country. | **Core fields/policy intent present.** `idx_reviews_user_id` and `idx_reviews_status` were not found. `admin_users.last_login_at` remains absent. |
| `20260803021435_fix_reviews_rls_and_contact_messages.sql` | Current public review policy is approved-only, and anonymous review INSERT is constrained to `user_id IS NULL` plus visitor country. No `sync_review_status()` function/trigger was found. `contact_messages.admin_reply` and `replied_at` are absent from current `contact_messages` columns. | **Partial; review synchronization and contact-reply fields need review.** Check whether the admin UI deliberately writes `status` and `is_approved` together; do not assume the absent trigger is harmless. The contact reply feature may have moved, but there is no same-name column evidence. |
| `20260804011846_add_growth_features_tables.sql` | `combo_packs`, `combo_items`, `promotions`, `promotion_gifts`, `product_batches`, `stock_notifications`, and `product_faqs` exist. Product `related_product_ids` and `image_alt` / `image_alt_bn` exist. Current public read policies are branch-aware for promotions/combos/gifts, and stock-notification anonymous insert exists. | **Main feature tables present; schema/policies evolved.** `blog_posts.related_product_ids` was not found. The current `product_faqs` SELECT policy visible in the catalog is authenticated-role only; no anon SELECT policy was found, so verify how the public product page obtains FAQs. |
| `20260804013805_add_sales_operations_upgrade.sql` | `product_variants`, `bulk_pricing`, `wishlists`, and `support_tickets` exist. `order_items.variant_id` exists, and feature toggles for variants/bulk pricing/wishlists exist in `site_settings`. | **Partial / schema evolved.** `customer_tags` and `support_ticket_replies` tables are absent. The historical `orders.cost_price_total` / `coupon_discount` and `order_items.variant_name` / `is_free_gift` / `promotion_id` / `cost_price` columns are absent; replacements or UI/reporting impact need review. |
| `20260809193316_final_master_upgrade.sql` | `reviews.guest_phone`, `landing_pages.landing_type`, `combo_product_ids`, `combo_quantities`, and several historical feature toggles exist. The historical `contact_messages.admin_reply` / `replied_at` and the listed courier/SMS/WhatsApp/payment/analytics integration columns are not present on `site_settings`. | **Partial / likely integration architecture changed.** Verify where integration configuration now lives and whether contact-message replies are still supported. Never add plaintext API-key columns simply to recreate the old layout. |
| `20260809195055_rebrand_to_seed_bari.sql` | The live `site_settings.website_name` column default is still `'GAZI SEED'`; both current stored settings rows also have `website_name = 'GAZI SEED'`. | **Rebrand effect is not visible in current settings.** This is a configuration/data mismatch with the historical file's intended change; it may be deliberate for a particular country branch. Confirm desired India/BD branding before any forward data update. |
| `20260809202738_add_ai_settings_foundation.sql` | `ai_settings` exists with an added country dimension and `api_key_secret_id`; `ai_get_api_key()` and `ai_store_api_key()` use Vault. | **AI foundation present, evolved.** Current settings policy is country/branch-admin scoped rather than the historical master-admin-only policy, and the original single-row design became a composite `(id, country_code)` key. Review the least-privilege requirement and RPC grants; no secret values were read. |
| `20260809205944_add_themes_popups_notifications.sql` | `site_settings.homepage_theme`, `promotional_popups`, `admin_notifications`, and current order/review/contact/support notification functions/triggers exist. Current public popup read is active-country scoped; admin notification access is branch scoped. | **Main intent present through newer implementation.** Current predicates are tighter/different from the legacy blanket public-read/admin policies, so preserve and review them semantically instead of restoring the old policy names. |
| `20260809212905_clear_old_products_preserve_reviews_inventory.sql` | Current `reviews.product_id` and `inventory_history.product_id` remain NOT NULL. This migration intentionally performs catalog DML and temporarily changes constraints/nullability before cleanup. | **Data-state cannot be concluded from catalog metadata alone. Do not replay.** Checkpoint whether historic cleanup was already performed using approved, non-sensitive evidence (counts/constraints or backup history) before any decision; no product/review/inventory rows were read. |

## High-priority access-control finding from the same catalog pass

The sales-operations migration explicitly says product cost price must not be exposed publicly, and the later review migration documents `reviews.guest_phone` as private. However, the current PostgreSQL ACL check returned:

- `anon` has table SELECT and column SELECT on `public.products.cost_price`; current `products_public_select` policy admits active products for the visitor's country.
- `anon` has table SELECT and column SELECT on `public.reviews.guest_phone`; current `reviews_public_read` policy admits approved reviews for the visitor's country.

**This indicates potential public exposure of supplier/unit cost and reviewer phone values through the Data API.** RLS filters rows; it does not hide individual columns. The catalog pass did not read any of those values and did not attempt an API data request. Treat this as **high-priority security remediation**: validate the effective Data API exposure and implement a reviewed column-safe design (for example, a public view with an allowlisted column set and appropriate grants, or separate private fields/table). Do not merely recreate historic policies or directly alter Production during reconciliation.

### Batch 2 conclusions

- The objects are not simply missing en masse: core admin audit, reviews, growth features, settings, popup/notification functions, and AI Vault access exist, mostly with newer country/branch-aware structure.
- Concrete gaps or mismatches to validate next: public exposure of `products.cost_price` / `reviews.guest_phone`; absent contact reply fields; absent review status-sync trigger; absent customer tags/support replies tables; absent historical finance/variant fields; and current branding config still reading `GAZI SEED`.
- The catalog is evidence for planning follow-up work, not permission to apply migrations. The destructive product-cleanup migration and all migration-history repair remain out of scope until the intended live state is proved.

## Live-schema effect review — batch 3 (30 of 72 unmatched files)

**Method:** compare migration files 21–30 with the live schema, the currently installed referral/AI/admin functions, and triggers in `auth.users`, `orders`, and `referrals`. No auth-user/account rows or wallet/customer transaction rows were inspected.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260810184101_add_watermark_settings.sql` | All five watermark fields (`watermark_enabled`, `watermark_logo_url`, `watermark_opacity`, `watermark_size`, `watermark_position`) exist on `site_settings`. | **Effect present.** Current columns are nullable, unlike the original NOT NULL definitions; verify current code defaults/settings semantics instead of re-running this migration. |
| `20260812205315_20260812190000_add_referral_program_foundation.sql` | Referral settings, codes, referrals, rewards and later wallet settings/transactions/reservations exist. Current keys/indexes and row scope are country-aware; the old recipient field/index names have changed (current reward owner is `user_id`). | **Core foundation present, schema evolved.** Legacy owner/recipient policies were replaced by branch-aware policies. Compare permissions and wallet/reward semantics, not legacy policy names. |
| `20260812205724_20260812210000_add_referral_code_auto_generation.sql` | `generate_referral_code()`, `ensure_referral_code(uuid)`, `create_referral_code_on_signup()`, and `auth.users.trg_create_referral_code_on_signup` exist. The functions have an explicit `search_path=public`. | **Auto-generation effect present, with a branding mismatch.** The live generator currently builds codes with the `GAZISEED-` prefix; the historical migration specifies `SEEDBARI-`. Confirm the intended prefixes by branch and current business rules before changing generation or existing codes. |
| `20260812211208_add_referral_terms_column.sql.sql` | `referral_settings.terms` exists. | **Effect present.** |
| `20260812211600_add_referral_qualification_logic.sql.sql` | `referrals.qualifying_order_id` exists. The old `qualify_referral_on_order()` / `revoke_referral_on_cancel()` functions and their trigger names are absent. Current implementation uses `orders.trg_qualify_referral_from_order` and `qualify_referral_from_order()`, which checks delivery/completion status; a separate `referrals.trg_reverse_referral_reward_on_cancel` exists. | **Qualification replaced; cancellation path needs semantic review.** Current referral qualification is tied to order status transitions, while the historical file also covered order cancellation/deletion. Verify whether cancellation of an already-qualified order revokes its referral/reward; the current trigger names alone do not prove equivalent behavior. |
| `20260812212031_add_referral_reward_calculation.sql.sql` | The old `calculate_referral_reward()` is absent. `calculate_and_issue_referral_reward()` now calculates the reward and writes to `referral_rewards` and `referral_wallet_transactions`; it is attached to a current referral status trigger. | **Replaced by a combined reward flow.** Current calculation and issuance are coupled; review idempotency and cancellation/reversal behavior together rather than reinstalling the old trigger. |
| `20260812212843_add_referral_reward_issue_ledger.sql.sql` | `referral_rewards` exists with a unique referral key, and `referral_wallet_transactions` has reward-once/usage indexes. The old `issue_referral_reward_ledger()` trigger is absent. | **Ledger/idempotency intent appears implemented by the newer combined function.** Current schemas use `user_id` and `status` rather than the historical `recipient_id` / `redeemed_at` model. |
| `20260812212916_fix_reward_ledger_trigger_timing.sql.sql` | Current reward issuance is performed by `calculate_and_issue_referral_reward()` after a qualifying referral status update; it does not use the old trigger that mutated `NEW` before update. | **Old timing fix is superseded by different design.** Do not force the historical BEFORE trigger back into Production without reviewing recursive status transitions and idempotency. |
| `20260814204631_fix_referral_trigger_search_path.sql` | `generate_referral_code()`, `ensure_referral_code(uuid)`, and `create_referral_code_on_signup()` all have `search_path=public`. | **Security intent present.** |
| `20260815114254_create_fresh_master_admin_account.sql` | `admin_users`, `is_master_admin()`, and the last-master-admin guard/trigger exist. | **Schema guardrails present; account-creation data effect intentionally unverified.** To avoid reading auth account details, this audit did not check whether that migration's specific account row exists. Do not rerun the account-creation migration as a reconciliation shortcut. |

### Batch 3 conclusions

- Watermark fields, referral foundation, terms, signup-code trigger and explicit referral-function search paths are present.
- Important differences needing business/security review: current referral-code prefix still says `GAZISEED-`; order-cancellation referral reversal may not be equivalent to the old trigger; and reward calculation/issuance is now a combined stateful function.
- The master-admin account migration is data-sensitive; its exact effect remains intentionally unverified without an approved, privacy-preserving existence check.

## Live-schema effect review — batch 4 (40 of 72 unmatched files)

**Method:** review duplicate/repair-era files 31–40. The current catalog was checked for the bucket, helper-function security settings and the currently deployed referral reward/sign-up triggers. Account records were not read.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260815114950_create_product_images_bucket.sql` | Storage bucket `product-images` exists and is public; it has current authenticated upload/delete/update policies. | **Bucket effect present.** The later bucket file is idempotent. Do not rerun it as a migration-history fix. |
| `20260817020243_create_master_admin_seedbari_account.sql` | Master-admin support, `is_master_admin()`, and last-master-admin guardrails exist. | **Account data intentionally unverified.** No auth-user or admin-user records were inspected; do not recreate an account merely because a migration filename has no matching history entry. |
| `20260817020658_fix_admin_rpc_search_path.sql` | `is_admin()` and `is_master_admin()` are SECURITY DEFINER functions with `search_path=public`. | **Search-path hardening present.** |
| `20260817044128_20260812212031_add_referral_reward_calculation.sql.sql.sql` | The old `calculate_referral_reward()` is absent; current reward calculation/issuance is done by `calculate_and_issue_referral_reward()`. | **Superseded by combined referral reward flow** (see batch 3). |
| `20260817044137_20260812212843_add_referral_reward_issue_ledger.sql.sql.sql` | The old `issue_referral_reward_ledger()` is absent; current reward ledger and wallet transaction tables plus unique/referral-once indexes exist. | **Superseded by current ledger implementation** (see batch 3). |
| `20260817044143_20260812212916_fix_reward_ledger_trigger_timing.sql.sql.sql` | Current trigger is `referrals.trg_calculate_and_issue_referral_reward` after status update, rather than the historical BEFORE-update ledger trigger. | **Legacy trigger timing no longer applies to the current function.** Validate transaction idempotency and cancellation behavior as one combined flow. |
| `20260817044149_20260814204631_fix_referral_trigger_search_path.sql.sql` | `generate_referral_code()`, `ensure_referral_code(uuid)`, and `create_referral_code_on_signup()` all have `search_path=public`. | **Security intent present.** |
| `20260817044158_20260815114254_create_fresh_master_admin_account.sql.sql` | General master-admin schema and guardrails exist. | **Account data intentionally unverified**, for the same privacy reason as the earlier account-creation file. |
| `20260817044206_20260815114950_create_product_images_bucket.sql.sql` | `product-images` bucket is present with public access enabled. | **Effect present.** This duplicate/upsert-style bucket creation must not be used to repair migration history. |
| `20260817044213_20260817020243_create_master_admin_seedbari_account.sql.sql` | General master-admin schema/guardrails exist. | **Account data intentionally unverified.** The SQL contains account-creation DML; no user row was examined or recreated. |

### Batch 4 conclusions

- The bucket, helper search paths and current referral reward infrastructure are present.
- Several files repeat older referral/account/bucket work, but a file that creates an account is data-changing and remains unverified rather than assumed applied.
- Do not replay any of these files on Production to resolve filename/history drift.

## Live-schema effect review — batch 5 (50 of 72 unmatched files)

**Method:** compare the next ten historical security/RPC migration files with current functions, function grants, indexes, triggers, and table RLS policies. No business rows were read or changed.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260817044220_20260817020658_fix_admin_rpc_search_path.sql.sql` | Both `is_admin()` and `is_master_admin()` use `search_path=public`; the public/anonymous EXECUTE grants are not effective in the current ACL check. | **Search-path and public EXECUTE restriction intent present.** The historical helper definition grants anon execute, but current effective `anon` EXECUTE is false. |
| `20260824012900_secure_offer_order_dispatch.sql` | The current no-zone offer bridge `create_order(... p_items jsonb ... UTM arguments)` exists and delegates offer placement through `create_offer_order()`. The latter looks up product/offer prices from live database rows and applies country/stock checks. | **Core secure dispatch path present through current RPCs.** The historic wrapper body differs; verify current grants and request context against the live storefront before assigning exact equivalence. |
| `20260824015000_remove_legacy_delivery_zone_order_rpc.sql` | The old Delivery-Zone-first `create_order(text,text,text,uuid,...)` signature is not among current `create_order` overloads. The current offer bridge and normal checkout RPCs remain. | **Legacy overload removal appears complete.** |
| `20260824020000_enforce_single_master_admin.sql` | `admin_users_single_master_admin_idx` exists as a unique partial index on `role='master_admin'`. | **Single-master-admin uniqueness guard present.** |
| `20260824023000_harden_last_master_admin_guard.sql` | `guard_last_master_admin()` exists as SECURITY DEFINER with `search_path=public`; `admin_users.guard_last_master_admin_before_change` is installed. Its effective EXECUTE is false for anon/authenticated and true for service_role. | **Last-active-master-admin guard present with restricted EXECUTE.** |
| `20260824024500_restrict_admin_helper_rpc.sql` | Effective EXECUTE checks show `anon=false` for both `is_admin()` and `is_master_admin()`; authenticated callers retain EXECUTE. | **Restriction present.** |
| `20260824031000_fix_addresses_rls.sql` | `addresses` has current self-scoped SELECT/INSERT/UPDATE policies and a consolidated DELETE policy. Predicates use `user_id = auth.uid()` or `can_access_country(country_code)`, consistent with later branch-aware admin access. | **Self-access intent present, evolved to branch access.** Confirm `can_access_country` strictly requires authorized admin context; do not restore the legacy policy blindly. |
| `20260824033000_harden_customers_rls.sql` | The current `customers.customers_admin_all` policy is authenticated and gated by `can_access_country(country_code)`; no anonymous customers policy appeared in the current policy snapshot. | **Legacy public customers access removed; current branch-admin gate present.** |
| `20260824035000_harden_legacy_delivery_rls.sql` | `delivery_settings` has authenticated branch-admin write policies and authenticated read only. `delivery_zones` has branch-admin write policies plus an anon SELECT policy limited to active rows for the visitor's country. | **Public write restriction present.** Public read remains only on active delivery-zone rows, as required for checkout; legacy delivery settings are not anonymously readable in this snapshot. |
| `20260824041000_harden_order_user_ownership.sql` | Both `orders.trg_guard_order_user_ownership` (`guard_order_user_ownership()`) and `orders.trg_enforce_order_user_binding` (`enforce_order_user_binding()`) are installed; both functions use `search_path=public`. Their EXECUTE is not available to anon for the SECURITY DEFINER guard. | **Ownership guard present, with two overlapping enforcement triggers.** Review both function bodies together and exercise guest checkout, authenticated checkout and service-role payment recovery to rule out inconsistent behavior; trigger-name presence alone does not show which guards fire successfully for every path. |

### Batch 5 conclusions

- Current Production has the single-master uniqueness index, last-master guard, restricted admin-helper grants, customer/admin RLS, legacy delivery write restrictions, and user-ownership triggers.
- There are two order-user binding triggers; this may be intentional defense-in-depth, but the current dual-trigger behavior should be tested rather than deduplicated without evidence.
- This batch shows multiple security migrations whose effects exist under current renamed objects or narrowed policies. Their lack of a matching migration-history fingerprint is not grounds to reapply them.

## Live-schema effect review — batch 6 (60 of 72 unmatched files)

**Method:** compare the next ten trigger/RPC-hardening files against live function definitions, effective EXECUTE privileges and installed triggers; read the current combo-order RPC body. No orders/auth-user rows were read.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260824043000_harden_last_master_admin_privilege.sql` | `guard_last_master_admin()` is SECURITY DEFINER, uses `search_path=public`, is called by the installed admin-user trigger, and effective EXECUTE is restricted to service_role (not anon/authenticated). | **Privilege hardening present.** |
| `20260824044500_restrict_order_ownership_trigger.sql` | `guard_order_user_ownership()` uses `search_path=public`; the trigger is installed. Effective EXECUTE is denied to anon/authenticated and allowed to service_role. | **Privilege hardening present.** |
| `20260824050000_harden_auto_confirm_user.sql` | `auto_confirm_user()` uses `search_path=public` and is not executable by anon/authenticated. No trigger invoking `auto_confirm_user()` was found among the current `auth.users` triggers (the referral-code signup trigger is present). | **Function hardening present; trigger behavior unverified.** Since this file only hardens the function rather than creating a trigger, verify current Auth confirmation behavior through the configured Auth flow before concluding whether the old trigger was intentionally removed. |
| `20260824052000_harden_update_updated_at.sql` | `update_updated_at()` uses `search_path=public` and is used by current update triggers. But effective EXECUTE still returns true for anon and authenticated, contrary to the migration's intended revoke of direct EXECUTE. | **Partial ACL drift.** Trigger behavior is present; assess whether the Data API exposes this trigger-returning function. Reapply only a reviewed privilege fix if needed; do not rerun the entire migration blindly. |
| `20260824053500_harden_set_order_number.sql` | `set_order_number()` uses `search_path=public` and `orders.trigger_set_order_number` is installed. Effective EXECUTE still returns true for anon and authenticated, despite the historical migration's revoke statements. | **Trigger behavior present; privilege state differs from intended hardening.** Confirm whether direct RPC exposure is possible and restrict unnecessary EXECUTE if so. |
| `20260824054500_harden_calculate_delivery_charge.sql` | `calculate_delivery_charge(numeric, boolean)` is present, uses `search_path=public`, and remains executable by anon/authenticated as the migration intended. | **Effect present.** |
| `20260824055500_harden_is_admin_search_path.sql` | `is_admin()` is SECURITY DEFINER with `search_path=public`; effective anon EXECUTE is false. | **Effect present.** |
| `20260824061000_harden_is_master_admin_search_path.sql` | `is_master_admin()` is SECURITY DEFINER with `search_path=public`; effective anon EXECUTE is false. | **Effect present.** |
| `20260824063000_harden_public_order_user_identity.sql` | Current `guard_order_user_ownership()` forces anonymous caller `user_id` to NULL and rejects authenticated callers trying to set another user's ID. It is attached to orders and direct anon EXECUTE is denied. | **Identity hardening present.** The additional `enforce_order_user_binding()` trigger also exists; test both together across guest checkout, signed-in checkout and service-role recovery. |
| `20260824065000_fix_combo_order_item_line_total.sql` | Current `create_combo_order()` writes `quantity = v_qty`, `unit_price = v_combo_price`, and `total_price = v_combo_price * v_qty` to `order_items`, then decrements combo stock by the requested quantity. | **Persisted line-total fix present.** This is a current function-body match by behavior, not by migration fingerprint. |

### Batch 6 conclusions

- Most search-path, identity, order-number, delivery-charge and last-admin behaviors exist in current definitions.
- Two trigger-only helpers (`update_updated_at()` and `set_order_number()`) still show effective anon/authenticated EXECUTE, whereas the historical migrations intended to revoke those privileges. Direct callability via PostgREST was not exercised; treat as a permissions-drift finding to validate, not as proof of exploitation.
- `auto_confirm_user()` has no currently visible `auth.users` trigger; verify Auth confirmation configuration/flow rather than creating a new trigger based solely on this migration.

## Live-schema effect review — batch 7 (70 of 72 unmatched files)

**Method:** compare the next ten rate-limit, Storage, referral-wallet, feature-flag, product-growth and Vault migrations with live tables, function definitions and effective grants. No order/customer/wallet values or Vault secret values were read.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20260824090000_add_feature_toggle_columns.sql` | Current `site_settings` includes the feature toggles for bundles, combos, free gifts, guides, photo reviews, online payment, courier, SMS, WhatsApp API and AdSense; other later flags also exist. | **Feature-toggle effect present, evolved.** |
| `20260824104500_harden_rls_auth_initplan.sql` | Current self-owned row policies use init-plan-style `( SELECT auth.uid() AS uid)` in multiple places, though older policy names have since been consolidated. | **Performance hardening is visible in current policies.** Check each remaining policy independently; do not interpret the changed policy names as missing authorization. |
| `20260824230000_complete_referral_program.sql` | The referral tables, current referral qualification/reward triggers, signup-code trigger, wallet ledger and current country-aware RLS exist. Several policy/function definitions differ from this historical version. | **Core referral program present in a later implementation.** Re-check referral code prefix and order-cancellation reward reversal noted in batch 3; avoid replaying this broad program migration. |
| `20260825041143_harden_storage_object_policies.sql` | This migration intends to keep storefront assets readable while allowing only admins to mutate Storage. Current `storage.objects` has only authenticated upload/update/delete policies whose predicates check `bucket_id = 'product-images'`; they do **not** call `is_admin()`. No current `Storage admins can upload/update/delete` policy was found. | **Security hardening does not match current Storage policies. HIGH PRIORITY.** Any authenticated user appears eligible to mutate objects in the product-images bucket under these policies. Validate the effective Storage API path and prepare a reviewed policy-only forward fix; do not restore the entire historical policy set blindly. |
| `20260825093000_fix_referral_wallet_balance_ledger_usage.sql` | Current wallet balance functions subtract available wallet usage from reward balances; the no-argument `get_referral_wallet_balance()` scopes to `auth.uid()`. Parameterized wallet helper functions are service-role-only in effective ACL checks. | **Ledger-balance intent present through current implementation.** The older parameterized function body differs, but the current user-scoped overload avoids client-supplied user-ID balance lookup. |
| `20260929145000_messenger_rate_limit_abuse_protection.sql` | `messenger_rate_limits`, its blocked/last-seen indexes and `consume_messenger_rate_limit(...)` exist. Table access and RPC execution are denied to anon/authenticated and granted to service_role. | **Messenger rate-limit foundation present with service-only access.** |
| `20261003100000_harden_public_rpc_rate_limits.sql` | `public.public_rpc_rate_limits`, `enforce_public_rpc_rate_limit(...)`, `guard_public_order_create_rate_limit()`, and the orders insert guard trigger are all absent. Current `track_order(text,text)` is executable by anon/authenticated, and its function body contains no public-RPC rate-limit check. | **Intended public order/track rate limiting is not visible in current Production. HIGH PRIORITY.** Order tracking still compares order number and normalized customer phone, but the current function itself has no rate-limiting logic. Verify if an edge/API layer applies an equivalent guard; otherwise prepare a separately reviewed forward migration. Do not replay the old migration without reconciling its trigger/RPC assumptions. |
| `20261007120000_add_product_growing_types.sql` | `products.growing_types` exists as an array alongside legacy `growing_type`. | **Schema effect present.** The migration's one-time data backfill was not assessed by reading product rows. |
| `20261008093000_fix_ai_settings_country_key.sql` | `ai_settings` has a composite `(id, country_code)` primary key and a country-code check for BD/IN. | **Branch-key fix present.** |
| `20261008095500_move_ai_keys_to_vault.sql` | `api_key_secret_id`, the `api_key = ''` constraint, and Vault-backed `ai_get_api_key()` / `ai_store_api_key()` exist. Effective EXECUTE is false for anon/authenticated and true for service_role. | **Vault migration intent present.** No secret values were read. |

## Additional high-priority access-control finding

The live Storage policies do not match the “admins-only mutations” intent in `20260825041143_harden_storage_object_policies.sql`. This is separate from the previously documented possible column exposure of `products.cost_price` and `reviews.guest_phone`.

The public-RPC rate-limit migration also appears absent as a whole: table, enforcement function, guard trigger, and `track_order` integration are all missing from the current catalog. These are **audit findings only**, not proof that attackers have exploited them. No Production changes were made.

### Batch 7 conclusions

- Feature flags, country-aware referral infrastructure, Messenger rate limiting, product growing types, and Vault-backed AI key helpers are present.
- **Top remediation candidates at this point:** public Storage writes for any authenticated account, unthrottled public `track_order` RPC, plus the earlier cost-price/reviewer-phone column exposure.
- Apply fixes only through small, reviewed forward migrations after verifying the application's actual read/write paths. Do not use historical migrations as repair scripts.

## Live-schema effect review — batch 8 (72 of 72 unmatched files)

**Method:** the final two unmatched files were checked against the current Production constraint, policy, and AI-settings state. For AI settings, only an aggregate count was queried; no configuration row values or secrets were inspected.

| Repository migration | Current evidence | Result / follow-up |
|---|---|---|
| `20261008102000_scope_messenger_profiles_by_country.sql` | `messenger_customer_profiles_country_code_check` exists, and `messenger_customer_profiles_admin_country_all` exists for authenticated admins with `can_access_country(country_code)` in both USING and WITH CHECK. | **Effect present.** |
| `20261008103500_disable_unconfigured_generic_ai.sql` | An aggregate read-only count found **one** `ai_settings` row with `is_enabled=true` and `api_key_secret_id IS NULL`. The migration's intended invariant is therefore not fully reflected in current state. | **Configuration drift confirmed (one row).** Do not inspect/display the row or key value in this audit. Confirm the intended Generic AI state for that branch and disable it through a reviewed, controlled change if it should remain off without a Vault key. This is not evidence that the live Messenger AI runtime is affected. |

## Whole-audit summary and proposed order of remediation

The 72-file catalog review is complete. It found that many historical SQL effects are implemented under newer schemas, policies, index names, triggers, or RPC signatures; several old data-sensitive migrations cannot be safely inferred from catalog metadata alone. The unmatched fingerprint count must not be used as a migration replay list.

**Highest-priority findings for a separate, reviewed forward-fix PR:**

1. **Private-column exposure candidate:** the effective Data API ACL allows `anon` SELECT on `products.cost_price` and `reviews.guest_phone`, while public table policies can admit rows from the storefront/current country. Validate the exact public API surface and move private fields behind column-safe views or separate private tables before any change. No values were queried.
2. **Storage policy drift:** current authenticated policies for `storage.objects` allow upload/update/delete based only on the `product-images` bucket ID and do not require `is_admin()`. Review and replace with admin-scoped write policies while preserving legitimate storefront reads.
3. **Order-tracking rate limit absent from current DB function:** `public_rpc_rate_limits`, its enforcement function and order-insert trigger were not found; `track_order(order_number, phone)` remains executable by anon/authenticated and has no rate-limit logic in its body. Confirm whether a deployed edge/API layer provides equivalent throttling, then close the gap with a tested forward migration if not.
4. **AI settings invariant mismatch:** one row has `is_enabled=true` without a Vault secret reference, contrary to the purpose of `20261008103500_disable_unconfigured_generic_ai.sql`. Confirm configuration intent and correct it with a reviewed, narrowly scoped change.
5. **Behavior/config review candidates:** `quantity_offers.custom_delivery_charge` is not consumed by current `create_offer_order`; product/landing SEO and FAQ/review read paths differ from historical schema; `contact_messages.admin_reply/replied_at` and some finance/order-item columns are absent; the SEED BARI name and referral-code prefix still show GAZI SEED-era values; reward reversal and direct EXECUTE grants on trigger helpers need follow-up.

**Boundary:** This is a read-only Production catalog audit plus documentation on an open Draft PR. No Production schema, data, migration history, Storage policy, Auth account, wallet transaction, or Vault secret was changed or replayed. Before touching Production, each security finding should be confirmed with a targeted regression test and handled in a separate forward migration or application change—not by running the historical files again.

