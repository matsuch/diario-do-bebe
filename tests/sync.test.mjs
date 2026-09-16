/**
 * Testes da sincronização, sem banco nem rede:
 *  - núcleo do servidor (lib/sync-core) com um "banco" em memória
 *  - helpers puros do cliente (assets/js/sync)
 *
 *   node tests/sync.test.mjs
 */
import assert from 'node:assert';
import { applySync, sanitizeEvent, sanitizeActive } from '../lib/sync-core.mjs';
import {
  mergeIncoming, collectDirty, hashObj, collectActive, ativoPendente,
  intervaloAtual, INTERVALO, atrasoDoPush, ATRASO_PUSH,
  enable, disable, syncOnce,
} from '../assets/js/sync.js';
import { state, startFeed, toggleSleep, applyRemoteActive, activeTimers, setOngoingStart, MS_MIN } from '../assets/js/store.js';

let falhas = 0;
async function teste(nome, fn) {
  try { await fn(); console.log(`  ok  ${nome}`); }
  catch (err) { falhas += 1; console.error(`FALHOU ${nome}\n       ${err.stack || err.message}`); }
}

/** Banco em memória com a mesma semântica do Neon (clock só avança em escrita). */
function fakeDb() {
  let clock = 0;
  const eventos = new Map();  // key -> Map(id -> {id,data,deleted,updatedMs})
  const perfis = new Map();
  const ativos = new Map();   // key -> Map(kind -> {kind,data,updatedMs})
  return {
    async now() { return clock; },
    async upsertEvents(key, evs) {
      const m = eventos.get(key) || new Map(); eventos.set(key, m);
      for (const e of evs) { clock += 1; m.set(e.id, { id: e.id, data: e.data, deleted: e.deleted, updatedMs: clock }); }
    },
    async getEventsSince(key, since) {
      const m = eventos.get(key) || new Map();
      return [...m.values()].filter((e) => e.updatedMs > since).sort((a, b) => a.updatedMs - b.updatedMs);
    },
    async getProfile(key) { return perfis.get(key) || null; },
    async upsertProfile(key, data) { clock += 1; perfis.set(key, { data, updatedMs: clock }); },
    async upsertActive(key, items) {
      const m = ativos.get(key) || new Map(); ativos.set(key, m);
      for (const a of items) { clock += 1; m.set(a.kind, { kind: a.kind, data: a.data, updatedMs: clock }); }
    },
    async getActiveSince(key, since) {
      const m = ativos.get(key) || new Map();
      return [...m.values()].filter((a) => a.updatedMs > since).sort((a, b) => a.updatedMs - b.updatedMs);
    },
  };
}

const FAM = 'fam1';

/* ------------------------------------------------------------------ núcleo */

await teste('celular B recebe os eventos que A empurrou', async () => {
  const db = fakeDb();
  const a = await applySync(db, { familyKey: FAM, since: 0, events: [
    { id: 'e1', type: 'feed', at: 100, _dirty: true },
    { id: 'e2', type: 'diaper', at: 200, _dirty: true },
  ] });
  assert.equal(a.events.length, 2, 'A deveria ver os 2 que empurrou');
  const b = await applySync(db, { familyKey: FAM, since: 0, events: [] });
  assert.equal(b.events.length, 2, 'B deveria puxar os 2 eventos de A');
  assert.ok(b.events.every((e) => !e.data._dirty), 'não deve vazar _dirty para o banco');
});

await teste('cursor só traz o que é novo (sem reenviar tudo)', async () => {
  const db = fakeDb();
  const a1 = await applySync(db, { familyKey: FAM, since: 0, events: [{ id: 'e1', type: 'feed', at: 1 }] });
  const b1 = await applySync(db, { familyKey: FAM, since: 0, events: [] }); // B pega e1, cursor = b1.now
  await applySync(db, { familyKey: FAM, since: a1.now, events: [{ id: 'e2', type: 'burp', at: 2 }] }); // A empurra e2
  const b2 = await applySync(db, { familyKey: FAM, since: b1.now, events: [] });
  assert.equal(b2.events.length, 1, 'B só deveria receber o evento novo (e2)');
  assert.equal(b2.events[0].id, 'e2');
});

