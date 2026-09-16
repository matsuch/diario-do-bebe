/**
 * Sincronização entre celulares via "código de família".
 *
 * Local-first: o localStorage continua sendo a verdade no aparelho; o sync
 * concilia com o servidor (Vercel + Neon) por polling. Se não houver código
 * configurado (ou o servidor não existir), o app funciona igual, offline.
 *
 * Três canais, cada um com sua regra:
 *  - Eventos: cada um carrega `updatedAt` e `_dirty`; exclusão é tombstone
 *    (`deleted`). Empurramos os `_dirty`, puxamos o que mudou desde o cursor, e
 *    mesclamos por id — nada é sobrescrito quando os dois registram ao mesmo tempo.
 *  - Perfil (bebê/ajustes/remédios): última-edição-vence, no todo.
 *  - EM ANDAMENTO (mamada, sono, arroto): última-edição-vence por tipo. É o que
 *    faz a soneca que ela começou no celular dela aparecer no celular dele —
 *    e sumir dos dois quando qualquer um encerrar.
 */
import { state, save, ACTIVE_KINDS, activeTimer, activeTimers, applyRemoteActive } from './store.js';

const BK_KEY = 'rotina-bebe:sync';
const ENDPOINT = './api/sync';

/** De quanto em quanto tempo perguntamos ao servidor o que mudou. */
export const INTERVALO = {
  andamento: 4000,   // tem cronômetro rodando (ou coisa a enviar): o parceiro precisa ver agora
  normal: 12000,     // app aberto, nada acontecendo
  oculto: 30000,     // app em segundo plano: economiza bateria e dados
};

let bk = carregarBk();       // { enabled, familyCode, since, profileHash, activeHash }
let sincronizando = false;
let aplicando = false;       // evita que o save() do próprio sync agende outro sync
let ultimoStatus = { estado: 'off', em: 0, pendentes: 0, erro: '' };
const ouvintes = new Set();
const ouvintesRemoto = new Set();

export function onStatus(fn) { ouvintes.add(fn); }
function emitir() { ouvintes.forEach((fn) => fn(ultimoStatus)); }

/** Avisa a UI que um cronômetro mudou no OUTRO celular: [{ kind, data, by }]. */
export function onRemoteActive(fn) { ouvintesRemoto.add(fn); }
function emitirRemoto(mudancas) {
  if (mudancas.length) ouvintesRemoto.forEach((fn) => fn(mudancas));
}

function carregarBk() {
  const base = { enabled: false, familyCode: '', since: 0, profileHash: '', activeHash: {} };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem(BK_KEY) || '{}') };
  } catch {
    return base;
  }
}
function salvarBk() {
  try { localStorage.setItem(BK_KEY, JSON.stringify(bk)); } catch { /* ignora */ }
}

/* ------------------------------------------------------------------ helpers puros */

