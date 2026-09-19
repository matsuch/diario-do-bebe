/**
 * Estado do app: tudo mora no localStorage deste aparelho.
 * Os eventos são a fonte da verdade; "próxima mamada" e "próxima dose"
 * são sempre derivados do último registro, nunca guardados.
 */

const KEY = 'rotina-bebe:v1';
export const MS_MIN = 60000;
export const MS_HOUR = 3600000;

/**
 * Remédios que já vêm sugeridos (mesma rotina dos alarmes de pós-parto).
 * Ids fixos (não aleatórios) para que dois celulares comecem idênticos e o
 * perfil não fique em ping-pong na sincronização.
 */
const MEDS_PADRAO = [
  { id: 'med-cefalexina', name: 'Cefalexina', category: 'remedio', repeat: { every: 6, unit: 'hour' }, dose: '' },
  { id: 'med-paracetamol', name: 'Paracetamol', category: 'remedio', repeat: { every: 8, unit: 'hour' }, dose: '' },
  { id: 'med-profenid', name: 'Profenid', category: 'remedio', repeat: { every: 12, unit: 'hour' }, dose: '' },
];

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function estadoInicial() {
  return {
    version: 1,
    // sex ('female' | 'male') é obrigatório para as curvas da OMS, que são
    // publicadas separadamente por sexo; vazio = ainda não informado.
    baby: { name: '', birth: '', sex: '' },
    settings: {
      feedIntervalMin: 180,
      notify: false,
      // Integração com WhatsApp via API não-oficial (WAHA ou Evolution).
      wa: {
        enabled: false,
        provider: 'waha',   // 'waha' | 'evolution'
        baseUrl: '',        // ex.: https://waha.seudominio.com
        apiKey: '',         // X-Api-Key (WAHA) ou apikey (Evolution)
        session: 'default', // sessão (WAHA) ou nome da instância (Evolution)
        numbers: '',        // destinos, separados por vírgula (DDI+DDD+número)
        onReminder: true,   // manda no WhatsApp junto do aviso local
        // URL do worker 24/7 (server/) que recebe a agenda e dispara na madrugada
        workerUrl: '',
        workerToken: '', // segredo compartilhado com o worker (header x-worker-token)
      },
      // Notificações push simples via ntfy.sh (sem servidor próprio).
      ntfy: {
        enabled: false,
        server: 'https://ntfy.sh',
        topic: '',          // tópico secreto; qualquer um que souber recebe os avisos
        onReminder: true,   // manda um push quando o aviso dispara (app aberto)
      },
      // Avisos automáticos pelo servidor (/api/cron): lidos pelo robô via perfil.
      reminders: {
        diaperTimes: ['10:00', '14:00', '18:00', '22:00'], // horários fixos p/ lembrar de anotar trocas
        tzOffsetMin: -180, // fuso da família (Brasil, sem horário de verão)
      },
    },
    meds: MEDS_PADRAO.map((m) => ({ active: true, startAt: Date.now(), ...m })),
    events: [],
    // Quem está mexendo neste aparelho ("Mamãe", "Papai"...). NÃO entra no
    // perfil sincronizado: é por aparelho, e viaja junto do cronômetro em
    // andamento para o outro celular saber quem começou a mamada/soneca.
    device: { name: '' },
    activeFeed: null,   // { startAt, side, segments: [{side, min}], by }
    activeSleep: null,  // { startAt, by }
    activeBurp: null,   // { startAt, by } — cronômetro de arroto
  };
}

