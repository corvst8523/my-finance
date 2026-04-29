-- My Finance seed
-- Substitua o UUID abaixo pelo id do usuario em Supabase Auth.

do $$
declare
  v_user uuid := '00000000-0000-0000-0000-000000000000';
  v_entradas uuid;
  v_moradia uuid;
  v_despesas uuid;
  v_salario uuid;
  v_freelas uuid;
  v_aluguel uuid;
  v_condominio uuid;
  v_supermercado uuid;
  v_transporte uuid;
begin
  insert into categories (user_id, code, name, type)
  values
    (v_user, '1', 'Entradas', 'entrada'),
    (v_user, '2', 'Moradia', 'saida'),
    (v_user, '3', 'Despesas do Dia a Dia', 'saida');

  select id into v_entradas from categories where user_id = v_user and code = '1';
  select id into v_moradia from categories where user_id = v_user and code = '2';
  select id into v_despesas from categories where user_id = v_user and code = '3';

  insert into items (user_id, category_id, code, name, type)
  values
    (v_user, v_entradas, '1.1', 'Salario', 'entrada'),
    (v_user, v_entradas, '1.2', 'Freelas', 'entrada'),
    (v_user, v_moradia, '2.1', 'Aluguel', 'saida'),
    (v_user, v_moradia, '2.2', 'Condominio', 'saida'),
    (v_user, v_despesas, '3.1', 'Supermercado', 'saida'),
    (v_user, v_despesas, '3.2', 'Transporte', 'saida');

  select id into v_salario from items where user_id = v_user and code = '1.1';
  select id into v_freelas from items where user_id = v_user and code = '1.2';
  select id into v_aluguel from items where user_id = v_user and code = '2.1';
  select id into v_condominio from items where user_id = v_user and code = '2.2';
  select id into v_supermercado from items where user_id = v_user and code = '3.1';
  select id into v_transporte from items where user_id = v_user and code = '3.2';

  insert into entries (user_id, item_id, month, value, note)
  values
    (v_user, v_salario, date_trunc('month', now())::date, 8500, 'Receita principal'),
    (v_user, v_freelas, date_trunc('month', now())::date, 1200, 'Projetos avulsos'),
    (v_user, v_aluguel, date_trunc('month', now())::date, 2400, null),
    (v_user, v_condominio, date_trunc('month', now())::date, 620, null),
    (v_user, v_supermercado, date_trunc('month', now())::date, 1650, null),
    (v_user, v_transporte, date_trunc('month', now())::date, 420, null);
end $$;
