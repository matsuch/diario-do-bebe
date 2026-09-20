/**
 * Guia por fase: "o que provavelmente está acontecendo com meu bebê agora".
 *
 * Este módulo é só CONTEÚDO + a regra de qual fase vale para uma idade. Não
 * conhece DOM nem localStorage, então roda igual no navegador e no Node (é o
 * que permite tests/fases.test.mjs conferir cobertura e integridade).
 *
 * ------------------------------------------------------------------ fontes
 * Cada informação carrega a sigla da fonte em que foi baseada (campo `fonte`),
 * e FONTES traz o nome completo e o link. Nada aqui é cópia de texto: a
 * redação é nossa, em linguagem de pai e mãe, a partir do que essas fontes
 * publicam. A ordem de prioridade seguida foi:
 *
 *   1. AAP / HealthyChildren.org  — desenvolvimento, pele, choro, sono, mamada
 *   2. NHS                        — sinais de alerta e rotina do recém-nascido
 *   3. CDC "Learn the Signs"      — marcos por idade e "converse com o médico se"
 *   4. Literatura (AASM/NSF)      — horas de sono por 24h (já usada em store.js)
 *   5. BabyCenter / The Wonder Weeks — referência de PRODUTO (como organizar a
 *      informação por idade), nunca de autoridade médica. Ver SALTOS.
 *
 * -------------------------------------------------------------- linguagem
 * Desenvolvimento não é checklist. Toda frase aqui é escrita como janela, não
 * como prazo: "é comum", "alguns bebês", "pode começar", "ao longo desta
 * fase". Se uma frase só faz sentido com "seu bebê vai", ela está errada para
 * este módulo. Os marcos do CDC são o que a MAIORIA dos bebês faz até aquela
 * idade — e é assim que eles entram aqui.
 *
 * ---------------------------------------------------------- idade e futuro
 * As funções recebem a idade em DIAS e nada mais. Hoje quem chama passa a
 * idade cronológica (data de nascimento, em store.ageDays). Se um dia o
 * cadastro guardar data prevista do parto / prematuridade, basta passar a
 * idade corrigida aqui — nenhuma linha de conteúdo muda.
 */

export const FONTES = {
  AAP: {
    nome: 'American Academy of Pediatrics — HealthyChildren.org',
    url: 'https://www.healthychildren.org',
  },
  CDC: {
    nome: 'CDC — Learn the Signs. Act Early. (marcos por idade)',
    url: 'https://www.cdc.gov/act-early/milestones/',
  },
  NHS: {
    nome: 'NHS — Baby / Birth to five (Reino Unido)',
    url: 'https://www.nhs.uk/baby/',
  },
  AASM: {
    nome: 'AASM 2016 (endossada pela AAP) e NSF 2015 — horas de sono por 24h',
    url: 'https://aasm.org/resources/pdf/pediatricsleepdurationconsensus.pdf',
  },
  SONOSEG: {
    nome: 'AAP 2022 — Sleep-Related Infant Deaths (sono seguro), Pediatrics',
    url: 'https://publications.aap.org/pediatrics/article/150/1/e2022057990/188304/',
  },
  WW: {
    nome: 'The Wonder Weeks — referência de produto (organização por semana), não de autoridade médica',
    url: 'https://thewonderweeks.com',
  },
};

/**
 * Vocabulário de janela.
 *
 * O bloco `desenvolvimento` é o único que fala de HABILIDADE APARECENDO — é
 * ele que corre o risco de virar checklist com prazo. Por isso toda frase
 * dele tem que carregar uma destas marcas, e tests/fases.test.mjs recusa
 * conteúdo novo que não use nenhuma: a lista é contrato de escrita, não
 * decoração.
 *
 * Os outros blocos não passam por essa régua de propósito. Neles cabe frase
 * afirmativa que não é marco ("colo não vicia recém-nascido", "quantidade e
 * intervalo são decisão do pediatra") e obrigá-las a hedgear só deixaria o
 * texto mole. O que vale para TODO o conteúdo é a régua oposta, também em
 * teste: nada pode prometer marco em data fixa.
 */
export const HEDGES = [
  'é comum', 'alguns bebês', 'muitos bebês', 'a maioria', 'costuma', 'pode',
  'começa', 'aos poucos', 'fica mais', 'ficam mais', 'são comuns', 'varia',
  'por volta', 'em geral', 'tende', 'janela',
];

/** Atalho para escrever conteúdo sem repetir `{ texto: ..., fonte: ... }`. */
const f = (texto, fonte) => ({ texto, fonte });

export const CATEGORIAS = [
  { id: 'desenvolvimento', emoji: '🌱', rotulo: 'Desenvolvimento', tint: 'tint-leaf' },
  { id: 'sono', emoji: '😴', rotulo: 'Sono', tint: 'tint-sleep' },
  { id: 'comportamento', emoji: '💗', rotulo: 'Comportamento', tint: 'tint-lamp' },
  { id: 'corpo', emoji: '🧸', rotulo: 'Corpo e aparência', tint: 'tint-med' },
  { id: 'alimentacao', emoji: '🍼', rotulo: 'Alimentação', tint: 'tint-lamp' },
  { id: 'sentidos', emoji: '👀', rotulo: 'Sentidos', tint: 'tint-aqua' },
];

/**
 * Sinais que, em bebês pequenos, pedem avaliação no mesmo dia — não é uma
 * lista de diagnóstico, é a rede de segurança do NHS e da AAP para quem está
 * em dúvida às 3 da manhã. Só aparece enquanto o bebê é pequeno (até ~3
 * meses), que é a idade em que essas orientações valem como estão escritas.
 */
export const URGENTE = {
  ate: 90,
  titulo: 'Procure atendimento no mesmo dia se',
  itens: [
    f('Febre: temperatura de 38 °C ou mais em bebê com menos de 3 meses é sempre motivo de avaliação imediata — mesmo que ele pareça bem.', 'NHS'),
    f('O bebê está muito difícil de acordar, molinho demais ou sem interesse nenhum em mamar.', 'NHS'),
    f('As fraldas estão bem mais secas que o normal, ou o xixi praticamente parou.', 'AAP'),
    f('A respiração está rápida, ruidosa, com gemido, ou você vê as costelas afundando a cada respiração.', 'NHS'),
    f('A pele ficou pálida, acinzentada ou azulada, ou apareceram manchinhas que não somem quando você pressiona.', 'NHS'),
    f('A pele ou os olhos ficaram amarelos já nas primeiras 24 horas de vida, ou o amarelo está aumentando em vez de diminuir.', 'NHS'),
  ],
};

/**
 * Períodos de salto de desenvolvimento.
 *
 * ATENÇÃO à honestidade desta seção: as janelas de semana vêm da organização
 * do The Wonder Weeks (referência de produto). O calendário fixo de 10 saltos
 * NÃO é consenso científico — a tentativa de replicação de de Weerth & van
 * Geert (1998) não encontrou o padrão de semanas descrito. Por isso aqui o
 * salto nunca é apresentado como evento médico nem como algo que acontece com
 * todo bebê: é uma lente para os pais entenderem uma fase mais difícil. O que
 * está em "amadurecendo" é descrito a partir de desenvolvimento infantil
 * (AAP/CDC), não do livro.
 */
export const SALTOS = [
  {
    id: 'salto-1', de: 28, ate: 48, semanas: '4ª à 6ª semana',
    titulo: 'Mais mundo chegando de uma vez',
    amadurecendo: 'Os sentidos estão ficando mais organizados: rostos, vozes e luz '
      + 'começam a fazer mais sentido juntos. É por volta daqui que muitos bebês dão o '
      + 'primeiro sorriso de resposta — e também quando o choro costuma chegar no ponto '
      + 'mais alto do primeiro ano.',
    perceber: [
      'Choro mais longo ou mais difícil de consolar, muitas vezes no fim da tarde',
      'Mais vontade de colo e de contato pele a pele',
      'Sono mais picado do que vinha sendo',
      'Períodos curtos em que fica olhando muito fixo para o seu rosto',
    ],
  },
  {
    id: 'salto-2', de: 49, ate: 69, semanas: '7ª à 10ª semana',
    titulo: 'Reparando em padrões',
    amadurecendo: 'O bebê começa a reparar em repetições: o desenho do seu rosto, a '
      + 'própria mão que passa na frente dos olhos, o som que sempre vem antes da mamada. '
      + 'Muitos passam a seguir objetos com os olhos e a responder com sons que não são choro.',
    perceber: [
      'Fica olhando as próprias mãos como se fossem novidade',
      'Mais irritação no fim do dia',
      'Mamadas mais curtas e distraídas, ou mais frequentes',
      'Começa a "conversar" com sons de vogal',
    ],
  },
  {
    id: 'salto-3', de: 77, ate: 97, semanas: '11ª à 14ª semana',
    titulo: 'Movimentos mais suaves',
    amadurecendo: 'Os movimentos vão perdendo o jeito de solavanco: a cabeça fica mais '
      + 'firme, a mão chega mais perto do que ela quer pegar e a voz ganha variação. É '
      + 'comum o bebê descobrir que consegue repetir um som de propósito.',
    perceber: [
      'Mais choramingo sem causa aparente',
      'Mudança no jeito de dormir — mais despertares ou sonecas mais curtas',
      'Muito interesse por vozes, música e pelo próprio balbucio',
      'Mãos que já vão em direção ao brinquedo em vez de só esbarrar nele',
    ],
  },
  {
    id: 'salto-4', de: 98, ate: 140, semanas: '14ª à 20ª semana',
    titulo: 'Entendendo que uma coisa leva a outra',
    amadurecendo: 'O bebê começa a perceber sequências curtas: se eu empurro, cai; se eu '
      + 'chamo, alguém vem. Junto disso costumam aparecer o rolar, o pegar com intenção e '
      + 'a gargalhada. É a fase em que muita gente sente o sono "desandar" — e isso também '
      + 'é reorganização, não retrocesso.',
    perceber: [
      'Despertares noturnos que não existiam antes',
      'Mais apego a você e estranhamento de colo desconhecido',
      'Bebê testando a própria voz alto, inclusive de madrugada',
      'Muita mão na boca e vontade de levar tudo até ela',
    ],
  },
  {
    id: 'salto-5', de: 154, ate: 189, semanas: '22ª à 27ª semana',
    titulo: 'Percebendo distâncias',
    amadurecendo: 'Sentar, alcançar e virar o corpo abrem uma noção nova: existe "perto" e '
      + 'existe "longe". Muitos bebês começam a estranhar quando você sai do campo de visão, '
      + 'justamente porque agora entendem melhor que você foi para outro lugar.',
    perceber: [
      'Protesta quando você sai do quarto',
      'Mais interesse em ficar sentado e alcançar coisas',
      'Sono mais sensível a mudanças de rotina',
      'Balbucio com sílabas repetidas',
    ],
  },
  {
    id: 'salto-6', de: 231, ate: 266, semanas: '33ª à 38ª semana',
    titulo: 'Separando as coisas em grupos',
    amadurecendo: 'O bebê começa a tratar coisas parecidas como se fossem da mesma família: '
      + 'cachorro é diferente de bola, e pessoa conhecida é diferente de estranho. É comum '
      + 'nesta faixa aparecer o estranhamento de desconhecidos e a ansiedade quando você sai.',
    perceber: [
      'Estranha visitas e colo de quem vê pouco',
      'Chora quando você sai do lado, mesmo por pouco tempo',
      'Repete sons como "mamama" e "bababa"',
      'Sono noturno mais interrompido',
    ],
  },
  {
    id: 'salto-7', de: 287, ate: 329, semanas: '41ª à 47ª semana',
    titulo: 'Fazendo as coisas na ordem certa',
    amadurecendo: 'O bebê começa a encaixar passos numa ordem: colocar dentro, empilhar, '
      + 'apontar para pedir, dar tchau quando alguém sai. Muita energia vai para se mover — '
      + 'engatinhar, se apoiar para levantar — e isso costuma cobrar do sono.',
    perceber: [
      'Quer treinar de pé até na hora de dormir',
      'Mais frustração quando algo não sai como ele quis',
      'Começa a apontar, dar e pedir objetos',
      'Come com mais ou menos apetite de um dia para o outro',
    ],
  },
  {
    id: 'salto-8', de: 350, ate: 392, semanas: '50ª à 56ª semana',
    titulo: 'Querendo fazer do próprio jeito',
    amadurecendo: 'Aparece a vontade de decidir: qual roupa, qual comida, quem pega no colo. '
      + 'O bebê já entende muito mais do que consegue falar, e a distância entre as duas '
      + 'coisas gera frustração.',
    perceber: [
      'Mais birra e choro de raiva',
      'Grande apego a um adulto específico',
      'Imita tarefas da casa',
      'Recusa comida que aceitava bem',
    ],
  },
];