function migrar(dados) {
  const base = estadoInicial();
  const s = { ...base, ...dados };
  s.baby = { ...base.baby, ...(dados.baby || {}) };
  s.settings = { ...base.settings, ...(dados.settings || {}) };
  s.settings.wa = { ...base.settings.wa, ...((dados.settings || {}).wa || {}) };
  s.settings.ntfy = { ...base.settings.ntfy, ...((dados.settings || {}).ntfy || {}) };
  s.settings.reminders = { ...base.settings.reminders, ...((dados.settings || {}).reminders || {}) };
  s.device = { ...base.device, ...(dados.device || {}) };
  s.meds = Array.isArray(dados.meds) ? dados.meds : base.meds;
  s.events = Array.isArray(dados.events) ? dados.events : [];
  // Normaliza alertas antigos: categoria, recorrência e data/hora âncora.
  s.meds.forEach((m) => {
    // Alertas criados antes da correção do saveMed vieram sem id. Batiza aqui
    // (antes da busca por doses abaixo, que senão casaria medId undefined com
    // qualquer evento sem remédio).
    if (!m.id) m.id = uid();
    if (!m.category) m.category = 'remedio';
    if (m.repeat === undefined) {
      m.repeat = m.intervalHours ? { every: m.intervalHours, unit: 'hour' } : { every: 8, unit: 'hour' };
    }
    if (!m.startAt) {
      // Ancora na última dose registrada; se não houver, em agora.
      const doses = s.events.filter((e) => e.type === 'med' && e.medId === m.id && !e.deleted);
      m.startAt = doses.length ? Math.max(...doses.map((e) => e.at)) : Date.now();
    }
  });
  return s;
}

export let state = carregar();

function carregar() {
  if (typeof localStorage === 'undefined') return estadoInicial(); // Node/SSR
  try {
    const bruto = localStorage.getItem(KEY);
    return bruto ? migrar(JSON.parse(bruto)) : estadoInicial();
  } catch (err) {
    console.warn('Não consegui ler os dados salvos:', err);
    return estadoInicial();
  }
}

const ouvintes = new Set();
export function onChange(fn) { ouvintes.add(fn); }

export function save() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Não consegui salvar:', err);
  }
  ouvintes.forEach((fn) => fn());
}

/* ------------------------------------------------------------------ eventos */
/** Tipos: feed | diaper | sleep | med | note */
export function addEvent(ev) {
  const completo = { id: uid(), at: Date.now(), ...ev, updatedAt: Date.now(), _dirty: true };
  state.events.push(completo);
  state.events.sort((a, b) => a.at - b.at);
  save();
  return completo;
}

/** Exclusão é "tombstone": marca deleted para a exclusão sincronizar. */
export function removeEvent(id) {
  const ev = state.events.find((e) => e.id === id);
  if (!ev) return;
  ev.deleted = true;
  ev.updatedAt = Date.now();
  ev._dirty = true;
  save();
}

export function updateEvent(id, patch) {
  const ev = state.events.find((e) => e.id === id);
  if (!ev) return null;
  Object.assign(ev, patch, { updatedAt: Date.now(), _dirty: true });
  state.events.sort((a, b) => a.at - b.at);
  save();
  return ev;
}

/** Último evento de um tipo (mais recente primeiro), ignorando apagados. */
export function lastEvent(type, filtro = () => true) {
  for (let i = state.events.length - 1; i >= 0; i -= 1) {
    const ev = state.events[i];
    if (ev.type === type && !ev.deleted && filtro(ev)) return ev;
  }
  return null;
}

export function eventsBetween(inicio, fim) {
  return state.events.filter((e) => !e.deleted && e.at >= inicio && e.at < fim);
}

/* ------------------------------------------------------------------ mamadas */
export function nextFeedAt() {
  const ultima = lastEvent('feed');
  if (!ultima) return null;
  return (ultima.endAt || ultima.at) + state.settings.feedIntervalMin * MS_MIN;
}

/** Sugere o lado a oferecer: o contrário do último que mamou mais tempo. */
export function nextSide() {
  const ultima = lastEvent('feed', (e) => e.lastSide === 'E' || e.lastSide === 'D');
  if (!ultima) return null;
  return ultima.lastSide === 'E' ? 'D' : 'E';
}

