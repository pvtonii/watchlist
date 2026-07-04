# 📺 WatchList — v1.0.0

App estilo TV Time: busque filmes e séries (dados reais do TMDB), marque
episódios assistidos, acompanhe o progresso por temporada, mantenha sua
watchlist e veja próximos episódios/lançamentos na Home. Multiusuário
(Supabase Auth), mobile-first, PWA pra iPhone.

> **Mapa do projeto:** ver `MAPA_DO_PROJETO.md` (funcionalidade → arquivo).

## Setup (primeira vez)

### 1. Supabase (~5 min)
1. Crie um projeto em [supabase.com](https://supabase.com).
2. **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
3. (Recomendado p/ simplificar) **Authentication → Sign In / Up → Email →
   desligue "Confirm email"** — senão cada conta nova precisa clicar num link
   de confirmação por email.
4. Copie **Project Settings → API**: `Project URL` e `anon public key`.

### 2. Variáveis de ambiente
Edite `.env.local` (já criado a partir de `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...      # do passo 1.4
NEXT_PUBLIC_SUPABASE_ANON_KEY=... # do passo 1.4
TMDB_API_KEY=...                  # sua key do TMDB (v3 key OU v4 token, tanto faz)
```

### 3. Rodar local
```bash
npm install
npm run dev
```
Abra http://localhost:3000 → crie uma conta → use.

### 4. Deploy (Vercel)
1. Crie um repositório no GitHub e faça push.
2. Em [vercel.com](https://vercel.com): **Add New Project** → importe o repo.
3. Em **Environment Variables**, adicione as 3 variáveis do `.env.local`.
4. Deploy. A cada `git push` na `main`, a Vercel publica sozinha.

### 5. Instalar no iPhone
1. Abra a URL do app no **Safari**.
2. Compartilhar → **Adicionar à Tela de Início**.
3. Após cada atualização de layout: remover o atalho → Safari → refresh
   forçado → adicionar de novo (cache do iOS é agressivo). Dentro do app,
   o botão **Update App** (Profile) também força a versão nova.

## Versionamento

Versão única em `lib/config.ts` (`APP_VERSION`, formato MAIOR.MENOR.CORREÇÃO) —
o footer lê de lá. A cada mudança: subir versão + data real, commit, push.

---
Dados de filmes/séries: [TMDB](https://www.themoviedb.org). This product uses
the TMDB API but is not endorsed or certified by TMDB.