/* ====================================================================== fases
 * `de` e `ate` são idade em DIAS, inclusivos nas duas pontas, sem buracos e
 * sem sobreposição — tests/fases.test.mjs trava isso. A última fase vai até o
 * infinito para que nenhuma idade fique sem guia.
 */

const SEMANA_1 = {
  id: 'sem-1', de: 0, ate: 6, unidade: 'semana', titulo: '1ª semana',
  chip: '1ª sem',
  resumo: 'A primeira semana é de recuperação para os dois lados. O bebê está aprendendo a '
    + 'respirar, mamar e se aquecer fora da barriga, e quase tudo que ele faz ainda é reflexo.',
  sentindo: [
    {
      titulo: 'Tudo é muito novo',
      texto: 'Até agora era escuro, morno e com o seu barulho o tempo todo. Luz, ar e roupa '
        + 'são sensações novas. Estar enrolado, no colo e pele a pele costuma ser o que mais acalma.',
    },
    {
      titulo: 'Fome que chega de repente',
      texto: 'O estômago é pequeno e esvazia rápido, então a fome aparece muitas vezes ao dia '
        + 'e sem aviso longo. Procurar o peito com a boca, levar a mão à boca e ficar inquieto '
        + 'costumam vir antes do choro.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Nesta fase é comum que quase tudo o que o bebê faz seja reflexo: sugar, agarrar o dedo que encosta na mão, virar a cabeça quando algo toca a bochecha.', 'NHS'),
      f('É comum o bebê levantar a cabeça por alguns segundos quando está de barriga para baixo — e deixar cair logo depois.', 'NHS'),
      f('Braços e pernas se mexem bastante, meio sem direção, e costumam se mexer de forma parecida dos dois lados.', 'NHS'),
    ],
    sono: [
      f('Recém-nascidos dormem muitas horas somadas ao longo das 24h, mas em pedaços curtos, dia e noite embaralhados.', 'AASM'),
      f('É comum o bebê fazer barulho, se mexer e até "resmungar" dormindo — isso não quer dizer que acordou.', 'NHS'),
      f('Pausas curtas na respiração de poucos segundos, alternando com respiração rápida, são comuns nas primeiras semanas.', 'NHS'),
      f('Sono seguro desde o primeiro dia: de barriga para cima, em superfície firme e plana, sem travesseiro, protetor ou cobertor solto, no quarto dos pais mas na própria cama.', 'SONOSEG'),
    ],
    comportamento: [
      f('Chorar é o jeito que ele tem de pedir qualquer coisa — fome, colo, fralda, sono, frio ou excesso de barulho.', 'AAP'),
      f('Muitos bebês passam quase todo o tempo acordado mamando ou sendo trocados. Períodos de alerta calmo são curtos.', 'AAP'),
      f('Colo não vicia recém-nascido: nesta fase, responder rápido ao choro é o que ensina o bebê que o mundo é previsível.', 'AAP'),
    ],
    corpo: [
      f('É esperado perder um pouco de peso nos primeiros dias. A maioria volta ao peso de nascimento por volta das 2 semanas.', 'AAP'),
      f('O coto do cordão costuma secar e cair entre o 5º e o 15º dia. Mantê-lo seco e arejado é o suficiente.', 'NHS'),
      f('A cabeça pode estar amassada ou comprida pelo parto e vai arredondando nas primeiras semanas.', 'AAP'),
      f('Descascar a pele, principalmente mãos e pés, é normal e não precisa de tratamento.', 'AAP'),
      f('Cerca de 9 em cada 10 bebês ficam um pouco amarelados a partir do 2º ou 3º dia; costuma melhorar sozinho até umas 2 semanas.', 'NHS'),
    ],
    alimentacao: [
      f('Nesta fase é comum mamar de 8 a 12 vezes em 24 horas, sem horário fixo.', 'AAP'),
      f('Vale oferecer antes do choro: boca procurando, mão na boca e inquietação são sinais mais cedo de fome.', 'AAP'),
      f('O xixi acompanha a descida do leite: costuma ser pouco nos primeiros dias e aumentar bastante a partir do 5º.', 'AAP'),
      f('Quantidade, intervalo e qualquer complemento são decisão do pediatra ou do profissional que acompanha a amamentação.', 'AAP'),
    ],
    sentidos: [
      f('O foco é curto: enxerga melhor o que está a uns 20 a 30 cm — mais ou menos a distância do seu rosto quando ele mama.', 'AAP'),
      f('Já reconhece a sua voz e costuma se acalmar ao ouvi-la.', 'NHS'),
      f('Os olhos ainda podem vagar ou desalinhar de vez em quando; isso costuma sumir por volta dos 2 ou 3 meses.', 'AAP'),
    ],
  },
  fazer: [
    'Pele a pele sempre que der — ajuda na mamada, no sono e na temperatura.',
    'Falar e cantar baixinho durante a troca e a mamada; a voz conhecida acalma.',
    'Deixar o quarto com pouca luz e pouco barulho nas horas mais difíceis.',
    'Alternar quem fica com o bebê para que o outro durma um pedaço de verdade.',
    'Anotar mamadas e fraldas nos primeiros dias — é o que o pediatra pergunta na consulta.',
  ],
  atencao: [
    f('Menos fraldas molhadas do que o esperado para os dias de vida, ou xixi muito escuro.', 'AAP'),
    f('O bebê não voltou ao peso de nascimento por volta das 2 semanas.', 'AAP'),
    f('Amarelão que aparece nas primeiras 24 horas, que aumenta, ou que atinge braços e pernas.', 'NHS'),
    f('Vermelhidão, cheiro ruim ou secreção ao redor do coto do cordão.', 'NHS'),
  ],
};

const SEMANA_2 = {
  id: 'sem-2', de: 7, ate: 13, unidade: 'semana', titulo: '2ª semana',
  chip: '2ª sem',
  resumo: 'A rotina começa a ganhar algum formato, ainda que irregular. Muitos bebês voltam ao '
    + 'peso de nascimento por aqui e passam a ficar um pouquinho mais tempo acordados.',
  sentindo: [
    {
      titulo: 'Mais estímulos ao redor',
      texto: 'Seu bebê está começando a perceber melhor o ambiente. Sons, luzes, rostos e '
        + 'movimentos chamam mais atenção. Alguns bebês se sobrecarregam com facilidade e '
        + 'pedem um lugar mais calmo para se recompor.',
    },
    {
      titulo: 'Segurança vem do previsível',
      texto: 'Ele ainda não entende horários, mas já sente repetição: a mesma voz, o mesmo '
        + 'jeito de pegar no colo, a mesma sequência antes de dormir. É assim que o mundo '
        + 'começa a ficar menos assustador.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('É comum ficar mais tempo olhando um rosto próximo, e algumas vezes acompanhar ele por um pedaço curto do caminho.', 'AAP'),
      f('O controle da cabeça vai aparecendo aos poucos: uns segundos a mais de barriga para baixo a cada semana.', 'CDC'),
      f('Alguns bebês já se acalmam ao ouvir uma voz conhecida antes mesmo de serem pegos no colo.', 'CDC'),
    ],
    sono: [
      f('O padrão ainda é bem irregular: sonecas curtas espalhadas pelo dia e pela noite, sem hora certa.', 'AASM'),
      f('Pode aparecer um período um pouco mais longo de sono, sem nenhuma garantia de que se repita amanhã.', 'AASM'),
      f('Acordar várias vezes à noite continua sendo o esperado nesta idade.', 'AAP'),
    ],
    comportamento: [
      f('A quantidade de choro costuma aumentar ao longo das primeiras semanas — é uma curva conhecida, não um sinal de que algo está errado.', 'AAP'),
      f('Alguns bebês pedem muito mais colo no fim da tarde e no começo da noite.', 'AAP'),
      f('Nem todo choro é fome: bebês também sugam por conforto.', 'AAP'),
    ],
    corpo: [
      f('Por volta das 2 semanas a maioria já recuperou o peso do nascimento; a partir daí o ganho costuma ser constante.', 'AAP'),
      f('Manchinhas brancas minúsculas no nariz e nas bochechas (milia) aparecem em boa parte dos recém-nascidos e somem sozinhas até 1 ou 2 meses.', 'AAP'),
      f('O coto do cordão pode cair nesta semana; um pouquinho de secreção seca na queda é comum.', 'NHS'),
      f('Manchinhas e vermelhidões que vão e vêm pelo corpo são frequentes nas primeiras semanas.', 'AAP'),
    ],
    alimentacao: [
      f('Mamadas agrupadas — várias seguidas em pouco tempo, principalmente à noite — são comuns e não significam que o leite está fraco.', 'AAP'),
      f('A partir do 5º dia, costuma-se esperar 6 ou mais fraldas de xixi por dia.', 'AAP'),
      f('Engasgos leves, soluço e regurgitação pequena depois de mamar são comuns nesta idade.', 'NHS'),
      f('Qualquer dúvida sobre pega, quantidade ou complemento é conversa com o pediatra ou com quem acompanha a amamentação.', 'AAP'),
    ],
    sentidos: [
      f('O interesse por rostos aumenta: contraste forte, olhos e boca são o que mais prende a atenção.', 'AAP'),
      f('Reage a sons altos e se acalma com sons repetitivos e constantes.', 'NHS'),
      f('O tato continua sendo o canal mais forte: contato pele a pele, enrolar e balanço suave costumam organizar o bebê.', 'AAP'),
    ],
  },
  fazer: [
    'Aproveitar os momentos de alerta calmo para olhar nos olhos e conversar.',
    'Começar a barriga para baixo acordado, poucos minutos, 2 ou 3 vezes ao dia, sempre com você por perto.',
    'Responder ao choro sem cronômetro — nesta idade não existe "mal-acostumar".',
    'Diminuir luz e barulho quando ele começar a virar o rosto ou ficar irritado.',
    'Manter o berço vazio: só o colchão firme e o lençol bem preso.',
  ],
  atencao: [
    f('Menos de 6 fraldas de xixi por dia depois da primeira semana.', 'AAP'),
    f('Dificuldade para acordar para mamar, ou mamadas que ficaram muito mais curtas e fracas.', 'NHS'),
    f('O amarelo da pele voltou a aumentar ou apareceu depois das 2 semanas.', 'NHS'),
    f('Vômito em jato repetido, diferente da golfadinha comum.', 'NHS'),
  ],
};