/** Apelido deste aparelho, para marcar quem começou o cronômetro. */
export function deviceName() {
  return String(state.device?.name || '').trim();
}

export function setDeviceName(nome) {
  state.device = { ...(state.device || {}), name: String(nome || '').trim().slice(0, 24) };
  save();
}

export function startFeed(side) {
  state.activeFeed = { startAt: Date.now(), side, segments: [], segStart: Date.now(), by: deviceName() };
  save();
}

export function switchSide(side) {
  const f = state.activeFeed;
  if (!f || f.side === side) return;
  const agora = Date.now();
  f.segments.push({ side: f.side, ms: agora - f.segStart });
  f.side = side;
  f.segStart = agora;
  save();
}

export function finishFeed() {
  const f = state.activeFeed;
  if (!f) return null;
  const agora = Date.now();
  const segmentos = [...f.segments, { side: f.side, ms: agora - f.segStart }];
  const porLado = segmentos.reduce((acc, s) => {
    acc[s.side] = (acc[s.side] || 0) + s.ms;
    return acc;
  }, {});
  state.activeFeed = null;
  return addEvent({
    type: 'feed',
    at: f.startAt,
    endAt: agora,
    durationMin: Math.max(1, Math.round((agora - f.startAt) / MS_MIN)),
    sides: Object.fromEntries(Object.entries(porLado).map(([k, ms]) => [k, Math.round(ms / MS_MIN)])),
    lastSide: f.side,
  });
}

export function cancelFeed() {
  state.activeFeed = null;
  save();
}

/* ------------------------------------------------------------------ sono */
export function toggleSleep() {
  if (state.activeSleep) {
    const inicio = state.activeSleep.startAt;
    state.activeSleep = null;
    return addEvent({ type: 'sleep', at: inicio, endAt: Date.now() });
  }
  state.activeSleep = { startAt: Date.now(), by: deviceName() };
  save();
  return null;
}

export function cancelSleep() {
  state.activeSleep = null;
  save();
}

/* ------------------------------------------------------------------ arroto */
export function startBurp() {
  if (state.activeBurp) return;
  state.activeBurp = { startAt: Date.now(), by: deviceName() };
  save();
}

export function finishBurp() {
  const b = state.activeBurp;
  if (!b) return null;
  const agora = Date.now();
  state.activeBurp = null;
  return addEvent({
    type: 'burp',
    at: b.startAt,
    endAt: agora,
    durationMin: Math.max(1, Math.round((agora - b.startAt) / MS_MIN)),
    ok: true,
  });
}

export function cancelBurp() {
  state.activeBurp = null;
  save();
}

/* ------------------------------------------------------------------ em andamento
 * Os cronômetros (mamada, sono e arroto) só viram evento de verdade quando
 * encerram — mas aparecem na lista de registros e nas contagens do dia desde
 * que começam, como eventos VIRTUAIS marcados com `ongoing`. Assim a Home
 * mostra o que está acontecendo agora sem inventar um registro pela metade
 * no histórico (e sem mandar meia-mamada para a sincronização).
 */

/** Ids fixos dos registros em andamento (não existem no histórico). */
export const ONGOING_ID = {
  feed: 'andamento-mamada',
  sleep: 'andamento-sono',
  burp: 'andamento-arroto',
};

/** Minutos por lado da mamada em andamento, contando o lado atual até agora. */
function ladosAtivos(f, agora) {
  const porLado = {};
  (f.segments || []).forEach((s) => { porLado[s.side] = (porLado[s.side] || 0) + s.ms; });
  if (f.segStart) porLado[f.side] = (porLado[f.side] || 0) + Math.max(0, agora - f.segStart);
  return Object.fromEntries(Object.entries(porLado).map(([lado, ms]) => [lado, Math.round(ms / MS_MIN)]));
}

