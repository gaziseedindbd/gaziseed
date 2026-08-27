/*
# Create Master Admin account (admin@seedbari.com)

## Summary
Creates a Master Admin user in auth.users with email admin@seedbari.com
and registers them in the admin_users table with role = 'master_admin'.

## Details
- Email: admin@seedbari.com
- Password: Admin@SeedBari2026! (bcrypt-hashed via crypt())
- Email confirmed: true (login works immediately)
- admin_users row: is_active = true, role = 'master_admin'
- must_change_password flag set to false so login is not blocked

## Security
- No existing data is modified or deleted.
- Password stored only as a bcrypt hash in auth.users.encrypted_password.
- The account has master_admin role (full admin access).
*/

-- 1. Create the auth user with a bcrypt-hashed password
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
  'admin@seedbari.com',
  crypt('Admin@SeedBari2026!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"must_change_password": false}'::jsonb,
  '{"name": "Master Admin"}'::jsonb,
  false
)
ON CONFLICT (email) WHERE is_sso_user = false
DO UPDATE SET
  encrypted_password = EXCLUDED.encrypted_password,
  email_confirmed_at = EXCLUDED.email_confirmed_at,
  raw_app_meta_data = EXCLUDED.raw_app_meta_data,
  updated_at = now();

-- 2. Insert the admin_users row with master_admin role
INSERT INTO admin_users (user_id, email, is_active, role)
SELECT id, email, true, 'master_admin'
FROM auth.users
WHERE email = 'admin@seedbari.com'
ON CONFLICT (user_id)
DO UPDATE SET is_active = true, role = 'master_admin';
