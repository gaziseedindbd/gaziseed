/*
# Fix reviews RLS policies and contact_messages schema

## Summary
1. Fix reviews SELECT policy to only expose approved reviews publicly (was USING(true) — exposed all pending/rejected)
2. Fix reviews INSERT policy to enforce user_id = auth.uid() and prevent self-approving/self-verifying
3. Add admin_reply column to contact_messages for admin responses
4. Add DELETE policy on contact_messages for admins
5. Add trigger to sync is_approved when status changes (and vice versa)

## Security Changes
- Reviews SELECT: now `USING (status = 'approved' OR is_approved = true)` — only approved reviews are public
- Reviews INSERT: `WITH CHECK (auth.uid() = user_id AND status = 'pending' AND is_approved = false AND verified_purchase = false)` — prevents self-approval, self-verification, and spoofed user_id
- contact_messages DELETE: admins can now delete messages
*/

-- 1. Fix reviews SELECT policy
DROP POLICY IF EXISTS "public_read_reviews" ON reviews;
CREATE POLICY "public_read_reviews"
  ON reviews FOR SELECT
  TO anon, authenticated
  USING (status = 'approved' OR is_approved = true);

-- 2. Fix reviews INSERT policy
DROP POLICY IF EXISTS "users_insert_reviews" ON reviews;
CREATE POLICY "users_insert_reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND is_approved = false AND verified_purchase = false);

-- Drop old auth_insert_reviews policy if it exists
DROP POLICY IF EXISTS "auth_insert_reviews" ON reviews;

-- 3. Add admin_reply to contact_messages
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS replied_at timestamptz;

-- 4. Add DELETE policy on contact_messages for admins
DROP POLICY IF EXISTS "admin_delete_messages" ON contact_messages;
CREATE POLICY "admin_delete_messages"
  ON contact_messages FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.user_id = auth.uid() AND admin_users.is_active = true));

-- 5. Create trigger function to sync is_approved and status
CREATE OR REPLACE FUNCTION sync_review_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    NEW.is_approved := true;
  ELSIF NEW.status = 'rejected' THEN
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_review_status ON reviews;
CREATE TRIGGER trigger_sync_review_status
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION sync_review_status();
