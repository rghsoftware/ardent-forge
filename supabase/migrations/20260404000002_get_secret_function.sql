-- Create a helper function to read decrypted secrets from Supabase Vault.
-- Edge Functions call this via PostgREST RPC using the service_role key.
-- Only service_role can execute this function.

create or replace function get_secret(secret_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  result text;
begin
  select decrypted_secret into result
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;

  return result;
end;
$$;

-- Restrict access to service_role only
revoke execute on function get_secret(text) from public;
revoke execute on function get_secret(text) from anon;
revoke execute on function get_secret(text) from authenticated;
grant execute on function get_secret(text) to service_role;
