/**
 * Testes do núcleo da agenda (o que decide o que está vencendo AGORA).
 *   node tests/agenda-core.test.mjs
 */
import assert from 'node:assert';
import {
  nextFeedAt, feedTargetAt, recentFeedIntervalMin, dueAlertAt, dueReminders, localTimeToday, normalizeMed, MS_MIN, MS_HOUR,
} from '../lib/agenda-core.mjs';

let falhas = 0;
function teste(nome, fn) {
  try { fn(); console.log(`  ok  ${nome}`); }
  catch (err) { falhas += 1; console.error(`FALHOU ${nome}\n       ${err.stack || err.message}`); }
}

const perfilBase = () => ({
  baby: { name: 'Teresa' },
  settings: { feedIntervalMin: 180, ntfy: { enabled: true, topic: 't' } },
  // Recorrente a cada 8h ancorado em 02:00; às 10:00 vence uma ocorrência.
  meds: [{ id: 'med-x', name: 'Paracetamol', category: 'remedio', startAt: 2 * MS_HOUR, repeat: { every: 8, unit: 'hour' }, active: true }],
});

teste('nextFeedAt = fim da última mamada + intervalo', () => {
  const now = 10 * MS_HOUR;
  const evs = [{ type: 'feed', at: now - 200 * MS_MIN, endAt: now - 180 * MS_MIN }];
  assert.equal(nextFeedAt(perfilBase(), evs), now); // -180min + 180min = now
});

teste('dueAlertAt: recorrente devolve a ocorrência vencendo agora', () => {
  const med = { startAt: 2 * MS_HOUR, repeat: { every: 8, unit: 'hour' }, active: true };
  assert.equal(dueAlertAt(med, 10 * MS_HOUR), 10 * MS_HOUR, 'ocorrência 02:00+8h = 10:00');
  assert.equal(dueAlertAt(med, 12 * MS_HOUR), 10 * MS_HOUR, 'ainda é a de 10:00 até chegar 18:00');
  assert.equal(dueAlertAt(med, 1 * MS_HOUR), null, 'antes da 1ª ocorrência não vence nada');
});

teste('dueAlertAt: data marcada (sem repetição) só vence depois da hora', () => {
  const med = { startAt: 10 * MS_HOUR, repeat: null, active: true };
  assert.equal(dueAlertAt(med, 9 * MS_HOUR), null, 'antes da hora, nada');
  assert.equal(dueAlertAt(med, 10 * MS_HOUR), 10 * MS_HOUR, 'na hora, vence');
});

teste('localTimeToday: 14:00 no fuso -180 (Brasil) = 17:00 UTC', () => {
  const now = Date.UTC(2026, 0, 15, 17, 0, 0); // 14:00 BRT
  assert.equal(localTimeToday(now, -180, '14:00'), now);
});

teste('dueReminders: mamada vencida entra', () => {
  const now = 10 * MS_HOUR;
  const evs = [{ type: 'feed', at: now - 200 * MS_MIN, endAt: now - 180 * MS_MIN }];
  const r = dueReminders(perfilBase(), evs, { now });
  assert.ok(r.some((x) => x.kind === 'feed'), 'deveria ter lembrete de mamada');
});

teste('dueReminders: antecipar a mamada 30 min CANCELA o aviso do horário antigo', () => {
  const now = 10 * MS_HOUR;
  // Sem a antecipação, a mamada venceria exatamente agora.
  const antes = dueReminders(perfilBase(), [
    { type: 'feed', at: now - 200 * MS_MIN, endAt: now - 180 * MS_MIN },
  ], { now });
  assert.ok(antes.some((x) => x.kind === 'feed'));

  // Registra uma mamada 30 min atrás (antecipada): próxima passa a ser now+150min.
  const depois = dueReminders(perfilBase(), [
    { type: 'feed', at: now - 200 * MS_MIN, endAt: now - 180 * MS_MIN },
    { type: 'feed', at: now - 40 * MS_MIN, endAt: now - 30 * MS_MIN },
  ], { now });
  assert.ok(!depois.some((x) => x.kind === 'feed'), 'não pode mais avisar mamada: já mamou');
});

teste('dueReminders: remédio vencido entra com a mensagem certa', () => {
  const now = 10 * MS_HOUR;
  const evs = [{ type: 'med', medId: 'med-x', at: now - 8 * MS_HOUR }];
  const r = dueReminders(perfilBase(), evs, { now });
  const med = r.find((x) => x.kind === 'med');
  assert.ok(med, 'deveria ter lembrete de remédio');
  assert.match(med.message, /Paracetamol/);
});

teste('dueReminders: troca em horário fixo entra no horário certo', () => {
  const now = Date.UTC(2026, 0, 15, 17, 0, 0); // 14:00 BRT — está na lista padrão
  const r = dueReminders(perfilBase(), [], { now });
  const troca = r.find((x) => x.kind === 'diaper');
  assert.ok(troca, 'deveria lembrar da troca às 14:00');
  assert.match(troca.key, /^diaper:2026-01-15:14:00$/);
});