const SEMANA_3 = {
  id: 'sem-3', de: 14, ate: 20, unidade: 'semana', titulo: '3ª semana',
  chip: '3ª sem',
  resumo: 'Muitos pais descrevem esta semana como mais agitada: o bebê fica mais tempo acordado, '
    + 'mama com mais frequência por alguns dias e chora um pouco mais.',
  sentindo: [
    {
      titulo: 'Mais períodos de alerta',
      texto: 'Seu bebê pode começar a passar alguns momentos do dia mais acordado e atento. '
        + 'São janelas curtas e ótimas para conversar, olhar para ele e interagir sem pressa.',
    },
    {
      titulo: 'Cansaço que vira choro',
      texto: 'Ficar acordado ainda custa caro. Quando passa do ponto, muitos bebês não '
        + 'desligam sozinhos — choram mais, se agitam e ficam mais difíceis de acalmar.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Pode passar mais tempo observando rostos e, às vezes, acompanhar um objeto que se move devagar bem perto dele.', 'AAP'),
      f('Movimentos de braços e pernas ficam mais frequentes e mais fortes.', 'NHS'),
      f('De barriga para baixo, alguns bebês já viram a cabeça de um lado para o outro.', 'CDC'),
    ],
    sono: [
      f('Os períodos acordado tendem a ficar um pouco mais longos, e as sonecas mais definidas.', 'AASM'),
      f('O sono continua espalhado pelas 24h; noite e dia ainda não estão separados.', 'AASM'),
      f('Sinais de sono nesta idade costumam ser sutis: olhar parado, bocejo, virar o rosto, mão fechada.', 'AAP'),
    ],
    comportamento: [
      f('Alguns dias de mamadas muito juntas e mais irritação são comuns por aqui, e costumam passar em poucos dias.', 'AAP'),
      f('Fica mais fácil notar o que acalma o seu bebê em particular: balanço, som constante, enrolar, peito, colo em pé.', 'AAP'),
      f('Em média, um bebê saudável tem 1 a 2 horas de choro sem explicação por dia, espalhadas.', 'AAP'),
    ],
    corpo: [
      f('A pele pode continuar descascando e ressecando, principalmente nas dobras, mãos e pés.', 'AAP'),
      f('Se ainda não caiu, o coto do cordão costuma cair nesta faixa.', 'NHS'),
      f('Pequenas espinhas no rosto podem começar a aparecer por volta das 2 a 4 semanas — é a acne neonatal, comum e passageira.', 'AAP'),
    ],
    alimentacao: [
      f('É comum haver dias de fome maior, com mamadas mais juntas por 2 ou 3 dias seguidos.', 'AAP'),
      f('O cocô costuma ser frequente nesta idade; a cor e a consistência variam bastante.', 'NHS'),
      f('Soluço depois da mamada é comum e não incomoda o bebê tanto quanto parece.', 'NHS'),
    ],
    sentidos: [
      f('Fica mais atento a vozes familiares e pode parar o que está fazendo para escutar.', 'NHS'),
      f('Começa a reagir a mudanças bruscas de luz e a barulhos repentinos.', 'AAP'),
      f('Ainda enxerga melhor de perto; rostos continuam sendo a imagem preferida.', 'AAP'),
    ],
  },
  fazer: [
    'Oferecer o peito ou a mamadeira com mais frequência nos dias de fome maior.',
    'Levar o bebê para um ambiente calmo assim que ele começar a se desorganizar.',
    'Aumentar aos poucos o tempo de barriga para baixo acordado.',
    'Usar um som constante e baixo (chuveiro, ventilador) se isso funcionar com ele.',
    'Deixar a acne neonatal em paz: água e sabonete neutro bastam, sem pomada por conta própria.',
  ],
  atencao: [
    f('Choro que muda de caráter — fica agudo, inconsolável e diferente do habitual.', 'AAP'),
    f('Recusa seguida de mamar, ou o bebê mamando muito menos que nos dias anteriores.', 'NHS'),
    f('Febre de 38 °C ou mais: em bebê com menos de 3 meses, isso é avaliação imediata.', 'NHS'),
  ],
};

const SEMANA_4 = {
  id: 'sem-4', de: 21, ate: 27, unidade: 'semana', titulo: '4ª semana',
  chip: '4ª sem',
  resumo: 'Fim do primeiro mês. O bebê já conhece a sua voz, o seu cheiro e o seu jeito de pegar '
    + 'no colo — e começa a mostrar isso.',
  sentindo: [
    {
      titulo: 'Já sei quem são vocês',
      texto: 'Seu bebê ainda não reconhece rostos como um adulto, mas já associa voz, cheiro e '
        + 'jeito de segurar. Muitos se acalmam mais rápido com quem passa mais tempo com eles.',
    },
    {
      titulo: 'Fim de tarde pesado',
      texto: 'É comum o choro se concentrar no fim do dia. Nem sempre há uma causa para '
        + 'resolver — às vezes é só o acúmulo de estímulos do dia saindo.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('De barriga para baixo, muitos bebês já levantam a cabeça por alguns segundos com mais firmeza.', 'CDC'),
      f('Pode olhar para um rosto e, por um instante, acompanhar ele de um lado para o outro.', 'CDC'),
      f('Alguns bebês começam a esboçar sons diferentes do choro, ainda muito curtos.', 'CDC'),
    ],
    sono: [
      f('Alguns bebês começam a esticar um pouco mais um dos períodos de sono da noite — outros não, e as duas coisas são comuns.', 'AASM'),
      f('Acordar para mamar de madrugada continua sendo o normal nesta idade.', 'AAP'),
      f('Dormir no colo e acordar ao ser colocado no berço é muito comum: o sono ainda é leve na maior parte do tempo.', 'AAP'),
    ],
    comportamento: [
      f('É comum aparecerem mais períodos de alerta tranquilo, em que ele só observa.', 'AAP'),
      f('A necessidade de colo pode aumentar nesta virada de mês.', 'AAP'),
      f('Cada bebê tem um limite diferente de estímulo; alguns precisam de muito menos barulho e visita do que outros.', 'AAP'),
    ],
    corpo: [
      f('A acne neonatal é comum entre a 2ª e a 4ª semana: pontinhos vermelhos no rosto que somem sozinhos em algumas semanas.', 'AAP'),
      f('O umbigo já costuma estar cicatrizado; uma casquinha ou um pouco de secreção na queda é esperado.', 'NHS'),
      f('A cabeça continua arredondando e as marcas do parto vão sumindo.', 'AAP'),
    ],
    alimentacao: [
      f('O ritmo de mamadas costuma ficar um pouco mais previsível, mesmo sem horário fixo.', 'AAP'),
      f('Regurgitar um pouco depois de mamar é comum e, se o bebê ganha peso e está confortável, não costuma preocupar.', 'NHS'),
      f('A frequência de cocô varia muito entre bebês saudáveis a partir de agora.', 'NHS'),
    ],
    sentidos: [
      f('Prefere olhar rostos a olhar objetos, e contrastes fortes a cores suaves.', 'AAP'),
      f('Reage à voz dos pais mudando o ritmo do corpo: para de se mexer, presta atenção, volta a se mexer.', 'NHS'),
      f('Reconhece cheiro e toque de quem cuida dele com mais frequência.', 'AAP'),
    ],
  },
  fazer: [
    'Conversar de frente, a uns 30 cm, esperando a resposta dele — cara, som, movimento.',
    'Fazer os momentos de interação curtos e repetidos, em vez de longos.',
    'Respeitar o sinal de "chega": virar o rosto, arquear as costas, ficar irritado.',
    'Combinar com visitas horários curtos, principalmente perto do fim da tarde.',
    'Continuar a barriga para baixo todos os dias, agora por períodos um pouco maiores.',
  ],
  atencao: [
    f('O bebê não reage a sons altos nem à voz de perto.', 'CDC'),
    f('O corpo parece muito duro e travado, ou muito mole, o tempo todo.', 'CDC'),
    f('Choro inconsolável por horas, sem nenhuma pausa, principalmente se vier com febre ou vômito.', 'AAP'),
  ],
};

const SEMANA_5 = {
  id: 'sem-5', de: 28, ate: 34, unidade: 'semana', titulo: '5ª semana',
  chip: '5ª sem',
  resumo: 'Começa a faixa em que o choro costuma chegar ao ponto mais alto de todo o primeiro '
    + 'ano. Ao mesmo tempo, aparecem as primeiras respostas sociais de verdade.',
  sentindo: [
    {
      titulo: 'Muita coisa ao mesmo tempo',
      texto: 'Os sentidos estão mais ligados e o mundo chega com mais força. Alguns bebês '
        + 'ficam sobrecarregados rápido e precisam de um ambiente bem mais tranquilo para se acalmar.',
    },
    {
      titulo: 'Vontade de responder',
      texto: 'Seu bebê está começando a perceber que o que ele faz muda o que você faz. '
        + 'Por isso ele olha mais, faz mais sons e espera a sua reação.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('É por volta desta faixa que muitos bebês dão o primeiro sorriso de resposta — alguns antes, outros só perto das 8 semanas.', 'NHS'),
      f('Sons de garganta e vogais curtas começam a aparecer entre os choros.', 'CDC'),
      f('A cabeça fica mais firme por alguns segundos quando o bebê está apoiado no seu ombro.', 'CDC'),
    ],
    sono: [
      f('O sono continua irregular e pode ficar mais picado justamente agora.', 'AASM'),
      f('Pode ser mais difícil colocar no berço: o bebê está mais reativo ao ambiente.', 'AAP'),
      f('Sonecas muito curtas alternando com uma longa são comuns.', 'AASM'),
    ],
    comportamento: [
      f('O choro sem causa aparente costuma atingir o ponto mais alto por volta das 6 semanas e diminuir depois.', 'AAP'),
      f('Quando o choro sem explicação passa de 3 horas por dia, é o que se costuma chamar de cólica — que também melhora sozinha, em geral até os 3 meses.', 'AAP'),
      f('Mais necessidade de colo e de movimento é esperado nesta fase.', 'AAP'),
    ],
    corpo: [
      f('A acne neonatal costuma estar no auge entre a 4ª e a 6ª semana e some sozinha.', 'AAP'),
      f('Alguns bebês têm a pele mais sensível a calor, tecido e sabonete neste período.', 'AAP'),
      f('O ganho de peso costuma estar em ritmo constante desde que o peso de nascimento foi recuperado.', 'AAP'),
    ],
    alimentacao: [
      f('Dias de mamadas muito juntas voltam a aparecer de tempos em tempos.', 'AAP'),
      f('Mamar também acalma: nem toda mamada extra é sinal de fome ou de leite insuficiente.', 'AAP'),
      f('Se a mamada está dolorida ou o ganho de peso preocupa, é conversa com o pediatra ou com apoio em amamentação — não é para resolver na internet.', 'AAP'),
    ],
    sentidos: [
      f('Acompanha objetos com os olhos por trechos maiores, especialmente rostos.', 'AAP'),
      f('Reage mais claramente à voz conhecida: abre os olhos, para, procura.', 'NHS'),
      f('Barulho, luz forte e muita gente junto podem incomodar mais do que nas semanas anteriores.', 'AAP'),
    ],
  },
  fazer: [
    'Sorrir de volta sempre — é o exercício social mais importante desta fase.',
    'Ter um plano para as horas difíceis: revezar, sair para caminhar, banho morno, som constante.',
    'Cortar estímulos antes do fim da tarde nos dias em que ele acordar mais sensível.',
    'Lembrar que chorar muito nesta idade é fase conhecida, não falha de ninguém.',
    'Se o choro te levar ao limite, colocar o bebê em lugar seguro e respirar alguns minutos antes de voltar.',
  ],
  atencao: [
    f('Choro que veio junto com febre, vômito, recusa alimentar ou bebê muito molinho.', 'NHS'),
    f('Você está esgotado ou com medo de perder o controle — isso também é motivo para pedir ajuda, e cedo.', 'AAP'),
    f('O bebê parou de fazer algo que já fazia, como se acalmar com a sua voz.', 'CDC'),
  ],
};

