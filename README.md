# 🍼 Rotina do Bebê

App para dar conta da rotina de recém-nascido: **mamadas de 3 em 3h, remédios com
intervalos diferentes (6h, 8h, 12h), fraldas e sono** — tudo em uma tela só, com
contagem regressiva, para não precisar fazer conta às 3 da manhã.

É um site que funciona como app: **instala na tela de início, abre offline e salva
tudo no próprio celular**. Sem conta e sem servidor obrigatório: sincronização entre
celulares e avisos automáticos são opcionais.

**No ar:** https://baby-routine-three.vercel.app

## O que ele faz

| Tela | Para quê |
|---|---|
| **Início** | Próxima mamada e próximas doses com contagem regressiva; **janela de sono / próxima soneca** por idade (estilo Napper); e o **sono do dia vs. recomendado**. Botões grandes para xixi, cocô, arroto e sono. Embaixo, os **registros** do dia com navegação entre dias, **"Agenda do dia"** (projeta os horários das próximas 24h) e **"Copiar resumo"** para mandar no WhatsApp ou mostrar no pediatra. Mamada, sono e arroto aparecem na lista **em andamento** desde que o cronômetro começa (e já contam nos números do dia, que vão se ajustando). **Todo registro é editável** — no que está em andamento, só o início; o ✕ dele cancela o cronômetro em vez de apagar histórico. |
| **Mamada** | Cronômetro com lado esquerdo/direito, troca de lado no meio da mamada e sugestão de qual peito oferecer na próxima. Também dá para registrar uma mamada que já passou. |
| **Sono** | Cronômetro dedicado; janela de sono por idade prevê a próxima soneca; **relógio do dia (24h)** na Início mostra sono × mamadas ao voltar para um dia anterior. As janelas e o total recomendado são **referências gerais por idade — não é conselho médico**. |
| **Remédios** | Cada remédio com seu intervalo. "Tomei agora" recalcula a próxima dose sozinho. Já vem com Cefalexina 6h, Paracetamol 8h e Profenid 12h — é só editar ou apagar. |
| **Diário** | Só gráficos: os números de hoje e três barras dos **últimos 7 dias** — sono, xixis e cocôs — com o valor de cada dia rotulado. |
| **Evolução** | Peso e altura no topo, com o **percentil da curva da OMS** para a idade e o sexo, e a faixa esperada. Abaixo, a média de xixis, cocôs e sono dos últimos 7 dias comparada com a referência da idade. Os gráficos do Diário ganham uma **linha tracejada de meta**. Onde não há referência honesta — a frequência de cocô depois das primeiras semanas — o app diz "sem meta" em vez de inventar uma. **Referências gerais: não é conselho médico.** |
| **Ajustes** | Na **engrenagem do canto superior direito**, disponível em qualquer aba: nome e nascimento do bebê, intervalo entre mamadas, avisos, **notificações no WhatsApp** e backup dos dados. |

## Notificações push pelo ntfy (recomendado — simples, sem servidor)

