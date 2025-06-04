-- Enable RLS for public_sites
ALTER TABLE public_sites ENABLE ROW LEVEL SECURITY;

-- Public access: allow read access to all rows where is_public is true and status is 'published'
CREATE POLICY "Allow read of published public sites"
  ON public_sites
  FOR SELECT
  USING (
    is_public = true AND status = 'published'
  );

-- Enable RLS for draft_sites
ALTER TABLE draft_sites ENABLE ROW LEVEL SECURITY;

-- Allow users to view/edit only their own drafts
CREATE POLICY "Allow user access to own drafts"
  ON draft_sites
  FOR ALL
  USING (user_id = auth.uid());