const SEMANA_6 = {
  id: 'sem-6', de: 35, ate: 41, unidade: 'semana', titulo: '6ª semana',
  chip: '6ª sem',
  resumo: 'Semana de pico do choro para muitos bebês — e também a faixa clássica do sorriso '
    + 'social. Duas coisas opostas acontecendo ao mesmo tempo.',
  sentindo: [
    {
      titulo: 'Descobrindo que existe troca',
      texto: 'Quando você sorri e ele sorri de volta, alguma coisa importante está acontecendo: '
        + 'seu bebê está aprendendo que existe conversa, mesmo sem palavras.',
    },
    {
      titulo: 'Sobrecarga chega rápido',
      texto: 'O limite de estímulo ainda é baixo. Muita gente, muita luz e muito barulho podem '
        + 'virar choro difícil de parar, principalmente no fim do dia.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('O sorriso de resposta aparece por volta das 6 semanas na maioria dos bebês — mas a janela é larga.', 'NHS'),
      f('Começa a fazer sons que não são choro, respondendo quando alguém fala com ele.', 'CDC'),
      f('Costuma segurar a cabeça por mais tempo de barriga para baixo e empurrar com os braços.', 'CDC'),
    ],
    sono: [
      f('Alguns bebês começam a concentrar um pouco mais sono à noite, sem nenhuma regra.', 'AASM'),
      f('Continuar acordando várias vezes por noite é esperado.', 'AAP'),
      f('Sonolência e irritação no fim da tarde costumam andar juntas nesta idade.', 'AAP'),
    ],
    comportamento: [
      f('A média de choro costuma chegar perto de 3 horas por dia por volta das 6 semanas e diminuir para 1 ou 2 horas até os 3 ou 4 meses.', 'AAP'),
      f('Mais interesse por rostos e vozes, e mais protesto quando é deixado sozinho acordado.', 'AAP'),
      f('Alguns bebês passam a ter um horário mais previsível de crise — em geral entre o fim da tarde e a noite.', 'AAP'),
    ],
    corpo: [
      f('A acne neonatal ainda pode estar presente e continua não precisando de tratamento.', 'AAP'),
      f('Os olhos vão ficando mais alinhados; vaguear ocasional ainda pode acontecer.', 'AAP'),
      f('Nesta faixa costuma acontecer a consulta com vacinas — reações leves por 1 ou 2 dias são comuns.', 'NHS'),
    ],
    alimentacao: [
      f('Um período de fome maior por alguns dias é comum por volta das 6 semanas.', 'AAP'),
      f('A frequência de cocô pode diminuir bastante em bebês amamentados sem que isso seja prisão de ventre.', 'NHS'),
      f('Se o bebê mama bem, molha bem as fraldas e ganha peso, a frequência de cocô sozinha diz pouco.', 'NHS'),
    ],
    sentidos: [
      f('Acompanha rostos e objetos com os olhos por trajetos mais longos.', 'AAP'),
      f('Reconhece vozes conhecidas e vira na direção do som com mais frequência.', 'NHS'),
      f('Gosta de contraste: desenhos simples em preto e branco ainda prendem mais que cores suaves.', 'AAP'),
    ],
  },
  fazer: [
    'Reservar alguns minutos de "conversa" por dia: falar, esperar, responder o som dele.',
    'Trocar de posição e de cenário quando o choro começar — às vezes só mudar de cômodo resolve.',
    'Aumentar o tempo de barriga para baixo, aproveitando os momentos de bom humor.',
    'Aceitar ajuda concreta: alguém segurando o bebê enquanto você dorme 90 minutos.',
    'Levar as dúvidas anotadas para a consulta — é a fase com mais perguntas acumuladas.',
  ],
  atencao: [
    f('Nenhum sorriso de resposta e nenhuma reação social até perto dos 2 meses de idade corrigida.', 'CDC'),
    f('Febre de 38 °C ou mais em bebê com menos de 3 meses.', 'NHS'),
    f('O bebê parece não escutar sons altos nem se acalmar quando você fala com ele.', 'CDC'),
  ],
};

const SEMANA_7 = {
  id: 'sem-7', de: 42, ate: 48, unidade: 'semana', titulo: '7ª semana',
  chip: '7ª sem',
  resumo: 'Para muitos bebês o pior do choro começa a passar. As trocas sociais ficam mais claras '
    + 'e os períodos acordado, mais interessantes.',
  sentindo: [
    {
      titulo: 'Reparando em repetições',
      texto: 'Seu bebê começa a notar o que se repete: o desenho do seu rosto, o som que vem '
        + 'antes da mamada, a própria mão que passa na frente dos olhos.',
    },
    {
      titulo: 'Quero conversar',
      texto: 'Os sons dele já são tentativas de resposta. Quando você espera e responde, está '
        + 'ensinando o ritmo de uma conversa.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Sorrisos de resposta ficam mais frequentes e mais fáceis de provocar.', 'CDC'),
      f('Sons de vogal ("aaa", "ooo") costumam aparecer com mais frequência.', 'CDC'),
      f('As mãos passam mais tempo abertas e começam a ir em direção à boca com mais intenção.', 'CDC'),
    ],
    sono: [
      f('Os períodos acordado ficam mais longos, e o dia começa a se separar um pouco da noite.', 'AASM'),
      f('O total de sono em 24h costuma continuar alto, mesmo com a noite ainda picada.', 'AASM'),
      f('Cada bebê consolida o sono num ritmo próprio; comparar com outro bebê ajuda pouco.', 'AASM'),
    ],
    comportamento: [
      f('A quantidade de choro costuma começar a cair a partir desta faixa.', 'AAP'),
      f('Mais interesse por gente: olha, acompanha e responde com mais frequência.', 'AAP'),
      f('Pode ficar entediado quando está muito tempo sozinho acordado — e avisar chorando.', 'AAP'),
    ],
    corpo: [
      f('A acne neonatal costuma começar a melhorar.', 'AAP'),
      f('O corpo fica mais "esticado": menos posição de bolinha, mais pernas e braços soltos.', 'NHS'),
      f('Alguns bebês babam mais — isso não quer dizer que os dentes estão nascendo.', 'NHS'),
    ],
    alimentacao: [
      f('As mamadas costumam ficar mais eficientes e às vezes mais curtas.', 'AAP'),
      f('Distrair-se no meio da mamada começa a acontecer em ambientes movimentados.', 'AAP'),
      f('O ganho de peso no acompanhamento vale mais que o número de uma pesagem isolada.', 'AAP'),
    ],
    sentidos: [
      f('Acompanha objetos que passam devagar em frente ao rosto.', 'AAP'),
      f('Vira a cabeça em direção a sons conhecidos.', 'NHS'),
      f('Começa a reparar nas próprias mãos quando elas entram no campo de visão.', 'AAP'),
    ],
  },
  fazer: [
    'Deixar um tempo por dia de barriga para baixo com você deitado de frente para ele.',
    'Responder cada som dele com uma frase — é o começo do revezamento da conversa.',
    'Mostrar objetos simples e de alto contraste, devagar, perto do rosto.',
    'Manter uma sequência parecida antes de dormir, mesmo sem horário fixo.',
    'Trocar de posição ao longo do dia para não deixar a cabeça sempre no mesmo apoio.',
  ],
  atencao: [
    f('Não segue nada com os olhos e não reage quando você aparece no campo de visão.', 'CDC'),
    f('Nenhum som além do choro por volta dos 2 meses.', 'CDC'),
    f('Perda de habilidades que ele já tinha.', 'CDC'),
  ],
};