teste('dueReminders: nada vencido = lista vazia (fora de horário)', () => {
  const now = Date.UTC(2026, 0, 15, 15, 30, 0); // 12:30 BRT, sem troca fixa, sem mamada
  const perfil = { ...perfilBase(), meds: [] }; // sem alertas para isolar o caso
  const r = dueReminders(perfil, [], { now });
  assert.equal(r.length, 0);
});

teste('dueReminders: janela maxLate ignora avisos muito antigos', () => {
  const now = 10 * MS_HOUR;
  // Mamada venceu 2h atrás (> maxLate padrão de 90 min): não deve disparar.
  const evs = [{ type: 'feed', at: now - 6 * MS_HOUR, endAt: now - 5 * MS_HOUR }];
  const r = dueReminders(perfilBase(), evs, { now });
  assert.ok(!r.some((x) => x.kind === 'feed'), 'aviso velho demais não deve entrar');
});

teste('normalizeMed: converte formato legado (intervalHours) para repeat + startAt', () => {
  const legado = { id: 'med-x', name: 'Cefalexina', active: true, intervalHours: 6 };
  const eventos = [{ type: 'med', medId: 'med-x', at: 5 * MS_HOUR, deleted: false }];
  normalizeMed(legado, eventos);
  assert.deepStrictEqual(legado.repeat, { every: 6, unit: 'hour' });
  assert.equal(legado.startAt, 5 * MS_HOUR, 'startAt deve ser ancorado na última dose');
  assert.equal(legado.category, 'remedio', 'category padrão é remedio');
});

teste('normalizeMed: sem eventos, startAt fica null (não inventa horário)', () => {
  const legado = { id: 'med-y', name: 'Profenid', active: true, intervalHours: 12 };
  normalizeMed(legado, []);
  assert.deepStrictEqual(legado.repeat, { every: 12, unit: 'hour' });
  assert.equal(legado.startAt, null);
});

teste('dueReminders: med no formato legado (intervalHours) dispara corretamente', () => {
  const now = 11 * MS_HOUR;
  const perfil = {
    baby: { name: 'Teresa' },
    settings: { feedIntervalMin: 180, ntfy: { enabled: true, topic: 't' } },
    meds: [{ id: 'med-cefa', name: 'Cefalexina', active: true, intervalHours: 6 }],
  };
  const evs = [{ type: 'med', medId: 'med-cefa', at: 5 * MS_HOUR, deleted: false }];
  const r = dueReminders(perfil, evs, { now });
  const med = r.find((x) => x.kind === 'med');
  assert.ok(med, 'deveria disparar o remédio no formato legado');
  assert.match(med.message, /Cefalexina/);
});

teste('dueReminders: sem diaperTimes não lembra de troca', () => {
  const now = Date.UTC(2026, 0, 15, 17, 0, 0);
  const perfil = perfilBase();
  perfil.settings.reminders = { diaperTimes: [], tzOffsetMin: -180 };
  const r = dueReminders(perfil, [], { now });
  assert.ok(!r.some((x) => x.kind === 'diaper'));
});

// Mamadas a cada 150 min (início→início) ao longo do último dia.
const mamadasRegulares = (now, n = 8, gap = 150) => Array.from({ length: n }, (_, i) => {
  const at = now - (n - i) * gap * MS_MIN;
  return { type: 'feed', at, endAt: at + 20 * MS_MIN };
});

teste('feedTargetAt (média, padrão): início da última + mediana recente', () => {
  const now = 3 * 24 * MS_HOUR;
  const evs = mamadasRegulares(now);
  assert.equal(recentFeedIntervalMin(perfilBase(), evs, { now, periodo: 'dia' }), 150);
  assert.equal(feedTargetAt(perfilBase(), evs, { now }), evs.at(-1).at + 150 * MS_MIN);
});

teste('feedTargetAt (intervalo fixo): fim da última + intervalo configurado', () => {
  const now = 3 * 24 * MS_HOUR;
  const evs = mamadasRegulares(now);
  const p = perfilBase(); p.settings.feedMode = 'intervalo';
  assert.equal(feedTargetAt(p, evs, { now }), evs.at(-1).endAt + 180 * MS_MIN);
});

teste('feedTargetAt (média) sem histórico cai no intervalo fixo', () => {
  const now = 10 * MS_HOUR;
  const evs = [{ type: 'feed', at: now - 200 * MS_MIN, endAt: now - 180 * MS_MIN }];
  assert.equal(feedTargetAt(perfilBase(), evs, { now }), now);
});

teste('dueReminders segue o modo: média avisa antes do intervalo fixo', () => {
  const now = 3 * 24 * MS_HOUR;
  const evs = mamadasRegulares(now);
  // Última mamada começou há 150 min: pela média (150) já venceu; pelo fixo
  // (fim + 180 = daqui a 50 min) ainda não.
  const media = dueReminders(perfilBase(), evs, { now });
  assert.ok(media.some((r) => r.kind === 'feed'), 'modo média deveria avisar');
  const p = perfilBase(); p.settings.feedMode = 'intervalo';
  assert.ok(!dueReminders(p, evs, { now }).some((r) => r.kind === 'feed'), 'modo intervalo não deveria avisar ainda');
});

if (falhas) { console.error(`\n${falhas} teste(s) falharam.`); process.exit(1); }
console.log('\nOK — núcleo da agenda (lembretes vencendo) passou.');