export function hashObj(obj) {
  const s = JSON.stringify(obj ?? null);
  let h = 5381;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/** O "perfil" que sincroniza por última-edição-vence. */
export function profileData(st = state) {
  return { baby: st.baby, settings: st.settings, meds: st.meds };
}

/** Eventos alterados localmente e ainda não enviados. */
export function collectDirty(st = state) {
  return st.events.filter((e) => e._dirty).map((e) => {
    const { _dirty, ...limpo } = e;
    return limpo;
  });
}

/**
 * Mescla eventos vindos do servidor no array local (em lugar).
 * Regra: sem conflito de clock — o local sujo (pendente) sempre vence e será
 * reenviado; caso contrário o servidor é a fonte da verdade para aquele id.
 * Retorna quantos foram aplicados.
 */
export function mergeIncoming(localEvents, incoming) {
  const porId = new Map(localEvents.map((e) => [e.id, e]));
  let aplicados = 0;
  for (const inc of incoming) {
    const local = porId.get(inc.id);
    const merged = { ...inc.data, id: inc.id, deleted: !!inc.deleted, updatedAt: inc.updatedMs, _dirty: false };
    if (!local) {
      localEvents.push(merged);
      porId.set(inc.id, merged);
      aplicados += 1;
    } else if (!local._dirty) {
      Object.keys(local).forEach((k) => delete local[k]);
      Object.assign(local, merged);
      aplicados += 1;
    } // local._dirty => mantém o local (vai reenviar)
  }
  if (aplicados) localEvents.sort((a, b) => a.at - b.at);
  return aplicados;
}

/* ------------------------------------------------- em andamento (cronômetros) */

function hashAtivos() {
  const atuais = activeTimers();
  return Object.fromEntries(ACTIVE_KINDS.map((k) => [k, hashObj(atuais[k])]));
}

/**
 * Este cronômetro mudou aqui e o servidor ainda não sabe?
 * Um tipo que nunca sincronizou e está parado NÃO conta como mudança: senão o
 * celular que acabou de ligar o sync mandaria "não tem nada rodando" e apagaria
 * a soneca que o parceiro já tinha começado.
 */
export function ativoPendente(kind, hashes = hashAtivos()) {
  const conhecido = bk.activeHash[kind];
  if (conhecido === undefined) return activeTimer(kind) != null;
  return hashes[kind] !== conhecido;
}

/** Os cronômetros a empurrar neste sync ({} se nenhum mudou). `null` = encerrei. */
export function collectActive(hashes = hashAtivos()) {
  const atuais = activeTimers();
  const payload = {};
  for (const kind of ACTIVE_KINDS) {
    if (ativoPendente(kind, hashes)) payload[kind] = atuais[kind];
  }
  return payload;
}

/* ------------------------------------------------------------------ ciclo de sync */

function setStatus(estado, extra = {}) {
  ultimoStatus = { ...ultimoStatus, estado, em: Date.now(), ...extra };
  emitir();
}

export function isEnabled() { return !!bk.enabled && !!bk.familyCode; }
export function getCode() { return bk.familyCode; }
export function status() { return ultimoStatus; }

export function sugerirCodigo() {
  const parte = () => Math.random().toString(36).slice(2, 6);
  return `${parte()}-${parte()}-${parte()}`;
}

/** Liga o sync com um código; marca tudo como pendente para o 1º envio. */
export function enable(codigo) {
  bk.enabled = true;
  bk.familyCode = String(codigo || '').trim();
  bk.since = 0;
  bk.profileHash = '';
  bk.activeHash = {}; // desconhecido: empurra só o que estiver rodando aqui
  state.events.forEach((e) => { e._dirty = true; });
  salvarBk();
  save();
  return syncOnce();
}

export function disable() {
  bk.enabled = false;
  salvarBk();
  setStatus('off');
}

function pendentes() {
  return state.events.filter((e) => e._dirty).length;
}

export async function syncOnce() {
  if (!isEnabled() || sincronizando) return;
  sincronizando = true;
  setStatus('sync');
  const codigoNoInicio = bk.familyCode; // se mudar no meio do voo, descartamos a resposta
  const cursorNoInicio = bk.since;
  const dirty = collectDirty();
  const perfilHashEnviado = hashObj(profileData());
  const perfilMudou = perfilHashEnviado !== bk.profileHash;
  const hashesAoEnviar = hashAtivos();
  const ativosEnviados = collectActive(hashesAoEnviar);
  const payload = {
    familyCode: bk.familyCode,
    since: bk.since,
    events: dirty,
    profile: perfilMudou ? { data: profileData() } : null,
    active: Object.keys(ativosEnviados).length ? ativosEnviados : null,
  };
  const idsEnviados = new Map(dirty.map((e) => [e.id, e.updatedAt]));

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // O código de família (ou o cursor) mudou enquanto esta requisição corria
    // (ex.: usuário trocou o código). Descarta a resposta; outro sync assume.
    if (bk.familyCode !== codigoNoInicio || bk.since !== cursorNoInicio) {
      setStatus('sync');
      triggerSoon(200);
      return;
    }

    // Confirma o envio: limpa _dirty dos que não mudaram no meio-tempo.
    state.events.forEach((e) => {
      if (idsEnviados.has(e.id) && e.updatedAt === idsEnviados.get(e.id)) e._dirty = false;
    });

    if (Array.isArray(data.events) && data.events.length) mergeIncoming(state.events, data.events);

    // Perfil: o servidor já tem o que enviamos, então é isso que passa a ser o
    // "sincronizado". Se o usuário editou no meio do voo, o hash local fica
    // diferente e a edição é empurrada no próximo ciclo (em vez de se perder).
    if (perfilMudou) bk.profileHash = perfilHashEnviado;
    if (data.profile && data.profile.data) {
      const localHash = hashObj(profileData());
      const localPendente = localHash !== bk.profileHash;
      if (!localPendente && hashObj(data.profile.data) !== localHash) {
        Object.assign(state, {
          baby: data.profile.data.baby ?? state.baby,
          settings: data.profile.data.settings ?? state.settings,
          meds: data.profile.data.meds ?? state.meds,
        });
        bk.profileHash = hashObj(profileData());
      }
    }

    // Em andamento: confirma o que empurramos e aplica o que o outro celular fez.
    const hashesAgora = hashAtivos();
    for (const kind of Object.keys(ativosEnviados)) {
      if (hashesAgora[kind] === hashesAoEnviar[kind]) bk.activeHash[kind] = hashesAoEnviar[kind];
    }
    const mudancasRemotas = [];
    for (const inc of (Array.isArray(data.active) ? data.active : [])) {
      if (!ACTIVE_KINDS.includes(inc.kind)) continue;
      if (ativoPendente(inc.kind)) continue; // mexeram aqui depois: o local vence e reenvia
      const mudou = applyRemoteActive(inc.kind, inc.data);
      bk.activeHash[inc.kind] = hashObj(activeTimer(inc.kind));
      if (mudou) mudancasRemotas.push({ kind: inc.kind, data: inc.data ?? null, by: inc.data?.by || '' });
    }

    bk.since = Number(data.now) || bk.since;
    salvarBk();
    aplicando = true;
    save();            // persiste + re-renderiza, sem reagendar outro sync
    aplicando = false;
    emitirRemoto(mudancasRemotas);
    setStatus('ok', { pendentes: pendentes(), erro: '' });
  } catch (err) {
    setStatus('erro', { pendentes: pendentes(), erro: err.message });
  } finally {
    sincronizando = false;
  }
}

