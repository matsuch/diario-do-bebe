/**
 * Guia por fase: cobertura, integridade e linguagem.
 *
 * O risco desta funcionalidade não é o código quebrar — é o CONTEÚDO mentir.
 * Uma faixa de idade sem fase deixa um pai sem guia; um texto escrito como
 * prazo ("seu bebê vai fazer X nesta semana") transforma desenvolvimento em
 * cobrança; uma informação sem fonte não tem como ser conferida depois.
 * Estes testes travam as três coisas.
 */
import {
  FASES, CATEGORIAS, FONTES, SALTOS, URGENTE, HEDGES,
  faseParaIdade, saltoParaIdade, urgenteParaIdade, idadeTexto,
  diasAteProximaFase, fontesDaFase, indiceDaFase,
} from '../assets/js/fases.js';

const falhas = [];
const ok = (cond, msg) => { console.log(`  ${cond ? 'ok ' : 'FALHOU'}  ${msg}`); if (!cond) falhas.push(msg); };

console.log('\ncobertura por idade');

// Nenhum buraco e nenhuma sobreposição: dos 0 dias aos 6 anos, todo dia tem
// exatamente uma fase. É o que garante que a tela nunca fique vazia.
{
  let buracos = 0;
  let duplicadas = 0;
  for (let d = 0; d <= 2200; d += 1) {
    const casam = FASES.filter((f) => d >= f.de && d <= f.ate);
    if (casam.length === 0) buracos += 1;
    if (casam.length > 1) duplicadas += 1;
  }
  ok(buracos === 0, `todo dia de 0 a 2200 tem fase (buracos: ${buracos})`);
  ok(duplicadas === 0, `nenhum dia cai em duas fases (sobreposições: ${duplicadas})`);
}

// As faixas têm que estar em ordem e encostadas uma na outra.
{
  const emOrdem = FASES.every((f, i) => i === 0 || FASES[i - 1].ate + 1 === f.de);
  ok(emOrdem, 'as faixas são contíguas e estão em ordem crescente');
  ok(FASES[0].de === 0, 'a primeira fase começa no dia 0');
  ok(FASES[FASES.length - 1].ate === Infinity, 'a última fase não tem fim (ninguém fica sem guia)');
}

// Granularidade pedida: semana a semana nas primeiras 8 semanas.
for (const [dia, titulo] of [
  [0, '1ª semana'], [6, '1ª semana'], [7, '2ª semana'], [13, '2ª semana'],
  [14, '3ª semana'], [18, '3ª semana'], [21, '4ª semana'], [28, '5ª semana'],
  [35, '6ª semana'], [42, '7ª semana'], [49, '8ª semana'], [55, '8ª semana'],
]) {
  ok(faseParaIdade(dia).titulo === titulo, `dia ${dia} cai em "${titulo}"`);
}

// Depois das 8 semanas o intervalo abre, como combinado.
ok(faseParaIdade(56).unidade !== 'semana', 'a partir do dia 56 a fase deixa de ser semanal');
ok(faseParaIdade(250).unidade === 'faixa', 'perto dos 8 meses a fase já cobre uma faixa de meses');
{
  // Granularidade decrescente: quanto mais velho o bebê, mais larga a fase.
  const largura = (d) => { const f = faseParaIdade(d); return f.ate - f.de + 1; };
  const cresce = largura(3) <= largura(70) && largura(70) <= largura(250) && largura(250) <= largura(600);
  ok(cresce, `a fase fica mais larga com a idade (${largura(3)} → ${largura(70)} → ${largura(250)} → ${largura(600)} dias)`);
}

// Idade inválida não pode derrubar a tela.
for (const v of [null, undefined, -1, NaN, 'oito']) {
  ok(faseParaIdade(v) === null, `idade inválida (${String(v)}) devolve null em vez de quebrar`);
}

console.log('\nintegridade do conteúdo');

const CHAVES = CATEGORIAS.map((c) => c.id);
FASES.forEach((fase) => {
  const faltando = CHAVES.filter((c) => !(fase.blocos[c] || []).length);
  ok(faltando.length === 0, `${fase.id}: tem conteúdo nas 6 categorias${faltando.length ? ` (falta ${faltando.join(', ')})` : ''}`);
});

FASES.forEach((fase) => {
  ok(fase.resumo && fase.chip && fase.titulo, `${fase.id}: tem título, chip da régua e resumo`);
  ok((fase.sentindo || []).length >= 1, `${fase.id}: tem ao menos um "o que seu bebê pode estar sentindo"`);
  ok((fase.fazer || []).length >= 3, `${fase.id}: tem ao menos três sugestões de "o que você pode fazer"`);
  ok((fase.atencao || []).length >= 2, `${fase.id}: tem ao menos dois "converse com o pediatra se"`);
});

// Toda informação carrega a fonte em que foi baseada, e a sigla existe.
{
  let semFonte = 0;
  let siglaInvalida = 0;
  FASES.forEach((fase) => {
    const itens = [...Object.values(fase.blocos).flat(), ...fase.atencao];
    itens.forEach((it) => {
      if (!it.fonte) semFonte += 1;
      else if (!FONTES[it.fonte]) siglaInvalida += 1;
    });
  });
  ok(semFonte === 0, `toda informação tem fonte registrada (sem fonte: ${semFonte})`);
  ok(siglaInvalida === 0, `toda sigla de fonte existe em FONTES (inválidas: ${siglaInvalida})`);
  ok(URGENTE.itens.every((it) => FONTES[it.fonte]), 'os sinais de urgência também têm fonte válida');
}