/** Os cronômetros em andamento como eventos virtuais (mesma forma dos salvos). */
export function ongoingEvents(agora = Date.now()) {
  const lista = [];
  const f = state.activeFeed;
  if (f) {
    lista.push({
      id: ONGOING_ID.feed, type: 'feed', ongoing: 'feed', at: f.startAt, endAt: null,
      durationMin: Math.round(Math.max(0, agora - f.startAt) / MS_MIN),
      sides: ladosAtivos(f, agora), lastSide: f.side, by: f.by || '',
    });
  }
  if (state.activeSleep) {
    lista.push({
      id: ONGOING_ID.sleep, type: 'sleep', ongoing: 'sleep', at: state.activeSleep.startAt, endAt: null,
      by: state.activeSleep.by || '',
    });
  }
  if (state.activeBurp) {
    lista.push({
      id: ONGOING_ID.burp, type: 'burp', ongoing: 'burp', at: state.activeBurp.startAt, endAt: null,
      durationMin: Math.round(Math.max(0, agora - state.activeBurp.startAt) / MS_MIN),
      by: state.activeBurp.by || '',
    });
  }
  return lista.sort((a, b) => a.at - b.at);
}

/**
 * Muda o início de um cronômetro em andamento — a única coisa editável antes de
 * encerrar. Início no futuro não existe, então fica preso em "agora". Na mamada,
 * o tempo que entra (ou sai) vai para o lado que estava mamando naquele trecho,
 * para os minutos por lado continuarem fechando com a duração total.
 */
export function setOngoingStart(tipo, at) {
  if (!Number.isFinite(at)) return null;
  const agora = Date.now();
  const inicio = Math.min(at, agora);
  if (tipo === 'sleep' && state.activeSleep) {
    state.activeSleep.startAt = inicio;
  } else if (tipo === 'burp' && state.activeBurp) {
    state.activeBurp.startAt = inicio;
  } else if (tipo === 'feed' && state.activeFeed) {
    const f = state.activeFeed;
    const delta = inicio - f.startAt; // > 0 = começou mais tarde, ou seja, menos tempo
    f.startAt = inicio;
    if (f.segments && f.segments.length) f.segments[0].ms = Math.max(0, f.segments[0].ms - delta);
    else f.segStart = Math.min(Math.max(inicio, (f.segStart || inicio) + delta), agora);
  } else {
    return null;
  }
  save();
  return inicio;
}

/* ------------------------------------------------------------------ em andamento: sincronização
 * Os cronômetros são estado compartilhado do casal, não registro do aparelho:
 * quem começa a soneca no celular dele tem que aparecer no celular dela na
 * mesma hora. Estas três funções são a ponte com assets/js/sync.js — o campo
 * do estado que guarda cada cronômetro fica escondido aqui dentro.
 */

/** Tipos de cronômetro que sincronizam (mesma lista do lib/sync-core). */
export const ACTIVE_KINDS = ['feed', 'sleep', 'burp'];

const CAMPO_ATIVO = { feed: 'activeFeed', sleep: 'activeSleep', burp: 'activeBurp' };

/** O cronômetro de um tipo (ou null se não tem nenhum rodando). */
export function activeTimer(tipo) {
  return state[CAMPO_ATIVO[tipo]] || null;
}

/** Os três cronômetros, do jeito que viajam na sincronização. */
export function activeTimers() {
  return Object.fromEntries(ACTIVE_KINDS.map((k) => [k, activeTimer(k)]));
}

/**
 * Aplica o cronômetro que veio do outro celular (sem marcar nada como local).
 * `dados` null = o outro aparelho encerrou/cancelou, então some daqui também.
 * Devolve true se mudou alguma coisa — a UI usa isso para avisar quem está
 * olhando ("Ana iniciou uma soneca").
 */
export function applyRemoteActive(tipo, dados) {
  const campo = CAMPO_ATIVO[tipo];
  if (!campo) return false;
  const antes = JSON.stringify(state[campo] ?? null);
  const depois = JSON.stringify(dados ?? null);
  if (antes === depois) return false;
  state[campo] = dados && typeof dados === 'object' ? dados : null;
  return true;
}

