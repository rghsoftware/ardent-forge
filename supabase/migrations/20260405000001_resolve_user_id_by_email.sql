-- Resolve a user's UUID from their email address.
-- Used by the connection-request flow so clients can send requests by email
-- without needing direct access to auth.users.

create or replace function resolve_user_id_by_email(lookup_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_id uuid;
begin
  select id into found_id
    from auth.users
   where email = lower(trim(lookup_email));

  if found_id is null then
    raise exception 'No user found with that email'
      using errcode = 'P0002'; -- no_data_found
  end if;

  return found_id;
end;
$$;
