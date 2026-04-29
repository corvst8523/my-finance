do $$
begin
  if to_regclass('public.items') is null and to_regclass('public.accounts') is not null then
    alter table public.accounts rename to items;
  end if;
end $$;

alter table public.items
  add column if not exists type text;

update public.items item
set type = category.type
from public.categories category
where item.category_id = category.id
  and item.type is null;

update public.items
set type = 'saida'
where type is null;

alter table public.items
  alter column type set default 'saida',
  alter column type set not null,
  alter column category_id drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_type_check'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_type_check check (type in ('entrada', 'saida'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'account_id'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'item_id'
  ) then
    alter table public.entries rename column account_id to item_id;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'account_id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'item_id'
  ) then
    update public.entries
    set item_id = account_id
    where item_id is null;
  end if;
end $$;

delete from public.entries
where coalesce(value, 0) = 0;

alter table public.entries
  alter column item_id set not null;
