/**
 * Testes da lógica de sono (idade -> janela, próxima soneca, recomendação por
 * 24h) e da procedência das tabelas por idade. Sem navegador nem rede.
 *
 *   node tests/sleep.test.mjs
 */
import assert from 'node:assert';
import {
  state, ageDays, wakeWindow, recommendedSleepH, nextNap, addEvent,
  sleepMinutesInDay, sleepSegmentsInDay, WAKE_WINDOWS, SLEEP_REC,
} from '../assets/js/store.js';

let falhas = 0;
function teste(nome, fn) {
  try { fn(); console.log(`  ok  ${nome}`); }
  catch (err) { falhas += 1; console.error(`FALHOU ${nome}\n       ${err.message}`); }
}
const dias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

teste('ageDays: null sem data, número com data', () => {
  state.baby.birth = '';
  assert.equal(ageDays(), null);
  state.baby.birth = dias(10);
  assert.equal(ageDays(), 10);
});

teste('wakeWindow: recém-nascido tem janela curta; bebê maior tem janela longa', () => {
  state.baby.birth = dias(10); // ~10 dias
  const rn = wakeWindow();
  assert.deepEqual([rn.min, rn.max], [40, 60]);
  state.baby.birth = dias(150); // ~5 meses
  const maior = wakeWindow();
  assert.ok(maior.min >= 120 && maior.max >= 150, `janela de 5 meses deveria ser longa: ${JSON.stringify(maior)}`);
});

teste('wakeWindow sem data assume recém-nascido (não quebra)', () => {
  state.baby.birth = '';
  const w = wakeWindow();
  assert.ok(w && w.min > 0, 'deveria devolver uma janela padrão');
});

teste('recommendedSleepH: recém-nascido 14–17h', () => {
  state.baby.birth = dias(10);
  const r = recommendedSleepH();
  assert.deepEqual([r.min, r.max], [14, 17]);
});

teste('nextNap: sem sono registrado -> null', () => {
  state.baby.birth = dias(10);
  state.events = [];
  state.activeSleep = null;
  assert.equal(nextNap(), null);
});

teste('nextNap: calcula janela a partir do último acordar', () => {
  state.baby.birth = dias(10);
  state.events = [];
  state.activeSleep = null;
  const acordou = Date.now() - 30 * 60000; // acordou há 30 min
  addEvent({ type: 'sleep', at: acordou - 60 * 60000, endAt: acordou });
  const nap = nextNap();
  assert.ok(nap, 'deveria haver próxima soneca');
  assert.equal(nap.wake, acordou);
  // janela recém-nascido 40–60 min após acordar
  assert.equal(Math.round((nap.start - acordou) / 60000), 40);
  assert.equal(Math.round((nap.end - acordou) / 60000), 60);
});

teste('nextNap: null enquanto está dormindo', () => {
  state.baby.birth = dias(10);
  state.activeSleep = { startAt: Date.now() };
  assert.equal(nextNap(), null);
  state.activeSleep = null;
});

teste('sono que cruza a meia-noite divide os minutos entre os dois dias', () => {
  const d15 = new Date(2026, 0, 15, 0, 0, 0, 0);         // meia-noite local do dia 15
  const inicioSono = new Date(2026, 0, 15, 23, 0, 0, 0);  // 23:00 do dia 15
  const fimSono = new Date(2026, 0, 16, 1, 0, 0, 0);      // 01:00 do dia 16
  state.events = [{ type: 'sleep', at: inicioSono.getTime(), endAt: fimSono.getTime() }];
  // Dia 15 fica só com 1h (23:00–00:00); dia 16 com 1h (00:00–01:00).
  assert.equal(sleepMinutesInDay(d15), 60, 'dia 15 deveria contar só a parte antes da meia-noite');
  assert.equal(sleepMinutesInDay(new Date(2026, 0, 16, 12, 0, 0)), 60, 'dia 16 deveria contar a parte depois da meia-noite');
  // e cada dia enxerga o segmento recortado (não o sono inteiro)
  const seg15 = sleepSegmentsInDay(d15);
  assert.equal(seg15.length, 1);
  assert.equal(seg15[0].endAt, d15.getTime() + 24 * 3600000, 'o segmento do dia 15 termina na meia-noite');
  state.events = [];
});

/* --------------------------------------------------------------- procedência das tabelas
 * SLEEP_REC tem que bater com a diretriz da AASM 2016 (0–3 meses vem da NSF
 * 2015, porque a AASM não recomenda abaixo de 4 meses). WAKE_WINDOWS não tem
 * fonte oficial — "wake window" não é conceito de medicina do sono —, então o
 * que dá para travar é o invariante: a janela de cada faixa implica um número
 * de períodos de sono por 24h, e esse número tem que seguir a curva de
 * consolidação observada por Galland 2012 (3,1 sonecas aos 0–5 meses; 1,2 aos
 * 12 meses). Ver o bloco de comentário em store.js.
 */
const ANOS = (n) => Math.round(n * 365.25);

