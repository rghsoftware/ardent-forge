-- Allow any authenticated user to read display_name for users who opted in
-- to public visibility. This supports author attribution on public content
-- (programs, templates) without exposing private profile data.
CREATE POLICY "user_profiles_public_display_name"
    ON user_profiles FOR SELECT
    USING (display_visible = true);