/** Descarta um cronômetro em andamento sem registrar nada. */
export function cancelOngoing(tipo) {
  if (tipo === 'feed') cancelFeed();
  else if (tipo === 'sleep') cancelSleep();
  else if (tipo === 'burp') cancelBurp();
}

/* ------------------------------------------------------------------ sono: janelas e recomendações
 *
 * PROCEDÊNCIA DOS NÚMEROS DESTE BLOCO
 *
 * [AASM] Paruthi et al., "Recommended Amount of Sleep for Pediatric Populations:
 *        A Consensus Statement of the American Academy of Sleep Medicine".
 *        J Clin Sleep Med. 2016;12(6):785-786. Endossado pela AAP.
 *        https://jcsm.aasm.org/doi/10.5664/jcsm.5866
 * [NSF]  Hirshkowitz et al., "National Sleep Foundation's sleep time duration
 *        recommendations: methodology and results summary".
 *        Sleep Health. 2015;1(1):40-43.
 * [GAL]  Galland et al., "Normal sleep patterns in infants and children: a
 *        systematic review of observational studies".
 *        Sleep Med Rev. 2012;16(3):213-222.
 * [MIN]  Mindell et al., "Development of infant and toddler sleep patterns:
 *        real-world data from a mobile application".
 *        J Sleep Res. 2016;25(5):508-516.
 *
 * SONO RECOMENDADO (SLEEP_REC): vem direto da [AASM], que é a diretriz oficial.
 * A [AASM] declara explicitamente NÃO haver recomendação abaixo de 4 meses (a
 * variação normal é ampla demais), então essa faixa usa a [NSF].
 *
 * JANELA DE SONO (WAKE_WINDOWS): não existe fonte oficial. "Wake window" não é
 * um conceito de medicina do sono — [AASM], AAP e [NSF] não definem, não
 * recomendam e não citam janelas de vigília, e não há estudo que teste durações
 * de vigília específicas. O termo vem de consultoria de sono comercial.
 * O que a literatura publica é (a) sono total por 24h e (b) número médio de
 * sonecas por idade. Como a janela não pode ser citada, ela é tratada aqui como
 * heurística COM INVARIANTE VERIFICÁVEL: para cada faixa, a janela implica um
 * número de períodos de sono por 24h,
 *
 *     períodos/24h = (24h − sono total recomendado) / janela
 *
 * e esse número tem que bater com a curva de consolidação observada — [GAL]
 * mede média de 3,1 sonecas diurnas aos 0–5 meses e 1,2 aos 12 meses (ou seja,
 * ~4,1 e ~2,2 períodos de sono por 24h, contando a noite), e [MIN] observa duas
 * sonecas de ~1,5h mais ~10,5h de noite entre 3 e 7 meses. A tabela abaixo
 * produz 10,2 → 6,8 → 5,7 → 5,7 → 4,2 → 3,3 → 2,9 → 2,7 → 2,1 períodos/24h,
 * dentro dessa curva em todas as faixas. tests/sleep.test.mjs trava o invariante,
 * para que uma edição futura em qualquer das duas tabelas não passe batido.
 *
 * Nada aqui é conselho médico: são referências gerais por idade, e cada bebê
 * tem o seu próprio ritmo.
 */