teste('SLEEP_REC segue a AASM 2016 em cada faixa etária', () => {
  const rec = (dias) => { state.baby.birth = ''; const d = dias; return SLEEP_REC.find((w) => d <= w.d); };
  const faixa = (r) => [r.min, r.max];
  assert.deepEqual(faixa(rec(30)),       [14, 17], '1 mês: NSF 14–17h');
  assert.deepEqual(faixa(rec(120)),      [12, 16], '4 meses: AASM 12–16h');
  assert.deepEqual(faixa(rec(365)),      [12, 16], '12 meses ainda é a faixa de lactente');
  assert.deepEqual(faixa(rec(ANOS(2))),  [11, 14], '2 anos: AASM 11–14h (não 10–13)');
  assert.deepEqual(faixa(rec(ANOS(3))),  [10, 13], '3 anos: AASM 10–13h');
  assert.deepEqual(faixa(rec(ANOS(5))),  [10, 13], '5 anos ainda é 10–13h (não 9–12)');
  assert.deepEqual(faixa(rec(ANOS(6))),  [9, 12],  '6 anos: AASM 9–12h');
  assert.deepEqual(faixa(rec(ANOS(14))), [8, 10],  '14 anos: AASM 8–10h');
});

teste('as duas tabelas são monotônicas: quanto mais velho, mais janela e menos sono', () => {
  for (let i = 1; i < WAKE_WINDOWS.length; i += 1) {
    assert.ok(WAKE_WINDOWS[i].d > WAKE_WINDOWS[i - 1].d, `faixa ${i}: limite de idade fora de ordem`);
    assert.ok(WAKE_WINDOWS[i].min >= WAKE_WINDOWS[i - 1].min, `faixa ${i}: janela mínima encolheu com a idade`);
    assert.ok(WAKE_WINDOWS[i].max >= WAKE_WINDOWS[i - 1].max, `faixa ${i}: janela máxima encolheu com a idade`);
  }
  for (let i = 1; i < SLEEP_REC.length; i += 1) {
    assert.ok(SLEEP_REC[i].d > SLEEP_REC[i - 1].d, `SLEEP_REC ${i}: limite de idade fora de ordem`);
    assert.ok(SLEEP_REC[i].max <= SLEEP_REC[i - 1].max, `SLEEP_REC ${i}: sono recomendado cresceu com a idade`);
  }
  WAKE_WINDOWS.forEach((w, i) => assert.ok(w.min < w.max, `faixa ${i}: min deveria ser menor que max`));
  SLEEP_REC.forEach((r, i) => assert.ok(r.min < r.max, `SLEEP_REC ${i}: min deveria ser menor que max`));
});

/** Períodos de sono por 24h que uma faixa de janela implica, dado o sono
 *  recomendado para a mesma idade: (24h − sono) / janela, tudo em minutos. */
function periodosPorDia(faixa) {
  const idade = Math.min(faixa.d, ANOS(2));           // faixa aberta: avalia aos 2 anos
  const rec = SLEEP_REC.find((w) => idade <= w.d);
  const vigilia = (24 - (rec.min + rec.max) / 2) * 60;
  return vigilia / ((faixa.min + faixa.max) / 2);
}

teste('WAKE_WINDOWS: os períodos de sono implicados caem com a idade (consolidação)', () => {
  const p = WAKE_WINDOWS.map(periodosPorDia);
  // Entre faixas vizinhas vale uma folga de 3%: SLEEP_REC é uma função degrau
  // (a AASM corta de 14–17h para 12–16h exatamente aos 4 meses), enquanto o
  // sono real cai de forma contínua. Esse degrau sozinho faz 2–3 meses (5,67)
  // e 3–4 meses (5,71) praticamente empatarem — é artefato da diretriz, não
  // inversão da tabela. Já o salto de DUAS faixas tem que cair de verdade,
  // e é isso que pega uma janela realmente fora de ordem.
  for (let i = 1; i < p.length; i += 1) {
    assert.ok(p[i] <= p[i - 1] * 1.03,
      `faixa ${i}: implica ${p[i].toFixed(2)} períodos/24h, acima dos ${p[i - 1].toFixed(2)} da faixa anterior`);
  }
  for (let i = 2; i < p.length; i += 1) {
    assert.ok(p[i] < p[i - 2],
      `faixa ${i}: ${p[i].toFixed(2)} períodos/24h não caiu em relação aos ${p[i - 2].toFixed(2)} de duas faixas atrás`);
  }
  assert.ok(p[p.length - 1] >= 2,
    `a faixa mais velha implica ${p[p.length - 1].toFixed(1)} períodos/24h — abaixo de 2 não sobra nem uma soneca além da noite`);
  assert.ok(p[0] <= 12, `recém-nascido implica ${p[0].toFixed(1)} períodos/24h — acima de ~12 passa do número de mamadas do dia`);
});

teste('WAKE_WINDOWS: sonecas implicadas batem com os dados de Galland 2012', () => {
  // 4–6 meses: Galland mede 3,1 sonecas diurnas aos 0–5 meses.
  const m6 = periodosPorDia(WAKE_WINDOWS.find((w) => w.d === 180)) - 1;
  assert.ok(m6 >= 2.5 && m6 <= 4, `4–6 meses implica ${m6.toFixed(1)} sonecas; Galland mede ~3,1 aos 0–5 meses`);
  // 9–12 meses: Galland mede 1,2 sonecas aos 12 meses (o intervalo ainda tem 2).
  const m12 = periodosPorDia(WAKE_WINDOWS.find((w) => w.d === 365)) - 1;
  assert.ok(m12 >= 1 && m12 <= 2.5, `9–12 meses implica ${m12.toFixed(1)} sonecas; Galland mede ~1,2 aos 12 meses`);
});

if (falhas) { console.error(`\n${falhas} teste(s) falharam.`); process.exit(1); }
console.log('\nOK — lógica de sono (janelas + soneca) passou.');
