INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_sso_user
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin.seedbari.master@outlook.com',
  crypt('S33dBar1#M@ster2026!', gen_salt('bf')),
  now(), now(), now(),
  '{"must_change_password": true}'::jsonb,
  '{"name": "Master Admin"}'::jsonb,
  false
)
ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

INSERT INTO admin_users (user_id, email, is_active, role)
SELECT id, email, true, 'master_admin'
FROM auth.users
WHERE email = 'admin.seedbari.master@outlook.com'
ON CONFLICT (user_id) DO NOTHING;