await teste('exclusão (tombstone) sincroniza', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, events: [{ id: 'e1', type: 'feed', at: 1 }] });
  const b1 = await applySync(db, { familyKey: FAM, since: 0, events: [] });
  await applySync(db, { familyKey: FAM, since: 0, events: [{ id: 'e1', type: 'feed', at: 1, deleted: true }] });
  const b2 = await applySync(db, { familyKey: FAM, since: b1.now, events: [] });
  assert.equal(b2.events.length, 1);
  assert.equal(b2.events[0].deleted, true, 'B deveria ver e1 como apagado');
});

await teste('perfil sincroniza por última-edição-vence', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, events: [], profile: { data: { baby: { name: 'Teresa' } } } });
  const b = await applySync(db, { familyKey: FAM, since: 0, events: [] });
  assert.equal(b.profile.data.baby.name, 'Teresa');
});

await teste('famílias diferentes não se enxergam', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: 'famA', since: 0, events: [{ id: 'x', type: 'feed', at: 1 }] });
  const outra = await applySync(db, { familyKey: 'famB', since: 0, events: [] });
  assert.equal(outra.events.length, 0, 'famB não pode ver eventos de famA');
});

await teste('sanitizeEvent remove campos locais e exige id', () => {
  assert.equal(sanitizeEvent({ type: 'feed' }), null, 'sem id deve ser rejeitado');
  const s = sanitizeEvent({ id: 'a', type: 'feed', _dirty: true, deleted: true });
  assert.equal(s.deleted, true);
  assert.ok(!('_dirty' in s.data) && !('deleted' in s.data), 'data não pode ter _dirty/deleted');
});

/* --------------------------------------------------- núcleo: em andamento */

await teste('soneca começada em A aparece em B antes de virar evento', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, active: { sleep: { startAt: 1000, by: 'Mamãe' } } });
  const b = await applySync(db, { familyKey: FAM, since: 0 });
  assert.equal(b.active.length, 1);
  assert.equal(b.active[0].kind, 'sleep');
  assert.equal(b.active[0].data.startAt, 1000);
  assert.equal(b.active[0].data.by, 'Mamãe', 'B precisa saber quem começou');
});

await teste('encerrar (null) apaga o andamento no outro celular', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, active: { sleep: { startAt: 1000 } } });
  const b1 = await applySync(db, { familyKey: FAM, since: 0 });
  await applySync(db, { familyKey: FAM, since: b1.now, active: { sleep: null } });
  const b2 = await applySync(db, { familyKey: FAM, since: b1.now });
  assert.equal(b2.active.length, 1);
  assert.equal(b2.active[0].data, null, 'B deveria ver a soneca encerrada');
});

await teste('cada cronômetro tem sua linha: mamada em A não derruba soneca de B', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, active: { sleep: { startAt: 1 } } });
  await applySync(db, { familyKey: FAM, since: 0, active: { feed: { startAt: 2, side: 'E' } } });
  const c = await applySync(db, { familyKey: FAM, since: 0 });
  const porTipo = Object.fromEntries(c.active.map((a) => [a.kind, a.data]));
  assert.ok(porTipo.sleep, 'a soneca deveria continuar de pé');
  assert.ok(porTipo.feed, 'a mamada deveria ter entrado');
});

await teste('cursor não reenvia andamento que não mudou', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: FAM, since: 0, active: { sleep: { startAt: 1 } } });
  const b1 = await applySync(db, { familyKey: FAM, since: 0 });
  const b2 = await applySync(db, { familyKey: FAM, since: b1.now });
  assert.equal(b2.active.length, 0);
});

await teste('andamento de uma família não vaza para outra', async () => {
  const db = fakeDb();
  await applySync(db, { familyKey: 'famA', since: 0, active: { sleep: { startAt: 1 } } });
  const outra = await applySync(db, { familyKey: 'famB', since: 0 });
  assert.equal(outra.active.length, 0);
});

