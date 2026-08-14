-- Public, read-only release channel used by Qingdan's in-app mobile updater.
-- Uploads still require the project owner's service_role key or the Supabase dashboard.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qingdan-releases',
  'qingdan-releases',
  true,
  104857600,
  array['application/vnd.android.package-archive', 'application/zip', 'application/json']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
