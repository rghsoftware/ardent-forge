-- =============================================================================
-- Migration: Media Storage Buckets + Missing Index
-- Description: Creates private storage buckets for chat images and files,
--              with RLS policies for upload (authenticated) and download
--              (conversation participation). Adds missing index on
--              media_attachments(message_id) for batch lookups.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Storage buckets
--    chat-images: private, 10 MB limit, image MIME types
--    chat-files:  private, 25 MB limit, document/archive MIME types
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('chat-images', 'chat-images', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('chat-files', 'chat-files', false, 26214400,
   array['application/pdf', 'application/msword',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel', 'text/plain', 'text/csv', 'application/zip']);

-- ---------------------------------------------------------------------------
-- 2. Storage RLS policies
-- ---------------------------------------------------------------------------

-- Upload: any authenticated user can upload to chat-images
create policy "chat_images_insert_authenticated"
    on storage.objects for insert
    with check (
        bucket_id = 'chat-images'
        and auth.uid() is not null
    );

-- Upload: any authenticated user can upload to chat-files
create policy "chat_files_insert_authenticated"
    on storage.objects for insert
    with check (
        bucket_id = 'chat-files'
        and auth.uid() is not null
    );

-- Download: conversation participation check for chat-images
-- Path convention: {conversation_id}/{message_id}/{filename}
-- Joins through media_attachments -> messages -> conversation_participants
create policy "chat_images_select_participant"
    on storage.objects for select
    using (
        bucket_id = 'chat-images'
        and exists (
            select 1
            from media_attachments ma
            join messages m on m.id = ma.message_id
            join conversation_participants cp
                on cp.conversation_id = m.conversation_id
            where cp.user_id = auth.uid()
              and cp.left_at is null
              and ma.provider = 'supabase_storage'
              and ma.media_type = 'image'
        )
    );

-- Download: conversation participation check for chat-files
create policy "chat_files_select_participant"
    on storage.objects for select
    using (
        bucket_id = 'chat-files'
        and exists (
            select 1
            from media_attachments ma
            join messages m on m.id = ma.message_id
            join conversation_participants cp
                on cp.conversation_id = m.conversation_id
            where cp.user_id = auth.uid()
              and cp.left_at is null
              and ma.provider = 'supabase_storage'
              and ma.media_type in ('file', 'image')
        )
    );

-- ---------------------------------------------------------------------------
-- 3. Missing index on media_attachments(message_id)
--    Supports batch lookups: SELECT * FROM media_attachments WHERE message_id = ANY($1)
--    Note: idx_media_message was created in 20260402000002 on (message_id).
--    This creates a dedicated index for the batch lookup pattern.
-- ---------------------------------------------------------------------------

create index if not exists idx_media_attachments_message
    on media_attachments(message_id);
