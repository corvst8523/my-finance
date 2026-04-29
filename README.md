# My Finance

App web de financas pessoais feito com Next.js App Router, TypeScript, TailwindCSS, shadcn/ui, Framer Motion e Supabase Auth/Postgres.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Variaveis de ambiente

Crie ou mantenha `.env.local` com:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

O app usa Supabase Auth para login/cadastro. A senha nunca e armazenada pelo app; o hash fica a cargo do Supabase Auth.

## Dados de exemplo

Depois de criar um usuario pelo `/signup`, copie o `id` desse usuario no Supabase Auth e use o arquivo `seed.sql`.

No `seed.sql`, substitua `00000000-0000-0000-0000-000000000000` pelo `id` real do usuario e execute no SQL Editor do Supabase. O script cria 3 categorias e 6 contas iniciais.

## Rotas

- `/login`: login
- `/signup`: cadastro
- `/app/cashflow`: fluxo de caixa principal
- `/app/setup`: CRUD de categorias e contas

> O projeto esta em `next@16.2.4`; nesta versao a antiga convencao de Middleware foi renomeada para `proxy.ts`, usada aqui para proteger `/app/*`.