const SEMANA_8 = {
  id: 'sem-8', de: 49, ate: 55, unidade: 'semana', titulo: '8ª semana',
  chip: '8ª sem',
  resumo: 'Perto dos 2 meses. É a primeira idade com uma lista de marcos bem estabelecida — e a '
    + 'primeira consulta em que o pediatra vai perguntar sobre eles.',
  sentindo: [
    {
      titulo: 'Sei que tem alguém do outro lado',
      texto: 'Seu bebê começa a esperar resposta. Ele olha, faz um som e aguarda. Essa espera '
        + 'é o começo da comunicação.',
    },
    {
      titulo: 'Ainda canso rápido',
      texto: 'Mesmo mais interessado no mundo, ele ainda se cansa depressa. Períodos curtos de '
        + 'brincadeira, várias vezes ao dia, funcionam melhor que uma sessão longa.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Até os 2 meses, a maioria dos bebês se acalma quando alguém fala com ele ou o pega no colo.', 'CDC'),
      f('Até os 2 meses, a maioria olha para o seu rosto e sorri quando você se aproxima e fala.', 'CDC'),
      f('Até os 2 meses, a maioria faz sons que não são choro e segura a cabeça de barriga para baixo.', 'CDC'),
      f('"A maioria" não é "todos": marcos são janelas, e prematuridade desloca a janela inteira.', 'CDC'),
    ],
    sono: [
      f('O total de sono em 24h continua alto, tipicamente entre 14 e 17 horas somadas nos primeiros 3 meses.', 'AASM'),
      f('Alguns bebês já dormem um trecho maior à noite; muitos ainda não, e os dois são normais.', 'AASM'),
      f('Colocar sempre de barriga para cima, no berço vazio, continua valendo até 1 ano.', 'SONOSEG'),
    ],
    comportamento: [
      f('O choro costuma estar em queda em relação às semanas anteriores.', 'AAP'),
      f('Os períodos de alerta ficam mais longos e mais sociais.', 'AAP'),
      f('Alguns bebês já mostram preferência clara por quem passa mais tempo com eles.', 'AAP'),
    ],
    corpo: [
      f('O controle de cabeça melhora de forma visível quando comparado com o primeiro mês.', 'CDC'),
      f('A acne neonatal costuma estar sumindo.', 'AAP'),
      f('Nesta faixa costuma acontecer a consulta dos 2 meses, com vacinas — febre baixa e irritação por 1 a 2 dias são comuns.', 'NHS'),
    ],
    alimentacao: [
      f('O intervalo entre mamadas costuma ficar um pouco maior e mais previsível.', 'AAP'),
      f('Fase de fome maior por alguns dias pode voltar a aparecer.', 'AAP'),
      f('Nada de água, chá ou outro alimento nesta idade sem orientação do pediatra.', 'AAP'),
    ],
    sentidos: [
      f('Segue objetos com os olhos por trajetos maiores e procura de onde vem o som.', 'AAP'),
      f('Reconhece o rosto de quem cuida dele a uma distância maior que nas primeiras semanas.', 'AAP'),
      f('Os olhos devem estar quase sempre alinhados a partir dos 2 a 3 meses.', 'AAP'),
    ],
  },
  fazer: [
    'Levar para a consulta dos 2 meses as dúvidas anotadas e o que você observou em casa.',
    'Continuar a barriga para baixo todos os dias, agora com sessões um pouco mais longas.',
    'Brincar de imitar: ele faz um som, você repete, e espera a vez dele.',
    'Descrever o que está acontecendo em voz alta durante troca e banho.',
    'Observar sem cobrar: marco não cumprido na semana exata não é atraso.',
  ],
  atencao: [
    f('Não reage a sons altos.', 'CDC'),
    f('Não acompanha com os olhos coisas que se movem.', 'CDC'),
    f('Não sorri para pessoas.', 'CDC'),
    f('Não leva as mãos à boca.', 'CDC'),
    f('Não consegue sustentar a cabeça quando está de barriga para baixo se apoiando.', 'CDC'),
  ],
};

const MES_2 = {
  id: 'mes-2', de: 56, ate: 90, unidade: 'mes', titulo: '2 a 3 meses',
  chip: '2–3m',
  resumo: 'Fase de virada social: mais sorriso, mais som, mais interesse pelo mundo. Muitos pais '
    + 'descrevem esta como a primeira fase em que "dá para conversar" com o bebê.',
  sentindo: [
    {
      titulo: 'Gosto de quem me responde',
      texto: 'Seu bebê está aprendendo que existe revezamento. Quando você espera ele terminar '
        + 'o som e só então responde, ele aprende o ritmo da conversa.',
    },
    {
      titulo: 'Descobri as minhas mãos',
      texto: 'As mãos passam a ser o brinquedo preferido de muitos bebês nesta fase: eles olham, '
        + 'abrem, fecham e levam à boca, repetidamente.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('É comum começar a abrir as mãos, levá-las à boca e tentar alcançar o que está perto.', 'CDC'),
      f('O controle de cabeça melhora bastante; alguns bebês já sustentam a cabeça no colo sem apoio.', 'CDC'),
      f('Balbucios ficam mais variados e o bebê começa a responder quando você fala.', 'CDC'),
      f('Alguns bebês rolam de barriga para baixo para cima no fim desta faixa; outros só bem depois.', 'CDC'),
    ],
    sono: [
      f('O sono começa a se organizar em torno da noite, mas despertares continuam frequentes.', 'AASM'),
      f('As sonecas ficam um pouco mais definidas ao longo do dia.', 'AASM'),
      f('Colocar no berço ainda acordado, quando der, ajuda — mas não funciona todo dia, e tudo bem.', 'AAP'),
    ],
    comportamento: [
      f('O choro sem explicação costuma cair para 1 a 2 horas por dia por volta dos 3 ou 4 meses.', 'AAP'),
      f('O bebê protesta mais quando está entediado e se acalma mais com interação.', 'AAP'),
      f('Já é possível notar temperamento: uns se recuperam rápido do susto, outros levam mais tempo.', 'AAP'),
    ],
    corpo: [
      f('A acne neonatal costuma ter sumido; a pele fica mais estável.', 'AAP'),
      f('O bebê "estica": menos posição encolhida, mais movimento amplo.', 'NHS'),
      f('Baba aumenta bastante nesta fase, geralmente muito antes do primeiro dente.', 'NHS'),
    ],
    alimentacao: [
      f('As mamadas ficam mais rápidas porque o bebê ficou mais eficiente.', 'AAP'),
      f('Distração durante a mamada aumenta: ambiente calmo ajuda.', 'AAP'),
      f('Nada de alimento sólido nesta faixa — a recomendação é esperar por volta dos 6 meses.', 'AAP'),
    ],
    sentidos: [
      f('Acompanha objetos de um lado ao outro e foca em coisas mais distantes que antes.', 'AAP'),
      f('Procura a origem dos sons virando cabeça e olhos.', 'NHS'),
      f('Começa a distinguir cores fortes melhor do que nas primeiras semanas.', 'AAP'),
    ],
  },
  fazer: [
    'Oferecer objetos leves e seguros para ele tentar alcançar e segurar.',
    'Cantar as mesmas músicas — repetição é o que ele mais gosta nesta fase.',
    'Ler livros de contraste e de figuras grandes, mesmo que pareça cedo.',
    'Fazer barriga para baixo em sessões curtas várias vezes, chegando perto de 30 minutos somados no dia.',
    'Dar tempo: esperar a resposta dele antes de falar de novo.',
  ],
  atencao: [
    f('Não sustenta a cabeça nem por pouco tempo.', 'CDC'),
    f('Não acompanha coisas que se movem nem olha para rostos.', 'CDC'),
    f('Não sorri para pessoas e não faz nenhum som além do choro.', 'CDC'),
    f('Os olhos continuam bastante desalinhados depois dos 3 meses.', 'AAP'),
  ],
};

const MES_3 = {
  id: 'mes-3', de: 91, ate: 121, unidade: 'mes', titulo: '3 a 4 meses',
  chip: '3–4m',
  resumo: 'Os movimentos ficam mais suaves e intencionais. Muitos bebês descobrem a gargalhada e '
    + 'começam a pegar o que querem — em vez de só esbarrar.',
  sentindo: [
    {
      titulo: 'Consigo escolher para onde ir',
      texto: 'A mão já vai na direção do brinquedo. Essa mudança, de esbarrar para mirar, muda '
        + 'a forma como o bebê explora tudo.',
    },
    {
      titulo: 'Reparo em quem some',
      texto: 'Seu bebê começa a acompanhar o que sai do campo de visão. Por isso ele pode '
        + 'reclamar quando você se afasta, mesmo que continue ouvindo a sua voz.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Até os 4 meses, a maioria segura a cabeça firme sem apoio quando está no colo.', 'CDC'),
      f('Até os 4 meses, a maioria abre a boca quando vê o peito ou a mamadeira e leva as mãos à boca.', 'CDC'),
      f('Até os 4 meses, a maioria dá risadinhas, faz sons de conversa e olha para as próprias mãos com interesse.', 'CDC'),
      f('Muitos bebês começam a se empurrar com os cotovelos quando estão de barriga para baixo.', 'CDC'),
    ],
    sono: [
      f('É comum o sono parecer piorar nesta faixa: mais despertares e sonecas mais curtas por algumas semanas.', 'AASM'),
      f('Por volta dos 4 meses a recomendação de horas por 24h passa para uma faixa um pouco menor, em torno de 12 a 16 horas somadas.', 'AASM'),
      f('Assim que o bebê começar a rolar, ainda se coloca de barriga para cima — mas não é preciso virá-lo de volta se ele rolar sozinho dormindo.', 'SONOSEG'),
    ],
    comportamento: [
      f('Sorri sozinho para chamar atenção e responde a expressões suas.', 'CDC'),
      f('Costuma protestar quando a brincadeira para.', 'CDC'),
      f('Fica mais fácil prever o humor dele ao longo do dia.', 'AAP'),
    ],
    corpo: [
      f('As pernas empurram com força quando os pés encostam em superfície firme.', 'CDC'),
      f('Baba e mão na boca aumentam muito; ainda costuma ser cedo para dente.', 'NHS'),
      f('A cabeça deve estar arredondando bem; muito tempo sempre na mesma posição pode achatar um lado.', 'AAP'),
    ],
    alimentacao: [
      f('Mamadas mais curtas e espaçadas são comuns e não significam desmame.', 'AAP'),
      f('O bebê pode parar no meio da mamada para olhar ao redor ou "conversar".', 'AAP'),
      f('Ainda não é hora de sólidos; a recomendação é por volta dos 6 meses, com sinais de prontidão.', 'AAP'),
    ],
    sentidos: [
      f('Enxerga mais longe e acompanha objetos por todo o campo de visão.', 'AAP'),
      f('Reconhece vozes e músicas familiares e demonstra preferência.', 'NHS'),
      f('Explora texturas com a boca e com as mãos.', 'AAP'),
    ],
  },
  fazer: [
    'Oferecer chocalhos leves e objetos fáceis de segurar.',
    'Brincar de esconde-esconde simples, cobrindo e mostrando o rosto.',
    'Variar a posição ao longo do dia: colo, tapete, barriga para baixo, de lado apoiado.',
    'Manter a sequência da noite parecida mesmo nas semanas de sono bagunçado.',
    'Guardar telas para depois — nesta idade a interação com gente vale muito mais.',
  ],
  atencao: [
    f('Não acompanha coisas que se movem com os olhos.', 'CDC'),
    f('Não sorri para pessoas.', 'CDC'),
    f('Não consegue manter a cabeça firme.', 'CDC'),
    f('Não leva objetos à boca e não empurra com as pernas quando os pés tocam uma superfície firme.', 'CDC'),
  ],
};

