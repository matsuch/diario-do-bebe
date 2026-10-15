/**
 * Núcleo da agenda (puro, sem DOM/banco): dado o perfil + eventos + "agora",
 * diz QUAIS lembretes estão vencendo NESTE instante. Nada é pré-agendado.
 *
 * É isso que permite criar/editar/cancelar de graça: como o robô do servidor
 * recalcula a cada rodada a partir do estado atual, antecipar uma mamada em
 * 30 min simplesmente faz o "próximo" mudar — o aviso do horário antigo nunca
 * chega a ser enviado.
 *
 * Compartilhado entre o cliente (store) e o /api/cron do servidor.
 */

export const MS_MIN = 60000;
export const MS_HOUR = 3600000;

// Emoji/tag do ntfy por categoria de alerta (espelha CATEGORIAS do cliente).
const CAT_EMOJI = { remedio: '💊', vacina: '💉', consulta: '🩺', alimentacao: '🍼', higiene: '🧴', outro: '🔔' };
const CAT_TAG = { remedio: 'pill', vacina: 'syringe', consulta: 'hospital', alimentacao: 'baby_bottle', higiene: 'bathtub', outro: 'bell' };

/** Último evento de um tipo (mais recente por `at`), ignorando apagados. */
export function lastEvent(events, type, filtro = () => true) {
  let melhor = null;
  for (const ev of events) {
    if (ev && ev.type === type && !ev.deleted && filtro(ev)) {
      if (!melhor || ev.at > melhor.at) melhor = ev;
    }
  }
  return melhor;
}

/** Quando deveria ser a próxima mamada (fim da última + intervalo). */
export function nextFeedAt(profile, events) {
  const ultima = lastEvent(events, 'feed');
  if (!ultima) return null;
  const intervaloMin = profile?.settings?.feedIntervalMin ?? 180;
  return (ultima.endAt || ultima.at) + intervaloMin * MS_MIN;
}

/* ------------------------------------------------------- mamada pela média
 * Espelha recentFeedIntervalMin/predictedFeedAt do store.js (modo 'media' dos
 * Ajustes): mediana dos intervalos início→início dos últimos 7 dias, separada
 * por período do dia no fuso da família, limitada a ±50% do intervalo
 * configurado. Sem amostras suficientes, cai no intervalo fixo.
 */
const FEED_DAYS = 7;
const FEED_MIN_SAMPLES = 6;

/** Período do dia ('dia' 6–18h, 'noite' 18–24h, 'madrugada' 0–6h) no fuso da família. */
export function periodoDe(ts, tzOffsetMin = -180) {
  const h = new Date(ts + tzOffsetMin * MS_MIN).getUTCHours();
  if (h >= 6 && h < 18) return 'dia';
  return h >= 18 ? 'noite' : 'madrugada';
}

function mediana(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Intervalo médio recente entre mamadas (min) para um período — ou null. */
export function recentFeedIntervalMin(profile, events, { now = Date.now(), periodo } = {}) {
  const tz = profile?.settings?.reminders?.tzOffsetMin ?? -180;
  const cfg = profile?.settings?.feedIntervalMin ?? 180;
  const desde = now - FEED_DAYS * 24 * MS_HOUR;
  const mam = (events || [])
    .filter((e) => e && !e.deleted && e.type === 'feed' && e.at >= desde)
    .sort((a, b) => a.at - b.at);
  const gaps = [];
  for (let i = 1; i < mam.length; i += 1) {
    const g = (mam[i].at - mam[i - 1].at) / MS_MIN;
    if (g >= 30 && g <= 6 * 60) gaps.push({ min: g, periodo: periodoDe(mam[i - 1].at, tz) });
  }
  const doPeriodo = gaps.filter((g) => g.periodo === periodo);
  const usar = doPeriodo.length >= FEED_MIN_SAMPLES ? doPeriodo : gaps;
  if (usar.length < FEED_MIN_SAMPLES) return null;
  return Math.round(Math.min(cfg * 1.5, Math.max(cfg * 0.5, mediana(usar.map((g) => g.min)))));
}

/**
 * Próxima mamada conforme o modo dos Ajustes (settings.feedMode):
 * 'intervalo' = fim da última + intervalo fixo; 'media' (padrão) = início da
 * última + intervalo médio recente do período.
 */
export function feedTargetAt(profile, events, { now = Date.now() } = {}) {
  if (profile?.settings?.feedMode === 'intervalo') return nextFeedAt(profile, events);
  const ultima = lastEvent(events || [], 'feed');
  if (!ultima) return null;
  const tz = profile?.settings?.reminders?.tzOffsetMin ?? -180;
  const intervalo = recentFeedIntervalMin(profile, events, { now, periodo: periodoDe(ultima.at, tz) });
  if (intervalo == null) return nextFeedAt(profile, events);
  return ultima.at + intervalo * MS_MIN;
}

/**
 * Normaliza um med que pode estar no formato legado (intervalHours, sem startAt)
 * para o formato atual (repeat + startAt). Espelha a migração do store.js:load().
 */
export function normalizeMed(med, events) {
  if (!med) return med;
  if (!med.category) med.category = 'remedio';
  if (med.repeat === undefined) {
    med.repeat = med.intervalHours ? { every: med.intervalHours, unit: 'hour' } : null;
  }
  if (!med.startAt && med.repeat) {
    const doses = (events || []).filter((e) => e.type === 'med' && med.id && e.medId === med.id && !e.deleted);
    med.startAt = doses.length ? Math.max(...doses.map((e) => e.at)) : null;
  }
  return med;
}

const UNIT_MS = { hour: MS_HOUR, day: 24 * MS_HOUR, week: 7 * 24 * MS_HOUR };
function addUnit(ts, every, unit) {
  if (unit === 'month') { const d = new Date(ts); d.setMonth(d.getMonth() + every); return d.getTime(); }
  return ts + every * (UNIT_MS[unit] || MS_HOUR);
}

/**
 * Ocorrência de um alerta que está vencendo em `now` (a última <= now).
 *  - sem repetição (data marcada): a própria data, se já passou;
 *  - com repetição: a última ocorrência <= now a partir de startAt.
 * Devolve null se ainda não chegou a hora (ou o alerta está inativo/sem data).
 */
export function dueAlertAt(med, now) {
  if (!med || !med.startAt || med.active === false) return null;
  if (!med.repeat) return med.startAt <= now ? med.startAt : null;
  if (med.startAt > now) return null;
  const { every, unit } = med.repeat;
  if (unit === 'month') {
    let occ = med.startAt;
    while (addUnit(occ, every, unit) <= now) occ = addUnit(occ, every, unit);
    return occ;
  }
  const passo = every * UNIT_MS[unit] || MS_HOUR;
  return med.startAt + Math.floor((now - med.startAt) / passo) * passo;
}

/* ------------------------------------------------------------ horários locais
 * O servidor roda em UTC; os "horários fixos" de troca são horas de parede
 * no fuso da família (Brasil = -180 min). Convertidos sem depender de libs.
 */
function partesLocais(now, tzOffsetMin) {
  const d = new Date(now + tzOffsetMin * MS_MIN);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), da: d.getUTCDate() };
}