A forma mais fácil de receber os avisos como **push**, inclusive de madrugada, é o
[**ntfy**](https://ntfy.sh) — grátis, open-source, sem conta e sem servidor próprio.

1. Instale o app **ntfy** ([iOS](https://apps.apple.com/app/ntfy/id1625396347) /
   [Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy)).
2. No Rotina do Bebê: **Ajustes → Push pelo ntfy** → ligue. O app já sugere um
   **tópico** aleatório (ex.: `rotina-bebe-x7k9m2`).
3. No app ntfy, assine **o mesmo tópico** (o parceiro(a) pode assinar também, no
   celular dele). Toque em **Enviar teste** para conferir.
4. Antes de dormir, toque em **Programar lembretes da noite** — o ntfy usa
   **entrega agendada** e dispara os avisos na hora certa **mesmo com o app fechado**.

> O tópico é **público para quem souber o nome** — use um nome aleatório e não o
> compartilhe. Registrar uma mamada fora do horário previsto pode fazer um aviso já
> agendado chegar no horário antigo (o ntfy não cancela agendados); por isso o botão
> é para programar a noite pouco antes de dormir.

## Notificações no WhatsApp (opcional, mais trabalhoso)

Em **Ajustes → Avisar no WhatsApp** dá para mandar os lembretes de mamada e remédio
(e o resumo do dia) para o seu WhatsApp e o do parceiro(a), usando uma API
**não-oficial** — [WAHA](https://waha.devlike.pro/) ou
[Evolution API](https://github.com/EvolutionAPI/evolution-api).

Como o app é estático (não roda com o celular bloqueado), há **duas camadas**:

- **No app** — enquanto aberto, envia o teste, o resumo e o aviso junto da notificação.
- **Worker 24/7** (`server/`) — recebe a agenda do app e dispara os lembretes na hora
  certa, inclusive de madrugada. É o que fecha o buraco da notificação com o app fechado.

O passo a passo de instalação numa VPS (Docker + WAHA/Evolution + HTTPS) está em
**[`server/README.md`](server/README.md)**.

> ⚠️ APIs não-oficiais do WhatsApp podem levar ao **bloqueio do número**. Use por sua
> conta e risco, de preferência com um chip dedicado.

## Como usar no celular

1. Publique o app (veja abaixo) ou abra o `index.html` de um servidor local.
2. **iPhone:** abra no Safari → botão compartilhar → *Adicionar à Tela de Início*.
   **Android:** Chrome → menu → *Instalar app*.
3. Abra pelo ícone. A partir daí funciona offline.

### Sobre os avisos ⚠️

O sininho no topo liga as notificações, mas **navegador só avisa com o app aberto ou
há pouco tempo em segundo plano** — no iPhone isso é ainda mais limitado. Para
receber avisos com o app fechado (madrugada), use o **push pelo ntfy** (acima) e o
botão *Programar lembretes da noite*. Como rede de segurança, vale manter também os
**alarmes do celular**; a *Agenda do dia* ajuda a acertar os horários. O app em si
serve para saber *quanto falta* e *o que já foi feito*.

## Sincronizar entre celulares (Vercel + Neon)

Para o seu celular e o do parceiro(a) verem e registrarem **a mesma rotina**, o app
sincroniza por um **código de família** através de uma função serverless na
[Vercel](https://vercel.com) com banco [Neon](https://neon.tech) (Postgres). Os
eventos sincronizam um a um (nada se sobrescreve quando os dois registram juntos); o
perfil (nome, remédios, ajustes) sincroniza por última-edição-vence.

> Sincronização é **opcional**. Sem ela, o app segue funcionando local e offline. Ela
> só funciona quando publicado na Vercel (o GitHub Pages não roda backend).

**1) Banco no Neon** (grátis): crie um projeto em neon.tech e copie a *connection
string* (algo como `postgresql://...@...neon.tech/neondb?sslmode=require`). As tabelas
são criadas sozinhas na primeira sincronização (esquema em [`db/schema.sql`](db/schema.sql)).

**2) Publicar na Vercel**: importe este repositório em vercel.com/new e adicione, em
**Settings → Environment Variables**:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `SYNC_PEPPER` | um segredo qualquer (embaralha o código antes de virar chave no banco) |

Faça o deploy. O app fica em `https://<seu-projeto>.vercel.app` e a sincronização
em `POST /api/sync`.

**3) No app** (nos dois celulares): **Ajustes → Sincronizar entre celulares** → ligue,
use **o mesmo código** nos dois (gere um no primeiro e copie para o segundo) →
*Sincronizar agora*. Pronto.

> ⚠️ Quem tiver o código acessa os dados da família — use um código difícil de
> adivinhar e não o compartilhe fora do casal.

A cada `git push` na branch principal, a Vercel republica sozinha.

## Avisos automáticos (cron)

A função `api/cron.js` calcula, a partir do estado sincronizado da rotina, quais
avisos estão na hora e os envia pelo ntfy. Quem a dispara é o workflow
[`.github/workflows/push-cron.yml`](.github/workflows/push-cron.yml), que "cutuca"
o endpoint periodicamente.

| Onde | Variável | Valor |
|---|---|---|
| Vercel | `PUSH_CRON_SECRET` | segredo compartilhado com o despertador |
| GitHub → Secrets and variables → Actions | `PUSH_CRON_SECRET` | o mesmo valor |
| GitHub (opcional) | `PUSH_CRON_URL` | se o domínio da Vercel mudar |

O agendamento do GitHub atrasa bastante; para cadência precisa, aponte um pinger
externo gratuito (ex.: cron-job.org) para a mesma URL com o header
`Authorization: Bearer <PUSH_CRON_SECRET>`.

## Hospedagem só estática

Sem sincronização e sem cron, o app é só arquivos estáticos e funciona em qualquer
hospedagem (GitHub Pages, Netlify etc.).

## Rodar e testar localmente

```bash
npm start          # serve em http://localhost:8080
npm install        # só para os testes (baixa o Playwright)
npm test           # abre um Chromium e percorre os fluxos principais
SHOTS=1 npm test   # o mesmo, salvando telas em tests/screenshots/
npm run icons      # regera os ícones PNG (script Python sem dependências)
node server/test.mjs   # testa o worker e o adaptador de WhatsApp (sem rede)
```

## Estrutura

```
index.html                 telas (uma <section> por aba)
assets/css/style.css       tema escuro, botões grandes para uso com uma mão
assets/js/store.js         estado + localStorage; eventos são a fonte da verdade
assets/js/format.js        formatação de horas, durações e contagens regressivas
assets/js/app.js           renderização das telas, interações e avisos
assets/js/ntfy.js          push simples via ntfy.sh (imediato e agendado)
assets/js/wa.js            adaptador de WhatsApp (WAHA/Evolution) — usado no app e no worker
assets/js/sync.js          sincronização entre celulares (cliente do /api/sync)
api/sync.js                função serverless da Vercel (sincroniza via Neon)
api/cron.js                função serverless que envia os avisos automáticos
lib/sync-core.mjs          núcleo do sync (sem dependências, testável)
lib/agenda-core.mjs        cálculo da agenda de mamadas e doses
lib/cron-core.mjs          núcleo dos avisos automáticos
db/schema.sql              esquema do Postgres (Neon)
vercel.json                config da Vercel
sw.js                      service worker (abre offline)
tools/make_icons.py        gera os ícones PNG sem dependências
tests/smoke.mjs            teste de fumaça ponta a ponta (UI no navegador)
tests/sync.test.mjs        testes do sync (núcleo + helpers do cliente)
tests/sync-e2e.mjs         dois "celulares" sincronizando ponta a ponta
server/                    worker 24/7 de WhatsApp + Docker (veja server/README.md)
  worker.mjs               recebe a agenda e dispara os lembretes na hora
  docker-compose.yml       WAHA + worker
  test.mjs                 testes do worker e do adaptador (sem rede)
```

Os horários (próxima mamada, próxima dose) nunca são gravados: são sempre calculados
a partir do último registro. Assim, atrasar ou adiantar uma dose reajusta o resto sozinho.

## Backup

Tudo fica no `localStorage` **deste aparelho**. Em *Ajustes → Exportar* sai um `.json`
que pode ser importado no celular do parceiro(a) ou depois de trocar de telefone.
Limpar os dados do site apaga os registros.

---

Este app apenas lembra os horários que você configurou. Dose, intervalo e duração do
tratamento são sempre os da prescrição médica.
