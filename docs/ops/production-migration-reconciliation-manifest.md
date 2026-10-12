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
- Name-matched files are marked `MATCH_SQL_EXACT`, `SQL_DIFF`, or `PENDING_SQL_COMPARE` according to the completed comparisons. Additionally, the separate SQL fingerprint index covers all 119 repository migration files and records 7 exact content matches found within Production history.

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

## Exact SQL matches under different Production names/versions

The following repository files are listed as having no same-name Production record, but their SQL token fingerprints exactly match stored SQL from an existing Production migration-history row. Do not apply these again just to make the history names line up.

| Repository file | Matching Production version | Production record name | Result |
|---|---|---|---|
| `20260929140000_add_messenger_customer_profiles.sql` | `20260929132935` | `20260929140000_add_messenger_customer_profiles` | `EXACT_SQL_TOKEN_MATCH` |
| `20260929170000_messenger_product_search_optimization.sql` | `20260929140411` | `20260929170000_messenger_product_search_optimization` | `EXACT_SQL_TOKEN_MATCH` |
| `20261001173000_preserve_cashfree_order_source.sql` | `20261001171349` | `preserve_cashfree_order_source` | `EXACT_SQL_TOKEN_MATCH` |
| `20261003210000_add_meta_ads_insights.sql` | `20261003163727` | `add_meta_ads_insights_daily` | `EXACT_SQL_TOKEN_MATCH` |
| `20261007123000_add_bulk_offer_free_item_text.sql` | `20261007064522` | `add_bulk_pricing_free_item_text` | `EXACT_SQL_TOKEN_MATCH` |
| `20261008160000_fix_ads_offer_order_totals.sql` | `20261008155002` | `fix_ads_package_item_totals` | `EXACT_SQL_TOKEN_MATCH` |
| `20261008183000_add_messenger_order_notification_sending_state.sql` | `20261008115546` | `allow_messenger_notification_sending_state` | `EXACT_SQL_TOKEN_MATCH` |

SQL fingerprints ignore comments/whitespace while preserving SQL tokens and quoted strings. These are strong source-equivalence matches, but the live object catalog should still be inspected before making any reconciliation decision.

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
| `20260929140000` | `20260929140000_add_messenger_customer_profiles.sql` | `EXACT_SQL_TOKEN_MATCH_AT_PROD_VERSION_20260929132935` |
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