const MES_4 = {
  id: 'mes-4', de: 122, ate: 152, unidade: 'mes', titulo: '4 a 5 meses',
  chip: '4–5m',
  resumo: 'Fase de muito movimento: rolar, alcançar, levar tudo à boca. O sono costuma se '
    + 'reorganizar e isso às vezes aparece como noites piores por algumas semanas.',
  sentindo: [
    {
      titulo: 'Quero pegar tudo',
      texto: 'Alcançar e levar à boca é como seu bebê estuda o mundo agora. Textura, peso e '
        + 'temperatura são informações novas a cada objeto.',
    },
    {
      titulo: 'Se eu faço, acontece',
      texto: 'Ele começa a perceber que uma ação leva a um resultado: se eu empurro, cai; se '
        + 'eu chamo, alguém vem. Essa descoberta costuma vir com muita repetição.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Rolar de barriga para baixo para cima costuma aparecer nesta faixa; o contrário costuma vir depois.', 'CDC'),
      f('Alcançar com as duas mãos e passar o objeto de uma mão para a outra começam a aparecer.', 'CDC'),
      f('Balbucio ganha consoantes e mais variação de tom.', 'CDC'),
    ],
    sono: [
      f('Muitos bebês passam por algumas semanas de despertares extras nesta faixa — costuma se acomodar sozinho.', 'AASM'),
      f('As sonecas vão se agrupando em menos períodos e mais longos ao longo dos meses.', 'AASM'),
      f('Com o bebê rolando, o berço precisa estar ainda mais vazio: nada de protetor, almofada ou brinquedo.', 'SONOSEG'),
    ],
    comportamento: [
      f('Ri alto e gosta de brincadeiras repetitivas.', 'CDC'),
      f('Pode protestar quando você sai de perto, mesmo sem ansiedade de separação instalada.', 'AAP'),
      f('Fica mais seletivo com colo desconhecido.', 'AAP'),
    ],
    corpo: [
      f('Controle de tronco melhora: sentado com apoio, a cabeça fica firme.', 'CDC'),
      f('Alguns bebês começam a ter sinais de dente nascendo a partir daqui — outros só bem mais tarde.', 'NHS'),
      f('Muita baba e mão na boca continuam sendo exploração, não necessariamente dente.', 'NHS'),
    ],
    alimentacao: [
      f('Interesse pela comida dos adultos pode aparecer antes de o bebê estar pronto para comer.', 'AAP'),
      f('Interesse sozinho não é sinal de prontidão — é preciso também sentar com apoio e sustentar bem a cabeça.', 'AAP'),
      f('Quando começar os sólidos e como começar é decisão junto com o pediatra.', 'AAP'),
    ],
    sentidos: [
      f('Enxerga cores e detalhes muito melhor; passa a preferir figuras complexas.', 'AAP'),
      f('Localiza sons com precisão e vira o corpo na direção deles.', 'NHS'),
      f('A boca continua sendo o principal instrumento de investigação.', 'AAP'),
    ],
  },
  fazer: [
    'Deixar o bebê num espaço seguro no chão para rolar e treinar.',
    'Oferecer objetos de texturas diferentes, todos seguros para ir à boca.',
    'Brincar de repetição: a mesma música, o mesmo gesto, o mesmo "cadê".',
    'Revisar a segurança da casa antes de ele se mover mais do que você espera.',
    'Manter rotina de sono estável nas semanas de noites piores, sem mudar tudo de uma vez.',
  ],
  atencao: [
    f('Não leva as coisas à boca e não tenta alcançar o que está perto.', 'CDC'),
    f('Não faz nenhum som de vogal nem ri.', 'CDC'),
    f('Corpo muito rígido ou muito mole o tempo todo.', 'CDC'),
    f('Não olha para onde você aponta nem reage ao seu rosto.', 'CDC'),
  ],
};

const MES_5 = {
  id: 'mes-5', de: 153, ate: 182, unidade: 'mes', titulo: '5 a 6 meses',
  chip: '5–6m',
  resumo: 'Preparação para sentar e para comer. O bebê fica mais forte, mais curioso e começa a '
    + 'perceber distância — o que costuma vir junto com mais protesto quando você sai.',
  sentindo: [
    {
      titulo: 'Percebo que você foi para outro lugar',
      texto: 'Agora ele entende melhor que você continua existindo mesmo fora de vista — e é '
        + 'justamente por isso que chama quando você sai do quarto.',
    },
    {
      titulo: 'Quero participar da refeição',
      texto: 'Muitos bebês passam a olhar fixo para o prato dos adultos e a imitar o movimento '
        + 'de mastigar. É curiosidade, e é um bom sinal.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Sentar com apoio e depois se apoiar nas mãos costuma aparecer nesta faixa.', 'CDC'),
      f('Rolar nos dois sentidos fica mais comum.', 'CDC'),
      f('Sons ganham sílabas repetidas e o bebê começa a revezar sons com você.', 'CDC'),
    ],
    sono: [
      f('O total costuma ficar entre 12 e 16 horas somadas em 24h nesta idade.', 'AASM'),
      f('O número de sonecas tende a cair ao longo dos próximos meses.', 'AASM'),
      f('Despertares continuam normais, principalmente em fases de habilidade nova.', 'AASM'),
    ],
    comportamento: [
      f('Reconhece pessoas conhecidas e demonstra alegria ao vê-las.', 'CDC'),
      f('Pode estranhar quem vê pouco.', 'CDC'),
      f('Gosta de se olhar no espelho.', 'CDC'),
    ],
    corpo: [
      f('Ganha força de tronco e pescoço de forma visível.', 'CDC'),
      f('Os primeiros dentes podem começar a aparecer a partir daqui, com bastante variação.', 'NHS'),
      f('Gengiva inchada, mais baba e vontade de morder podem acompanhar o dente.', 'NHS'),
    ],
    alimentacao: [
      f('A recomendação é começar os sólidos por volta dos 6 meses, não antes.', 'AAP'),
      f('Os sinais de prontidão aparecem juntos: sentar com apoio, sustentar bem a cabeça e levar comida à boca.', 'NHS'),
      f('Leite materno ou fórmula continuam sendo a base da alimentação durante todo o primeiro ano.', 'AAP'),
    ],
    sentidos: [
      f('Enxergar já está bem próximo do adulto em nitidez de perto e de longe.', 'AAP'),
      f('Reage ao próprio nome com mais frequência.', 'CDC'),
      f('Explora com as mãos: aperta, bate, arrasta, e leva à boca.', 'AAP'),
    ],
  },
  fazer: [
    'Sentar o bebê apoiado e brincar de frente com ele.',
    'Nomear objetos e ações o tempo todo — é assim que o vocabulário começa.',
    'Conversar sobre a introdução alimentar na consulta antes de começar.',
    'Oferecer um mordedor limpo e seguro se a gengiva incomodar.',
    'Avisar quando for sair do cômodo, mesmo que ele ainda não entenda as palavras.',
  ],
  atencao: [
    f('Não tenta alcançar coisas ao alcance da mão.', 'CDC'),
    f('Não demonstra afeto por quem cuida dele.', 'CDC'),
    f('Não reage a sons ao redor.', 'CDC'),
    f('Não rola para nenhum dos lados e parece muito duro ou muito mole.', 'CDC'),
  ],
};

const MES_6 = {
  id: 'mes-6', de: 183, ate: 212, unidade: 'mes', titulo: '6 a 7 meses',
  chip: '6–7m',
  resumo: 'Marco grande: costuma ser a idade de começar a comer e de sentar com mais firmeza. '
    + 'Também é o primeiro momento formal de avaliação de desenvolvimento.',
  sentindo: [
    {
      titulo: 'Gosto novo, textura nova',
      texto: 'Comer é uma experiência sensorial inteira: cheiro, temperatura, textura na mão e '
        + 'na boca. Fazer careta não quer dizer que não gostou — quer dizer que é novo.',
    },
    {
      titulo: 'Quero alcançar sozinho',
      texto: 'Sentado, o bebê vê o mundo de outro jeito e quer chegar até ele. A frustração de '
        + 'não alcançar faz parte e é motor do movimento.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Até os 6 meses, a maioria se apoia nas mãos quando está sentada e rola de barriga para baixo para cima.', 'CDC'),
      f('Até os 6 meses, a maioria reveza sons com você, dá risada e faz sons agudos.', 'CDC'),
      f('Até os 6 meses, a maioria leva coisas à boca para explorar e fecha a boca quando não quer mais comida.', 'CDC'),
      f('Conhecer pessoas familiares e gostar de se olhar no espelho também costumam aparecer nesta idade.', 'CDC'),
    ],
    sono: [
      f('A noite costuma ficar mais longa, com despertares que ainda podem acontecer.', 'AASM'),
      f('O número de sonecas costuma cair para duas ou três ao longo desta faixa.', 'AASM'),
      f('A partir dos 6 meses o risco de morte súbita cai bastante, mas as regras de sono seguro seguem valendo até 1 ano.', 'SONOSEG'),
    ],
    comportamento: [
      f('Mostra preferências claras por pessoas, brinquedos e comidas.', 'CDC'),
      f('Pode começar a estranhar desconhecidos.', 'AAP'),
      f('Protesta quando um brinquedo é tirado — sinal de que entendeu que ele existia ali.', 'AAP'),
    ],
    corpo: [
      f('Dentes podem começar a nascer nesta faixa, com grande variação entre bebês.', 'NHS'),
      f('A musculatura do tronco melhora e o bebê fica mais estável sentado.', 'CDC'),
      f('Com a introdução alimentar, cocô muda de cor, cheiro e consistência.', 'NHS'),
    ],
    alimentacao: [
      f('Por volta dos 6 meses é a hora recomendada para começar os sólidos, mantendo leite materno ou fórmula.', 'AAP'),
      f('Prontidão é o conjunto: sentar com apoio, sustentar a cabeça e levar a comida à boca sozinho.', 'NHS'),
      f('Nada de mel antes de 1 ano, por risco de botulismo.', 'AAP'),
      f('Como oferecer, em que ordem e quanto é conversa com o pediatra — cada família recebe uma orientação.', 'AAP'),
    ],
    sentidos: [
      f('Explora com as duas mãos e passa objetos de uma para a outra.', 'CDC'),
      f('Reage ao nome e a sons familiares com mais consistência.', 'CDC'),
      f('Paladar e olfato ganham protagonismo com a comida.', 'AAP'),
    ],
  },
  fazer: [
    'Comer junto: bebê à mesa, vendo todo mundo comer, ajuda mais do que qualquer técnica.',
    'Oferecer o mesmo alimento várias vezes antes de concluir que ele não gostou.',
    'Deixar sujar — usar as mãos faz parte de aprender a comer.',
    'Brincar de esconder objeto embaixo do pano e deixar ele procurar.',
    'Rever a casa: a partir daqui ele alcança muito mais do que você imagina.',
  ],
  atencao: [
    f('Não tenta pegar o que está ao alcance.', 'CDC'),
    f('Não demonstra afeto por quem cuida dele.', 'CDC'),
    f('Não responde a sons ao redor.', 'CDC'),
    f('Não faz sons de vogal, não ri e não rola para nenhum lado.', 'CDC'),
  ],
};

