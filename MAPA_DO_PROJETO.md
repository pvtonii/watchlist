# 🗺️ MAPA_DO_PROJETO — WatchList

> Cole este arquivo no começo de um chat novo. Use a tabela pra ir DIRETO no
> arquivo certo, sem reler o projeto todo.

**Stack:** Next.js 16 (App Router, TS) · Tailwind v4 · shadcn/ui · Supabase (auth + Postgres/RLS) · React Query · Zod · TMDB API · Vercel
**Versão atual:** v1.18.1 (2026-07-10) — definida em `lib/config.ts`

## Onde mexo pra…

| Funcionalidade | Arquivo |
|---|---|
| **Versão do app / regras de negócio / helpers de imagem TMDB** | `lib/config.ts` |
| Cores / tema / layout PWA (receita v3: body, tabs, safe-area) | `app/globals.css` |
| Meta tags PWA (viewport, theme-color, apple-*) | `app/layout.tsx` |
| Manifest PWA | `app/manifest.ts` |
| Ícones do app | `public/icons/` (gerados; fundo sólido #0c111b) |
| **Tela Home** (abas TV Shows/Movies em grade de 4: Up Next, Want to Watch, Upcoming Movies) | `app/(app)/page.tsx` |
| Tela de loading (splash de marca, cold start + `app/(app)/loading.tsx`) | `components/app-splash.tsx` |
| **Tela Busca** | `app/(app)/search/page.tsx` |
| **Tela My List** (filtro Progress + sort, estilo TV Time) | `app/(app)/library/page.tsx` |
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
| `GET /api/tmdb/movie/[id]` | detalhes do filme + elenco + watch/providers + release_dates |
| `GET /api/tmdb/tv/[id]` | detalhes da série + elenco + next_episode_to_air |
| `GET /api/tmdb/tv/[id]/season/[n]` | episódios da temporada |
| `GET /api/tmdb/upcoming` | filmes por lançar nos próximos 120 dias (TMDB `/discover/movie`, popularidade → reordenado por data), usado em Home > Movies |

## Banco (Supabase)

- `library_items` — 1 linha por filme/série do usuário: `status` ∈ watchlist/watching/completed/dropped + cache de título/pôster. Único por (user, tmdb_id, media_type).
- `watched_episodes` — 1 linha por episódio assistido (show, season, episode).
- RLS ativo nas duas: cada usuário só vê as próprias linhas.

## Regras de negócio (v1)

- Filme "assistido" = status `completed` (sem tracking por episódio).
- Progresso de série = episódios assistidos ÷ total (specials/temporada 0 fora da conta, mas listadas e marcáveis).
- Série: só existem 3 botões manuais — Want to Watch / Completed / Stopped. `watching` é
  **derivado automaticamente**, nunca tocado direto (decidido em 2026-07-06):
  - Marca 1+ episódio regular sem estar em dia → status vira `watching` (mesmo se estava
    watchlist/completed/dropped).
  - Fica em dia com **tudo que já foi lançado** (não o total bruto do TMDB — ver
    `deriveTvLibraryStatus`/`releasedEpisodeCount` em `lib/config.ts`) → status vira
    `completed`, mesmo que a série ainda esteja no ar (decidido em 2026-07-06: "em dia"
    conta como completed até sair um episódio novo).
  - Desmarca 1 episódio de uma série `completed` → volta pra `watching` sozinho.
  - **Sem reconciliação em background** (tentamos um hook rodando 1x por load do app
    pra pegar séries que ganharam episódio novo enquanto `completed` — quebrou o app
    inteiro em 2026-07-06, removido). Uma série `completed` só recalcula o status
    quando você mexe em algo (marca/desmarca episódio na tela da temporada), então se
    sair um episódio novo ela fica "completed" (desatualizado) até você de fato assistir
    esse episódio — nesse momento o toggle já resincroniza pra `watching` sozinho.
    Pra você saber que tem episódio novo sem precisar abrir a série: Home > Upcoming
    Episodes também lista séries `completed` ainda no ar com `next_episode_to_air`.
  - Tocar em "Completed" manualmente marca TODOS os episódios como assistidos (pede
    confirmação, `app/(app)/tv/[id]/page.tsx`).
  - "Stopped" mantém o histórico de episódios assistidos (não apaga `watched_episodes`).
  - Remover uma série da lista de vez é via botão dedicado "Remove from list" (com
    confirmação), já que não dá mais pra tocar num chip "Watching" pra tirar da lista.
- Tocar de novo num chip de status ativo (Want to Watch/Completed/Stopped) → remove da lista.
- Cor da barra de progresso (My List, tela da série, e Home > Up Next/Haven't
  Seen desde 2026-07-10): roxo `#9900FF` = encerrada sem mais episódios,
  verde `#66CC00` = ainda vai ter episódios novos, `#E50914` = Stopped
  (ver `showProgressColor` em `lib/config.ts`).
- Home > Up Next: só mostra séries assistidas nos últimos 30 dias
  (`STALE_AFTER_MS` em `app/(app)/page.tsx`); as assistidas antes disso caem
  em "Haven't Seen in a While", ordenadas da mais abandonada pra menos.
  Séries nunca assistidas (status Watching sem nenhum episódio marcado)
  ficam fora da Home inteira — não aparecem em nenhuma das duas seções.
- My List (estilo TV Time, decidido em 2026-07-06): filtro por **Progress**, não mais
  por status bruto — TV: All/Watching/Haven't Started/Up to Date/Finished/Stopped;
  Filme: All/Haven't Started/Finished. "Up to Date" (completed, ainda no ar) e
  "Finished" (completed, `Ended`/`Canceled` de vez, ou qualquer filme) são calculados
  na hora de exibir a partir do status do TMDB (`progressCategory` em
  `app/(app)/library/page.tsx`) — nunca gravados no banco, só leitura.
  Sort: Last Watched / Last Added / Release Date / A-Z, iguais pra série e filme.
  Last Watched = `watched_at` mais recente da série (TV) ou data que o filme foi
  marcado completed (`updated_at`); sem histórico fica por último. Release Date =
  pra filme, `release_date` cacheado no item; pra série, `last_episode_to_air.air_date`
  do TMDB (episódio mais recente já ao ar, não a estreia) — cai pro `release_date`
  cacheado (estreia) enquanto os detalhes da série ainda não carregaram ou se não há
  episódio ao ar ainda (decidido em 2026-07-09: assim uma série antiga que ainda
  lança episódios novos sobe na lista junto com elas, não fica presa na data de
  estreia).
  "Last Watched" some da lista de sort quando o filtro Progress é "Haven't Started"
  (nada ali foi assistido ainda) — cai pra "Last Added" automaticamente se estava
  selecionado (decidido em 2026-07-09).
  Campo de busca por título (mesmo componente/estilo da tela Search) filtra a lista
  já ordenada, client-side (decidido em 2026-07-09).
- Profile > stats (estilo TV Time, `app/(app)/profile/page.tsx`): tempo assistido é
  aproximado — `episode_run_time` médio do TMDB por série (fallback 45min se a série
  não informar) × episódios assistidos (specials contam aqui, diferente do resto do
  app); filme usa `runtime` do TMDB (fallback 100min). "Remaining Episodes" soma
  episódios já lançados e não assistidos em toda série salva **exceto Stopped**.
  "Top Networks"/"Top Genres" contam em cima de **todas** as séries salvas, qualquer
  status (não exclui Stopped).
- Sem sistema de notas na v1 (decidido em 2026-07-04).
- UI em inglês; dados TMDB em `en-US`.
- Home espera só `library` carregar antes de renderizar (mostra `AppSplash`
  até lá, `app/(app)/page.tsx`); o feed de Upcoming Movies (TMDB) carrega à
  parte e mostra seu próprio skeleton em grade — não segura a tela toda,
  já que TV Shows nem depende dele.
- `app/(app)/layout.tsx` usa `getSession()`, não `getUser()`: o proxy
  (`proxy.ts`) já valida/atualiza o token contra o servidor da Supabase em
  toda navegação (matcher cobre quase todas as rotas); repetir `getUser()`
  no layout duplicava esse round-trip de rede em CADA troca de aba, já que
  esse layout é dinâmico (usa `cookies()`) e não entra no Router Cache do
  Next — decidido em 2026-07-08 depois de identificar isso como a causa do
  clique/navegação lenta.
- `proxy.ts` cacheia a validação do `getUser()` por 60s num cookie
  (`sb-auth-checked-at`) em vez de bater na rede do Supabase em toda
  navegação — decidido em 2026-07-08 depois de identificar esse round-trip
  como a causa da tela branca demorada ao abrir o app (nada renderiza,
  nem o `AppSplash`, até essa chamada resolver). Trade-off: sessão revogada
  em outro dispositivo pode continuar válida aqui por até 60s.
- Tela branca no boot do PWA iOS: `app/layout.tsx` define
  `appleWebApp.startupImage` (imagens em `public/splash/`, geradas de
  `public/icons/icon-512.png` com fundo `THEME_COLOR`) — sem isso o iOS
  ignora o manifest pra splash e mostra branco liso até o primeiro paint.
- Home (decidido em 2026-07-10, substitui a versão de 3 abas de 2026-07-09):
  2 abas em pílula — **TV Shows** (Up Next + Haven't Seen in a While +
  Upcoming Episodes, essa última em formato lista/linha, não em grade) e
  **Movies** (Want to Watch + Upcoming Movies). Cards de TV (`ShowProgressCard`)
  e de filme (`PosterCard`) usam o mesmo tamanho fluido, em grade
  `grid-cols-4` (`POSTER_GRID` em `app/(app)/page.tsx`) — sem mais
  carrossel horizontal nessas seções.
  Home > Movies > Upcoming Movies junta dois grupos por `tmdb_id` (sem
  duplicar): o feed de lançamentos da TMDB (`/api/tmdb/upcoming`) + os
  filmes Want to Watch do usuário com `release_date` futura (cobre o caso
  de um filme já salvo que não apareceu no feed da TMDB). Cada card mostra
  o mesmo badge de check genérico da tela Search (`inLibrary` em
  `components/poster-card.tsx`) quando o filme já está na sua lista, sem
  distinguir o status (decidido em 2026-07-10: só interessa saber que já
  foi salvo).
  Aba selecionada persiste em `?tab=` na URL (mesmo padrão de My List) —
  necessário pra voltar de um detalhe (filme/série) e cair na aba em que
  você estava, não sempre em TV Shows (useState puro reseta no remount que
  a navegação de volta causa). A tela de Busca (`app/(app)/search/page.tsx`)
  ganhou o mesmo tratamento pra `?q=`/`?media=`, pelo mesmo motivo.
- Disponibilidade de filme (`movieAvailability` em `lib/config.ts`, região
  fixa `AVAILABILITY_REGION = "US"`, decidido em 2026-07-09): heurística
  best-effort mostrada em My List (linha do filme) e na tela de detalhe —
  `Releases {data}` se ainda não lançou; `In Theaters` se tem release
  teatral nos EUA nos últimos ~60 dias e nenhum lançamento digital/TV ainda;
  `Streaming on {provedores}` se a TMDB lista flatrate/rent/buy pra região;
  senão cai pra `Released {data}`. Sem dado de data nenhum, não mostra nada
  (cobertura da TMDB varia por título).

## Ao mudar qualquer coisa (checklist de entrega)

1. Subir `APP_VERSION` + `APP_RELEASE_DATE` em `lib/config.ts` (data REAL).
2. Atualizar este MAPA se criou/moveu arquivo.
3. `npm run build` pra validar.
4. Commit com mensagem clara + push → Vercel faz deploy sozinho.
