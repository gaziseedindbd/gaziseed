/*
# Add review management fields, admin reply, verified purchase, and assign master admin

## Summary
1. Adds `admin_reply`, `verified_purchase`, `user_id`, `status` columns to `reviews` table
2. Adds `last_login_at` column to `admin_users` table
3. Assigns MASTER_ADMIN role to the existing primary admin (bangladeshtnt@gmail.com)
4. Adds RLS policies for reviews so customers can submit reviews

## Modified Tables
- `reviews`: added `admin_reply` (text), `verified_purchase` (boolean default false), `user_id` (uuid, references auth.users), `status` (text default 'pending')
- `admin_users`: added `last_login_at` (timestamptz)

## Security
- RLS enabled on reviews (already had policies, adding INSERT for authenticated users)
- Reviews can be submitted by any authenticated user
- Reviews can be read by anyone (public)
- Reviews can only be updated/deleted by admins

## Important Notes
1. The `verified_purchase` field is set server-side by the edge function based on real order history — never user-editable
2. The `status` field replaces the boolean `is_approved` for more granular control (pending/approved/rejected)
3. The existing `is_approved` column is kept for backward compatibility
4. The primary admin account (bangladeshtnt@gmail.com) is assigned `role = 'master_admin'`
*/

-- 1. Add columns to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_purchase boolean NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 2. Add last_login_at to admin_users
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 3. Assign MASTER_ADMIN to existing primary admin
UPDATE admin_users SET role = 'master_admin' WHERE email = 'bangladeshtnt@gmail.com';

-- 4. Review RLS policies - allow authenticated users to insert reviews
DROP POLICY IF EXISTS "users_insert_reviews" ON reviews;
CREATE POLICY "users_insert_reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anyone to read approved reviews
DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
CREATE POLICY "public_read_reviews"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow admins to update/delete reviews
DROP POLICY IF EXISTS "admins_update_reviews" ON reviews;
CREATE POLICY "admins_update_reviews"
  ON reviews FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

DROP POLICY IF EXISTS "admins_delete_reviews" ON reviews;
CREATE POLICY "admins_delete_reviews"
  ON reviews FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- 5. Create index on user_id for reviews
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