const MES_7_8 = {
  id: 'mes-7-8', de: 213, ate: 273, unidade: 'faixa', titulo: '7 e 8 meses',
  chip: '7–8m',
  resumo: 'O bebê começa a se deslocar e a entender que as pessoas continuam existindo mesmo '
    + 'fora de vista. As duas coisas mudam bastante a dinâmica da casa.',
  sentindo: [
    {
      titulo: 'Quando você sai, eu percebo',
      texto: 'Entender que você existe mesmo longe é um avanço — e é a razão do choro quando '
        + 'você sai do cômodo. Não é manha; é compreensão nova.',
    },
    {
      titulo: 'Quero chegar lá',
      texto: 'Rolar, arrastar, engatinhar: a vontade de alcançar as coisas vira movimento. '
        + 'Isso costuma cobrar do sono por algumas semanas.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Sentar sem apoio e começar a se deslocar (arrastando ou engatinhando) costumam aparecer nesta faixa.', 'CDC'),
      f('Sílabas repetidas como "mamama" e "bababa" costumam ficar frequentes.', 'CDC'),
      f('Passar objetos de uma mão para a outra e bater dois objetos entre si são comuns.', 'CDC'),
    ],
    sono: [
      f('Despertares podem aumentar quando uma habilidade nova está sendo treinada.', 'AASM'),
      f('É comum o bebê acordar e treinar sentar ou ficar de pé no berço de madrugada.', 'AASM'),
      f('O total de sono em 24h costuma ficar entre 12 e 16 horas somadas até o primeiro ano.', 'AASM'),
    ],
    comportamento: [
      f('Estranhamento de desconhecidos costuma aparecer com força nesta faixa.', 'AAP'),
      f('A ansiedade de separação costuma começar por aqui e ficar mais forte perto dos 9 meses.', 'AAP'),
      f('Ele busca você com o olhar antes de decidir se algo é seguro.', 'AAP'),
    ],
    corpo: [
      f('Mais dentes podem nascer, com irritação de gengiva e vontade de morder.', 'NHS'),
      f('A pinça ainda é grosseira: o bebê pega com a mão inteira antes de usar os dedos.', 'CDC'),
      f('O corpo ganha equilíbrio sentado e começa a se apoiar para levantar.', 'CDC'),
    ],
    alimentacao: [
      f('As texturas podem ir ficando menos lisas conforme ele aprende a mastigar.', 'NHS'),
      f('O apetite varia muito de um dia para o outro nesta idade.', 'NHS'),
      f('Leite materno ou fórmula continuam sendo a principal fonte de nutrição no primeiro ano.', 'AAP'),
    ],
    sentidos: [
      f('Procura objetos que caíram — sinal de que entende que eles continuam existindo.', 'CDC'),
      f('Responde ao próprio nome de forma consistente.', 'CDC'),
      f('Gosta de brincadeiras de ida e volta, como jogar e devolver.', 'CDC'),
    ],
  },
  fazer: [
    'Brincar de esconde-esconde e de "cadê o brinquedo" debaixo do pano.',
    'Avisar quando sair e voltar sempre — é assim que a separação fica previsível.',
    'Deixar espaço livre e seguro no chão para ele treinar o deslocamento.',
    'Nomear objetos e repetir as sílabas que ele fizer.',
    'Instalar proteção em tomadas, escadas e quinas antes de precisar.',
  ],
  atencao: [
    f('Não senta com ajuda.', 'CDC'),
    f('Não balbucia ("mama", "baba", "dada").', 'CDC'),
    f('Não responde ao próprio nome e não parece reconhecer pessoas conhecidas.', 'CDC'),
    f('Não passa brinquedos de uma mão para a outra.', 'CDC'),
  ],
};

const MES_9_10 = {
  id: 'mes-9-10', de: 274, ate: 334, unidade: 'faixa', titulo: '9 e 10 meses',
  chip: '9–10m',
  resumo: 'Idade de avaliação formal do desenvolvimento e de muita interação: apontar, imitar, '
    + 'brincar de ida e volta. O apego a você costuma estar no ponto mais forte.',
  sentindo: [
    {
      titulo: 'Você é a minha base',
      texto: 'Quanto mais ele explora, mais precisa saber que você está ali. Voltar ao seu colo '
        + 'entre uma exploração e outra é parte do processo, não um retrocesso.',
    },
    {
      titulo: 'Entendo mais do que falo',
      texto: 'Seu bebê já entende várias palavras e gestos, mesmo sem falar nenhuma. A distância '
        + 'entre entender e conseguir dizer pode gerar frustração.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Até os 9 meses, a maioria senta sozinha, passa objetos de uma mão para a outra e faz muitos sons diferentes.', 'CDC'),
      f('Até os 9 meses, a maioria procura objetos que saem de vista e reage ao próprio nome.', 'CDC'),
      f('Apontar, dar tchau e bater palma costumam aparecer entre os 9 e os 12 meses.', 'CDC'),
    ],
    sono: [
      f('A ansiedade de separação pode aparecer na hora de dormir e causar mais despertares.', 'AAP'),
      f('Costumam sobrar duas sonecas por dia nesta faixa.', 'AASM'),
      f('Uma rotina previsível antes de dormir ajuda mais do que qualquer mudança brusca.', 'AAP'),
    ],
    comportamento: [
      f('Estranhamento de desconhecidos costuma estar bem presente.', 'CDC'),
      f('A ansiedade de separação costuma se firmar por volta dos 9 meses e seguir até bem depois do primeiro ano.', 'AAP'),
      f('Ele imita gestos e expressões com muita frequência.', 'CDC'),
    ],
    corpo: [
      f('Ficar de pé apoiado em móveis costuma aparecer nesta faixa.', 'CDC'),
      f('A pinça com polegar e indicador começa a se formar.', 'CDC'),
      f('Mais dentes, com períodos de gengiva dolorida e sono pior.', 'NHS'),
    ],
    alimentacao: [
      f('Comer com as mãos vira exercício de coordenação, não só de alimentação.', 'NHS'),
      f('Recusas repentinas de comidas antes aceitas são comuns.', 'NHS'),
      f('Continua valendo: nada de mel antes de 1 ano.', 'AAP'),
    ],
    sentidos: [
      f('Olha para onde você aponta e segue a direção do seu olhar.', 'CDC'),
      f('Reconhece o nome de pessoas e objetos do dia a dia.', 'CDC'),
      f('Gosta de sons que ele mesmo produz: bater, jogar, amassar.', 'CDC'),
    ],
  },
  fazer: [
    'Brincar de dar e receber objetos, revezando.',
    'Nomear o que ele aponta, transformando o gesto em palavra.',
    'Criar despedidas curtas e previsíveis em vez de sair escondido.',
    'Ler livros com figuras e deixá-lo virar as páginas.',
    'Levar as observações do dia a dia para a consulta dos 9 meses.',
  ],
  atencao: [
    f('Não fica de pé com apoio e não senta sem ajuda.', 'CDC'),
    f('Não balbucia nem faz sons variados.', 'CDC'),
    f('Não responde ao próprio nome e não reconhece pessoas familiares.', 'CDC'),
    f('Não olha para onde você aponta e não brinca de ida e volta.', 'CDC'),
  ],
};

const MES_11_12 = {
  id: 'mes-11-12', de: 335, ate: 395, unidade: 'faixa', titulo: '11 e 12 meses',
  chip: '11–12m',
  resumo: 'Primeiro aniversário chegando: primeiras palavras, primeiros passos e muita vontade '
    + 'de decidir sozinho. Tudo com janelas largas.',
  sentindo: [
    {
      titulo: 'Quero do meu jeito',
      texto: 'Seu bebê já tem preferências fortes e ainda não tem palavras para explicá-las. É '
        + 'daí que vem boa parte da frustração desta fase.',
    },
    {
      titulo: 'Estou quase lá',
      texto: 'Andar, falar, comer sozinho: várias habilidades estão quase prontas ao mesmo tempo. '
        + 'Cada bebê termina uma delas primeiro, em ordens diferentes.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Até 1 ano, a maioria dá tchau, chama um dos pais por um nome especial e entende o "não".', 'CDC'),
      f('Até 1 ano, a maioria coloca objetos dentro de um recipiente e usa a pinça com polegar e indicador.', 'CDC'),
      f('Ficar de pé sozinho e andar apoiado nos móveis são comuns; andar sozinho tem janela larga.', 'CDC'),
    ],
    sono: [
      f('Costuma ser a faixa em que muitos bebês passam de duas sonecas para uma — em geral só depois do primeiro ano.', 'AASM'),
      f('Treinar ficar de pé no berço de madrugada é comum.', 'AASM'),
      f('A partir de 1 ano, a faixa recomendada de sono costuma ser de 11 a 14 horas somadas em 24h.', 'AASM'),
    ],
    comportamento: [
      f('Testa limites e observa a sua reação.', 'AAP'),
      f('A ansiedade de separação costuma atingir o ponto mais alto entre 10 e 18 meses.', 'AAP'),
      f('Imita tarefas da casa e gosta de "ajudar".', 'CDC'),
    ],
    corpo: [
      f('A maioria já tem alguns dentes; a quantidade varia muito.', 'NHS'),
      f('O ritmo de ganho de peso desacelera em relação ao primeiro semestre.', 'AAP'),
      f('O equilíbrio melhora rápido, com muitas quedas de bumbum pelo caminho.', 'CDC'),
    ],
    alimentacao: [
      f('A comida da família ganha espaço e o leite deixa de ser a base a partir de 1 ano.', 'AAP'),
      f('Apetite irregular e recusas são comuns e costumam se equilibrar ao longo da semana.', 'NHS'),
      f('Mel continua proibido antes de 1 ano; a partir daí, converse com o pediatra sobre o que introduzir.', 'AAP'),
    ],
    sentidos: [
      f('Entende muitas palavras e ordens simples.', 'CDC'),
      f('Procura objetos escondidos com persistência.', 'CDC'),
      f('Reconhece e prefere pessoas, brinquedos e livros específicos.', 'CDC'),
    ],
  },
  fazer: [
    'Transformar gesto em frase: ele aponta, você nomeia e comenta.',
    'Oferecer brinquedos de encaixar, empilhar e colocar dentro.',
    'Dar escolhas pequenas e possíveis para reduzir a frustração.',
    'Manter rotinas previsíveis, que ajudam mais do que regras novas.',
    'Deixar espaço seguro para treinar ficar de pé e andar.',
  ],
  atencao: [
    f('Não engatinha nem se move para chegar aos lugares.', 'CDC'),
    f('Não fica de pé com apoio.', 'CDC'),
    f('Não procura coisas que você escondeu na frente dele.', 'CDC'),
    f('Não diz nenhuma palavra e não usa gestos como apontar ou dar tchau.', 'CDC'),
  ],
};