/** Epoch (UTC ms) do horário local "HH:MM" de hoje. */
export function localTimeToday(now, tzOffsetMin, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const { y, mo, da } = partesLocais(now, tzOffsetMin);
  return Date.UTC(y, mo, da, h, m, 0) - tzOffsetMin * MS_MIN;
}

/** Chave de dia local (YYYY-MM-DD) para deduplicar os lembretes fixos. */
export function localDateKey(now, tzOffsetMin) {
  const { y, mo, da } = partesLocais(now, tzOffsetMin);
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
}

export const REMINDERS_PADRAO = {
  diaperTimes: ['10:00', '14:00', '18:00', '22:00'],
  tzOffsetMin: -180, // Brasil (sem horário de verão)
};

/**
 * Lembretes vencendo em `now`. Um lembrete "vence" quando seu horário-alvo já
 * passou (t <= now) mas não faz muito tempo (janela `maxLateMs`, para o servidor
 * não despejar avisos antigos se ficou horas fora do ar). Cada um traz uma
 * `key` estável para o servidor enviar só uma vez.
 *
 * Retorna [{ kind, key, message, tags, at }]. O título (com o nome do bebê)
 * é montado por quem envia, para caber no header Latin-1 do ntfy.
 *
 * `active` são os cronômetros em andamento da família ({ feed, sleep, burp }),
 * como estão na sincronização — o que está acontecendo agora silencia o aviso
 * que ia lembrar de fazer exatamente isso.
 */
export function dueReminders(profile, events, {
  now = Date.now(),
  maxLateMs = 90 * MS_MIN,
  active = null,
} = {}) {
  const evs = Array.isArray(events) ? events : [];
  const rem = { ...REMINDERS_PADRAO, ...(profile?.settings?.reminders || {}) };
  const out = [];
  const venceu = (t) => t != null && t <= now && t > now - maxLateMs;

  // Se alguém já está amamentando NESTE momento (cronômetro rodando em algum
  // dos celulares), o aviso de mamada só atrapalha — é o mesmo cuidado que o
  // app tem quando está aberto.
  const mamandoAgora = !!(active && active.feed);
  const mamada = feedTargetAt(profile, evs, { now });
  if (!mamandoAgora && venceu(mamada)) {
    out.push({ kind: 'feed', key: `feed:${mamada}`, message: '🍼 Hora da mamada', tags: 'baby_bottle', at: mamada });
  }

  for (const med of (profile?.meds || [])) {
    if (!med || med.active === false) continue;
    normalizeMed(med, evs);
    const t = dueAlertAt(med, now);
    if (venceu(t)) {
      const emoji = CAT_EMOJI[med.category] || CAT_EMOJI.outro;
      out.push({
        kind: 'med',
        key: `med:${med.id || med.name}:${t}`,
        message: `${emoji} ${med.name}${med.dose ? ` · ${med.dose}` : ''}`,
        tags: CAT_TAG[med.category] || CAT_TAG.outro,
        at: t,
      });
    }
  }

  const dia = localDateKey(now, rem.tzOffsetMin);
  for (const hhmm of (rem.diaperTimes || [])) {
    const t = localTimeToday(now, rem.tzOffsetMin, hhmm);
    if (venceu(t)) {
      out.push({
        kind: 'diaper',
        key: `diaper:${dia}:${hhmm}`,
        message: '🧷 Hora de anotar as trocas (xixi/cocô)',
        tags: 'toilet',
        at: t,
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}