export const WAKE_WINDOWS = [
  // Heurística, não diretriz. O comentário de cada linha traz os períodos de
  // sono por 24h que ela implica (ver o invariante no bloco acima).
  { d: 30,    min: 40,  max: 60 },   // 0–1 mês    → ~10,2 períodos/24h (~8–12 mamadas/dia)
  { d: 60,    min: 60,  max: 90 },   // 1–2 meses  → ~6,8
  { d: 90,    min: 75,  max: 105 },  // 2–3 meses  → ~5,7
  { d: 120,   min: 90,  max: 120 },  // 3–4 meses  → ~5,7
  { d: 180,   min: 120, max: 165 },  // 4–6 meses  → ~4,2  (≈3,2 sonecas; [GAL] 3,1 aos 0–5m)
  { d: 270,   min: 150, max: 210 },  // 6–9 meses  → ~3,3  (≈2,3 sonecas)
  { d: 365,   min: 180, max: 240 },  // 9–12 meses → ~2,9  (≈1,9 sonecas; [GAL] 1,2 aos 12m)
  { d: 540,   min: 210, max: 300 },  // 12–18 meses→ ~2,7
  { d: 99999, min: 300, max: 360 },  // 18+ meses  → ~2,1  (1 soneca + noite)
];
export const SLEEP_REC = [
  // Limites em DIAS de vida: a faixa "1 a 2 anos" da [AASM] vale até o 3º
  // aniversário (12–35 meses), e "3 a 5 anos" até o 6º — daí 1095 e 2190.
  { d: 90,    min: 14, max: 17 },  // 0–3 meses  [NSF] — a [AASM] não recomenda <4 meses
  { d: 365,   min: 12, max: 16 },  // 4–12 meses [AASM]
  { d: 1095,  min: 11, max: 14 },  // 1–2 anos   [AASM]
  { d: 2190,  min: 10, max: 13 },  // 3–5 anos   [AASM]
  { d: 4745,  min: 9,  max: 12 },  // 6–12 anos  [AASM]
  { d: 99999, min: 8,  max: 10 },  // 13–18 anos [AASM]
];

/** Idade em dias (ou null se não tem data de nascimento). */
export function ageDays(ref = Date.now()) {
  if (!state.baby.birth) return null;
  const nasc = new Date(`${state.baby.birth}T00:00:00`).getTime();
  if (Number.isNaN(nasc)) return null;
  return Math.max(0, Math.floor((ref - nasc) / (24 * MS_HOUR)));
}

/** Janela de sono (min/max em minutos) para a idade. Sem data: assume recém-nascido. */
export function wakeWindow(ref = Date.now()) {
  const d = ageDays(ref) ?? 20;
  return WAKE_WINDOWS.find((w) => d <= w.d);
}

/** Sono recomendado por 24h (min/max em horas) para a idade. */
export function recommendedSleepH() {
  const d = ageDays() ?? 20;
  return SLEEP_REC.find((w) => d <= w.d);
}

/** Quando o bebê acordou pela última vez (fim do último sono concluído). */
export function lastWakeAt() {
  const s = lastEvent('sleep', (e) => e.endAt);
  return s ? s.endAt : null;
}

/** Próxima soneca sugerida: { wake, start, end, window } — ou null se dormindo/sem dados. */
export function nextNap(ref = Date.now()) {
  if (state.activeSleep) return null;
  const wake = lastWakeAt();
  if (!wake) return null;
  const w = wakeWindow(ref);
  return { wake, start: wake + w.min * MS_MIN, end: wake + w.max * MS_MIN, window: w };
}

/* ------------------------------------------------------------------ remédios */
export function lastDose(medId) {
  return lastEvent('med', (e) => e.medId === medId);
}

const UNIT_MS = { hour: MS_HOUR, day: 24 * MS_HOUR, week: 7 * 24 * MS_HOUR };

/** Avança um timestamp em `every` unidades (mês usa calendário). */
export function addUnit(ts, every, unit) {
  if (unit === 'month') { const d = new Date(ts); d.setMonth(d.getMonth() + every); return d.getTime(); }
  return ts + every * (UNIT_MS[unit] || MS_HOUR);
}

/**
 * Próxima ocorrência de um alerta a partir de `ref`.
 *  - sem repetição (data marcada): devolve a data agendada (mesmo se já passou,
 *    para o card mostrar "atrasado" até ser concluído);
 *  - com repetição: a menor ocorrência >= ref (a partir de startAt).
 * Devolve null se o alerta não tem data ou está inativo.
 */
