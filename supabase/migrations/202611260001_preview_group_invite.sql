begin;

drop function if exists public.preview_group_invite(text);

create or replace function public.preview_group_invite(p_code text)
returns table(name text, language text)
language sql stable security definer set search_path = '' as $$
  select g.name, g.language
  from public.groups g
  where lower(trim(g.join_code)) = lower(trim(p_code))
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'student'
    );
$$;

revoke all on function public.preview_group_invite(text) from public, anon, authenticated;
grant execute on function public.preview_group_invite(text) to authenticated;

commit;