let debounce = null;
export function triggerSoon(ms = 1500) {
  if (!isEnabled() || aplicando) return; // não reagenda a partir do save() do próprio sync
  clearTimeout(debounce);
  debounce = setTimeout(syncOnce, ms);
}

/**
 * De quanto em quanto tempo vale a pena perguntar de novo. Enquanto alguém
 * está mamando/dormindo (aqui ou no outro celular) a gente acelera: é justo
 * o momento em que os dois precisam estar vendo a mesma coisa.
 */
export function intervaloAtual() {
  if (typeof document !== 'undefined' && document.hidden) return INTERVALO.oculto;
  const rodando = ACTIVE_KINDS.some((k) => activeTimer(k) != null);
  return rodando || pendentes() ? INTERVALO.andamento : INTERVALO.normal;
}

let proximo = null;
function agendarProximo() {
  clearTimeout(proximo);
  proximo = setTimeout(async () => {
    if (isEnabled()) await syncOnce();
    agendarProximo();
  }, intervaloAtual());
}

/** Liga o loop: intervalo adaptativo + ao focar o app. Chamado uma vez no boot. */
export function start() {
  if (isEnabled()) { setStatus('sync'); syncOnce(); }
  agendarProximo();
  document.addEventListener('visibilitychange', () => {
    agendarProximo();                       // volta para a cadência de app aberto
    if (!document.hidden) syncOnce();
  });
}