// Sinal de alerta não se inventa: só pode vir de fonte médica reconhecida.
{
  const MEDICAS = ['AAP', 'NHS', 'CDC', 'AASM', 'SONOSEG'];
  const fora = [];
  FASES.forEach((fase) => fase.atencao.forEach((it) => {
    if (!MEDICAS.includes(it.fonte)) fora.push(`${fase.id}: ${it.fonte}`);
  }));
  ok(fora.length === 0, `todo "converse com o pediatra se" vem de fonte médica (fora: ${fora.join(', ') || '—'})`);
  ok(URGENTE.itens.every((it) => MEDICAS.includes(it.fonte)), 'todo sinal de urgência vem de fonte médica');
  // O Wonder Weeks é referência de PRODUTO. Se um dia ele virar fonte de um
  // fato de saúde, este teste avisa.
  const usaWW = FASES.some((fase) => [...Object.values(fase.blocos).flat(), ...fase.atencao]
    .some((it) => it.fonte === 'WW'));
  ok(!usaWW, 'The Wonder Weeks não é usado como autoridade médica em nenhuma fase');
}

console.log('\nlinguagem: janela, não prazo');

// Desenvolvimento não é checklist. Frases que prometem o que o bebê "vai"
// fazer numa data não podem entrar no conteúdo.
{
  const PROIBIDO = [
    /seu bebê vai\b/i,
    /nesta semana ele (vai|deve)\b/i,
    /obrigatoriamente/i,
    /\bterá\b/i,
    /precisa (já )?estar fazendo/i,
  ];
  const achados = [];
  FASES.forEach((fase) => {
    const textos = [
      fase.resumo,
      ...fase.sentindo.flatMap((s) => [s.titulo, s.texto]),
      ...Object.values(fase.blocos).flat().map((it) => it.texto),
      ...fase.fazer,
      ...fase.atencao.map((it) => it.texto),
    ];
    textos.forEach((t) => PROIBIDO.forEach((re) => { if (re.test(t)) achados.push(`${fase.id}: "${t.slice(0, 48)}…"`); }));
  });
  ok(achados.length === 0, `nenhuma frase promete marco em data fixa (${achados.join(' | ') || 'nenhuma'})`);
}

// E o contrário: o bloco que fala de habilidade aparecendo precisa mesmo
// hedgear. Só ele — nos outros blocos cabe frase afirmativa que não é marco
// (ver o comentário de HEDGES em fases.js).
{
  const hedgeia = (texto) => HEDGES.some((h) => texto.toLowerCase().includes(h));
  const sem = [];
  FASES.forEach((fase) => fase.blocos.desenvolvimento.forEach((it) => {
    if (!hedgeia(it.texto)) sem.push(`${fase.id}: "${it.texto.slice(0, 44)}…"`);
  }));
  ok(sem.length === 0, `todo item de desenvolvimento usa uma marca de janela (sem: ${sem.join(' | ') || 'nenhum'})`);
  ok(HEDGES.length >= 10, 'o vocabulário de janela tem variedade suficiente para não engessar a escrita');
}

console.log('\nsaltos de desenvolvimento');

{
  const emOrdem = SALTOS.every((s, i) => s.de <= s.ate && (i === 0 || SALTOS[i - 1].ate < s.de));
  ok(emOrdem, 'as janelas de salto não se sobrepõem e estão em ordem');
  ok(SALTOS.every((s) => s.perceber.length >= 3 && s.amadurecendo && s.semanas),
    'todo salto tem "o que você pode perceber", "o que pode estar acontecendo" e a janela em semanas');
  ok(saltoParaIdade(35) && saltoParaIdade(35).id === 'salto-1', 'a 5ª semana cai na primeira janela de salto');
  ok(saltoParaIdade(72) === null, 'entre duas janelas não há salto ativo (e a tela não mostra o card)');
  ok(saltoParaIdade(null) === null, 'sem idade não há salto');
}

console.log('\nsinais de urgência e idade em texto');

ok(urgenteParaIdade(10) === URGENTE, 'bebê de 10 dias vê a rede de segurança de urgência');
ok(urgenteParaIdade(URGENTE.ate) === URGENTE, `no limite (${URGENTE.ate} dias) ainda aparece`);
ok(urgenteParaIdade(URGENTE.ate + 1) === null, 'depois de ~3 meses ela some (a orientação era para bebê pequeno)');
ok(urgenteParaIdade(null) === null, 'sem idade não mostra urgência');

for (const [dias, esperado] of [
  [0, 'recém-nascido'], [1, '1 dia'], [13, '13 dias'], [14, '2 semanas'],
  [18, '2 semanas'], [55, '7 semanas'], [60, '1 mês'], [200, '6 meses'],
  [365, '11 meses'], [366, '1 ano'], [400, '1 ano e 1 mês'], [730, '1 ano e 11 meses'], [1096, '3 anos'],
]) {
  ok(idadeTexto(dias) === esperado, `${dias} dias vira "${esperado}" (deu "${idadeTexto(dias)}")`);
}

console.log('\nhelpers da tela');

ok(diasAteProximaFase(0) === 7, 'no 1º dia faltam 7 dias para a 2ª semana');
ok(diasAteProximaFase(6) === 1, 'no 7º dia de vida a fase muda amanhã');
ok(diasAteProximaFase(5000) === null, 'na última fase não há próxima fase');
ok(indiceDaFase('sem-1') === 0 && indiceDaFase('nao-existe') === -1, 'indiceDaFase acha a fase e devolve -1 quando não existe');
ok(fontesDaFase(faseParaIdade(10)).length >= 2, 'a fase lista as fontes que usou');
ok(fontesDaFase(null).length === 0, 'sem fase, nenhuma fonte');

console.log(falhas.length ? `\n${falhas.length} FALHA(S)\n` : '\ntudo certo\n');
process.exit(falhas.length ? 1 : 0);