await teste('sanitizeActive separa "não mexi" de "encerrei" e ignora lixo', () => {
  assert.deepEqual(sanitizeActive({ sleep: null }), [{ kind: 'sleep', data: null }], 'null = encerrei');
  assert.deepEqual(sanitizeActive({}), [], 'chave ausente = não mexi');
  assert.deepEqual(sanitizeActive({ xpto: { a: 1 }, feed: 'não é objeto' }), [], 'tipo desconhecido/valor inválido');
  assert.deepEqual(sanitizeActive(null), []);
});

await teste('banco antigo (sem as funções de andamento) não quebra o sync', async () => {
  const db = fakeDb();
  delete db.upsertActive;
  delete db.getActiveSince;
  const r = await applySync(db, { familyKey: FAM, since: 0, events: [{ id: 'e1', type: 'feed', at: 1 }], active: { sleep: { startAt: 1 } } });
  assert.equal(r.events.length, 1);
  assert.deepEqual(r.active, []);
});

/* ------------------------------------------------------------------ cliente */

await teste('mergeIncoming: adiciona novo, substitui limpo, preserva sujo', () => {
  const local = [
    { id: 'a', type: 'feed', at: 1, updatedAt: 1, _dirty: false },
    { id: 'b', type: 'diaper', at: 2, updatedAt: 5, _dirty: true },
  ];
  const incoming = [
    { id: 'a', data: { type: 'feed', at: 1, durationMin: 9 }, deleted: false, updatedMs: 10 },
    { id: 'b', data: { type: 'diaper', at: 2, kind: 'xixi' }, deleted: false, updatedMs: 9 },
    { id: 'c', data: { type: 'burp', at: 3 }, deleted: false, updatedMs: 11 },
  ];
  const n = mergeIncoming(local, incoming);
  assert.equal(n, 2, 'a substituído + c adicionado');
  const a = local.find((e) => e.id === 'a');
  assert.equal(a.durationMin, 9, 'a deveria ter sido atualizado pelo servidor');
  assert.equal(a._dirty, false);
  const b = local.find((e) => e.id === 'b');
  assert.equal(b.kind, undefined, 'b sujo deveria ter sido preservado (não sobrescrito)');
  assert.ok(local.some((e) => e.id === 'c'), 'c deveria ter sido adicionado');
  assert.deepEqual(local.map((e) => e.at), [1, 2, 3], 'deve ficar ordenado por at');
});

await teste('collectDirty pega só os pendentes e sem _dirty no payload', () => {
  const st = { events: [
    { id: 'a', type: 'feed', at: 1, _dirty: true },
    { id: 'b', type: 'diaper', at: 2, _dirty: false },
  ] };
  const d = collectDirty(st);
  assert.equal(d.length, 1);
  assert.equal(d[0].id, 'a');
  assert.ok(!('_dirty' in d[0]), 'não deve enviar _dirty');
});

await teste('collectActive só empurra o cronômetro que mudou aqui', () => {
  state.activeFeed = null; state.activeSleep = null; state.activeBurp = null;
  // Nada nunca sincronizou e nada está rodando: não há o que dizer ao servidor.
  assert.deepEqual(collectActive(), {}, 'celular parado não manda "não tem nada rodando"');
  assert.equal(ativoPendente('sleep'), false);

  toggleSleep(); // começou uma soneca aqui
  const payload = collectActive();
  assert.ok(payload.sleep && payload.sleep.startAt, 'a soneca precisa ser empurrada');
  assert.ok(!('feed' in payload), 'a mamada, que ninguém tocou, fica de fora');
});

await teste('applyRemoteActive liga e desliga o cronômetro vindo do outro celular', () => {
  state.activeSleep = null;
  assert.equal(applyRemoteActive('sleep', { startAt: 123, by: 'Papai' }), true);
  assert.equal(state.activeSleep.startAt, 123);
  assert.equal(activeTimers().sleep.by, 'Papai');
  assert.equal(applyRemoteActive('sleep', { startAt: 123, by: 'Papai' }), false, 'mesmo valor não é mudança');
  assert.equal(applyRemoteActive('sleep', null), true, 'o outro encerrou');
  assert.equal(state.activeSleep, null);
  assert.equal(applyRemoteActive('xpto', { startAt: 1 }), false, 'tipo desconhecido é ignorado');
});

