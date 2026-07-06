# 🗺️ MAPA_DO_PROJETO — WatchList

> Cole este arquivo no começo de um chat novo. Use a tabela pra ir DIRETO no
> arquivo certo, sem reler o projeto todo.

**Stack:** Next.js 16 (App Router, TS) · Tailwind v4 · shadcn/ui · Supabase (auth + Postgres/RLS) · React Query · Zod · TMDB API · Vercel
**Versão atual:** v1.0.0 (2026-07-04) — definida em `lib/config.ts`

## Onde mexo pra…

| Funcionalidade | Arquivo |
|---|---|
| **Versão do app / regras de negócio / helpers de imagem TMDB** | `lib/config.ts` |
| Cores / tema / layout PWA (receita v3: body, tabs, safe-area) | `app/globals.css` |
| Meta tags PWA (viewport, theme-color, apple-*) | `app/layout.tsx` |
| Manifest PWA | `app/manifest.ts` |
| Ícones do app | `public/icons/` (gerados; fundo sólido #0c111b) |
| **Tela Home** (Up Next, próximos episódios, lançamentos) | `app/(app)/page.tsx` |
| **Tela Busca** | `app/(app)/search/page.tsx` |
| **Tela My List** (abas por status + progresso) | `app/(app)/library/page.tsx` |
| **Tela Profile** (stats, sign out, botão Atualizar, footer versão) | `app/(app)/profile/page.tsx` |
| **Detalhe de filme** (sinopse, elenco, Want to Watch/Watched) | `app/(app)/movie/[id]/page.tsx` |
| **Detalhe de série** (status, progresso, temporadas) | `app/(app)/tv/[id]/page.tsx` |
| **Episódios de uma temporada** (marcar assistido / mark all) | `app/(app)/tv/[id]/season/[season]/page.tsx` |
| Login / criar conta | `app/login/page.tsx` |
| Guard de auth da área logada (redirect p/ /login) | `app/(app)/layout.tsx` |
| Refresh de sessão Supabase (ex-middleware) | `proxy.ts` |
| Callback de confirmação de email | `app/auth/callback/route.ts` |
| **Chamadas ao TMDB (server, key escondida)** | `lib/tmdb.ts` + `app/api/tmdb/*/route.ts` |
| Tipos do TMDB | `lib/tmdb-types.ts` |
| **Hooks de dados (React Query + Supabase): library, episódios, toggles** | `lib/hooks.ts` |
| Clientes Supabase (browser / server) | `lib/supabase/client.ts` / `lib/supabase/server.ts` |
| **Schema do banco + RLS** | `supabase/schema.sql` |
| Bottom nav (fixa, filha direta do body — NÃO mover pra dentro do #app) | `components/bottom-nav.tsx` |
| Topbar (sticky, com botão voltar) | `components/topbar.tsx` |
| Card de pôster (busca/home) | `components/poster-card.tsx` |
| Card grande com barra de progresso na borda (Home > Up Next) | `components/show-progress-card.tsx` |
| Barra de progresso | `components/progress-bar.tsx` |
| Botão "Update App" anti-cache | `components/refresh-button.tsx` |
| Header de detalhe (pôster + infos) | `components/detail-header.tsx` |
| Fileira de elenco | `components/cast-row.tsx` |
| Formatação de datas / labels SxEy | `lib/format.ts` |
| Env vars (modelo) | `.env.example` → copiar p/ `.env.local` |

## Rotas da API interna (proxy do TMDB)

| Rota | Retorna |
|---|---|
| `GET /api/tmdb/search?q=` | busca multi (filmes + séries) |
| `GET /api/tmdb/movie/[id]` | detalhes do filme + elenco |
| `GET /api/tmdb/tv/[id]` | detalhes da série + elenco + next_episode_to_air |
| `GET /api/tmdb/tv/[id]/season/[n]` | episódios da temporada |
| `GET /api/tmdb/upcoming` | filmes por lançar + séries no ar |

## Banco (Supabase)

- `library_items` — 1 linha por filme/série do usuário: `status` ∈ watchlist/watching/completed/dropped + cache de título/pôster. Único por (user, tmdb_id, media_type).
- `watched_episodes` — 1 linha por episódio assistido (show, season, episode).
- RLS ativo nas duas: cada usuário só vê as próprias linhas.

## Regras de negócio (v1)

- Filme "assistido" = status `completed` (sem tracking por episódio).
- Progresso de série = episódios assistidos ÷ total (specials/temporada 0 fora da conta, mas listadas e marcáveis).
- Série: só existem 3 botões manuais — Want to Watch / Completed / Dropped. `watching` é
  **derivado automaticamente**, nunca tocado direto (decidido em 2026-07-06):
  - Marca 1+ episódio regular sem estar 100% → status vira `watching` (mesmo se estava
    watchlist/completed/dropped).
  - Marca todos os episódios regulares → status vira `completed`.
  - Desmarca 1 episódio de uma série `completed` → volta pra `watching` sozinho.
  - Tocar em "Completed" manualmente marca TODOS os episódios como assistidos (pede
    confirmação, `app/(app)/tv/[id]/page.tsx`).
  - "Dropped" mantém o histórico de episódios assistidos (não apaga `watched_episodes`).
  - Remover uma série da lista de vez é via botão dedicado "Remove from list" (com
    confirmação), já que não dá mais pra tocar num chip "Watching" pra tirar da lista.
- Tocar de novo num chip de status ativo (Want to Watch/Completed/Dropped) → remove da lista.
- Cor da barra de progresso (My List + tela da série): roxo `#9900FF` = encerrada sem
  mais episódios, verde `#66CC00` = ainda vai ter episódios novos, `#CB9783` = dropped
  (ver `showProgressColor` em `lib/config.ts`).
- Home > Up Next: só mostra séries assistidas nos últimos 30 dias
  (`STALE_AFTER_MS` em `app/(app)/page.tsx`); as assistidas antes disso caem
  em "Haven't Seen in a While" (carrosséis empilhados de até 8, sem
  título/legenda, `STALE_ROW_SIZE`), ordenadas da mais abandonada pra menos.
  Séries nunca assistidas (status Watching sem nenhum episódio marcado)
  ficam fora da Home inteira — não aparecem em nenhuma das duas seções.
- My List: sort "Up to Date" agrupa séries em dia (assistiu tudo que já saiu)
  antes das atrasadas, ordenando por data do último episódio lançado.
- Sem sistema de notas na v1 (decidido em 2026-07-04).
- UI em inglês; dados TMDB em `en-US`.

## Ao mudar qualquer coisa (checklist de entrega)

1. Subir `APP_VERSION` + `APP_RELEASE_DATE` em `lib/config.ts` (data REAL).
2. Atualizar este MAPA se criou/moveu arquivo.
3. `npm run build` pra validar.
4. Commit com mensagem clara + push → Vercel faz deploy sozinho.
