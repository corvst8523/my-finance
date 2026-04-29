alter table public.accounts
  add column if not exists type text;

update public.accounts account
set type = category.type
from public.categories category
where account.category_id = category.id
  and account.type is null;

update public.accounts
set type = 'saida'
where type is null;

alter table public.accounts
  alter column type set default 'saida',
  alter column type set not null,
  alter column category_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'accounts_type_check'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_type_check check (type in ('entrada', 'saida'));
  end if;
end $$;