await teste('ciclo real: corrigir o início chega ao servidor e nada é reenviado à toa', async () => {
  // Um "celular" de verdade: o syncOnce do app falando com o applySync do
  // servidor por um fetch de mentira, que guarda tudo o que foi empurrado.
  const db = fakeDb();
  const enviados = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    enviados.push(body);
    const out = await applySync(db, { familyKey: FAM, since: body.since, events: body.events, profile: body.profile, active: body.active });
    return { ok: true, json: async () => out };
  };

  try {
    state.events = [];
    state.activeFeed = null; state.activeSleep = null; state.activeBurp = null;
    await enable('codigo-de-teste');

    toggleSleep();                       // A começa a soneca
    await syncOnce();
    const inicio = state.activeSleep.startAt;
    assert.deepEqual(enviados.at(-1).active, { sleep: { startAt: inicio, by: '' } }, 'a soneca deveria ter sido empurrada');

    await syncOnce();                    // nada mudou desde então
    assert.equal(enviados.at(-1).active, null, 'não pode ficar reempurrando a mesma soneca a cada ciclo');

    const novoInicio = setOngoingStart('sleep', inicio - 2 * MS_MIN); // antecipa 2 min
    await syncOnce();
    assert.equal(enviados.at(-1).active.sleep.startAt, novoInicio, 'a correção do início precisa subir');

    // É isto que o outro celular puxaria agora:
    const outroCelular = await applySync(db, { familyKey: FAM, since: 0 });
    const soneca = outroCelular.active.find((a) => a.kind === 'sleep');
    assert.equal(soneca.data.startAt, novoInicio, 'B veria o início já corrigido');

    toggleSleep();                       // A encerra: vira evento e apaga o andamento
    await syncOnce();
    assert.equal(enviados.at(-1).active.sleep, null, 'encerrar precisa apagar o andamento no outro celular');
    const depois = await applySync(db, { familyKey: FAM, since: 0 });
    assert.equal(depois.active.find((a) => a.kind === 'sleep').data, null);
    assert.equal(depois.events.filter((e) => e.data.type === 'sleep').length, 1, 'e virar um registro de sono');
  } finally {
    disable();
    globalThis.fetch = fetchOriginal;
    state.events = [];
    state.activeSleep = null;
  }
});

await teste('mexer no cronômetro vai quase sem espera; digitação nos ajustes não', () => {
  state.activeFeed = null; state.activeSleep = null; state.activeBurp = null;
  assert.equal(atrasoDoPush(), ATRASO_PUSH.normal, 'sem cronômetro pendente, mantém o debounce');
  toggleSleep();
  assert.equal(atrasoDoPush(), ATRASO_PUSH.andamento, 'começar a soneca não pode esperar 1,5s');
  state.activeSleep = null;
});

await teste('o sync acelera enquanto tem cronômetro rodando', () => {
  state.activeFeed = null; state.activeSleep = null; state.activeBurp = null;
  state.events = [];
  assert.equal(intervaloAtual(), INTERVALO.normal);
  startFeed('E');
  assert.equal(intervaloAtual(), INTERVALO.andamento, 'mamando: o outro celular precisa ver agora');
  state.activeFeed = null;
  assert.equal(intervaloAtual(), INTERVALO.normal);
});

await teste('hashObj muda quando o objeto muda', () => {
  assert.notEqual(hashObj({ a: 1 }), hashObj({ a: 2 }));
  assert.equal(hashObj({ a: 1 }), hashObj({ a: 1 }));
});

if (falhas) { console.error(`\n${falhas} teste(s) falharam.`); process.exit(1); }
console.log('\nOK — sincronização (núcleo + cliente) passou.');