const ANO_1 = {
  id: 'ano-1', de: 396, ate: 547, unidade: 'faixa', titulo: '1 ano a 1 ano e meio',
  chip: '1–1,5a',
  resumo: 'Fase de andar, falar as primeiras palavras e querer autonomia. O vocabulário costuma '
    + 'crescer devagar antes de disparar.',
  sentindo: [
    {
      titulo: 'Sou eu quem decide',
      texto: 'A vontade de fazer sozinho cresce muito mais rápido que a capacidade. Essa '
        + 'diferença explica boa parte das crises desta idade.',
    },
    {
      titulo: 'Ainda preciso de você por perto',
      texto: 'Mesmo andando e explorando, ele volta o tempo todo para conferir se você está ali. '
        + 'Esse vai e vem é exatamente o esperado.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Andar sozinho costuma aparecer entre 12 e 18 meses, com janela larga.', 'CDC'),
      f('Primeiras palavras com sentido costumam aparecer nesta faixa, uma de cada vez.', 'CDC'),
      f('Imitar, apontar para pedir e seguir ordens simples costumam ficar frequentes.', 'CDC'),
    ],
    sono: [
      f('A faixa recomendada entre 1 e 2 anos costuma ser de 11 a 14 horas somadas em 24h, incluindo sonecas.', 'AASM'),
      f('A transição de duas sonecas para uma costuma acontecer nesta faixa.', 'AASM'),
      f('Resistência na hora de dormir é comum quando a autonomia cresce.', 'AAP'),
    ],
    comportamento: [
      f('Frustração e birra aparecem porque a vontade passou na frente das palavras.', 'AAP'),
      f('Brinca ao lado de outras crianças antes de brincar com elas.', 'CDC'),
      f('Procura você para compartilhar descobertas.', 'CDC'),
    ],
    corpo: [
      f('O corpo fica mais esguio conforme ele anda mais.', 'AAP'),
      f('Molares podem nascer e incomodar bastante.', 'NHS'),
      f('Quedas fazem parte do aprendizado de andar; o ambiente seguro é o que importa.', 'AAP'),
    ],
    alimentacao: [
      f('A comida da família vira a base; o apetite fica irregular e isso é esperado.', 'NHS'),
      f('Comer sozinho, com as mãos e com colher, melhora com prática e sujeira.', 'NHS'),
      f('Quantidade, leite e suplementos seguem a orientação do pediatra.', 'AAP'),
    ],
    sentidos: [
      f('Entende muito mais palavras do que consegue falar.', 'CDC'),
      f('Reconhece rotinas e antecipa o que vem a seguir.', 'CDC'),
      f('Gosta de texturas, água, areia e de experimentar com o corpo inteiro.', 'AAP'),
    ],
  },
  fazer: [
    'Falar muito e nomear tudo, esperando a resposta dele.',
    'Ler juntos todos os dias, mesmo que sejam dois minutos.',
    'Oferecer escolhas entre duas opções em vez de perguntas abertas.',
    'Manter limites poucos e constantes, sem discurso longo.',
    'Reservar tempo ao ar livre para gastar energia.',
  ],
  atencao: [
    f('Não anda por volta dos 18 meses.', 'CDC'),
    f('Não aponta para mostrar coisas e não usa nenhuma palavra.', 'CDC'),
    f('Perdeu habilidades que já tinha.', 'CDC'),
    f('Não imita gestos nem reage quando você chama o nome dele.', 'CDC'),
  ],
};

const ANO_1_5 = {
  id: 'ano-1-5', de: 548, ate: 730, unidade: 'faixa', titulo: '1 ano e meio a 2 anos',
  chip: '1,5–2a',
  resumo: 'O vocabulário costuma explodir e as emoções ficam grandes demais para o tamanho dele. '
    + 'É a fase em que ajudar a nomear o que sente vale mais do que corrigir.',
  sentindo: [
    {
      titulo: 'Sinto muito e não sei explicar',
      texto: 'Emoções fortes chegam antes das palavras para elas. Nomear em voz alta o que você '
        + 'acha que ele sente ajuda mais do que pedir calma.',
    },
    {
      titulo: 'Quero fazer igual a você',
      texto: 'Imitar é a principal ferramenta de aprendizado agora — inclusive o jeito como os '
        + 'adultos da casa lidam com frustração.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('O vocabulário costuma crescer rápido depois dos 18 meses, com juntada de duas palavras perto dos 2 anos.', 'CDC'),
      f('Correr, subir e descer degraus com apoio ficam mais comuns.', 'CDC'),
      f('Brincadeira de faz de conta simples começa a aparecer.', 'CDC'),
    ],
    sono: [
      f('Costuma sobrar uma soneca por dia, dentro das 11 a 14 horas somadas em 24h.', 'AASM'),
      f('Resistir para dormir e chamar depois de deitar são muito comuns.', 'AAP'),
      f('A previsibilidade da rotina continua sendo a melhor ferramenta.', 'AAP'),
    ],
    comportamento: [
      f('Birras aumentam e costumam ser mais sobre autonomia do que sobre o objeto em disputa.', 'AAP'),
      f('Ele testa limites para descobrir onde eles estão.', 'AAP'),
      f('Começa a mostrar empatia simples, como oferecer um brinquedo para quem está chorando.', 'CDC'),
    ],
    corpo: [
      f('O ritmo de crescimento continua mais lento que no primeiro ano.', 'AAP'),
      f('Molares e caninos costumam nascer nesta faixa.', 'NHS'),
      f('Coordenação melhora rápido: correr, chutar, subir.', 'CDC'),
    ],
    alimentacao: [
      f('Seletividade alimentar é muito comum e costuma passar.', 'NHS'),
      f('O apetite se equilibra ao longo da semana, não do dia.', 'NHS'),
      f('Comer junto da família, sem pressão, é o que mais ajuda.', 'NHS'),
    ],
    sentidos: [
      f('Entende ordens de dois passos.', 'CDC'),
      f('Reconhece partes do corpo e figuras em livros.', 'CDC'),
      f('Busca experiências físicas intensas: pular, escalar, girar.', 'AAP'),
    ],
  },
  fazer: [
    'Nomear a emoção antes de resolver o problema.',
    'Oferecer duas opções em vez de ordens diretas.',
    'Manter rotinas de sono e refeição estáveis.',
    'Brincar de faz de conta simples com objetos do dia a dia.',
    'Elogiar o esforço, não só o resultado.',
  ],
  atencao: [
    f('Não fala nenhuma palavra por volta dos 18 meses, ou não junta duas palavras perto dos 2 anos.', 'CDC'),
    f('Não imita e não aponta para mostrar coisas.', 'CDC'),
    f('Perdeu habilidades que já tinha.', 'CDC'),
    f('Não anda com firmeza depois dos 18 meses.', 'CDC'),
  ],
};

const DEPOIS = {
  id: 'apos-2a', de: 731, ate: Infinity, unidade: 'faixa', titulo: '2 anos ou mais',
  chip: '2a+',
  resumo: 'A partir daqui o desenvolvimento se espalha em muitas direções ao mesmo tempo, e as '
    + 'janelas ficam ainda mais largas entre crianças.',
  sentindo: [
    {
      titulo: 'Quero entender o mundo',
      texto: 'Perguntas, faz de conta e repetição são a forma de ele organizar o que aprende. '
        + 'Responder com paciência vale mais do que responder certo.',
    },
  ],
  blocos: {
    desenvolvimento: [
      f('Frases curtas, faz de conta e brincadeira com outras crianças costumam ganhar espaço.', 'CDC'),
      f('Correr, pular e subir ficam mais coordenados.', 'CDC'),
      f('As janelas de marcos ficam mais largas: comparar com outras crianças ajuda pouco.', 'CDC'),
    ],
    sono: [
      f('Entre 3 e 5 anos, a faixa recomendada costuma ser de 10 a 13 horas somadas em 24h.', 'AASM'),
      f('A soneca vai sumindo ao longo desta fase, em idades bem diferentes.', 'AASM'),
      f('Medos noturnos e despertares são comuns e costumam passar.', 'AAP'),
    ],
    comportamento: [
      f('Autonomia e limites continuam em negociação constante.', 'AAP'),
      f('Amizades e brincadeiras em grupo começam a importar.', 'CDC'),
      f('Rotinas previsíveis continuam sendo o que mais ajuda.', 'AAP'),
    ],
    corpo: [
      f('Crescimento mais lento e constante.', 'AAP'),
      f('A dentição de leite se completa ao longo desta fase.', 'NHS'),
      f('Coordenação fina melhora: desenhar, encaixar, vestir.', 'CDC'),
    ],
    alimentacao: [
      f('Seletividade pode continuar; oferecer sem pressão segue sendo a melhor estratégia.', 'NHS'),
      f('Comer junto da família continua sendo o maior fator de influência.', 'NHS'),
      f('Dúvidas sobre crescimento e alimentação seguem com o pediatra.', 'AAP'),
    ],
    sentidos: [
      f('Linguagem vira a principal ferramenta de exploração.', 'CDC'),
      f('Interesse por histórias, músicas e regras de brincadeira aumenta.', 'CDC'),
      f('Consegue descrever o que sente com mais precisão.', 'CDC'),
    ],
  },
  fazer: [
    'Conversar bastante, com frases completas e perguntas abertas.',
    'Ler todo dia e deixar a criança contar a história do jeito dela.',
    'Manter limites claros e previsíveis.',
    'Garantir tempo de brincadeira livre e ao ar livre.',
    'Levar dúvidas de desenvolvimento para as consultas de rotina.',
  ],
  atencao: [
    f('Não junta duas palavras aos 2 anos.', 'CDC'),
    f('Perdeu habilidades que já tinha.', 'CDC'),
    f('Não brinca de faz de conta e não se interessa por outras crianças.', 'CDC'),
  ],
};

export const FASES = [
  SEMANA_1, SEMANA_2, SEMANA_3, SEMANA_4, SEMANA_5, SEMANA_6, SEMANA_7, SEMANA_8,
  MES_2, MES_3, MES_4, MES_5, MES_6, MES_7_8, MES_9_10, MES_11_12, ANO_1, ANO_1_5, DEPOIS,
];

/* ================================================================ seleção */

/** A fase que vale para uma idade em dias. Fora da faixa (idade inválida): null. */
export function faseParaIdade(dias) {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return null;
  return FASES.find((fase) => dias >= fase.de && dias <= fase.ate) || null;
}

/** Índice da fase na linha do tempo — usado pela régua de fases da tela. */
export function indiceDaFase(id) {
  return FASES.findIndex((fase) => fase.id === id);
}

/**
 * Salto de desenvolvimento ativo nesta idade, ou null.
 * Recebe dias porque, com data prevista do parto no cadastro, o certo é passar
 * a idade corrigida — as janelas de salto são contadas a partir dela.
 */
export function saltoParaIdade(dias) {
  if (dias == null || !Number.isFinite(dias) || dias < 0) return null;
  return SALTOS.find((s) => dias >= s.de && dias <= s.ate) || null;
}

/** Sinais de urgência que valem para a idade (só enquanto o bebê é pequeno). */
export function urgenteParaIdade(dias) {
  if (dias == null || dias < 0 || dias > URGENTE.ate) return null;
  return URGENTE;
}

/**
 * Idade em texto curto para o título: "18 dias", "2 semanas", "5 meses".
 * A unidade acompanha a granularidade da fase: até 8 semanas fala em semanas,
 * depois em meses — é como os pais contam.
 */
export function idadeTexto(dias) {
  if (dias == null || dias < 0) return '';
  if (dias === 0) return 'recém-nascido';
  if (dias < 14) return dias === 1 ? '1 dia' : `${dias} dias`;
  if (dias < 56) {
    const sem = Math.floor(dias / 7);
    return `${sem} semanas`;
  }
  const meses = Math.floor(dias / 30.4375);
  if (meses < 12) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const base = anos === 1 ? '1 ano' : `${anos} anos`;
  return resto ? `${base} e ${resto} ${resto === 1 ? 'mês' : 'meses'}` : base;
}

/** Quanto falta para a próxima fase, em dias (null na última). */
export function diasAteProximaFase(dias) {
  const fase = faseParaIdade(dias);
  if (!fase || !Number.isFinite(fase.ate)) return null;
  return fase.ate - dias + 1;
}

/** Todas as siglas de fonte citadas numa fase (para o rodapé "de onde vem"). */
export function fontesDaFase(fase) {
  if (!fase) return [];
  const siglas = new Set();
  Object.values(fase.blocos).forEach((lista) => lista.forEach((it) => siglas.add(it.fonte)));
  (fase.atencao || []).forEach((it) => siglas.add(it.fonte));
  return [...siglas].filter((s) => FONTES[s]);
}