export function nextAlertAt(med, ref = Date.now()) {
  if (!med || !med.startAt || med.active === false) return null;
  if (!med.repeat) return med.startAt;
  if (med.startAt >= ref) return med.startAt;
  const { every, unit } = med.repeat;
  if (unit === 'month') {
    let occ = med.startAt; let guarda = 0;
    while (occ < ref && guarda < 2400) { occ = addUnit(occ, every, unit); guarda += 1; }
    return occ;
  }
  const passo = every * UNIT_MS[unit] || MS_HOUR;
  const k = Math.ceil((ref - med.startAt) / passo);
  return med.startAt + k * passo;
}

/** Ocorrência que está vencendo AGORA (a última <= ref), para os lembretes. */
export function dueAlertAt(med, ref = Date.now()) {
  if (!med || !med.startAt || med.active === false) return null;
  if (!med.repeat) return med.startAt <= ref ? med.startAt : null;
  if (med.startAt > ref) return null;
  const { every, unit } = med.repeat;
  if (unit === 'month') {
    let occ = med.startAt;
    while (addUnit(occ, every, unit) <= ref) occ = addUnit(occ, every, unit);
    return occ;
  }
  const passo = every * UNIT_MS[unit] || MS_HOUR;
  const k = Math.floor((ref - med.startAt) / passo);
  return med.startAt + k * passo;
}

export function takeMed(med, at = Date.now()) {
  return addEvent({
    type: 'med', at, medId: med.id, name: med.name, dose: med.dose || '', category: med.category || 'remedio',
  });
}

export function saveMed(dados) {
  if (dados.id) {
    const med = state.meds.find((m) => m.id === dados.id);
    if (med) Object.assign(med, dados);
  } else {
    // `id` fica por último: o formulário manda `id: undefined` ao criar, e um
    // spread depois do uid() apagava o id — o alerta nascia sem identidade.
    state.meds.push({ active: true, ...dados, id: uid() });
  }
  save();
}

export function removeMed(id) {
  state.meds = state.meds.filter((m) => m.id !== id);
  // Apaga as doses desse remédio como tombstone, para a exclusão sincronizar.
  state.events.forEach((e) => {
    if (e.type === 'med' && e.medId === id && !e.deleted) {
      e.deleted = true;
      e.updatedAt = Date.now();
      e._dirty = true;
    }
  });
  save();
}

/* ------------------------------------------------------------------ medidas */

/**
 * Peso (kg) e altura (cm) são eventos como qualquer outro — o que interessa
 * é a série ao longo do tempo, não só o último valor. Cada medição pode
 * trazer só um dos dois (a balança de casa não mede altura).
 */
export function medidas() {
  return state.events.filter((e) => e.type === 'measure' && !e.deleted);
}

/** Última medição que trouxe este campo ('weightKg' | 'heightCm'). */
export function ultimaMedida(campo) {
  const lista = medidas();
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (lista[i][campo] > 0) return lista[i];
  }
  return null;
}

/* ------------------------------------------------------------------ resumo */
export function dayBounds(ref = new Date()) {
  const inicio = new Date(ref);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return [inicio.getTime(), fim.getTime()];
}

/**
 * Sono que cai DENTRO de um dia, recortado nos limites [inicio, fim).
 * Um sono que cruza a meia-noite entra parcial em cada dia (a parte que
 * pertence àquele dia), em vez de contar tudo no dia em que começou.
 * Retorna segmentos { at, endAt, id } já recortados, ordenados. A soneca em
 * andamento entra recortada em `agora` e marcada com `ongoing`.
 */
