-- Restrict address access to the authenticated user's own rows.
-- Replaces the previous policy condition that allowed any authenticated user
-- to access every address row.

DROP POLICY IF EXISTS "Users can manage their own addresses" ON public.addresses;

CREATE POLICY "Users can manage their own addresses"
  ON public.addresses
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
