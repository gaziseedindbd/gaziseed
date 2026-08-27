/*
# Create one fresh Master Admin account

## Summary
Creates a single new Master Admin user in auth.users and registers them
in the admin_users table with role = 'master_admin'.

## Details
- Email: admin.seedbari.master@outlook.com
- Password: hashed with bcrypt via crypt()
- Email confirmed: true (so they can log in immediately)
- admin_users row: is_active = true, role = 'master_admin'
- must_change_password flag set in raw_app_meta_data so the admin is
  prompted to set their own password on first login

## Security
- No existing data is modified or deleted.
- The password is stored only as a bcrypt hash in auth.users.encrypted_password.
- The account has the same master_admin role as existing master admins.
*/

-- 1. Create the auth user with a bcrypt-hashed password
--    Uses the partial unique index users_email_partial_key for ON CONFLICT
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin.seedbari.master@outlook.com',
  crypt('S33dBar1#M@ster2026!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"must_change_password": true}'::jsonb,
  '{"name": "Master Admin"}'::jsonb,
  false
)
ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

-- 2. Insert the admin_users row with master_admin role
INSERT INTO admin_users (user_id, email, is_active, role)
SELECT id, email, true, 'master_admin'
FROM auth.users
WHERE email = 'admin.seedbari.master@outlook.com'
ON CONFLICT (user_id) DO NOTHING;