export function sleepSegmentsInDay(ref = new Date(), agora = Date.now()) {
  const [inicio, fim] = dayBounds(ref);
  const segs = [];
  for (const e of state.events) {
    if (e.type !== 'sleep' || e.deleted || !e.endAt) continue;
    const ini = Math.max(e.at, inicio);
    const f = Math.min(e.endAt, fim);
    if (f > ini) segs.push({ at: ini, endAt: f, id: e.id });
  }
  // Soneca em andamento: conta até agora, para o total do dia subir junto.
  if (state.activeSleep) {
    const ini = Math.max(state.activeSleep.startAt, inicio);
    const f = Math.min(agora, fim);
    if (f > ini) segs.push({ at: ini, endAt: f, id: ONGOING_ID.sleep, ongoing: 'sleep' });
  }
  return segs.sort((a, b) => a.at - b.at);
}

/** Minutos de sono do dia (já recortados na meia-noite, incluindo a soneca em curso). */
export function sleepMinutesInDay(ref = new Date(), agora = Date.now()) {
  const ms = sleepSegmentsInDay(ref, agora).reduce((t, s) => t + (s.endAt - s.at), 0);
  return Math.round(ms / MS_MIN);
}

export function daySummary(ref = new Date()) {
  const [inicio, fim] = dayBounds(ref);
  // Os cronômetros em andamento entram no dia em que começaram: aparecem na
  // lista e já contam nos números, que vão se ajustando até eles encerrarem.
  const eventos = [...eventsBetween(inicio, fim), ...ongoingEvents().filter((e) => e.at >= inicio && e.at < fim)]
    .sort((a, b) => a.at - b.at);
  const feeds = eventos.filter((e) => e.type === 'feed');
  const fraldas = eventos.filter((e) => e.type === 'diaper');
  return {
    inicio,
    fim,
    eventos,
    mamadas: feeds.length,
    minutosMamando: feeds.reduce((t, e) => t + (e.durationMin || 0), 0),
    xixis: fraldas.filter((e) => e.kind !== 'cocô').length,
    cocos: fraldas.filter((e) => e.kind !== 'xixi').length,
    arrotos: eventos.filter((e) => e.type === 'burp').length,
    remedios: eventos.filter((e) => e.type === 'med').length,
    // Recortado na meia-noite: sono que cruza a virada divide entre os dias.
    minutosDormindo: sleepMinutesInDay(ref),
  };
}

/** Projeta os horários de mamada e remédio das próximas `horas` horas. */
export function agenda(horas = 24) {
  const agora = Date.now();
  const limite = agora + horas * MS_HOUR;
  const linhas = [];

  let proximaMamada = nextFeedAt();
  const intervalo = state.settings.feedIntervalMin * MS_MIN;
  if (proximaMamada) {
    while (proximaMamada < agora) proximaMamada += intervalo;
    for (let t = proximaMamada; t <= limite; t += intervalo) {
      linhas.push({ at: t, emoji: '🍼', text: 'Mamada' });
    }
  }

  state.meds.filter((m) => m.active !== false).forEach((med) => {
    const prox = nextAlertAt(med, agora);
    if (prox == null) return;
    const texto = `${med.name}${med.dose ? ` · ${med.dose}` : ''}`;
    if (!med.repeat) {
      if (prox <= limite) linhas.push({ at: prox, emoji: '🔔', text: texto });
      return;
    }
    const { every, unit } = med.repeat;
    let guarda = 0;
    for (let t = prox; t <= limite && guarda < 500; t = addUnit(t, every, unit), guarda += 1) {
      linhas.push({ at: t, emoji: '🔔', text: texto });
    }
  });

  return linhas.sort((a, b) => a.at - b.at);
}

/* ------------------------------------------------------------------ backup */
export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(texto) {
  const dados = JSON.parse(texto);
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.events)) {
    throw new Error('Arquivo não parece um backup do Rotina do Bebê.');
  }
  state = migrar(dados);
  save();
}

export function wipe() {
  state = estadoInicial();
  save();
}
