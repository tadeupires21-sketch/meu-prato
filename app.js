/* Meu Prato — acompanhamento alimentar pessoal.
   Sem dependências. Dados em localStorage (um documento JSON por modo: real e demonstração).
   Regras que valem em todo o arquivo:
   - Cada registro de consumo guarda os nutrientes já calculados (snapshot). Editar um
     alimento/receita depois NÃO altera dias anteriores.
   - Nenhum valor nutricional é inventado: só existe o que o usuário cadastrou.
   - Medidas caseiras (unidade, colher, scoop) só valem se tiverem equivalência cadastrada. */
(() => {
'use strict';

// ---------- Armazenamento ----------
const CHAVE_REAL = 'meuprato.v1';
const CHAVE_DEMO = 'meuprato.demo.v1';
const CHAVE_MODO = 'meuprato.modo';
const VERSAO_DADOS = 1;
const REFEICOES_PADRAO = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar'];
// Definição central dos nutrientes. Os quatro primeiros são obrigatórios no cadastro; os opcionais podem ser
// null = "não informado" (diferente de 0). Somas só consideram valores conhecidos e informam a cobertura.
const NUTR = [
  { k: 'kcal', nome: 'Calorias', un: 'kcal', dec: 0, obrigatorio: true, meta: 'meta' },
  { k: 'prot', nome: 'Proteínas', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'carb', nome: 'Carboidratos', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'gord', nome: 'Gorduras', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'fibra', nome: 'Fibras', un: 'g', dec: 1, obrigatorio: false, meta: 'meta' },
  { k: 'sodio', nome: 'Sódio', un: 'mg', dec: 0, obrigatorio: false, meta: 'limite' },
];
const NUTR_OBRIG = NUTR.filter((n) => n.obrigatorio).map((n) => n.k);
const NUTR_OPC = NUTR.filter((n) => !n.obrigatorio).map((n) => n.k);
const METAS_VAZIAS = () => Object.fromEntries(NUTR.map((n) => [n.k, null]));
// Alimentos comuns, por 100 g de parte comestível, copiados da TACO 4ª edição (NEPA/Unicamp, 2011).
// Entram como cadastro normal (editável) e levam o campo `fonte`. Sem medidas caseiras de propósito:
// peso de "1 unidade" ou "1 colher" varia, então o usuário cadastra a equivalência que pesou.
const FONTE_TACO = 'TACO 4ª ed. (NEPA/Unicamp)';
// `medidas` aqui são pesos médios APROXIMADOS, de tabelas de medidas caseiras que divergem entre si;
// por isso entram com `obs` e o usuário deve conferir pesando. Onde não há consenso, não há medida.
const OBS_MEDIDA = 'Peso por unidade é média aproximada; pese o seu e ajuste a equivalência.';
const ALIMENTOS_BASE = [
  { nome: 'Ovo de galinha inteiro, cozido', estado: 'cozido', kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5, fibra: null, sodio: 146, medidas: [{ nome: 'unidade', equivale: 50 }], obs: OBS_MEDIDA },
  { nome: 'Arroz branco tipo 1, cozido', estado: 'cozido', kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2, fibra: 1.6, sodio: 1 },
  { nome: 'Feijão carioca, cozido', estado: 'cozido', kcal: 76, prot: 4.8, carb: 13.6, gord: 0.5, fibra: 8.5, sodio: 2 },
  { nome: 'Frango, peito sem pele, grelhado', estado: 'cozido', kcal: 159, prot: 32.0, carb: 0, gord: 2.5, fibra: null, sodio: 50 },
  { nome: 'Pão de forma integral', estado: 'na', kcal: 253, prot: 9.4, carb: 49.9, gord: 3.7, fibra: 6.9, sodio: 506, medidas: [{ nome: 'fatia', equivale: 25 }], obs: 'Fatia de 25 g é média; o rótulo da sua marca traz o peso exato e os valores dela.' },
  { nome: 'Banana prata, crua', estado: 'cru', kcal: 98, prot: 1.3, carb: 26.0, gord: 0.1, fibra: 2, sodio: 0, medidas: [{ nome: 'unidade', equivale: 65 }], obs: OBS_MEDIDA },
  { nome: 'Aveia em flocos, crua', estado: 'cru', kcal: 394, prot: 13.9, carb: 66.6, gord: 8.5, fibra: 9.1, sodio: 5, medidas: [{ nome: 'colher de sopa', equivale: 15 }], obs: 'Colher de sopa de 15 g é média; varia com flocos finos/grossos e colher cheia/rasa.' },
  { nome: 'Batata-doce, cozida', estado: 'cozido', kcal: 77, prot: 0.6, carb: 18.4, gord: 0.1, fibra: 2.2, sodio: 3, obs: 'Sem medida por unidade: o tamanho varia demais. Pese e cadastre a sua.' },
  { nome: 'Maçã Fuji com casca, crua', estado: 'cru', kcal: 56, prot: 0.3, carb: 15.2, gord: 0, fibra: 1.3, sodio: 0, obs: 'Sem medida por unidade: tabelas divergem (de 100 a 160 g). Pese uma e cadastre "unidade".' },
  { nome: 'Feijão preto, cozido', estado: 'cozido', kcal: 77, prot: 4.5, carb: 14.0, gord: 0.5, fibra: 8.4, sodio: 2 },
  { nome: 'Abacate, cru', estado: 'cru', kcal: 96, prot: 1.2, carb: 6.0, gord: 8.4, fibra: 6.3, sodio: 0, obs: 'Sem medida por unidade: o tamanho varia muito. Pese a polpa.' },
  { nome: 'Iogurte natural integral', estado: 'na', kcal: 51, prot: 4.1, carb: 1.9, gord: 3, fibra: null, sodio: 52.0, obs: 'Valor médio da TACO; o rótulo da sua marca é mais preciso (marcas variam bastante).' },
  { nome: 'Iogurte natural desnatado', estado: 'na', kcal: 41, prot: 3.8, carb: 5.8, gord: 0.3, fibra: null, sodio: 60, obs: 'Valor médio da TACO; o rótulo da sua marca é mais preciso.' },
  { nome: 'Leite de vaca integral', estado: 'na', refUnidade: 'ml', kcal: 60, prot: 3.2, carb: 4.5, gord: 3.3, fonte: 'Média de tabelas (TACO não informa leite líquido)', obs: 'A TACO 4ª ed. não traz valores para leite de vaca líquido (só em pó). Estes são valores médios de outras tabelas, por 100 ml. Prefira o rótulo da sua marca.' },
  { nome: 'Queijo minas frescal', estado: 'na', kcal: 264, prot: 17.4, carb: 3.2, gord: 20.2, fibra: null, sodio: 31 },
  { nome: 'Queijo muçarela', estado: 'na', kcal: 330, prot: 22.6, carb: 3.0, gord: 25.2, fibra: null, sodio: 581, obs: 'Fatia varia de 15 a 30 g conforme o corte: pese ou use o rótulo.' },
  { nome: 'Pão francês', estado: 'na', kcal: 300, prot: 8.0, carb: 58.6, gord: 3.1, fibra: 2.3, sodio: 648, medidas: [{ nome: 'unidade', equivale: 50 }], obs: 'Unidade de 50 g é o padrão de padaria, mas varia; pese o seu.' },
  { nome: 'Batata inglesa, cozida', estado: 'cozido', kcal: 52, prot: 1.2, carb: 11.9, gord: 0, fibra: 1.3, sodio: 2 },
  { nome: 'Ovo de galinha inteiro, frito', estado: 'cozido', kcal: 240, prot: 15.6, carb: 1.2, gord: 18.6, fibra: null, sodio: 166, obs: 'Valor já inclui a gordura absorvida na fritura (média TACO). Sem unidade: o peso frito varia com o óleo.' },
  { nome: 'Carne bovina, patinho sem gordura, grelhado', estado: 'cozido', kcal: 219, prot: 35.9, carb: 0, gord: 7.3, fibra: null, sodio: 60 },
  { nome: 'Mamão papaia, cru', estado: 'cru', kcal: 40, prot: 0.5, carb: 10.4, gord: 0.1, fibra: 1, sodio: 2 },
  { nome: 'Laranja pêra, crua', estado: 'cru', kcal: 37, prot: 1.0, carb: 8.9, gord: 0.1, fibra: 0.8, sodio: 0, obs: 'Sem medida por unidade: pese a laranja descascada.' },
  { nome: 'Tomate com semente, cru', estado: 'cru', kcal: 15, prot: 1.1, carb: 3.1, gord: 0.2, fibra: 1.2, sodio: 1 },
  { nome: 'Azeite de oliva extra virgem', estado: 'na', kcal: 884, prot: 0, carb: 0, gord: 100, obs: 'Sem medida de colher: tabelas vão de 8 a 13 g. Pese uma colher sua e cadastre.' },
  { nome: 'Banana nanica, crua', estado: 'cru', kcal: 92, prot: 1.4, carb: 23.8, gord: 0.1, fibra: 1.9, sodio: 0, obs: 'Sem medida por unidade: a nanica varia de 80 a 120 g. Pese uma e cadastre "unidade".' },
  { nome: 'Cuscuz de milho, cozido com sal', estado: 'cozido', kcal: 113, prot: 2.2, carb: 25.3, gord: 0.7, fibra: 2.1, sodio: 248 },
  { nome: 'Atum em conserva em óleo', estado: 'na', kcal: 166, prot: 26.2, carb: 0, gord: 6, fibra: null, sodio: 362.0, obs: 'Valor TACO para o atum em óleo; drenado muda pouco. Lata pequena tem ~120 g drenados, confira no rótulo.' },
  { nome: 'Sardinha em conserva em óleo', estado: 'na', kcal: 285, prot: 15.9, carb: 0, gord: 24, fibra: null, sodio: 666.0 },
  { nome: 'Requeijão cremoso', estado: 'na', kcal: 257, prot: 9.6, carb: 2.4, gord: 23.4, fibra: null, sodio: 558, obs: 'Média TACO; marcas e versões light variam muito. Rótulo é mais preciso.' },
  { nome: 'Carne bovina, acém moído, cozido', estado: 'cozido', kcal: 212, prot: 26.7, carb: 0, gord: 10.9, fibra: null, sodio: 52 },
  { nome: 'Carne bovina, coxão mole sem gordura, cozido', estado: 'cozido', kcal: 219, prot: 32.4, carb: 0, gord: 8.9, fibra: null, sodio: 44 },
  { nome: 'Carne bovina, contra-filé com gordura, grelhado', estado: 'cozido', kcal: 278, prot: 32.4, carb: 0, gord: 15.5, fibra: null, sodio: 57 },
  { nome: 'Frango, sobrecoxa sem pele, assada', estado: 'cozido', kcal: 233, prot: 29.2, carb: 0, gord: 12, fibra: null, sodio: 106.0 },
  { nome: 'Pescada, filé, frito', estado: 'cozido', kcal: 154, prot: 28.6, carb: 0, gord: 3.6, fibra: null, sodio: 115, obs: 'Filé frito sem farinha. Empanado (com farinha de trigo) é outro item na TACO, 283 kcal.' },
  { nome: 'Mandioca, cozida', estado: 'cozido', kcal: 125, prot: 0.6, carb: 30.1, gord: 0.3, fibra: 1.6, sodio: 1 },
  { nome: 'Batata inglesa, frita', estado: 'cozido', kcal: 267, prot: 5.0, carb: 35.6, gord: 13.1, fibra: 8.1, sodio: 2 },
  { nome: 'Arroz integral, cozido', estado: 'cozido', kcal: 124, prot: 2.6, carb: 25.8, gord: 1, fibra: 2.7, sodio: 1.0 },
  { nome: 'Lentilha, cozida', estado: 'cozido', kcal: 93, prot: 6.3, carb: 16.3, gord: 0.5, fibra: 7.9, sodio: 1 },
  { nome: 'Manga Palmer, crua', estado: 'cru', kcal: 72, prot: 0.4, carb: 19.4, gord: 0.2, fibra: 1.6, sodio: 2 },
  { nome: 'Morango, cru', estado: 'cru', kcal: 30, prot: 0.9, carb: 6.8, gord: 0.3, fibra: 1.7, sodio: 0 },
  { nome: 'Abacaxi, cru', estado: 'cru', kcal: 48, prot: 0.9, carb: 12.3, gord: 0.1, fibra: 1, sodio: 0 },
  { nome: 'Goiaba vermelha com casca, crua', estado: 'cru', kcal: 54, prot: 1.1, carb: 13.0, gord: 0.4, fibra: 6.2, sodio: 0 },
  { nome: 'Melancia, crua', estado: 'cru', kcal: 33, prot: 0.9, carb: 8.1, gord: 0, fibra: 0.1, sodio: 0 },
  { nome: 'Biscoito salgado cream cracker', estado: 'na', kcal: 432, prot: 10.1, carb: 68.7, gord: 14.4, fibra: 2.5, sodio: 854, obs: 'Média TACO; o rótulo do pacote traz peso por unidade e valores da marca.' },
  { nome: 'Queijo prato', estado: 'na', kcal: 360, prot: 22.7, carb: 1.9, gord: 29.1, fibra: null, sodio: 580 },
  { nome: 'Leite de vaca integral em pó', estado: 'na', kcal: 497, prot: 25.4, carb: 39.2, gord: 26.9, fibra: null, sodio: 323, obs: 'Rótulo da marca traz o peso da colher/medida.' },
  { nome: 'Brócolis, cozido', estado: 'cozido', kcal: 25, prot: 2.1, carb: 4.4, gord: 0.5, fibra: 3.4, sodio: 2 },
  { nome: 'Cenoura, cozida', estado: 'cozido', kcal: 30, prot: 0.8, carb: 6.7, gord: 0.2, fibra: 2.6, sodio: 8 },
  { nome: 'Abobrinha italiana, cozida', estado: 'cozido', kcal: 15, prot: 1.1, carb: 3.0, gord: 0.2, fibra: 1.6, sodio: 1 },
  { nome: 'Tilápia, filé, cru', estado: 'cru', kcal: 94, prot: 18.1, carb: 0, gord: 2.3, fibra: 0, sodio: 52, fonte: 'TBCA (USP) BRC0031E', obs: 'Não está na TACO. TBCA informa 393 kJ por 100 g (94 kcal). Pese cru: ao grelhar perde água e 100 g prontos concentram mais.' },
  { nome: 'Tilápia, filé sem pele, grelhado sem óleo e sem sal', estado: 'cozido', kcal: 90, prot: 18.5, carb: 0, gord: 1.73, fibra: 0, sodio: 50.3, fonte: 'TBCA (USP) BRC0486E', obs: 'Não está na TACO. TBCA informa 378 kJ por 100 g (90 kcal). Grelhado na chapa sem óleo. Se usar óleo, veja a versão com óleo de soja.' },
  { nome: 'Tilápia, filé sem pele, grelhado com óleo de soja, sem sal', estado: 'cozido', kcal: 114, prot: 18.0, carb: 0, gord: 4.68, fibra: 0, sodio: 48.7, fonte: 'TBCA (USP) BRC0488E', obs: 'Não está na TACO. TBCA informa 478 kJ por 100 g (114 kcal). Inclui o óleo absorvido no preparo. Sal à parte: registre se quiser acompanhar sódio.' },
  { nome: 'Alface crespa, crua', estado: 'cru', kcal: 11, prot: 1.3, carb: 1.7, gord: 0.2, fibra: 1.8, sodio: 3 },
  { nome: 'Couve manteiga, crua', estado: 'cru', kcal: 27, prot: 2.9, carb: 4.3, gord: 0.5, fibra: 3.1, sodio: 6 },
  { nome: 'Couve manteiga, refogada', estado: 'cozido', kcal: 90, prot: 1.7, carb: 8.7, gord: 6.6, fibra: 5.7, sodio: 11, obs: 'Inclui o óleo do refogado (média TACO).' },
  { nome: 'Couve-flor, cozida', estado: 'cozido', kcal: 19, prot: 1.2, carb: 3.9, gord: 0.3, fibra: 2.1, sodio: 2 },
  { nome: 'Beterraba, cozida', estado: 'cozido', kcal: 32, prot: 1.3, carb: 7.2, gord: 0.1, fibra: 1.9, sodio: 23 },
  { nome: 'Chuchu, cozido', estado: 'cozido', kcal: 19, prot: 0.4, carb: 4.8, gord: 0, fibra: 1, sodio: 2 },
  { nome: 'Pepino, cru', estado: 'cru', kcal: 10, prot: 0.9, carb: 2, gord: 0, fibra: 1.1, sodio: 0 },
  { nome: 'Cebola, crua', estado: 'cru', kcal: 39, prot: 1.7, carb: 8.9, gord: 0.1, fibra: 2.2, sodio: 1 },
  { nome: 'Milho verde enlatado, drenado', estado: 'na', kcal: 98, prot: 3.2, carb: 17.1, gord: 2.4, fibra: 4.6, sodio: 260 },
  { nome: 'Feijão fradinho, cozido', estado: 'cozido', kcal: 78, prot: 5.1, carb: 13.5, gord: 0.6, fibra: 7.5, sodio: 1 },
  { nome: 'Salmão sem pele, fresco, grelhado', estado: 'cozido', kcal: 243, prot: 26.1, carb: 0, gord: 14.5, fibra: null, sodio: 96 },
  { nome: 'Carne bovina, maminha, grelhada', estado: 'cozido', kcal: 153, prot: 30.7, carb: 0, gord: 2.4, fibra: null, sodio: 58, obs: 'TACO: mesma energia da crua por 100 g porque a grelhada perde água e gordura. Prefira pesar como vai comer (pronta).' },
  { nome: 'Carne bovina, maminha, crua', estado: 'cru', kcal: 153, prot: 20.9, carb: 0, gord: 7, fibra: null, sodio: 37, obs: 'Valor cru: use se pesar antes de preparar.' },
  { nome: 'Purê de batata com manteiga e sal', estado: 'cozido', kcal: 87, prot: 1.73, carb: 11.4, gord: 4.09, fibra: 1.26, sodio: 141, fonte: 'TBCA (USP) BRC1195B', obs: 'Não está na TACO. Receita-padrão TBCA: batata inglesa, leite integral, manteiga e sal; TBCA informa 364 kJ por 100 g. Purê caseiro varia com a quantidade de manteiga e leite.' },
  { nome: 'Purê de batata com margarina e sal', estado: 'cozido', kcal: 80, prot: 1.72, carb: 11.4, gord: 3.34, fibra: 1.26, sodio: 143, fonte: 'TBCA (USP) BRC0323B', obs: 'Não está na TACO. Receita-padrão TBCA: batata inglesa, leite integral, margarina e sal; TBCA informa 335 kJ por 100 g.' },
  { nome: 'Carne bovina, miolo de alcatra sem gordura, grelhado', estado: 'cozido', kcal: 241, prot: 31.9, carb: 0, gord: 11.6, fibra: null, sodio: 52 },
  { nome: 'Porco, lombo, assado', estado: 'cozido', kcal: 210, prot: 35.7, carb: 0, gord: 6.4, fibra: null, sodio: 39 },
  { nome: 'Presunto sem capa de gordura', estado: 'na', kcal: 94, prot: 14.3, carb: 2.1, gord: 2.7, fibra: null, sodio: 1039, obs: 'Fatia varia de 15 a 25 g; rótulo da marca é mais preciso.' },
  { nome: 'Queijo parmesão', estado: 'na', kcal: 453, prot: 35.6, carb: 1.7, gord: 33.5, fibra: null, sodio: 1844 },
  { nome: 'Queijo ricota', estado: 'na', kcal: 140, prot: 12.6, carb: 3.8, gord: 8.1, fibra: null, sodio: 283 },
  { nome: 'Manteiga com sal', estado: 'na', kcal: 726, prot: 0.4, carb: 0.1, gord: 82.4, fibra: null, sodio: 579, obs: 'Sem medida de colher: pese ou use o rótulo.' },
  { nome: 'Mel de abelha', estado: 'na', kcal: 309, prot: 0, carb: 84, gord: 0, fibra: null, sodio: 6 },
  { nome: 'Açúcar refinado', estado: 'na', kcal: 387, prot: 0.3, carb: 99.5, gord: 0, fibra: null, sodio: 6, obs: 'Colher de chá/sopa varia (5 a 15 g); pese a sua.' },
  { nome: 'Farinha de mandioca, torrada', estado: 'na', kcal: 365, prot: 1.2, carb: 89.2, gord: 0.3, fibra: 6.5, sodio: 10 },
  { nome: 'Tapioca com manteiga', estado: 'cozido', kcal: 348, prot: 0.1, carb: 63.6, gord: 10.9, fibra: 0, sodio: 158, obs: 'Preparo pronto (goma + manteiga), média TACO.' },
  { nome: 'Pão de queijo, assado', estado: 'cozido', kcal: 363, prot: 5.1, carb: 34.2, gord: 24.6, fibra: 0.6, sodio: 773, obs: 'Unidade varia de 20 a 60 g: pese a sua.' },
  { nome: 'Biscoito doce maisena', estado: 'na', kcal: 443, prot: 8.1, carb: 75.2, gord: 12, fibra: 2.1, sodio: 352, obs: 'Unidade ≈ 5 a 7 g conforme a marca; veja o rótulo.' },
  { nome: 'Chocolate ao leite', estado: 'na', kcal: 540, prot: 7.2, carb: 59.6, gord: 30.3, fibra: 2.2, sodio: 77 },
  { nome: 'Chocolate meio amargo', estado: 'na', kcal: 475, prot: 4.9, carb: 62.4, gord: 29.9, fibra: 4.9, sodio: 9 },
  { nome: 'Amendoim torrado, salgado', estado: 'na', kcal: 606, prot: 22.5, carb: 18.7, gord: 54, fibra: 7.8, sodio: 376 },
  { nome: 'Castanha-de-caju torrada, salgada', estado: 'na', kcal: 570, prot: 18.5, carb: 29.1, gord: 46.3, fibra: 3.7, sodio: 125 },
  { nome: 'Castanha-do-Brasil, crua', estado: 'cru', kcal: 643, prot: 14.5, carb: 15.1, gord: 63.5, fibra: 7.9, sodio: 1, obs: 'Unidade ≈ 4 a 5 g; pese.' },
  { nome: 'Uva Itália, crua', estado: 'cru', kcal: 53, prot: 0.7, carb: 13.6, gord: 0.2, fibra: 0.9, sodio: 0 },
  { nome: 'Melão, cru', estado: 'cru', kcal: 29, prot: 0.7, carb: 7.5, gord: 0, fibra: 0.3, sodio: 11 },
  { nome: 'Tangerina Poncã, crua', estado: 'cru', kcal: 38, prot: 0.8, carb: 9.6, gord: 0.1, fibra: 0.9, sodio: 0 },
  { nome: 'Café, infusão 10%', estado: 'na', kcal: 9, prot: 0.7, carb: 1.5, gord: 0.1, fibra: null, sodio: 1, refUnidade: 'ml', obs: 'Café coado sem açúcar, por 100 ml.' },
  { nome: 'Suco de laranja pêra', estado: 'na', kcal: 33, prot: 0.7, carb: 7.6, gord: 0.1, fibra: 0, sodio: 0, refUnidade: 'ml', obs: 'Suco natural, por 100 ml.' },
  { nome: 'Refrigerante tipo cola', estado: 'na', kcal: 34, prot: 0, carb: 8.7, gord: 0, fibra: null, sodio: 7, refUnidade: 'ml', obs: 'Por 100 ml; versão com açúcar.' },
  { nome: 'Macarrão de trigo com ovos, cru', estado: 'cru', kcal: 371, prot: 10.3, carb: 76.6, gord: 2, fibra: 2.3, sodio: 15, obs: 'Valor do macarrão CRU. A TACO não traz cozido; pese cru antes de cozinhar (cozido rende ~2,2 a 2,5× o peso).' },
  { nome: 'Polenta pré-cozida', estado: 'cozido', kcal: 103, prot: 2.3, carb: 23.3, gord: 0.3, fibra: 2.4, sodio: 442 },
  { nome: 'Pipoca com óleo, sem sal', estado: 'cozido', kcal: 448, prot: 9.9, carb: 70.3, gord: 15.9, fibra: 14.3, sodio: 4 },
];
// Modelos: abrem o formulário já preenchido com o que não varia; valores vêm do rótulo do produto.
const MODELOS_BASE = [
  { nome: 'Whey protein', refQtd: 30, refUnidade: 'g', medidas: [{ nome: 'scoop', equivale: 30 }], obs: 'Confira no rótulo a porção (g) e o peso do scoop; aqui está pré-preenchido 30 g, o mais comum.' },
];

function dadosVazios() {
  return {
    versao: VERSAO_DADOS,
    config: { metas: METAS_VAZIAS(), historicoMetas: [], refeicoesPadrao: [...REFEICOES_PADRAO], consultarOFF: true, metaAgua: 2000, copoAgua: 250 },
    alimentos: [], receitas: [], dias: {}, recentes: [], porcoes: {}, combinacoes: []
  };
}
function modoDemo() { try { return localStorage.getItem(CHAVE_MODO) === 'demo'; } catch { return false; } }
function chaveAtual() { return modoDemo() ? CHAVE_DEMO : CHAVE_REAL; }

const UI = { aba: 'hoje', data: hojeISO(), filtroAlimentos: 'todos', buscaAlimentos: '', histDias: 7, falhaSalvar: null, dadosCorrompidos: null };
let D = carregar();
function carregar() {
  let bruto = null;
  try { bruto = localStorage.getItem(chaveAtual()); } catch { /* sem acesso */ }
  if (!bruto) {
    const novo = dadosVazios();
    if (modoDemo()) semearDemo(novo);
    return novo;
  }
  let erro = null;
  try {
    const obj = JSON.parse(bruto);
    const v = validarDados(obj);
    if (v.ok) return normalizar(obj);
    erro = v.erro;
  } catch (e) { erro = 'falha ao ler: ' + e.message; }
  // Conteúdo inválido: guarda o original à parte (nunca sobrescreve) e começa vazio, avisando.
  console.warn('Dados locais inválidos:', erro);
  try { if (!localStorage.getItem(chaveAtual() + '.corrompido')) localStorage.setItem(chaveAtual() + '.corrompido', bruto); } catch { /* sem espaço: o original continua na chave principal até a próxima gravação */ }
  UI.dadosCorrompidos = { erro, tamanho: bruto.length };
  return dadosVazios();
}
function brutoCorrompido() { try { return localStorage.getItem(chaveAtual() + '.corrompido'); } catch { return null; } }
// Retorna true só se gravou. Em falha, mostra banner persistente e bloqueia toasts de sucesso por alguns segundos,
// para o aviso de erro não ser coberto por "salvo com sucesso" de quem chamou.
function salvar() {
  try {
    localStorage.setItem(chaveAtual(), JSON.stringify(D));
    if (UI.falhaSalvar) { UI.falhaSalvar = null; mostrarBannerErro(); }
    return true;
  } catch (e) {
    console.error(e);
    UI.falhaSalvar = 'A última alteração NÃO foi salva (armazenamento cheio ou bloqueado). Exporte um backup em Ajustes antes de continuar.';
    mostrarBannerErro(); toast('Não foi possível salvar.', { erro: true });
    return false;
  }
}
function mostrarBannerErro() { const b = $('#erro-banner'); if (!b) return; const msg = UI.falhaSalvar || (UI.dadosCorrompidos ? 'Os dados salvos neste navegador estavam ilegíveis e foram preservados à parte. Veja Ajustes → Dados e privacidade.' : ''); b.textContent = msg; b.hidden = !msg; }
function normalizar(obj) {
  const base = dadosVazios();
  obj.config = Object.assign(base.config, obj.config || {});
  obj.config.metas = Object.assign(base.config.metas, obj.config.metas || {});
  for (const k of NUTR_OPC) if (obj.config.metas[k] === undefined) obj.config.metas[k] = null;
  // Vigência das metas: quem já tinha metas antes deste recurso recebe um registro "desde sempre", marcado como
  // anterior à vigência (não é inferência de valor: é a meta que estava em uso de fato).
  if (!Array.isArray(obj.config.historicoMetas)) obj.config.historicoMetas = [];
  if (!obj.config.historicoMetas.length && Object.values(obj.config.metas).some((v) => v != null)) obj.config.historicoMetas.push({ desde: '1970-01-01', metas: { ...obj.config.metas }, origem: 'anterior ao registro de vigência' });
  obj.config.historicoMetas.sort((a, b) => a.desde.localeCompare(b.desde));
  if (typeof obj.config.consultarOFF !== 'boolean') obj.config.consultarOFF = true;
  if (!(obj.config.metaAgua > 0)) obj.config.metaAgua = 2000;
  if (!(obj.config.copoAgua > 0)) obj.config.copoAgua = 250;
  for (const dia of Object.values(obj.dias)) if (!Array.isArray(dia.agua)) dia.agua = [];
  if (!Array.isArray(obj.config.refeicoesPadrao) || !obj.config.refeicoesPadrao.length) obj.config.refeicoesPadrao = [...REFEICOES_PADRAO];
  obj.alimentos = obj.alimentos || []; obj.receitas = obj.receitas || []; obj.dias = obj.dias || {}; obj.recentes = obj.recentes || []; obj.porcoes = obj.porcoes || {}; obj.combinacoes = obj.combinacoes || [];
  for (const a of obj.alimentos) { a.medidas = a.medidas || []; a.favorito = !!a.favorito; }
  for (const r of obj.receitas) { r.ingredientes = r.ingredientes || []; r.favorito = !!r.favorito; }
  return obj;
}
function ehNum(v) { return typeof v === 'number' && isFinite(v); }
function ehNumNaoNeg(v) { return ehNum(v) && v >= 0; }
function ehObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
// Valida estrutura e regras de domínio antes de aceitar dados (do armazenamento ou de um backup).
// Campos novos são opcionais, para backups antigos continuarem válidos.
function validarDados(obj) {
  if (!ehObj(obj)) return { ok: false, erro: 'não é um objeto JSON' };
  if (typeof obj.versao !== 'number') return { ok: false, erro: 'campo "versao" ausente' };
  if (obj.versao > VERSAO_DADOS) return { ok: false, erro: `versão ${obj.versao} é mais nova que a do app (${VERSAO_DADOS})` };
  if (!Array.isArray(obj.alimentos)) return { ok: false, erro: '"alimentos" deve ser uma lista' };
  if (!Array.isArray(obj.receitas)) return { ok: false, erro: '"receitas" deve ser uma lista' };
  if (!ehObj(obj.dias)) return { ok: false, erro: '"dias" deve ser um objeto por data' };
  if (obj.config !== undefined) {
    if (!ehObj(obj.config)) return { ok: false, erro: '"config" inválida' };
    const m = obj.config.metas;
    if (m !== undefined) {
      if (!ehObj(m)) return { ok: false, erro: 'metas inválidas' };
      for (const k of NUTR.map((n) => n.k)) if (m[k] != null && !ehNumNaoNeg(m[k])) return { ok: false, erro: `meta de ${k} inválida` };
    }
    if (obj.config.historicoMetas !== undefined) {
      if (!Array.isArray(obj.config.historicoMetas)) return { ok: false, erro: 'histórico de metas inválido' };
      for (const h of obj.config.historicoMetas) { if (!ehObj(h) || !/^\d{4}-\d{2}-\d{2}$/.test(h.desde) || !ehObj(h.metas)) return { ok: false, erro: 'vigência de meta inválida' }; for (const k of Object.keys(h.metas)) if (h.metas[k] != null && !ehNumNaoNeg(h.metas[k])) return { ok: false, erro: `vigência com ${k} inválido` }; }
    }
    for (const k of ['metaAgua', 'copoAgua']) if (obj.config[k] !== undefined && !(ehNum(obj.config[k]) && obj.config[k] > 0)) return { ok: false, erro: `${k} inválida` };
    if (obj.config.refeicoesPadrao !== undefined && (!Array.isArray(obj.config.refeicoesPadrao) || obj.config.refeicoesPadrao.some((n) => typeof n !== 'string'))) return { ok: false, erro: 'refeições padrão inválidas' };
  }
  const ids = new Set();
  const validarMedidas = (med, dono) => {
    if (med === undefined) return null;
    if (!Array.isArray(med)) return `medidas de "${dono}" devem ser lista`;
    for (const x of med) if (!ehObj(x) || typeof x.nome !== 'string' || !x.nome.trim() || !(ehNum(x.equivale) && x.equivale > 0)) return `medida inválida em "${dono}"`;
    return null;
  };
  for (const a of obj.alimentos) {
    if (!ehObj(a) || typeof a.id !== 'string' || !a.id) return { ok: false, erro: 'alimento sem id' };
    if (ids.has(a.id)) return { ok: false, erro: `id repetido: ${a.id}` }; ids.add(a.id);
    if (typeof a.nome !== 'string' || !a.nome.trim()) return { ok: false, erro: `alimento ${a.id} sem nome` };
    if (!(ehNum(a.refQtd) && a.refQtd > 0)) return { ok: false, erro: `alimento "${a.nome}" com quantidade de referência inválida` };
    if (!['g', 'ml', 'porção'].includes(a.refUnidade)) return { ok: false, erro: `alimento "${a.nome}" com unidade de referência inválida` };
    for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(a[k])) return { ok: false, erro: `alimento "${a.nome}" com ${k} inválido` };
    for (const k of NUTR_OPC) if (a[k] != null && !ehNumNaoNeg(a[k])) return { ok: false, erro: `alimento "${a.nome}" com ${k} inválido` };
    const em = validarMedidas(a.medidas, a.nome); if (em) return { ok: false, erro: em };
  }
  for (const r of obj.receitas) {
    if (!ehObj(r) || typeof r.id !== 'string' || !r.id) return { ok: false, erro: 'receita sem id' };
    if (ids.has(r.id)) return { ok: false, erro: `id repetido: ${r.id}` }; ids.add(r.id);
    if (typeof r.nome !== 'string' || !r.nome.trim()) return { ok: false, erro: `receita ${r.id} sem nome` };
    if (!(ehNum(r.porcoes) && r.porcoes > 0)) return { ok: false, erro: `receita "${r.nome}" sem rendimento válido` };
    if (r.pesoFinal != null && !(ehNum(r.pesoFinal) && r.pesoFinal > 0)) return { ok: false, erro: `receita "${r.nome}" com peso final inválido` };
    if (!Array.isArray(r.ingredientes)) return { ok: false, erro: `receita "${r.nome}" sem lista de ingredientes` };
    for (const ing of r.ingredientes) {
      if (!ehObj(ing) || !(ehNum(ing.qtd) && ing.qtd > 0) || typeof ing.unidade !== 'string') return { ok: false, erro: `ingrediente inválido em "${r.nome}"` };
      for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(ing[k])) return { ok: false, erro: `ingrediente com ${k} inválido em "${r.nome}"` };
      for (const k of NUTR_OPC) if (ing[k] != null && !ehNumNaoNeg(ing[k])) return { ok: false, erro: `ingrediente com ${k} inválido em "${r.nome}"` };
    }
  }
  for (const [data, dia] of Object.entries(obj.dias)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: `data inválida: ${data}` };
    if (!ehObj(dia) || !Array.isArray(dia.refeicoes)) return { ok: false, erro: `dia ${data} sem lista de refeições` };
    for (const r of dia.refeicoes) {
      if (!ehObj(r) || typeof r.nome !== 'string' || !Array.isArray(r.itens)) return { ok: false, erro: `refeição inválida em ${data}` };
      for (const it of r.itens) {
        if (!ehObj(it) || typeof it.rotulo !== 'string' || typeof it.unidade !== 'string') return { ok: false, erro: `item inválido em ${data}` };
        if (!(ehNum(it.qtd) && it.qtd > 0)) return { ok: false, erro: `item com quantidade inválida em ${data}` };
        for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido em ${data}` };
        for (const k of NUTR_OPC) if (it[k] != null && !ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido em ${data}` };
      }
    }
    if (dia.agua !== undefined && (!Array.isArray(dia.agua) || dia.agua.some((a) => !ehObj(a) || !(ehNum(a.ml) && a.ml > 0)))) return { ok: false, erro: `registro de água inválido em ${data}` };
  }
  if (obj.recentes !== undefined && (!Array.isArray(obj.recentes) || obj.recentes.some((x) => !ehObj(x)))) return { ok: false, erro: '"recentes" inválido' };
  if (obj.combinacoes !== undefined) {
    if (!Array.isArray(obj.combinacoes)) return { ok: false, erro: '"combinacoes" inválido' };
    for (const c of obj.combinacoes) {
      if (!ehObj(c) || typeof c.id !== 'string' || typeof c.nome !== 'string' || !c.nome.trim() || !Array.isArray(c.itens) || !c.itens.length) return { ok: false, erro: 'combinação inválida' };
      for (const it of c.itens) { if (!ehObj(it) || !['alimento', 'receita'].includes(it.tipo) || typeof it.refId !== 'string' || typeof it.rotulo !== 'string' || !(ehNum(it.qtd) && it.qtd > 0) || typeof it.unidade !== 'string') return { ok: false, erro: `item inválido na combinação "${c.nome}"` };
        for (const k of NUTR_OBRIG) if (!ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido na combinação "${c.nome}"` };
        for (const k of NUTR_OPC) if (it[k] != null && !ehNumNaoNeg(it[k])) return { ok: false, erro: `item com ${k} inválido na combinação "${c.nome}"` }; }
    }
  }
  if (obj.porcoes !== undefined) {
    if (!ehObj(obj.porcoes)) return { ok: false, erro: '"porcoes" inválido' };
    for (const [k, p] of Object.entries(obj.porcoes)) if (!ehObj(p) || !(ehNum(p.qtd) && p.qtd > 0) || typeof p.unidade !== 'string') return { ok: false, erro: `última porção inválida (${k})` };
  }
  return { ok: true };
}

// ---------- Utilidades ----------
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; }
function p2(n) { return String(n).padStart(2, '0'); }
function somarDias(iso, n) { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(a, m - 1, d + n); return `${dt.getFullYear()}-${p2(dt.getMonth() + 1)}-${p2(dt.getDate())}`; }
function rotuloData(iso) {
  if (iso === hojeISO()) return 'Hoje';
  if (iso === somarDias(hojeISO(), -1)) return 'Ontem';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
}
function dataCurta(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).replace('.', ''); }
function fmt(n, dec = 0) { if (n == null || !isFinite(n)) return '–'; return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec }); }
// Aceita "1,5", "1.5", "2.000" (milhar pt-BR) e "1.234,5". Ponto só é decimal quando não houver vírgula e não
// casar com o padrão de milhar.
function num(str) {
  if (typeof str === 'number') return str; if (str == null) return NaN;
  let t = String(str).trim().replace(/\s/g, ''); if (t === '') return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  return Number(t);
}
// Valor para dentro de <input>: sem separador de milhar, para o que se mostra ser o que se lê de volta.
function fmtIn(n, dec = 2) { if (n == null || !isFinite(n)) return ''; return Number(n).toLocaleString('pt-BR', { useGrouping: false, minimumFractionDigits: 0, maximumFractionDigits: dec }); }
// Busca: ignora acentos, caixa e ordem das palavras; nome vale mais que marca.
function normTexto(t) { return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
function pontuarBusca(q, nome, marca = '') {
  const palavras = normTexto(q).split(' ').filter(Boolean); if (!palavras.length) return 1;
  const n = normTexto(nome), m = normTexto(marca), nm = n + ' ' + m;
  if (!palavras.every((p) => nm.includes(p))) return 0;
  if (palavras.every((p) => n.includes(p))) return n.startsWith(palavras[0]) ? 3 : 2;
  return 1;
}
function filtrarOrdenar(lista, q, nomeDe, marcaDe = () => '') {
  return lista.map((x) => ({ x, p: pontuarBusca(q, nomeDe(x), marcaDe(x)) })).filter((o) => o.p > 0)
    .sort((a, b) => b.p - a.p || nomeDe(a.x).localeCompare(nomeDe(b.x), 'pt-BR')).map((o) => o.x);
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
let toastTimer;
let toastErroAte = 0;
// toast(msg, { rotulo, acao }) mostra um botão (ex.: Desfazer). { erro: true } segura a tela por mais tempo e
// impede que um toast de sucesso logo em seguida o cubra.
function toast(msg, op = {}) {
  const t = $('#toast');
  if (!op.erro && Date.now() < toastErroAte) return;
  t.textContent = ''; t.append(document.createTextNode(msg));
  if (op.acao) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toast-acao'; b.textContent = op.rotulo || 'Desfazer'; b.addEventListener('click', () => { t.hidden = true; op.acao(); }); t.append(b); }
  t.classList.toggle('topo', !!$('.sheet-backdrop')); // com folha aberta, não cobrir o botão de confirmar
  t.hidden = false; clearTimeout(toastTimer);
  const dur = op.erro ? 5000 : op.acao ? 5000 : 2600; if (op.erro) toastErroAte = Date.now() + 4000;
  toastTimer = setTimeout(() => { t.hidden = true; }, dur);
}
function confirmar(msg) { return window.confirm(msg); }

// ---------- Cálculos ----------
// Unidades disponíveis para um alimento: a unidade de referência + medidas caseiras cadastradas.
function unidadesAlimento(a) { return [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))]; }
// Nutrientes de "qtd" na unidade "unidade" de um alimento. Proporcional à quantidade de referência.
function nutrientesAlimento(a, qtd, unidade) {
  const u = unidadesAlimento(a).find((x) => x.nome === unidade);
  if (!u) throw new Error(`Medida "${unidade}" sem equivalência cadastrada para ${a.nome}`);
  const fator = (qtd * u.fator) / a.refQtd;
  return escalar(a, fator);
}
// Multiplica os nutrientes de um objeto por um fator; opcionais desconhecidos (null/undefined) continuam null.
function escalar(o, f) { const r = {}; for (const k of NUTR_OBRIG) r[k] = (o[k] || 0) * f; for (const k of NUTR_OPC) r[k] = o[k] == null ? null : o[k] * f; return r; }
// Soma uma lista de nutrientes. Opcionais: soma só o conhecido e informa cobertura em `cob[k] = { conhecidos, total }`.
function somar(lista) {
  const s = { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, sodio: 0, cob: {} };
  for (const k of NUTR_OPC) s.cob[k] = { conhecidos: 0, total: lista.length };
  for (const n of lista) { for (const k of NUTR_OBRIG) s[k] += n[k] || 0; for (const k of NUTR_OPC) if (n[k] != null) { s[k] += n[k]; s.cob[k].conhecidos++; } }
  return s;
}
// Resultado de somar() convertido em "nutrientes de um item": opcional só é conhecido se todos os componentes eram.
function fecharSoma(s) { const r = {}; for (const k of NUTR_OBRIG) r[k] = s[k]; for (const k of NUTR_OPC) r[k] = s.cob[k].total > 0 && s.cob[k].conhecidos === s.cob[k].total ? s[k] : null; return r; }
// Receita: totais calculados dos ingredientes. Usa o alimento atual se existir; senão o snapshot do ingrediente.
function totaisReceita(r) {
  return somar(r.ingredientes.map((ing) => {
    const a = D.alimentos.find((x) => x.id === ing.alimentoId);
    if (a) { try { return nutrientesAlimento(a, ing.qtd, ing.unidade); } catch { /* medida removida: usa snapshot */ } }
    return escalar(ing, 1);
  }));
}
function unidadesReceita(r) { const u = [{ nome: 'porção', fator: null }]; if (r.pesoFinal > 0) u.push({ nome: 'g', fator: null }); return u; }
function nutrientesReceita(r, qtd, unidade) {
  const t = totaisReceita(r);
  let f;
  if (unidade === 'porção') f = qtd / r.porcoes;
  else if (unidade === 'g' && r.pesoFinal > 0) f = qtd / r.pesoFinal;
  else throw new Error('Unidade inválida para receita');
  return escalar(fecharSoma(t), f); // incompletude dos ingredientes se propaga: fibra/sódio só se todos informaram
}
function rotuloAlimento(a) { return a.marca ? `${a.nome} (${a.marca})` : a.nome; }

// ---------- Dias e refeições ----------
function obterDia(iso, criar = true) {
  let dia = D.dias[iso];
  if (!dia && criar) { dia = { refeicoes: D.config.refeicoesPadrao.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: false, agua: [] }; D.dias[iso] = dia; }
  return dia;
}
function diaTemRegistro(dia) { return !!dia && dia.refeicoes.some((r) => r.itens.length > 0); }
// Metas vigentes numa data: o último registro com desde <= data. Sem registro anterior, não há referência (tudo null).
function metasEm(iso) {
  const h = D.config.historicoMetas || []; let m = null;
  for (const x of h) if (x.desde <= iso) m = x.metas; else break;
  return m ? { ...METAS_VAZIAS(), ...m } : METAS_VAZIAS();
}
function temAlgumaMeta(m) { return Object.values(m).some((v) => v != null && v > 0); }
function aguaDia(dia) { return dia && Array.isArray(dia.agua) ? dia.agua.reduce((t, a) => t + a.ml, 0) : 0; }
function cartaoAgua(dia) {
  const total = aguaDia(dia), meta = D.config.metaAgua, copo = D.config.copoAgua;
  const pct = Math.max(0, Math.min(1, total / meta)); const falta = meta - total;
  const texto = falta > 0 ? `faltam ${fmt(falta)} ml` : falta === 0 ? 'meta do dia alcançada' : `${fmt(-falta)} ml além da meta`;
  const nivel = 118 - pct * 96; // copo vai de y=22 (cheio) a y=118 (vazio)
  const copos = Math.round(total / copo * 10) / 10;
  return `<section class="card agua">
    <div class="row" style="gap:16px">
      <svg class="copo" viewBox="0 0 80 130" width="76" height="124" aria-hidden="true">
        <defs><clipPath id="copo-clip"><path d="M12 10 L68 10 L62 118 Q61 124 55 124 L25 124 Q19 124 18 118 Z"/></clipPath></defs>
        <g clip-path="url(#copo-clip)">
          <rect x="0" y="0" width="80" height="130" fill="var(--agua-fundo)"/>
          <g class="onda" style="transform:translateY(${nivel}px)">
            <path fill="var(--agua)" d="M-80 6 Q-70 0 -60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 V140 H-80 Z"/>
          </g>
          <g class="onda onda2" style="transform:translateY(${nivel + 3}px)">
            <path fill="var(--agua)" opacity=".55" d="M-80 6 Q-70 0 -60 6 T-40 6 T-20 6 T0 6 T20 6 T40 6 T60 6 T80 6 T100 6 T120 6 T140 6 T160 6 V140 H-80 Z"/>
          </g>
        </g>
        <path d="M12 10 L68 10 L62 118 Q61 124 55 124 L25 124 Q19 124 18 118 Z" fill="none" stroke="var(--agua-borda)" stroke-width="3"/>
        ${[0.25, 0.5, 0.75].map((m) => `<line x1="58" x2="64" y1="${118 - m * 96}" y2="${118 - m * 96}" stroke="var(--agua-borda)" stroke-width="2" opacity=".6"/>`).join('')}
      </svg>
      <div class="grow">
        <div class="label muted small">Água</div>
        <div class="value" style="font-size:30px;font-weight:700;line-height:1.1">${fmt(total)} <small style="font-size:14px;font-weight:500" class="muted">/ ${fmt(meta)} ml</small></div>
        <div class="small" style="margin-top:4px">${texto} · ${fmt(copos, 1)} copo${copos === 1 ? '' : 's'} de ${fmt(copo)} ml</div>
        <div class="bar" style="margin-top:8px"><span style="width:${pct * 100}%;background:var(--agua)"></span></div>
      </div>
    </div>
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn primary grow" data-act="agua-mais" data-ml="${copo}" style="background:var(--agua);border-color:var(--agua);white-space:nowrap">+ Copo</button>
      <button class="btn" data-act="agua-mais" data-ml="500">+ 500 ml</button>
      <button class="btn" data-act="agua-outro">Outro</button>
      <button class="btn icon" data-act="agua-desfazer" aria-label="Desfazer último registro de água" ${dia && dia.agua && dia.agua.length ? '' : 'disabled'}>↶</button>
    </div>
  </section>`;
}
function totaisDia(dia) { return somar(dia ? dia.refeicoes.flatMap((r) => r.itens) : []); }
// Quantas vezes cada alimento/receita entrou numa refeição com este nome nos últimos 60 dias (sugestão explicável).
function frequenciaPorRefeicao(nomeRefeicao, dias = 60) {
  const limite = somarDias(hojeISO(), -dias); const cont = new Map();
  for (const [data, dia] of Object.entries(D.dias)) { if (data < limite) continue; for (const r of dia.refeicoes) if (r.nome === nomeRefeicao) for (const it of r.itens) { const k = `${it.tipo}:${it.refId}`; cont.set(k, (cont.get(k) || 0) + 1); } }
  return cont;
}
function registrarRecente(tipo, id) {
  D.recentes = [{ tipo, id, em: Date.now() }, ...D.recentes.filter((x) => !(x.tipo === tipo && x.id === id))].slice(0, 30);
}
// Última porção usada por alimento/receita: preferência, separada do diário. Por modo (real/demo), já que D é por modo.
function lembrarPorcao(tipo, id, qtd, unidade) { D.porcoes[`${tipo}:${id}`] = { qtd, unidade, em: new Date().toISOString() }; }
function ultimaPorcao(tipo, id) { return D.porcoes[`${tipo}:${id}`] || null; }

// ---------- Estado de interface ----------
// (UI é declarado antes de carregar(), no topo.)

function render() {
  $('#demo-banner').hidden = !modoDemo(); mostrarBannerErro();
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === UI.aba));
  const app = $('#app');
  if (UI.aba === 'hoje') app.innerHTML = telaHoje();
  else if (UI.aba === 'alimentos') app.innerHTML = telaAlimentos();
  else if (UI.aba === 'historico') app.innerHTML = telaHistorico();
  else app.innerHTML = telaConfig();
  window.scrollTo(0, 0);
}

// ---------- Tela: Hoje ----------
function telaHoje() {
  const dia = obterDia(UI.data, false);
  const t = totaisDia(dia);
  const m = metasEm(UI.data);
  const saldoTxt = m.kcal ? ((m.kcal - t.kcal) >= 0 ? `${fmt(m.kcal - t.kcal)} kcal disponíveis` : `${fmt(t.kcal - m.kcal)} kcal além da meta`) : 'sem meta definida';
  const protTxt = m.prot ? ((m.prot - t.prot) >= 0 ? `faltam ${fmt(m.prot - t.prot)} g` : `${fmt(t.prot - m.prot)} g além da meta`) : 'sem meta definida';
  const pct = (v, meta) => meta > 0 ? Math.min(100, (v / meta) * 100) : 0;
  const macro = (nome, v, meta, k) => `<button class="macro-btn" data-act="detalhe" data-n="${k}"><span class="muted">${nome}</span> <b>${fmt(v)} g</b>${meta ? `<span class="muted"> de ${fmt(meta)}</span>` : ''}</button>`;
  const nItens = dia ? dia.refeicoes.reduce((a, r) => a + r.itens.length, 0) : 0;
  const opc = (k) => { const d = NUTR.find((n) => n.k === k); const c = t.cob[k]; const txt = nItens === 0 ? '–' : c.conhecidos === 0 ? 'não informado' : `${fmt(t[k], d.dec)} ${d.un}`; const cobTxt = nItens && c.conhecidos < c.total ? ` <span class="muted small">(dados em ${c.conhecidos} de ${c.total})</span>` : ''; return `<button class="macro-btn" data-act="detalhe" data-n="${k}"><span class="muted">${d.nome}</span> <b>${txt}</b>${m[k] && c.conhecidos ? `<span class="muted"> de ${fmt(m[k], d.dec)}</span>` : ''}${cobTxt}</button>`; };
  const semMetas = !temAlgumaMeta(m);
  const refeicoes = (dia ? dia.refeicoes : D.config.refeicoesPadrao.map((n) => ({ id: null, nome: n, itens: [] })));
  return `
  <div class="topbar">
    <button class="btn icon ghost" data-act="dia-ant" aria-label="Dia anterior">‹</button>
    <div class="title" style="text-align:center">
      <h1>${esc(rotuloData(UI.data))}</h1>
      <input type="date" value="${UI.data}" data-act="data" aria-label="Escolher data" style="border:0;background:none;color:var(--muted);font-size:13px;text-align:center;width:100%">
    </div>
    <button class="btn icon ghost" data-act="dia-prox" aria-label="Próximo dia">›</button>
  </div>
  ${UI.data !== hojeISO() ? `<button class="btn sm full" data-act="ir-hoje" style="margin-bottom:10px">Voltar para hoje</button>` : ''}
  <section class="card">
    <div class="summary">
      <button class="stat" data-act="detalhe" data-n="kcal"><div class="label">Calorias</div><div class="value">${fmt(t.kcal)}${m.kcal ? '' : ' <small>kcal</small>'}</div>${m.kcal ? `<div class="sub muted">de ${fmt(m.kcal)} kcal</div>` : ''}<div class="sub">${saldoTxt}</div>${m.kcal ? `<div class="bar"><span style="width:${pct(t.kcal, m.kcal)}%"></span></div>` : ''}</button>
      <button class="stat prot" data-act="detalhe" data-n="prot"><div class="label">Proteínas</div><div class="value">${fmt(t.prot)} <small>g</small></div>${m.prot ? `<div class="sub muted">de ${fmt(m.prot, 1)} g</div>` : ''}<div class="sub">${protTxt}</div>${m.prot ? `<div class="bar"><span style="width:${pct(t.prot, m.prot)}%"></span></div>` : ''}</button>
    </div>
    <div class="macros">${macro('Carboidratos', t.carb, m.carb, 'carb')}${macro('Gorduras', t.gord, m.gord, 'gord')}</div>
    <div class="macros opc" style="margin-top:6px">${opc('fibra')}${opc('sodio')}<span class="muted small" style="margin-left:auto">toque para detalhar</span></div>
    ${semMetas ? `<p class="help" style="margin:10px 0 0">Sem metas para ${UI.data === hojeISO() ? 'hoje' : 'esta data'}. Metas são referências que você escolhe, não uma recomendação do app. <button class="btn sm" data-act="ir-config" style="margin-left:6px">Definir em Ajustes</button></p>` : ''}
  </section>
  ${cartaoAgua(dia)}
  ${refeicoes.map((r, i) => {
    const st = somar(r.itens);
    return `<section class="card meal" data-ref="${r.id ?? ''}" data-idx="${i}">
      <div class="meal-head">
        <div class="grow"><h2>${esc(r.nome)}</h2><div class="meal-sub">${r.itens.length ? `${fmt(st.kcal)} kcal · <span style="color:var(--prot)">P ${fmt(st.prot, 1)}</span> · C ${fmt(st.carb, 1)} · G ${fmt(st.gord, 1)} g` : 'Nada registrado'}</div></div>
        <button class="btn icon ghost" data-act="menu-refeicao" data-idx="${i}" aria-label="Opções da refeição">⋯</button>
      </div>
      ${r.itens.map((it) => `<button class="entry" data-act="editar-item" data-idx="${i}" data-item="${it.id}">
          <div class="grow"><div class="name ellipsis">${esc(it.rotulo)}</div><div class="qty">${fmt(it.qtd, 2)} ${esc(it.unidade)}</div></div>
          <div class="nums"><div>${fmt(it.kcal)} kcal</div><div class="p">${fmt(it.prot, 1)} g prot</div></div>
        </button>`).join('')}
      <div class="row" style="gap:0"><button class="meal-add grow" data-act="adicionar" data-idx="${i}">+ Adicionar alimento</button>${!r.itens.length && ultimaRefeicaoAnterior(r.nome, UI.data) ? `<button class="meal-add" style="width:auto;color:var(--muted)" data-act="repetir" data-idx="${i}">↻ Repetir última</button>` : ''}</div>
    </section>`;
  }).join('')}
  <button class="btn full" data-act="nova-refeicao">+ Nova refeição neste dia</button>
  <div style="height:12px"></div>
  <label class="check card" style="margin-top:12px"><input type="checkbox" data-act="concluir" ${dia && dia.concluido ? 'checked' : ''}> <span><b>Dia concluído</b><br><span class="small muted">Só dias concluídos entram nas médias do histórico.</span></span></label>`;
}

// ---------- Tela: Alimentos ----------
function telaAlimentos() {
  const f = UI.filtroAlimentos; const q = UI.buscaAlimentos.trim();
  let html = `<div class="topbar"><h1 class="title">Alimentos e receitas</h1></div>
  <input class="search" type="search" placeholder="Buscar por nome ou marca" value="${esc(UI.buscaAlimentos)}" data-act="busca-alimentos" aria-label="Buscar">
  <div class="chips">${[['todos', 'Todos'], ['favoritos', 'Favoritos'], ['receitas', 'Receitas'], ['combinacoes', 'Combinações']].map(([k, n]) => `<button class="chip ${f === k ? 'active' : ''}" data-act="filtro-alimentos" data-f="${k}">${n}</button>`).join('')}</div>
  <div class="grid3" style="margin-bottom:12px"><button class="btn primary" data-act="novo-alimento">+ Alimento</button><button class="btn" data-act="nova-receita">+ Receita</button><button class="btn" data-act="ler-codigo">▥ Código</button></div>
  <section class="card">`;
  const itens = [];
  if (f === 'combinacoes') {
    html += (D.combinacoes.length ? filtrarOrdenar(D.combinacoes, q, (c) => c.nome).map((c) => itemListaCombinacao(c, 'abrir-combinacao')).join('') : '<div class="empty">Nenhuma combinação salva. Na tela Hoje, no menu ⋯ de uma refeição com itens, use “Salvar como combinação”. Uma combinação reúne consumos independentes (editáveis um a um); receita tem ingredientes e rendimento.</div>') + '</section>';
    return html;
  }
  if (f !== 'receitas') for (const a of filtrarOrdenar(D.alimentos.filter((a) => f !== 'favoritos' || a.favorito), q, (a) => a.nome, (a) => a.marca)) itens.push(itemListaAlimento(a, 'abrir-alimento'));
  for (const r of filtrarOrdenar(D.receitas.filter((r) => f !== 'favoritos' || r.favorito), q, (r) => r.nome)) itens.push(itemListaReceita(r, 'abrir-receita'));
  html += itens.length ? itens.join('') : `<div class="empty">${D.alimentos.length || D.receitas.length ? 'Nada encontrado com esse filtro.' : 'Nenhum alimento cadastrado ainda. Toque em “+ Alimento” para começar.'}</div>` + (D.alimentos.length ? '' : `<button class="btn full" data-act="importar-base" style="margin-top:8px">Adicionar alimentos comuns (TACO)</button>`);
  html += `</section>`;
  return html;
}
function itemListaAlimento(a, act, extra = '') {
  const estado = a.estado && a.estado !== 'na' ? ` · ${a.estado}` : '';
  return `<button class="list-item" data-act="${act}" data-id="${a.id}" ${extra}>
    <div class="grow"><div class="name">${a.favorito ? '<span class="star">★</span> ' : ''}${esc(a.nome)}${a.marca ? ` <span class="muted">· ${esc(a.marca)}</span>` : ''}</div>
    <div class="meta">${fmt(a.kcal)} kcal · ${fmt(a.prot, 1)} g prot por ${fmt(a.refQtd, 2)} ${esc(a.refUnidade)}${estado}${a.fonte ? ` · <span class="badge neutral">${esc(a.fonte)}</span>` : ''}${a.codigoBarras ? ' · ▥' : ''}</div></div><span class="muted">›</span></button>`;
}
function itemListaReceita(r, act, extra = '') {
  const t = totaisReceita(r); const pp = r.porcoes > 0 ? t.kcal / r.porcoes : 0; const pr = r.porcoes > 0 ? t.prot / r.porcoes : 0;
  return `<button class="list-item" data-act="${act}" data-id="${r.id}" ${extra}>
    <div class="grow"><div class="name">${r.favorito ? '<span class="star">★</span> ' : ''}${esc(r.nome)} <span class="badge">receita</span></div>
    <div class="meta">${fmt(pp)} kcal · ${fmt(pr, 1)} g prot por porção · rende ${fmt(r.porcoes, 2)}${r.pesoFinal ? ` · ${fmt(r.pesoFinal)} g no total` : ''}</div></div><span class="muted">›</span></button>`;
}

// ---------- Tela: Histórico ----------
// Resumo de um período de n dias terminando em `fim`: médias só de dias concluídos, com denominadores explícitos.
function resumoPeriodo(fim, n) {
  const r = { n, concl: 0, comRef: 0, soAgua: 0, semReg: 0, comAgua: 0, soma: { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0, sodio: 0, agua: 0 }, completos: { fibra: 0, sodio: 0 }, linhas: [] };
  for (let i = 0; i < n; i++) {
    const iso = somarDias(fim, -i); const dia = D.dias[iso]; const tem = diaTemRegistro(dia); const t = totaisDia(dia); const ml = aguaDia(dia);
    if (!tem && !ml) r.semReg++; else if (!tem) r.soAgua++;
    if (dia && dia.concluido && (tem || ml)) {
      r.concl++;
      if (tem) { r.comRef++; for (const k of NUTR_OBRIG) r.soma[k] += t[k]; for (const k of NUTR_OPC) if (t.cob[k].conhecidos === t.cob[k].total) { r.soma[k] += t[k]; r.completos[k]++; } }
      if (ml) { r.comAgua++; r.soma.agua += ml; }
    }
    r.linhas.push({ iso, dia, tem, t, ml, m: metasEm(iso) });
  }
  r.media = (k) => k === 'agua' ? (r.comAgua ? r.soma.agua / r.comAgua : null) : NUTR_OPC.includes(k) ? (r.completos[k] ? r.soma[k] / r.completos[k] : null) : (r.comRef ? r.soma[k] / r.comRef : null);
  r.denom = (k) => k === 'agua' ? r.comAgua : NUTR_OPC.includes(k) ? r.completos[k] : r.comRef;
  return r;
}
function telaHistorico() {
  const n = UI.histDias; const hoje = hojeISO();
  const atual = resumoPeriodo(hoje, n); const anterior = resumoPeriodo(somarDias(hoje, -n), n);
  let maxK = Math.max(1, ...atual.linhas.map((l) => l.t.kcal), ...atual.linhas.map((l) => l.m.kcal || 0));
  const linhaMedia = (k, nome, un, dec) => { const a = atual.media(k), b = anterior.media(k); return `<tr><td>${nome}</td><td><b>${a == null ? '–' : fmt(a, dec) + ' ' + un}</b><div class="small muted">${atual.denom(k)} ${atual.denom(k) === 1 ? 'dia' : 'dias'}</div></td><td>${b == null ? '–' : fmt(b, dec) + ' ' + un}<div class="small muted">${anterior.denom(k)} ${anterior.denom(k) === 1 ? 'dia' : 'dias'}</div></td></tr>`; };
  return `<div class="topbar"><h1 class="title">Histórico</h1></div>
  <div class="chips">${[7, 30].map((k) => `<button class="chip ${n === k ? 'active' : ''}" data-act="hist-dias" data-n="${k}">Últimos ${k} dias</button>`).join('')}</div>
  <section class="card">
    <h2>Médias dos dias concluídos</h2>
    <p class="help">Só dias marcados como concluídos entram. Fibras e sódio: só dias em que todos os registros informaram o valor. Água: dias concluídos com água registrada. Cada média mostra seu próprio número de dias.</p>
    ${atual.concl || anterior.concl ? `<table class="tabela"><thead><tr><th></th><th>Últimos ${n} dias</th><th>${n} anteriores</th></tr></thead><tbody>
      ${linhaMedia('kcal', 'Calorias', 'kcal', 0)}${linhaMedia('prot', 'Proteínas', 'g', 0)}${linhaMedia('carb', 'Carboidratos', 'g', 0)}${linhaMedia('gord', 'Gorduras', 'g', 0)}${linhaMedia('fibra', 'Fibras', 'g', 1)}${linhaMedia('sodio', 'Sódio', 'mg', 0)}${linhaMedia('agua', 'Água', 'ml', 0)}
    </tbody></table>` : ''}
    <p class="help" style="margin-bottom:0">${atual.concl ? `${atual.comRef} de ${n} dias concluídos com refeições${atual.soAgua ? ` · ${atual.soAgua} só com água` : ''}${atual.semReg ? ` · ${atual.semReg} sem registro` : ''}. Dias sem registro não entram como zero.` : `Nenhum dia concluído nos últimos ${n} dias. Marque “Dia concluído” na tela Hoje para incluir um dia na média.`}</p>
  </section>
  <section class="card">
    ${atual.linhas.map(({ iso, dia, tem, t, ml, m }) => `<button class="hist-row" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;color:inherit" data-act="abrir-dia" data-data="${iso}">
      <div class="d">${esc(dataCurta(iso))}</div>
      ${tem || ml ? `<div class="bars"><div class="small">${tem ? `${fmt(t.kcal)} kcal · <span style="color:var(--prot)">${fmt(t.prot)} g prot</span>` : '<span class="muted">Só água</span>'}${ml ? ` · <span style="color:var(--agua)">${fmt(ml)} ml</span>` : ''}</div>${tem ? `<div class="bar"><span style="width:${Math.min(100, t.kcal / maxK * 100)}%"></span>${m.kcal ? `<i class="meta-marca" style="left:${Math.min(100, m.kcal / maxK * 100)}%"></i>` : ''}</div><div class="bar p"><span style="width:${m.prot ? Math.min(100, t.prot / m.prot * 100) : 0}%"></span></div>` : ''}</div>` : `<div class="muted small">Sem registros</div>`}
      <div class="st">${tem || ml ? (dia.concluido ? '<span class="badge">concluído</span>' : '<span class="badge neutral">em aberto</span>') : ''}</div>
    </button>`).join('')}
    <p class="help" style="margin:10px 0 0">Barra verde: calorias na escala do período, com a marca da meta vigente naquele dia. Barra azul: proteína em relação à meta do dia (sem meta, vazia).</p>
  </section>`;
}

// ---------- Tela: Configurações ----------
function telaConfig() {
  const m = D.config.metas; const hm = D.config.historicoMetas || []; const vig = hm.length ? hm[hm.length - 1] : null;
  let usoKB = 0; try { usoKB = Math.round((localStorage.getItem(chaveAtual()) || '').length / 1024); } catch { /* ignore */ }
  return `<div class="topbar"><h1 class="title">Configurações</h1></div>
  <section class="card">
    <h2>Metas diárias</h2>
    <p class="help">Referências escolhidas por você (com quem te orienta, se for o caso). O app não calcula dieta nem recomenda valores. Todas são opcionais: sem meta, a tela mostra só o consumo. Sódio funciona como limite.</p>
    <form data-form="metas">
      <div class="grid2">
        ${NUTR.map((n) => `<div class="field"><label>${n.nome} (${n.un})${n.k === 'sodio' ? ' — limite' : ''}</label><input name="${n.k}" inputmode="decimal" value="${m[n.k] != null ? fmtIn(m[n.k], 2) : ''}" placeholder="sem meta"></div>`).join('')}
      </div>
      <button class="btn primary full" type="submit">Salvar metas a partir de hoje</button>
      <p class="help" style="margin:8px 0 0">${vig ? `Vigência atual desde ${vig.desde === '1970-01-01' ? 'antes do registro de vigência' : dataCurta(vig.desde)}${hm.length > 1 ? ` · ${hm.length} alterações registradas` : ''}. Dias anteriores continuam comparados com a meta que valia neles.` : 'Nenhuma meta registrada ainda.'}</p>
    </form>
  </section>
  <section class="card">
    <h2>Água</h2>
    <form data-form="agua"><div class="grid2">
      <div class="field"><label>Meta diária (ml)</label><input name="meta" inputmode="numeric" value="${fmtIn(D.config.metaAgua)}" required></div>
      <div class="field"><label>Tamanho do copo (ml)</label><input name="copo" inputmode="numeric" value="${fmtIn(D.config.copoAgua)}" required></div>
    </div><button class="btn full" type="submit">Salvar água</button></form>
  </section>
  <section class="card">
    <h2>Refeições padrão</h2>
    <p class="help">Uma por linha. Vale para dias novos; dias já criados não mudam.</p>
    <form data-form="refeicoes"><div class="field"><textarea name="lista" rows="4" style="min-height:100px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);width:100%">${esc(D.config.refeicoesPadrao.join('\n'))}</textarea></div><button class="btn full" type="submit">Salvar refeições padrão</button></form>
  </section>
  <section class="card">
    <h2>Alimentos comuns</h2>
    <p class="help">Adiciona ${ALIMENTOS_BASE.length} alimentos do dia a dia (ovo, arroz, feijão, frango, carne, pães, laticínios, frutas, legumes, azeite) com valores por 100 g copiados da ${FONTE_TACO}. Entram como cadastro normal: confira e corrija se o seu produto for diferente. Itens já cadastrados não se repetem.</p>
    <button class="btn full" data-act="importar-base">Adicionar alimentos comuns (TACO)</button>
    <p class="help" style="margin-top:12px">Suplementos variam por marca, então não têm valor embutido. O modelo abaixo abre o cadastro já com porção e scoop para você copiar o rótulo.</p>
    ${MODELOS_BASE.map((m, i) => `<button class="btn full" data-act="modelo" data-i="${i}">Cadastrar ${esc(m.nome)} (do rótulo)</button>`).join('')}
  </section>
  <section class="card">
    <h2>Código de barras</h2>
    <p class="help">O leitor usa a câmera pelo próprio navegador (Chrome no Android). Ao ler um código novo, o app consulta o <b>Open Food Facts</b>, base aberta e colaborativa: envia só o código, recebe nome, marca e valores por 100 g, e abre o cadastro para você conferir com o rótulo antes de salvar. Produtos brasileiros nem sempre estão lá ou podem vir incompletos.</p>
    <label class="check"><input type="checkbox" data-act="toggle-off" ${D.config.consultarOFF ? 'checked' : ''}> <span>Consultar o Open Food Facts ao ler um código</span></label>
    <p class="small muted">Desligado, o código só fica salvo no alimento e o cadastro é todo manual.</p>
  </section>
  <section class="card">
    <h2>Dados e privacidade</h2>
    <p class="help">Tudo fica salvo <b>somente neste aparelho e neste navegador</b> (armazenamento local, ~${usoKB} KB em uso). Não há conta nem envio para servidor. Isso significa: trocar de celular, limpar os dados do navegador ou desinstalar o app apaga os registros. Faça backup em JSON com alguma frequência.</p>
    ${brutoCorrompido() ? `<div class="help" style="background:var(--warn-soft);padding:10px;border-radius:10px"><b>Dados anteriores preservados.</b> O conteúdo salvo antes estava ilegível${UI.dadosCorrompidos ? ` (${esc(UI.dadosCorrompidos.erro)})` : ''} e foi guardado à parte, sem ser apagado. Baixe-o para tentar recuperar; depois, se quiser, descarte.<div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="baixar-corrompido">Baixar dados brutos</button><button class="btn sm danger" data-act="descartar-corrompido">Descartar</button></div></div>` : ''}
    <div class="stack">
      <button class="btn full" data-act="exportar-json">Exportar backup (JSON)</button>
      <button class="btn full" data-act="importar-json">Importar backup (JSON)</button>
      <input type="file" accept="application/json,.json" data-act="arquivo-json" hidden>
      <button class="btn full" data-act="exportar-csv">Exportar histórico alimentar (CSV)</button>
    </div>
  </section>
  <section class="card">
    <h2>Modo demonstração</h2>
    <p class="help">Carrega alimentos e dias de exemplo num espaço separado, sem tocar nos seus registros reais. Os números de exemplo são ilustrativos, não uma tabela nutricional de referência.</p>
    <button class="btn full" data-act="alternar-demo">${modoDemo() ? 'Sair do modo demonstração' : 'Entrar no modo demonstração'}</button>
  </section>
  <section class="card">
    <h2>Zona de cuidado</h2>
    <button class="btn full danger" data-act="apagar-tudo">Apagar todos os dados ${modoDemo() ? 'de demonstração' : 'deste aparelho'}</button>
  </section>
  <p class="small muted" style="text-align:center">Meu Prato · versão 1 · dados v${VERSAO_DADOS}</p>`;
}

// ---------- Folhas (sheets) ----------
function abrirFolha(html, aoMontar) {
  fecharFolha();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#toast').classList.add('topo');
  const bd = $('.sheet-backdrop', root);
  bd.addEventListener('click', (e) => { if (e.target === bd) fecharFolha(); });
  $$('[data-fechar]', root).forEach((b) => b.addEventListener('click', fecharFolha));
  if (aoMontar) aoMontar($('.sheet', root));
}
function fecharFolha() { $('#sheet-root').innerHTML = ''; $('#toast').classList.remove('topo'); }
const cab = (titulo) => `<div class="sheet-head"><h2>${esc(titulo)}</h2><button class="btn icon ghost" data-fechar aria-label="Fechar">✕</button></div>`;

// Menu simples de opções
function menu(titulo, opcoes) {
  abrirFolha(`${cab(titulo)}<div class="menu">${opcoes.map((o, i) => `<button data-i="${i}" class="${o.perigo ? 'danger' : ''}">${esc(o.rotulo)}</button>`).join('')}</div>`, (s) => {
    $$('.menu button', s).forEach((b) => b.addEventListener('click', () => { fecharFolha(); opcoes[Number(b.dataset.i)].acao(); }));
  });
}

// ----- Escolher alimento/receita para uma refeição -----
function folhaEscolher(idxRefeicao, aoEscolher, resumo = '') {
  let filtro = 'recentes'; let busca = '';
  const lote = idxRefeicao !== null && idxRefeicao !== undefined; // modo lote só faz sentido ao montar uma refeição
  const nomeRef = lote ? (obterDia(UI.data, false)?.refeicoes[idxRefeicao]?.nome || null) : null;
  const freq = nomeRef ? frequenciaPorRefeicao(nomeRef) : new Map();
  const usado = (t, id) => { const n = freq.get(`${t}:${id}`); return n ? ` <span class="badge" title="Vezes que entrou em ${esc(nomeRef)} nos últimos 60 dias">${n}× ${n === 1 ? 'no' : 'no'} ${esc(nomeRef.toLowerCase())}</span>` : ''; };
  const rascunho = (lote && UI.rascunhoLote && UI.rascunhoLote.idx === idxRefeicao && UI.rascunhoLote.data === UI.data) ? UI.rascunhoLote.itens : [];
  let selecionando = rascunho.length > 0;
  const chave = (t, id) => `${t}:${id}`;
  const noRascunho = (t, id) => rascunho.some((x) => chave(x.tipo, x.id) === chave(t, id));
  const alternar = (t, id) => { const i = rascunho.findIndex((x) => chave(x.tipo, x.id) === chave(t, id)); if (i >= 0) rascunho.splice(i, 1); else rascunho.push({ tipo: t, id }); UI.rascunhoLote = { idx: idxRefeicao, data: UI.data, itens: rascunho }; };
  if (!D.recentes.length) filtro = D.alimentos.some((a) => a.favorito) || D.receitas.some((r) => r.favorito) ? 'favoritos' : 'todos';
  const desenhar = (s) => {
    const q = busca.trim();
    let lista = [];
    if (q) filtro = 'todos';
    if (filtro === 'recentes') {
      lista = D.recentes.map((x) => x.tipo === 'alimento' ? D.alimentos.find((a) => a.id === x.id) : Object.assign({ _receita: true }, D.receitas.find((r) => r.id === x.id))).filter((x) => x && x.id);
      // Com refeição conhecida, o que mais entrou nela vem primeiro (recência desempata).
      if (nomeRef && freq.size) lista = lista.map((x, i) => ({ x, i, f: freq.get(`${x._receita ? 'receita' : 'alimento'}:${x.id}`) || 0 })).sort((a, b) => b.f - a.f || a.i - b.i).map((o) => o.x);
    }
    else if (filtro === 'favoritos') lista = [...D.alimentos.filter((a) => a.favorito), ...D.receitas.filter((r) => r.favorito).map((r) => Object.assign({ _receita: true }, r))];
    else if (filtro === 'receitas') lista = D.receitas.map((r) => Object.assign({ _receita: true }, r));
    else if (filtro === 'combinacoes') lista = [];
    else lista = filtrarOrdenar([...D.alimentos, ...D.receitas.map((r) => Object.assign({ _receita: true }, r))], q, (x) => x.nome, (x) => x.marca || '');
    const marca = (t, id) => selecionando ? `<span class="marca ${noRascunho(t, id) ? 'on' : ''}" aria-hidden="true">${noRascunho(t, id) ? '✓' : ''}</span>` : '';
    const combos = filtro === 'combinacoes' ? (D.combinacoes.length ? D.combinacoes.map((c) => itemListaCombinacao(c, 'pick-combo')).join('') : '<div class="empty">Nenhuma combinação salva. No menu ⋯ de uma refeição com itens, use “Salvar como combinação”.</div>') : '';
    const comBadge = (html, t, id) => usado(t, id) ? html.replace('<div class="meta">', `<div class="meta">${usado(t, id)} · `) : html;
    $('.lista', s).innerHTML = combos + (filtro === 'combinacoes' ? '' : (lista.length ? lista.map((x) => x._receita ? comBadge(itemListaReceita(x, 'pick-receita', ''), 'receita', x.id).replace('<div class="grow">', marca('receita', x.id) + '<div class="grow">') : comBadge(itemListaAlimento(x, 'pick-alimento', ''), 'alimento', x.id).replace('<div class="grow">', marca('alimento', x.id) + '<div class="grow">')).join('')
      : `<div class="empty">${filtro === 'recentes' ? 'Nada usado recentemente.' : filtro === 'favoritos' ? 'Nenhum favorito ainda.' : 'Nada encontrado.'}</div>`)
      + `<button class="list-item" data-act="pick-novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento${q ? ` “${esc(busca.trim())}”` : ''}</div></div></button>`
      + (D.alimentos.length ? '' : `<button class="list-item" data-act="pick-base"><div class="grow"><div class="name" style="color:var(--brand)">+ Adicionar alimentos comuns (TACO)</div><div class="meta">Arroz, feijão, ovo, frango, frutas… com valores da tabela oficial.</div></div></button>`));
    $$('.chip', s).forEach((c) => c.classList.toggle('active', c.dataset.f === filtro));
    const escolher = (t, id) => { if (selecionando) { alternar(t, id); desenhar(s); } else aoEscolher(t, id); };
    $$('[data-act="pick-alimento"]', s).forEach((b) => b.addEventListener('click', () => escolher('alimento', b.dataset.id)));
    $$('[data-act="pick-receita"]', s).forEach((b) => b.addEventListener('click', () => escolher('receita', b.dataset.id)));
    $$('[data-act="pick-combo"]', s).forEach((b) => b.addEventListener('click', () => { if (lote) menuCombinacao(b.dataset.id, idxRefeicao); else menuCombinacao(b.dataset.id); }));
    const barra = $('.barra-lote', s);
    if (barra) { barra.hidden = !selecionando; if (selecionando) { $('[data-revisar]', barra).textContent = rascunho.length ? `Revisar ${rascunho.length} ${rascunho.length === 1 ? 'item' : 'itens'}` : 'Toque nos itens para marcar'; $('[data-revisar]', barra).disabled = !rascunho.length; } $('[data-lote]', s).classList.toggle('active', selecionando); }
    $('[data-act="pick-base"]', s)?.addEventListener('click', () => folhaImportarBase(() => { if (lote) abrirSeletor(idxRefeicao); }));
    $('[data-act="pick-novo"]', s)?.addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => { if (selecionando) { alternar('alimento', novo.id); abrirSeletor(idxRefeicao); } else aoEscolher('alimento', novo.id); }));
  };
  abrirFolha(`${cab('Adicionar alimento')}
    ${resumo ? `<p class="help resumo-refeicao" style="margin-top:-6px">${esc(resumo)}</p>` : ''}
    <div class="row" style="margin-bottom:10px"><input class="search" type="search" placeholder="Buscar nos meus alimentos" aria-label="Buscar" autofocus style="margin:0"><button class="btn" data-act="pick-codigo" aria-label="Ler código de barras" title="Código de barras">▥</button></div>
    <div class="chips">${[['recentes', 'Recentes'], ['favoritos', 'Favoritos'], ['todos', 'Todos'], ['receitas', 'Receitas'], ['combinacoes', 'Combinações']].map(([k, n]) => `<button class="chip" data-f="${k}">${n}</button>`).join('')}${lote ? '<button class="chip" data-lote title="Selecionar vários">☑ Vários</button>' : ''}</div>
    <div class="lista"></div>
    ${lote ? `<div class="barra-lote row" hidden style="position:sticky;bottom:-16px;background:var(--card);padding:10px 0 4px;margin-top:8px;border-top:1px solid var(--line)"><button class="btn sm ghost" data-cancelar-lote>Cancelar</button><button class="btn primary grow" data-revisar>Revisar</button></div>` : ''}`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); });
    if (lote) {
      $('[data-lote]', s).addEventListener('click', () => { selecionando = !selecionando; if (!selecionando) { rascunho.length = 0; UI.rascunhoLote = null; } desenhar(s); });
      $('[data-cancelar-lote]', s).addEventListener('click', () => { selecionando = false; rascunho.length = 0; UI.rascunhoLote = null; desenhar(s); });
      $('[data-revisar]', s).addEventListener('click', () => {
        const linhas = rascunho.map(({ tipo, id }) => {
          const ref = tipo === 'alimento' ? D.alimentos.find((a) => a.id === id) : D.receitas.find((r) => r.id === id); if (!ref) return null;
          const un = tipo === 'alimento' ? unidadesAlimento(ref) : unidadesReceita(ref); const u = ultimaPorcao(tipo, id);
          const unidade = u && un.some((x) => x.nome === u.unidade) ? u.unidade : un[0].nome; const qtd = u && unidade === u.unidade ? u.qtd : (tipo === 'alimento' ? ref.refQtd : 1);
          const n = tipo === 'alimento' ? nutrientesAlimento(ref, qtd, unidade) : nutrientesReceita(ref, qtd, unidade);
          return { tipo, refId: id, rotulo: tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome, qtd, unidade, ...n, historico: false };
        }).filter(Boolean);
        const ref = obterDia(UI.data).refeicoes[idxRefeicao];
        folhaRevisar({ titulo: 'Revisar seleção', descricao: 'Quantidades sugeridas pela última porção usada ou pela referência do cadastro.', linhas, destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
          aoConfirmar: (itens) => { UI.rascunhoLote = null; inserirLote(idxRefeicao, itens, { lote: true }); } });
      });
    }
    $('[data-act="pick-codigo"]', s).addEventListener('click', () => folhaCodigo((a) => aoEscolher('alimento', a.id)));
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { filtro = c.dataset.f; busca = ''; $('.search', s).value = ''; desenhar(s); }));
    desenhar(s);
    $('.search', s).focus();
  });
}

// ----- Quantidade (novo registro ou edição) -----
function folhaQuantidade({ tipo, id, item, idxRefeicao, aoConfirmar, aoContinuar }) {
  const ref = tipo === 'alimento' ? D.alimentos.find((a) => a.id === id) : D.receitas.find((r) => r.id === id);
  if (!ref) { toast('Cadastro original não encontrado. Edite a quantidade a partir do registro.'); return; }
  const unidades = tipo === 'alimento' ? unidadesAlimento(ref) : unidadesReceita(ref);
  // Sugestão inicial: a última porção usada (se a unidade ainda existir), senão a referência do cadastro.
  const ultima = item ? null : ultimaPorcao(tipo, id);
  const ultimaValida = ultima && unidades.some((u) => u.nome === ultima.unidade);
  let avisoPorcao = '';
  if (ultima && !ultimaValida) avisoPorcao = `A medida “${ultima.unidade}” da última vez não existe mais neste cadastro; usando ${unidades[0].nome}.`;
  const qtdIni = item ? item.qtd : ultimaValida ? ultima.qtd : (tipo === 'alimento' ? ref.refQtd : 1);
  const uniIni = item && unidades.some((u) => u.nome === item.unidade) ? item.unidade : ultimaValida ? ultima.unidade : unidades[0].nome;
  const titulo = tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome;
  const calc = (q, u) => tipo === 'alimento' ? nutrientesAlimento(ref, q, u) : nutrientesReceita(ref, q, u);
  abrirFolha(`${cab(item ? 'Editar quantidade' : 'Quantidade')}
    <div style="font-weight:600;margin-bottom:10px">${esc(titulo)}</div>
    <div class="grid2">
      <div class="field"><label>Quantidade</label><input name="qtd" inputmode="decimal" value="${fmtIn(qtdIni, 3)}" autofocus></div>
      <div class="field"><label>Unidade</label><select name="uni">${unidades.map((u) => `<option value="${esc(u.nome)}" ${u.nome === uniIni ? 'selected' : ''}>${esc(u.nome)}${u.fator && u.fator !== 1 ? ` (${fmt(u.fator, 2)} ${esc(ref.refUnidade)})` : ''}</option>`).join('')}</select></div>
    </div>
    ${tipo === 'alimento' ? `<p class="help">Referência: ${fmt(ref.kcal)} kcal e ${fmt(ref.prot, 1)} g de proteína por ${fmt(ref.refQtd, 2)} ${esc(ref.refUnidade)}.${ref.medidas.length ? '' : ' Para usar unidade, colher ou scoop, cadastre a equivalência no alimento.'}</p>`
      : `<p class="help">Rende ${fmt(ref.porcoes, 2)} porção(ões)${ref.pesoFinal ? ` · ${fmt(ref.pesoFinal)} g no total` : ' · sem peso final informado, então só é possível registrar em porções'}.</p>`}
    ${ultimaValida ? `<p class="help ultima" style="margin-top:0">Última vez: <b>${fmt(ultima.qtd, 3)} ${esc(ultima.unidade)}</b>. Ajuste se for diferente.</p>` : ''}
    ${avisoPorcao ? `<p class="help" style="margin-top:0;background:var(--warn-soft);padding:8px 10px;border-radius:8px">${esc(avisoPorcao)}</p>` : ''}
    <div class="chips atalhos" aria-label="Atalhos de quantidade"></div>
    <div class="preview" aria-live="polite"></div>
    <button class="btn primary full" data-ok>${item ? 'Salvar' : 'Adicionar'}</button>
    ${aoContinuar ? '<button class="btn full" data-continuar style="margin-top:8px">Adicionar e continuar</button>' : ''}`, (s) => {
    const inQ = $('[name=qtd]', s), inU = $('[name=uni]', s), pv = $('.preview', s), ok = $('[data-ok]', s), cont = $('[data-continuar]', s), at = $('.atalhos', s);
    const ehBase = (u) => u === 'g' || u === 'ml';
    const atalhos = () => {
      const u = inU.value; const vals = ehBase(u) ? [50, 100, 150, 200, 250] : [0.5, 1, 1.5, 2, 3];
      const fator = ehBase(u) ? 1 : (unidades.find((x) => x.nome === u) || {}).fator;
      at.innerHTML = vals.map((v) => `<button type="button" class="chip" data-v="${v}">${fmt(v, 1)}${ehBase(u) ? ' ' + u : ''}${fator && fator !== 1 && tipo === 'alimento' ? ` <span class="muted">(${fmt(v * fator, 0)} ${esc(ref.refUnidade)})</span>` : ''}</button>`).join('');
      $$('.chip', at).forEach((c) => c.addEventListener('click', () => { inQ.value = fmtIn(Number(c.dataset.v), 3); atualizar(); inQ.focus(); }));
    };
    const atualizar = () => {
      const q = num(inQ.value);
      $$('.chip', at).forEach((c) => c.classList.toggle('active', Number(c.dataset.v) === q));
      if (!(q > 0)) { pv.innerHTML = '<span style="grid-column:1/-1">Informe uma quantidade maior que zero.</span>'; ok.disabled = true; if (cont) cont.disabled = true; return; }
      const n = calc(q, inU.value); ok.disabled = false; if (cont) cont.disabled = false;
      pv.innerHTML = `<div><b>${fmt(n.kcal)}</b><span>kcal</span></div><div><b>${fmt(n.prot, 1)}</b><span>g prot</span></div><div><b>${fmt(n.carb, 1)}</b><span>g carb</span></div><div><b>${fmt(n.gord, 1)}</b><span>g gord</span></div>`
        + `<div class="small muted" style="grid-column:1/-1">Fibras ${n.fibra == null ? 'não informadas' : fmt(n.fibra, 1) + ' g'} · Sódio ${n.sodio == null ? 'não informado' : fmt(n.sodio) + ' mg'}</div>`;
    };
    inQ.addEventListener('input', atualizar); inU.addEventListener('change', () => { atalhos(); atualizar(); }); atalhos(); atualizar();
    inQ.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); });
    let enviado = false; // evita duplicar por toque repetido
    const confirmar_ = (cb) => {
      if (enviado) return; const q = num(inQ.value); if (!(q > 0)) return; enviado = true;
      const n = calc(q, inU.value);
      fecharFolha(); // antes do callback: ele pode abrir outra folha (ex.: voltar ao formulário da receita)
      cb({ qtd: q, unidade: inU.value, rotulo: titulo, ...n });
    };
    ok.addEventListener('click', () => confirmar_(aoConfirmar));
    if (cont) cont.addEventListener('click', () => confirmar_(aoContinuar));
    inQ.focus(); inQ.select();
  });
}

function adicionarItem(idxRefeicao, tipo, id) {
  const inserir = (dados) => {
    const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao];
    const novo = { id: uid(), tipo, refId: id, criadoEm: new Date().toISOString(), ...dados };
    ref.itens.push(novo); registrarRecente(tipo, id); lembrarPorcao(tipo, id, dados.qtd, dados.unidade);
    const ok = salvar(); render();
    if (ok) toast(`${dados.rotulo} em ${ref.nome}: ${fmt(dados.kcal)} kcal.`, { rotulo: 'Desfazer', acao: () => { ref.itens = ref.itens.filter((x) => x.id !== novo.id); salvar(); render(); if ($('.sheet .resumo-refeicao')) abrirSeletor(idxRefeicao); } });
    return ref;
  };
  folhaQuantidade({ tipo, id, idxRefeicao,
    aoConfirmar: inserir,
    aoContinuar: (dados) => { inserir(dados); abrirSeletor(idxRefeicao); } });
}
// Seletor de alimentos para uma refeição, com o parcial da refeição no cabeçalho.
function abrirSeletor(idxRefeicao) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; if (!ref) return;
  const t = somar(ref.itens);
  folhaEscolher(idxRefeicao, (tipo, id) => adicionarItem(idxRefeicao, tipo, id), `${ref.nome} · ${rotuloData(UI.data).toLowerCase()} · ${ref.itens.length} ${ref.itens.length === 1 ? 'item' : 'itens'} · ${fmt(t.kcal)} kcal`);
}

// ----- Revisão de vários itens antes de registrar (lote, combinação, cópia) -----
// linhas: [{ tipo, refId, rotulo, qtd, unidade, kcal, prot, carb, gord, historico }]
//  - historico=true: valores do registro antigo, escalados pela quantidade (nunca recalculados do cadastro).
//  - senão: recalcula do cadastro atual; se o cadastro sumiu, usa o snapshot da linha escalado e avisa.
function calcularLinha(l, q) {
  if (!l.historico) {
    const ref = l.tipo === 'alimento' ? D.alimentos.find((a) => a.id === l.refId) : D.receitas.find((r) => r.id === l.refId);
    if (ref) { try { return { ...(l.tipo === 'alimento' ? nutrientesAlimento(ref, q, l.unidade) : nutrientesReceita(ref, q, l.unidade)), rotulo: l.tipo === 'alimento' ? rotuloAlimento(ref) : ref.nome, fonte: 'cadastro' }; } catch { /* medida sumiu: cai no snapshot */ } }
  }
  const f = q / l.qtd; return { ...escalar(l, f), rotulo: l.rotulo, fonte: l.historico ? 'historico' : 'snapshot' };
}
function folhaRevisar({ titulo, descricao, linhas, destino, aoConfirmar, botao = 'Adicionar' }) {
  const estado = linhas.map((l) => ({ l, q: l.qtd, sel: true }));
  const desenhar = (s) => {
    const selecionados = []; let nSel = 0; let avisoSnapshot = false;
    const html = estado.map((e, i) => {
      const c = calcularLinha(e.l, e.q > 0 ? e.q : e.l.qtd);
      if (e.sel && e.q > 0) { nSel++; selecionados.push(c); }
      if (c.fonte === 'snapshot') avisoSnapshot = true;
      return `<div class="ing" style="gap:6px;opacity:${e.sel ? 1 : .5}">
        <input type="checkbox" data-sel="${i}" ${e.sel ? 'checked' : ''} aria-label="Incluir ${esc(c.rotulo)}" style="width:22px;height:22px;flex:none">
        <div class="grow"><div class="ellipsis" style="font-weight:500">${esc(c.rotulo)}${c.fonte === 'snapshot' ? ' <span class="badge neutral">cadastro excluído</span>' : ''}</div><div class="small muted">${fmt(c.kcal)} kcal · ${fmt(c.prot, 1)} g prot</div></div>
        <input data-q="${i}" inputmode="decimal" value="${fmtIn(e.q, 3)}" aria-label="Quantidade" style="width:64px;min-height:40px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);text-align:right">
        <span class="small muted" style="width:58px">${esc(e.l.unidade)}</span></div>`;
    }).join('');
    const tot = somar(selecionados);
    $('.linhas', s).innerHTML = html;
    $('.total', s).innerHTML = `<div class="preview" style="margin:10px 0 0"><div><b>${fmt(tot.kcal)}</b><span>kcal</span></div><div><b>${fmt(tot.prot, 1)}</b><span>g prot</span></div><div><b>${fmt(tot.carb, 1)}</b><span>g carb</span></div><div><b>${fmt(tot.gord, 1)}</b><span>g gord</span></div></div>
      ${avisoSnapshot ? '<p class="help">Itens com cadastro excluído usam os valores guardados na combinação.</p>' : ''}`;
    const ok = $('[data-ok]', s); ok.disabled = nSel === 0; ok.textContent = nSel ? `${botao} ${nSel} ${nSel === 1 ? 'item' : 'itens'} em ${destino}` : 'Nenhum item selecionado';
    $$('[data-sel]', s).forEach((c) => c.addEventListener('change', () => { estado[Number(c.dataset.sel)].sel = c.checked; desenhar(s); }));
    $$('[data-q]', s).forEach((inp) => inp.addEventListener('change', () => { const v = num(inp.value); estado[Number(inp.dataset.q)].q = v > 0 ? v : estado[Number(inp.dataset.q)].l.qtd; desenhar(s); }));
  };
  abrirFolha(`${cab(titulo)}${descricao ? `<p class="help" style="margin-top:-6px">${esc(descricao)}</p>` : ''}
    <div class="row between small muted" style="margin-bottom:4px"><span>Desmarque o que não comeu; ajuste quantidades.</span><button type="button" class="btn sm ghost" data-todos>Marcar todos</button></div>
    <div class="linhas"></div><div class="total"></div>
    <button class="btn primary full" data-ok style="margin-top:12px">Adicionar</button>`, (s) => {
    $('[data-todos]', s).addEventListener('click', () => { const todos = estado.every((e) => e.sel); estado.forEach((e) => { e.sel = !todos; }); desenhar(s); });
    let enviado = false;
    $('[data-ok]', s).addEventListener('click', () => {
      if (enviado) return; enviado = true;
      const escolhidas = estado.filter((e) => e.sel && e.q > 0).map((e) => { const c = calcularLinha(e.l, e.q); return { tipo: e.l.tipo, refId: e.l.refId, rotulo: c.rotulo, qtd: e.q, unidade: e.l.unidade, ...escalar(c, 1) }; });
      fecharFolha(); aoConfirmar(escolhidas);
    });
    desenhar(s);
  });
}
// Insere várias linhas numa refeição, com um único "Desfazer" para o lote inteiro.
function inserirLote(idxRefeicao, itens, origem) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; if (!ref || !itens.length) return;
  const novos = itens.map((it) => ({ id: uid(), criadoEm: new Date().toISOString(), origem, ...it }));
  ref.itens.push(...novos);
  for (const it of itens) { registrarRecente(it.tipo, it.refId); lembrarPorcao(it.tipo, it.refId, it.qtd, it.unidade); }
  const ok = salvar(); render();
  const ids = new Set(novos.map((n) => n.id)); const t = somar(novos);
  if (ok) toast(`${novos.length} ${novos.length === 1 ? 'item' : 'itens'} em ${ref.nome}: ${fmt(t.kcal)} kcal.`, { rotulo: 'Desfazer', acao: () => { ref.itens = ref.itens.filter((x) => !ids.has(x.id)); salvar(); render(); toast('Inclusão desfeita.'); } });
}

// ----- Combinações (conjuntos de consumos independentes; não são receitas) -----
function linhasDeItens(itens, historico) { return itens.map((it) => ({ tipo: it.tipo, refId: it.refId, rotulo: it.rotulo, qtd: it.qtd, unidade: it.unidade, ...escalar(it, 1), historico })); }
function salvarCombinacao(itens, nomeSugerido) {
  if (!itens.length) { toast('A refeição está vazia.'); return; }
  const nome = prompt('Nome da combinação (ex.: Meu café da manhã):', nomeSugerido || ''); if (!nome || !nome.trim()) return;
  if (D.combinacoes.some((c) => c.nome.toLowerCase() === nome.trim().toLowerCase()) && !confirmar(`Já existe “${nome.trim()}”. Salvar outra com o mesmo nome?`)) return;
  D.combinacoes.push({ id: uid(), nome: nome.trim(), itens: linhasDeItens(itens, false).map(({ historico, ...r }) => r), criadoEm: new Date().toISOString() });
  D.combinacoes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (salvar()) toast(`Combinação “${nome.trim()}” salva. Ela aparece no seletor, em Combinações.`);
}
function aplicarCombinacao(idxRefeicao, comboId) {
  const c = D.combinacoes.find((x) => x.id === comboId); if (!c) return; const ref = obterDia(UI.data).refeicoes[idxRefeicao];
  folhaRevisar({ titulo: c.nome, descricao: 'Composição calculada com os cadastros atuais.', linhas: linhasDeItens(c.itens, false), destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
    aoConfirmar: (itens) => inserirLote(idxRefeicao, itens, { combinacao: c.id }) });
}
function menuCombinacao(id, idxRefeicao = null) {
  const c = D.combinacoes.find((x) => x.id === id); if (!c) return;
  const ops = [];
  if (idxRefeicao !== null) ops.push({ rotulo: 'Usar nesta refeição', acao: () => aplicarCombinacao(idxRefeicao, id) });
  else ops.push({ rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((r, i) => ({ rotulo: r.nome, acao: () => aplicarCombinacao(i, id) }))) });
  ops.push({ rotulo: 'Renomear', acao: () => { const n = prompt('Novo nome:', c.nome); if (n && n.trim()) { c.nome = n.trim(); salvar(); render(); } } });
  ops.push({ rotulo: 'Excluir combinação', perigo: true, acao: () => { if (!confirmar(`Excluir “${c.nome}”? Os registros já feitos não mudam.`)) return; D.combinacoes = D.combinacoes.filter((x) => x !== c); salvar(); render(); } });
  menu(`${c.nome} · ${c.itens.length} itens`, ops);
}
function itemListaCombinacao(c, act) {
  const t = somar(c.itens.map((it) => calcularLinha({ ...it, historico: false }, it.qtd)));
  return `<button class="list-item" data-act="${act}" data-id="${c.id}"><div class="grow"><div class="name">${esc(c.nome)} <span class="badge">combinação</span></div><div class="meta">${esc(c.itens.map((i) => i.rotulo).join(', '))} · ${fmt(t.kcal)} kcal · ${fmt(t.prot, 1)} g prot</div></div><span class="muted">›</span></button>`;
}
// Última ocorrência anterior de uma refeição com o mesmo nome e itens.
function ultimaRefeicaoAnterior(nome, antesDe) {
  const datas = Object.keys(D.dias).filter((d) => d < antesDe).sort().reverse();
  for (const d of datas) { const r = D.dias[d].refeicoes.find((x) => x.nome === nome && x.itens.length); if (r) return { data: d, refeicao: r }; }
  return null;
}
function repetirUltima(idxRefeicao) {
  const ref = obterDia(UI.data).refeicoes[idxRefeicao]; const u = ultimaRefeicaoAnterior(ref.nome, UI.data);
  if (!u) { toast(`Nenhum ${ref.nome} anterior com registros.`); return; }
  folhaRevisar({ titulo: `Repetir ${ref.nome} de ${rotuloData(u.data).toLowerCase()}`, descricao: `Origem: ${dataCurta(u.data)}. Valores preservados do registro original.`, linhas: linhasDeItens(u.refeicao.itens, true), destino: `${ref.nome} de ${rotuloData(UI.data).toLowerCase()}`,
    aoConfirmar: (itens) => inserirLote(idxRefeicao, itens, { copiaDe: u.data }) });
}

// ----- Detalhe do dia: de onde vem cada nutriente -----
const NUTRIENTES = Object.fromEntries(NUTR.map((n) => [n.k, n]));
function folhaDetalheDia(n0 = 'kcal') {
  let n = NUTRIENTES[n0] ? n0 : 'kcal';
  const desenhar = (s) => {
    const dia = obterDia(UI.data, false); const info = NUTRIENTES[n]; const m = metasEm(UI.data)[n];
    const itens = dia ? dia.refeicoes.flatMap((r, i) => r.itens.map((it) => ({ it, r, i }))) : [];
    const val = (it) => it[n] == null ? null : it[n];
    const conhecidos = itens.filter((x) => val(x.it) != null).length;
    const total = itens.reduce((a, x) => a + (val(x.it) || 0), 0);
    const pct = (v) => total > 0 && v != null ? `${fmt(v / total * 100)}%` : '–';
    const porRef = dia ? dia.refeicoes.map((r) => ({ r, v: r.itens.reduce((a, it) => a + (val(it) || 0), 0), semDados: r.itens.length && r.itens.every((it) => val(it) == null) })) : [];
    const maiores = [...itens].sort((a, b) => (val(b.it) || 0) - (val(a.it) || 0)).slice(0, 10);
    const opcional = !info.obrigatorio; const parcial = opcional && conhecidos < itens.length;
    const difTxt = !m ? (opcional ? `sem ${info.meta === 'limite' ? 'limite' : 'meta'} definido para este nutriente` : 'sem meta definida para este nutriente')
      : info.meta === 'limite' ? (total <= m ? `${fmt(m - total, info.dec)} ${info.un} abaixo do limite de ${fmt(m, info.dec)}` : `${fmt(total - m, info.dec)} ${info.un} acima do limite de ${fmt(m, info.dec)}`)
      : (m - total >= 0 ? `faltam ${fmt(m - total, info.dec)} ${info.un} para a meta de ${fmt(m, info.dec)}` : `${fmt(total - m, info.dec)} ${info.un} além da meta de ${fmt(m, info.dec)}`);
    const cobTxt = opcional && itens.length ? (conhecidos === 0 ? 'Nenhum registro informa este nutriente.' : parcial ? `Total parcial: dados em ${conhecidos} de ${itens.length} registros. Um item sem dado pode ser grande; isto mede cobertura, não precisão.` : `Dados em todos os ${itens.length} registros.`) : '';
    $$('.chip', s).forEach((c) => c.classList.toggle('active', c.dataset.n === n));
    $('.corpo', s).innerHTML = `
      <div class="stat ${n === 'prot' ? 'prot' : ''}" style="margin-bottom:12px"><div class="label">${info.nome} registradas ${rotuloData(UI.data).toLowerCase()}${dia && dia.concluido ? '' : ' <span class="badge neutral">dia em aberto · parcial</span>'}</div>
        <div class="value">${opcional && conhecidos === 0 && itens.length ? 'não informado' : fmt(total, info.dec)} <small>${opcional && conhecidos === 0 && itens.length ? '' : info.un}</small>${parcial ? ' <span class="badge neutral">parcial</span>' : ''}</div><div class="sub">${difTxt}</div>${cobTxt ? `<div class="sub small muted">${cobTxt}</div>` : ''}${m && conhecidos ? `<div class="bar"><span style="width:${Math.min(100, total / m * 100)}%"></span></div>` : ''}</div>
      ${!itens.length ? '<div class="empty">Nenhum alimento registrado neste dia.</div>' : `
      <h3>Por refeição</h3>
      ${porRef.map(({ r, v, semDados }) => `<div class="ing"><div class="grow">${esc(r.nome)}</div><div style="text-align:right"><b>${semDados ? 'não informado' : `${fmt(v, info.dec)} ${info.un}`}</b> <span class="muted small">· ${semDados ? '–' : pct(v)}</span><div class="bar" style="width:120px;margin:4px 0 0 auto"><span style="width:${total > 0 ? v / total * 100 : 0}%"></span></div></div></div>`).join('')}
      <h3 style="margin-top:14px">Maiores contribuições</h3>
      <p class="help" style="margin-top:2px">Participação no total registrado do dia. Toque para corrigir o registro.</p>
      ${maiores.map(({ it, r, i }) => `<button class="list-item" data-item="${it.id}" data-idx="${i}"><div class="grow"><div class="name">${esc(it.rotulo)}</div><div class="meta">${fmt(it.qtd, 2)} ${esc(it.unidade)} · ${esc(r.nome)}</div></div><div style="text-align:right"><b>${val(it) == null ? '<span class="muted">não informado</span>' : `${fmt(val(it), info.dec)} ${info.un}`}</b><div class="small muted">${pct(val(it))}</div></div></button>`).join('')}`}`;
    $$('[data-item]', s).forEach((b) => b.addEventListener('click', () => { fecharFolha(); folhaItem(Number(b.dataset.idx), b.dataset.item); }));
  };
  abrirFolha(`${cab('Detalhe do dia')}
    <div class="chips">${Object.entries(NUTRIENTES).map(([k, v]) => `<button class="chip" data-n="${k}">${v.nome}</button>`).join('')}</div>
    <div class="corpo"></div>`, (s) => {
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { n = c.dataset.n; desenhar(s); }));
    desenhar(s);
  });
}

// ----- Editar item registrado -----
function folhaItem(idxRefeicao, itemId) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idxRefeicao]; const it = ref.itens.find((x) => x.id === itemId); if (!it) return;
  const origem = it.tipo === 'alimento' ? D.alimentos.find((a) => a.id === it.refId) : D.receitas.find((r) => r.id === it.refId);
  const ops = [
    { rotulo: 'Alterar quantidade', acao: () => {
      if (origem) folhaQuantidade({ tipo: it.tipo, id: it.refId, item: it, aoConfirmar: (d) => { Object.assign(it, d); salvar(); render(); } });
      else folhaQuantidadeOrfa(it);
    } },
    { rotulo: 'Duplicar neste dia', acao: () => { ref.itens.push({ ...it, id: uid(), criadoEm: new Date().toISOString() }); salvar(); render(); toast('Item duplicado.'); } },
    { rotulo: 'Mover para outra refeição', acao: () => menu('Mover para', dia.refeicoes.filter((r) => r !== ref).map((r) => ({ rotulo: r.nome, acao: () => { ref.itens = ref.itens.filter((x) => x !== it); r.itens.push(it); salvar(); render(); } }))) },
  ];
  if (origem && it.tipo === 'alimento') ops.push({ rotulo: origem.favorito ? 'Remover dos favoritos' : 'Marcar alimento como favorito', acao: () => { origem.favorito = !origem.favorito; salvar(); toast(origem.favorito ? 'Favoritado.' : 'Removido dos favoritos.'); } });
  if (origem && it.tipo === 'receita') ops.push({ rotulo: origem.favorito ? 'Remover receita dos favoritos' : 'Marcar receita como favorita', acao: () => { origem.favorito = !origem.favorito; salvar(); } });
  ops.push({ rotulo: 'Excluir registro', perigo: true, acao: () => { ref.itens = ref.itens.filter((x) => x !== it); salvar(); render(); toast('Registro excluído.'); } });
  menu(`${it.rotulo} · ${fmt(it.qtd, 2)} ${it.unidade}`, ops);
}
// Item cujo alimento foi apagado: recalcula proporcionalmente a partir do próprio registro.
function folhaQuantidadeOrfa(it) {
  abrirFolha(`${cab('Alterar quantidade')}<p class="help">O cadastro original foi excluído. A nova quantidade será calculada proporcionalmente a este registro (${fmt(it.qtd, 2)} ${esc(it.unidade)} = ${fmt(it.kcal)} kcal).</p>
    <div class="field"><label>Quantidade (${esc(it.unidade)})</label><input name="qtd" inputmode="decimal" value="${fmtIn(it.qtd, 3)}"></div><button class="btn primary full" data-ok>Salvar</button>`, (s) => {
    $('[data-ok]', s).addEventListener('click', () => {
      const q = num($('[name=qtd]', s).value); if (!(q > 0)) { toast('Quantidade inválida.'); return; }
      const f = q / it.qtd; it.kcal *= f; it.prot *= f; it.carb *= f; it.gord *= f; it.qtd = q; salvar(); render(); fecharFolha();
    });
  });
}

// ----- Menu da refeição -----
function menuRefeicao(idx) {
  const dia = obterDia(UI.data); const ref = dia.refeicoes[idx];
  const ant = ultimaRefeicaoAnterior(ref.nome, UI.data);
  menu(ref.nome, [
    ...(ant ? [{ rotulo: `Repetir ${ref.nome} de ${rotuloData(ant.data).toLowerCase()} (${ant.refeicao.itens.length} itens)`, acao: () => repetirUltima(idx) }] : []),
    { rotulo: 'Copiar refeição de outro dia', acao: () => folhaCopiar(idx) },
    ...(ref.itens.length ? [{ rotulo: 'Salvar como combinação', acao: () => salvarCombinacao(ref.itens, `Meu ${ref.nome.toLowerCase()}`) }] : []),
    { rotulo: 'Renomear refeição', acao: () => { const n = prompt('Novo nome da refeição:', ref.nome); if (n && n.trim()) { ref.nome = n.trim(); salvar(); render(); } } },
    { rotulo: 'Limpar itens desta refeição', perigo: true, acao: () => { if (!ref.itens.length) return; if (confirmar(`Excluir os ${ref.itens.length} itens de ${ref.nome}?`)) { ref.itens = []; salvar(); render(); } } },
    { rotulo: 'Remover refeição do dia', perigo: true, acao: () => { if (ref.itens.length && !confirmar(`A refeição tem ${ref.itens.length} itens. Remover mesmo assim?`)) return; dia.refeicoes.splice(idx, 1); salvar(); render(); } },
  ]);
}
function folhaCopiar(idxDestino) {
  let data = somarDias(UI.data, -1);
  const desenhar = (s) => {
    const dia = D.dias[data]; const lista = $('.lista', s);
    if (!diaTemRegistro(dia)) { lista.innerHTML = '<div class="empty">Nenhum registro nessa data.</div>'; return; }
    lista.innerHTML = dia.refeicoes.filter((r) => r.itens.length).map((r, i) => { const t = somar(r.itens); return `<button class="list-item" data-i="${dia.refeicoes.indexOf(r)}"><div class="grow"><div class="name">${esc(r.nome)}</div><div class="meta">${esc(r.itens.map((x) => x.rotulo).join(', '))} · ${fmt(t.kcal)} kcal</div></div><span class="muted">copiar ›</span></button>`; }).join('');
    $$('.list-item', lista).forEach((b) => b.addEventListener('click', () => {
      const origem = dia.refeicoes[Number(b.dataset.i)]; const destino = obterDia(UI.data).refeicoes[idxDestino];
      folhaRevisar({ titulo: `Copiar ${origem.nome} de ${dataCurta(data)}`, descricao: 'Valores preservados do registro original; quantidade alterada é escalada proporcionalmente.', linhas: linhasDeItens(origem.itens, true), destino: `${destino.nome} de ${rotuloData(UI.data).toLowerCase()}`, botao: 'Copiar',
        aoConfirmar: (itens) => inserirLote(idxDestino, itens, { copiaDe: data }) });
    }));
  };
  abrirFolha(`${cab('Copiar refeição de outro dia')}<div class="field"><label>Data de origem</label><input type="date" value="${data}" max="${hojeISO()}"></div><div class="lista"></div>`, (s) => {
    $('input[type=date]', s).addEventListener('change', (e) => { if (e.target.value) { data = e.target.value; desenhar(s); } }); desenhar(s);
  });
}

// ----- Cadastro / edição de alimento -----
function folhaAlimento(id, inicial = {}, aoSalvar) {
  const a = id ? D.alimentos.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', marca: '', estado: 'na', refQtd: 100, refUnidade: 'g', kcal: '', prot: '', carb: '', gord: '', medidas: [], favorito: false, obs: '', codigoBarras: '', fonte: '' }, a || {}, inicial);
  let medidas = v.medidas.map((m) => ({ ...m }));
  const linhaMedida = (m, i) => `<div class="ing"><div class="grow">${esc(m.nome)} = ${fmt(m.equivale, 2)} <span class="un"></span></div><button type="button" class="btn sm ghost danger" data-rm="${i}">remover</button></div>`;
  abrirFolha(`${cab(a ? 'Editar alimento' : 'Novo alimento')}
    <form data-form="alimento">
      <h3>Identificação</h3>
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required autofocus></div>
      <div class="grid2">
        <div class="field"><label>Estado</label><select name="estado"><option value="na" ${v.estado === 'na' ? 'selected' : ''}>não se aplica</option><option value="cru" ${v.estado === 'cru' ? 'selected' : ''}>cru</option><option value="cozido" ${v.estado === 'cozido' ? 'selected' : ''}>cozido</option></select></div>
      </div>
      ${(a && a.fonte) || (!a && v.fonte) ? `<p class="help" style="margin-top:0">Valores de origem: <b>${esc(v.fonte)}</b>. Se editar, eles passam a ser seus.</p>` : ''}
      ${v.obs ? `<p class="help" style="margin-top:0;background:var(--warn-soft);padding:8px 10px;border-radius:8px">${esc(v.obs)}</p>` : ''}
      <h3>Referência do rótulo</h3>
      <p class="help" style="margin-top:0">O rótulo informa os valores por 100 g/ml ou por porção. Escolha como está no rótulo; o app não converte nada sozinho.</p>
      <div class="chips base-chips">${[['100', 'Por 100 g ou ml'], ['porcao', 'Por porção do rótulo'], ['outra', 'Outra quantidade']].map(([k, n]) => `<button type="button" class="chip" data-base="${k}">${n}</button>`).join('')}</div>
      <div class="grid2">
        <div class="field"><label class="rot-ref">Quantidade de referência</label><input name="refQtd" inputmode="decimal" value="${fmtIn(v.refQtd, 3)}" required></div>
        <div class="field"><label>Unidade</label><select name="refUnidade">${['g', 'ml', 'porção'].map((u) => `<option ${v.refUnidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      </div>
      <label class="check opt-porcao" hidden><input type="checkbox" name="criarPorcao" checked> <span class="small">Criar a medida “porção do rótulo” com essa quantidade, para registrar “1 porção”.</span></label>
      <p class="help base-txt" style="margin-top:0"></p>
      <h3>Nutrientes <span class="muted small base-txt2"></span></h3>
      <div class="grid2">
        <div class="field"><label>Calorias (kcal)</label><input name="kcal" inputmode="decimal" value="${v.kcal === '' ? '' : fmtIn(v.kcal, 2)}" required></div>
        <div class="field"><label>Proteínas (g)</label><input name="prot" inputmode="decimal" value="${v.prot === '' ? '' : fmtIn(v.prot, 2)}" required></div>
        <div class="field"><label>Carboidratos (g)</label><input name="carb" inputmode="decimal" value="${v.carb === '' ? '' : fmtIn(v.carb, 2)}" required></div>
        <div class="field"><label>Gorduras (g)</label><input name="gord" inputmode="decimal" value="${v.gord === '' ? '' : fmtIn(v.gord, 2)}" required></div>
        <div class="field"><label>Fibras (g) — opcional</label><input name="fibra" inputmode="decimal" value="${v.fibra == null || v.fibra === '' ? '' : fmtIn(v.fibra, 2)}" placeholder="não informado"></div>
        <div class="field"><label>Sódio (mg) — opcional</label><input name="sodio" inputmode="decimal" value="${v.sodio == null || v.sodio === '' ? '' : fmtIn(v.sodio, 2)}" placeholder="não informado"></div>
      </div>
      <p class="help" style="margin-top:-4px">Em branco = não informado (diferente de 0). Sódio em mg; o rótulo às vezes traz só “sal”: não converta, deixe em branco.</p>
      <details class="opcional" ${(v.marca || (v.medidas && v.medidas.length) || v.codigoBarras) ? 'open' : ''}><summary class="btn sm full" style="list-style:none;cursor:pointer;margin:6px 0 10px">Mais opções: marca, medidas caseiras, código de barras</summary>
      <div class="field"><label>Marca (opcional)</label><input name="marca" value="${esc(v.marca || '')}"></div>
      <h3>Medidas caseiras (opcional)</h3>
      <p class="help">Ex.: “unidade” = 50 g, “scoop” = 30 g, “colher de sopa” = 15 ml. Sem equivalência cadastrada o app não presume conversão.</p>
      <div class="medidas">${medidas.map(linhaMedida).join('')}</div>
      <div class="grid3" style="align-items:end;margin-top:8px">
        <div class="field" style="grid-column:span 2"><label>Nome da medida</label><input name="mNome" placeholder="unidade"></div>
        <div class="field"><label>Equivale a (<span class="un"></span>)</label><input name="mEq" inputmode="decimal" placeholder="50"></div>
      </div>
      <button type="button" class="btn sm full" data-add-medida>+ Adicionar medida</button>
      <div class="field" style="margin-top:10px"><label>Código de barras (opcional)</label><input name="codigoBarras" inputmode="numeric" value="${esc(v.codigoBarras || '')}" placeholder="Para reconhecer o produto ao ler o código"></div>
      </details>
      <hr class="sep">
      <label class="check"><input type="checkbox" name="favorito" ${v.favorito ? 'checked' : ''}> Favorito</label>
      <div class="stack" style="margin-top:8px">
        <button class="btn primary full" type="submit">${a ? 'Salvar alterações' : 'Salvar alimento'}</button>
        ${a ? `<button type="button" class="btn full" data-dup>Duplicar como novo alimento</button><button type="button" class="btn full danger" data-del>Excluir alimento</button>` : ''}
      </div>
      ${a ? '<p class="help">Alterar valores não muda registros de dias anteriores: eles guardam os nutrientes calculados na hora.</p>' : ''}
    </form>`, (s) => {
    const form = $('form', s);
    const atualizarUn = () => $$('.un', s).forEach((e) => { e.textContent = form.refUnidade.value; });
    const redesenharMedidas = () => { $('.medidas', s).innerHTML = medidas.map(linhaMedida).join(''); atualizarUn(); $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { medidas.splice(Number(b.dataset.rm), 1); redesenharMedidas(); })); };
    // Base do rótulo: "100" fixa 100; "porcao" libera a quantidade e oferece criar a medida; "outra" é livre.
    let base = (num(form.refQtd.value) === 100 && (form.refUnidade.value === 'g' || form.refUnidade.value === 'ml')) ? '100' : (v.medidas || []).some((m) => m.nome === 'porção do rótulo') ? 'porcao' : 'outra';
    const atualizarBase = () => {
      $$('.base-chips .chip', s).forEach((c) => c.classList.toggle('active', c.dataset.base === base));
      form.refQtd.readOnly = base === '100'; if (base === '100') form.refQtd.value = '100';
      $('.opt-porcao', s).hidden = base !== 'porcao';
      $('.rot-ref', s).textContent = base === 'porcao' ? 'Peso ou volume da porção' : 'Quantidade de referência';
      const q = num(form.refQtd.value); const txt = `Base: valores por ${q > 0 ? fmtIn(q, 3) : '…'} ${form.refUnidade.value}`;
      $('.base-txt', s).textContent = txt + (base === 'porcao' ? ' (porção do rótulo).' : '.'); $('.base-txt2', s).textContent = '· por ' + (q > 0 ? fmtIn(q, 3) : '…') + ' ' + form.refUnidade.value;
    };
    $$('.base-chips .chip', s).forEach((c) => c.addEventListener('click', () => { base = c.dataset.base; if (base === 'porcao' && num(form.refQtd.value) === 100) form.refQtd.value = ''; atualizarBase(); if (base !== '100') form.refQtd.focus(); }));
    form.refQtd.addEventListener('input', atualizarBase);
    form.refUnidade.addEventListener('change', () => { atualizarUn(); atualizarBase(); }); redesenharMedidas(); atualizarBase();
    $('[data-add-medida]', s).addEventListener('click', () => {
      const nome = form.mNome.value.trim(); const eq = num(form.mEq.value);
      if (!nome) { toast('Dê um nome à medida.'); return; }
      if (!(eq > 0)) { toast('Informe a equivalência (número maior que zero).'); return; }
      if (['g', 'ml', 'porção'].includes(nome) || medidas.some((m) => m.nome === nome)) { toast('Já existe uma medida com esse nome.'); return; }
      medidas.push({ nome, equivale: eq }); form.mNome.value = ''; form.mEq.value = ''; redesenharMedidas();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const campos = { nome: form.nome.value.trim(), marca: form.marca.value.trim(), estado: form.estado.value, refQtd: num(form.refQtd.value), refUnidade: form.refUnidade.value,
        kcal: num(form.kcal.value), prot: num(form.prot.value), carb: num(form.carb.value), gord: num(form.gord.value),
        fibra: form.fibra.value.trim() === '' ? null : num(form.fibra.value), sodio: form.sodio.value.trim() === '' ? null : num(form.sodio.value),
        medidas, favorito: form.favorito.checked, obs: v.obs || '', codigoBarras: normalizarCodigo(form.codigoBarras.value) };
      if (!campos.nome) { toast('Informe o nome.'); return; }
      if (!(campos.refQtd > 0)) { toast(base === 'porcao' ? 'Informe o peso ou volume da porção do rótulo.' : 'Quantidade de referência deve ser maior que zero.'); return; }
      if (base === 'porcao' && form.criarPorcao.checked && !['g', 'ml', 'porção'].includes('porção do rótulo') && !medidas.some((m) => m.nome === 'porção do rótulo') && campos.refUnidade !== 'porção') medidas.push({ nome: 'porção do rótulo', equivale: campos.refQtd });
      for (const k of NUTR_OBRIG) if (!(campos[k] >= 0)) { toast(`Valor inválido em ${k}. Use números (vírgula ou ponto).`); return; }
      for (const k of NUTR_OPC) if (campos[k] !== null && !(campos[k] >= 0)) { toast(`Valor inválido em ${k}. Use números ou deixe em branco.`); return; }
      if (campos.codigoBarras) { const dono = D.alimentos.find((x) => x !== a && x.codigoBarras === campos.codigoBarras); if (dono && !confirmar(`O código ${campos.codigoBarras} já está em “${dono.nome}”. Manter nos dois?`)) return; }
      if (!a && v.fonte) { const mudou = NUTR_OBRIG.some((k) => v[k] !== '' && v[k] !== campos[k]); campos.fonte = mudou ? v.fonte + ' (editado)' : v.fonte; }
      let salvo;
      if (a) {
        const mudouValor = a.fonte && [...NUTR_OBRIG, 'refQtd', 'refUnidade'].some((k) => a[k] !== campos[k]);
        Object.assign(a, campos, { atualizadoEm: new Date().toISOString() });
        if (mudouValor) a.fonte = a.fonte.replace(/ \(editado\)$/, '') + ' (editado)';
        salvo = a;
      }
      else { salvo = { id: uid(), ...campos, criadoEm: new Date().toISOString() }; D.alimentos.push(salvo); }
      D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      const gravou = salvar(); fecharFolha(); render(); if (gravou) toast(a ? 'Alimento atualizado.' : 'Alimento cadastrado.');
      if (aoSalvar) aoSalvar(salvo);
    });
    if (a) {
      $('[data-dup]', s).addEventListener('click', () => folhaAlimento(null, { ...a, id: undefined, nome: a.nome + ' (cópia)' }));
      $('[data-del]', s).addEventListener('click', () => {
        const emReceitas = D.receitas.filter((r) => r.ingredientes.some((i) => i.alimentoId === a.id)).map((r) => r.nome);
        const aviso = `Excluir “${a.nome}”? Registros antigos continuam com os valores já calculados.` + (emReceitas.length ? `\n\nUsado nas receitas: ${emReceitas.join(', ')} (elas passam a usar os valores guardados no ingrediente).` : '');
        if (!confirmar(aviso)) return;
        D.alimentos = D.alimentos.filter((x) => x !== a); D.recentes = D.recentes.filter((x) => !(x.tipo === 'alimento' && x.id === a.id));
        salvar(); fecharFolha(); render(); toast('Alimento excluído.');
      });
    }
    form.nome.focus();
  });
}

// ----- Cadastro / edição de receita -----
function folhaReceita(id, rascunho = null, ingsIniciais = null) {
  const r = id ? D.receitas.find((x) => x.id === id) : null;
  const v = Object.assign({ nome: '', porcoes: 1, pesoFinal: '', favorito: false, ingredientes: [] }, r || {}, rascunho || {});
  let ings = ingsIniciais ? ingsIniciais : v.ingredientes.map((i) => ({ ...i }));
  const totais = () => somar(ings);
  abrirFolha(`${cab(r ? 'Editar receita' : 'Nova receita')}
    <form data-form="receita">
      <div class="field"><label>Nome</label><input name="nome" value="${esc(v.nome)}" required placeholder="Ex.: Pão com ovo"></div>
      <h3>Ingredientes</h3>
      <div class="ings"></div>
      <button type="button" class="btn sm full" data-add-ing style="margin:8px 0 12px">+ Adicionar ingrediente</button>
      <div class="grid2">
        <div class="field"><label>Rendimento (porções)</label><input name="porcoes" inputmode="decimal" value="${fmtIn(v.porcoes, 2)}" required></div>
        <div class="field"><label>Peso final do preparo (g, opcional)</label><input name="pesoFinal" inputmode="decimal" value="${v.pesoFinal ? fmtIn(v.pesoFinal, 1) : ''}"></div>
      </div>
      <div class="resumo"></div>
      <label class="check"><input type="checkbox" name="favorito" ${v.favorito ? 'checked' : ''}> Favorita</label>
      <div class="stack" style="margin-top:8px">
        <button class="btn primary full" type="submit">${r ? 'Salvar alterações' : 'Salvar receita'}</button>
        ${r ? '<button type="button" class="btn full danger" data-del>Excluir receita</button>' : ''}
      </div>
    </form>`, (s) => {
    const form = $('form', s);
    const resumo = () => {
      const t = totais(); const p = num(form.porcoes.value); const pf = num(form.pesoFinal.value);
      $('.resumo', s).innerHTML = `<div class="preview"><div><b>${fmt(t.kcal)}</b><span>kcal total</span></div><div><b>${fmt(t.prot, 1)}</b><span>g prot total</span></div>
        <div><b>${p > 0 ? fmt(t.kcal / p) : '–'}</b><span>kcal / porção</span></div><div><b>${p > 0 ? fmt(t.prot / p, 1) : '–'}</b><span>g prot / porção</span></div></div>
        ${pf > 0 ? `<p class="help">Por grama: ${fmt(t.kcal / pf, 2)} kcal · ${fmt(t.prot / pf, 3)} g prot.</p>` : ''}`;
    };
    const redesenhar = () => {
      $('.ings', s).innerHTML = ings.length ? ings.map((i, k) => `<div class="ing"><div class="grow">${esc(i.rotulo)} · ${fmt(i.qtd, 2)} ${esc(i.unidade)} <span class="muted">(${fmt(i.kcal)} kcal)</span></div><button type="button" class="btn sm ghost danger" data-rm="${k}">remover</button></div>`).join('') : '<div class="empty" style="padding:4px 0">Nenhum ingrediente ainda.</div>';
      $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { ings.splice(Number(b.dataset.rm), 1); redesenhar(); }));
      resumo();
    };
    form.porcoes.addEventListener('input', resumo); form.pesoFinal.addEventListener('input', resumo); redesenhar();
    $('[data-add-ing]', s).addEventListener('click', () => {
      // Guarda o estado do formulário enquanto o seletor está aberto.
      const rascunho = { nome: form.nome.value, porcoes: num(form.porcoes.value) || 1, pesoFinal: form.pesoFinal.value.trim() === '' ? '' : num(form.pesoFinal.value), favorito: form.favorito.checked };
      const reabrir = () => folhaReceita(id, rascunho, ings);
      folhaEscolherIngrediente((alimento) => {
        folhaQuantidade({ tipo: 'alimento', id: alimento.id, aoConfirmar: (d) => {
          ings.push({ alimentoId: alimento.id, rotulo: d.rotulo, qtd: d.qtd, unidade: d.unidade, ...escalar(d, 1) });
          reabrir();
        } });
      }, reabrir);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = form.nome.value.trim(); const porcoes = num(form.porcoes.value); const pf = form.pesoFinal.value.trim() === '' ? null : num(form.pesoFinal.value);
      if (!nome) { toast('Informe o nome.'); return; }
      if (!ings.length) { toast('Adicione ao menos um ingrediente.'); return; }
      if (!(porcoes > 0)) { toast('Rendimento deve ser maior que zero.'); return; }
      if (pf !== null && !(pf > 0)) { toast('Peso final inválido.'); return; }
      const campos = { nome, porcoes, pesoFinal: pf, favorito: form.favorito.checked, ingredientes: ings, atualizadoEm: new Date().toISOString() };
      if (r) Object.assign(r, campos); else D.receitas.push({ id: uid(), ...campos, criadoEm: campos.atualizadoEm });
      D.receitas.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
      const gravou = salvar(); fecharFolha(); render(); if (gravou) toast(r ? 'Receita atualizada.' : 'Receita salva.');
    });
    if (r) $('[data-del]', s).addEventListener('click', () => { if (!confirmar(`Excluir a receita “${r.nome}”? Registros antigos não mudam.`)) return; D.receitas = D.receitas.filter((x) => x !== r); D.recentes = D.recentes.filter((x) => !(x.tipo === 'receita' && x.id === r.id)); salvar(); fecharFolha(); render(); });
  });
}
function folhaEscolherIngrediente(aoEscolher, aoCancelar) {
  let busca = '';
  const desenhar = (s) => {
    const q = busca.trim();
    const lista = filtrarOrdenar(D.alimentos, q, (a) => a.nome, (a) => a.marca);
    $('.lista', s).innerHTML = (lista.length ? lista.map((a) => itemListaAlimento(a, 'pick')).join('') : '<div class="empty">Nenhum alimento encontrado.</div>')
      + `<button class="list-item" data-act="novo"><div class="grow"><div class="name" style="color:var(--brand)">+ Cadastrar novo alimento</div></div></button>`;
    $$('[data-act="pick"]', s).forEach((b) => b.addEventListener('click', () => aoEscolher(D.alimentos.find((a) => a.id === b.dataset.id))));
    $('[data-act="novo"]', s).addEventListener('click', () => folhaAlimento(null, { nome: busca.trim() }, (novo) => aoEscolher(novo)));
  };
  abrirFolha(`${cab('Escolher ingrediente')}<input class="search" type="search" placeholder="Buscar alimento" aria-label="Buscar"><div class="lista"></div>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); }); desenhar(s);
    $('[data-fechar]', s).addEventListener('click', aoCancelar);
    $('.search', s).focus();
  });
}

// ----- Detalhe de alimento / receita (na aba Alimentos) -----
function menuAlimento(id) {
  const a = D.alimentos.find((x) => x.id === id); if (!a) return;
  menu(rotuloAlimento(a), [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((r, i) => ({ rotulo: r.nome, acao: () => adicionarItem(i, 'alimento', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaAlimento(id) },
    { rotulo: a.favorito ? 'Remover dos favoritos' : 'Marcar como favorito', acao: () => { a.favorito = !a.favorito; salvar(); render(); } },
  ]);
}
function menuReceita(id) {
  const r = D.receitas.find((x) => x.id === id); if (!r) return;
  menu(r.nome, [
    { rotulo: 'Registrar em uma refeição de ' + rotuloData(UI.data).toLowerCase(), acao: () => menu('Em qual refeição?', obterDia(UI.data).refeicoes.map((m, i) => ({ rotulo: m.nome, acao: () => adicionarItem(i, 'receita', id) }))) },
    { rotulo: 'Editar / excluir', acao: () => folhaReceita(id) },
    { rotulo: r.favorito ? 'Remover dos favoritos' : 'Marcar como favorita', acao: () => { r.favorito = !r.favorito; salvar(); render(); } },
  ]);
}

// ---------- Código de barras ----------
// Leitor: BarcodeDetector nativo (Chrome Android). Sem ele, só digitação. Consulta: Open Food Facts,
// base colaborativa; o que vem de lá entra no formulário para conferência, nunca é salvo direto.
const FONTE_OFF = 'Open Food Facts';
const temLeitor = () => 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
function normalizarCodigo(c) { return String(c || '').replace(/\D/g, ''); }
async function consultarOFF(codigo) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_pt,brands,quantity,serving_size,nutriments`;
  let ultimoErro;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/json' } }); clearTimeout(t);
      if (r.status === 404) return { achou: false };
      if (!r.ok) { ultimoErro = new Error(`HTTP ${r.status}`); continue; }
      const j = await r.json();
      if (j.status !== 1 || !j.product) return { achou: false };
      return { achou: true, produto: j.product };
    } catch (e) { ultimoErro = e; }
  }
  throw ultimoErro || new Error('falha na consulta');
}
// Converte o registro do OFF nos campos do formulário. Só por 100 g/ml; kJ vira kcal (÷4,184) se faltar kcal.
function mapearOFF(p, codigo) {
  const n = p.nutriments || {};
  const num100 = (k) => { const v = n[k]; return typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ? Number(v) : ''); };
  let kcal = num100('energy-kcal_100g');
  if (kcal === '' && num100('energy-kj_100g') !== '') kcal = Math.round(num100('energy-kj_100g') / 4.184);
  if (kcal === '' && num100('energy_100g') !== '') kcal = Math.round(num100('energy_100g') / 4.184);
  // A base (100 g ou 100 ml) vem inferida do texto da embalagem; é só um palpite que o usuário confere.
  const qtdTxt = p.quantity || '';
  const liquido = /\b(ml|l|litros?)\b/i.test(qtdTxt) && !/\b(g|kg|gramas?)\b/i.test(qtdTxt);
  const refUnidade = liquido ? 'ml' : 'g';
  const avisoBase = qtdTxt ? ` Base assumida: 100 ${refUnidade} (embalagem "${qtdTxt}"); se o rótulo informar por 100 ${refUnidade === 'g' ? 'ml' : 'g'}, troque a unidade.` : ' Base assumida: 100 g; confira se o rótulo não é por 100 ml.';
  const medidas = [];
  const m = /([\d.,]+)\s*(g|ml)/i.exec(p.serving_size || '');
  if (m && m[2].toLowerCase() === refUnidade) { const q = num(m[1]); if (q > 0) medidas.push({ nome: 'porção do rótulo', equivale: q }); }
  const faltando = ['kcal', 'prot', 'carb', 'gord'].filter((k, i) => [kcal, num100('proteins_100g'), num100('carbohydrates_100g'), num100('fat_100g')][i] === '');
  // Opcionais: fibra em g; sódio no OFF vem em g → mg, convertido uma única vez aqui. "Sal" não é sódio: não converte.
  const fibra = num100('fiber_100g') === '' ? null : num100('fiber_100g');
  const sodio = num100('sodium_100g') === '' ? null : Math.round(num100('sodium_100g') * 1000);
  const avisoSal = sodio === null && num100('salt_100g') !== '' ? ` Vem só “sal” (${fmt(num100('salt_100g'), 2)} g/100 ${refUnidade}); sódio ficou como não informado.` : '';
  return {
    nome: (p.product_name_pt || p.product_name || '').trim(), marca: (p.brands || '').split(',')[0].trim(), refQtd: 100, refUnidade,
    kcal, prot: num100('proteins_100g'), carb: num100('carbohydrates_100g'), gord: num100('fat_100g'), fibra, sodio, medidas,
    codigoBarras: codigo, fonte: FONTE_OFF,
    obs: `Dados do ${FONTE_OFF} (base colaborativa): confira com o rótulo antes de salvar.${faltando.length ? ` Faltou no cadastro deles: ${faltando.join(', ')}.` : ''}${p.serving_size ? ` Porção informada: ${p.serving_size}.` : ''}${avisoBase}${avisoSal}`,
  };
}
// Fluxo: código → alimento já cadastrado (callback direto) → consulta OFF → formulário preenchido → callback ao salvar.
function folhaCodigo(aoEscolher) {
  let stream = null, rodando = false;
  const parar = () => { rodando = false; if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };
  const tratar = async (s, codigoBruto) => {
    const codigo = normalizarCodigo(codigoBruto);
    if (codigo.length < 8 || codigo.length > 14) { toast('Código inválido: use 8 a 14 dígitos.'); return; }
    parar();
    const existente = D.alimentos.find((a) => a.codigoBarras === codigo);
    if (existente) { fecharFolha(); toast(`Reconhecido: ${rotuloAlimento(existente)}`); aoEscolher(existente); return; }
    const status = $('.status', s); const abrirManual = (ini, msg) => { fecharFolha(); if (msg) toast(msg); folhaAlimento(null, ini, aoEscolher); };
    if (!D.config.consultarOFF) { abrirManual({ codigoBarras: codigo }, 'Consulta desligada em Ajustes. Cadastre pelo rótulo.'); return; }
    if (navigator.onLine === false) { abrirManual({ codigoBarras: codigo }, 'Sem internet. Cadastre pelo rótulo; o código fica salvo.'); return; }
    status.textContent = `Consultando ${codigo} no ${FONTE_OFF}…`;
    try {
      const r = await consultarOFF(codigo);
      if (!r.achou) { abrirManual({ codigoBarras: codigo }, `Código ${codigo} não está no ${FONTE_OFF}. Cadastre pelo rótulo.`); return; }
      abrirManual(mapearOFF(r.produto, codigo));
    } catch (e) { console.warn(e); abrirManual({ codigoBarras: codigo }, `${FONTE_OFF} não respondeu. Cadastre pelo rótulo; o código fica salvo.`); }
  };
  abrirFolha(`${cab('Código de barras')}
    ${temLeitor() ? `<div class="camera"><video playsinline muted autoplay style="width:100%;border-radius:12px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><div class="row cam-ctr" style="margin-top:8px;min-height:0"></div><p class="help cam-msg">Abrindo a câmera…</p></div>`
      : `<p class="help">Este navegador não tem leitor de código embutido (no Android, use o Chrome). Digite o código abaixo.</p>`}
    <form class="row" data-form="codigo"><div class="field grow" style="margin:0"><label>Código (EAN)</label><input name="codigo" inputmode="numeric" pattern="[0-9]*" placeholder="7891234567890" autocomplete="off"></div><button class="btn primary" type="submit" style="align-self:flex-end">Buscar</button></form>
    <p class="help status" aria-live="polite" style="margin-top:10px"></p>
    <p class="small muted">${D.config.consultarOFF ? `A consulta envia apenas o código ao ${FONTE_OFF}. Pode ser desligada em Ajustes.` : 'Consulta ao Open Food Facts desligada em Ajustes: o código só fica salvo no alimento.'}</p>`, async (s) => {
    $('form', s).addEventListener('submit', (e) => { e.preventDefault(); tratar(s, $('[name=codigo]', s).value); });
    const bd = $('.sheet-backdrop'); const obs = new MutationObserver(() => { if (!document.contains(bd)) { parar(); obs.disconnect(); } }); obs.observe($('#sheet-root'), { childList: true });
    if (!temLeitor()) { $('[name=codigo]', s).focus(); return; }
    const video = $('video', s), msg = $('.cam-msg', s);
    try {
      const formatos = (await BarcodeDetector.getSupportedFormats()).filter((f) => ['ean_13', 'ean_8', 'upc_a', 'upc_e'].includes(f));
      if (!formatos.length) throw new Error('sem formatos EAN');
      const det = new BarcodeDetector({ formats: formatos });
      // Resolução alta + foco contínuo ajudam em código pequeno; zoom e lanterna quando a câmera oferecer.
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      video.srcObject = stream; await video.play(); rodando = true;
      const trilha = stream.getVideoTracks()[0];
      const cap = trilha.getCapabilities ? trilha.getCapabilities() : {};
      const aplicar = (c) => trilha.applyConstraints({ advanced: [c] }).catch(() => {});
      if (Array.isArray(cap.focusMode) && cap.focusMode.includes('continuous')) aplicar({ focusMode: 'continuous' });
      const ctr = $('.cam-ctr', s);
      if (cap.zoom && cap.zoom.max > cap.zoom.min) {
        const z = document.createElement('input'); z.type = 'range'; z.min = cap.zoom.min; z.max = cap.zoom.max; z.step = cap.zoom.step || 0.1;
        z.value = Math.min(cap.zoom.max, Math.max(cap.zoom.min, 2)); z.setAttribute('aria-label', 'Zoom'); z.className = 'grow';
        aplicar({ zoom: Number(z.value) }); z.addEventListener('input', () => aplicar({ zoom: Number(z.value) }));
        const rot = document.createElement('span'); rot.className = 'small muted'; rot.textContent = 'Zoom'; ctr.append(rot, z);
      }
      if (cap.torch) {
        let ligada = false; const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn sm'; bt.textContent = '🔦 Lanterna';
        bt.addEventListener('click', () => { ligada = !ligada; aplicar({ torch: ligada }); bt.classList.toggle('primary', ligada); }); ctr.append(bt);
      }
      msg.textContent = 'Aponte a câmera para o código de barras. Código pequeno: aproxime até ele ocupar quase toda a largura' + (cap.zoom ? ' ou use o zoom' : '') + '.';
      const laco = async () => {
        if (!rodando) return;
        try { const cods = await det.detect(video); if (cods.length && rodando) { msg.textContent = `Lido: ${cods[0].rawValue}`; tratar(s, cods[0].rawValue); return; } } catch { /* quadro inválido */ }
        setTimeout(laco, 120);
      };
      laco();
    } catch (e) {
      console.warn(e); parar(); $('.camera', s).innerHTML = `<p class="help">Não foi possível usar a câmera (${e.name === 'NotAllowedError' ? 'permissão negada' : 'indisponível'}). Digite o código abaixo.</p>`;
      $('[name=codigo]', s).focus();
    }
  });
}

// ---------- Água: quantidade livre ----------
function folhaAgua() {
  const dia = obterDia(UI.data);
  abrirFolha(`${cab('Registrar água')}
    <div class="field"><label>Quantidade (ml)</label><input name="ml" inputmode="numeric" pattern="[0-9]*" placeholder="Ex.: 350" autofocus></div>
    <div class="chips">${[150, 200, 300, 350, 600, 1000].map((v) => `<button class="chip" data-v="${v}">${fmt(v)} ml</button>`).join('')}</div>
    <button class="btn primary full" data-ok>Adicionar</button>
    ${dia.agua.length ? `<hr class="sep"><h3>Registros de ${esc(rotuloData(UI.data).toLowerCase())}</h3><div class="lista">${dia.agua.map((a) => `<div class="ing"><div class="grow">${fmt(a.ml)} ml <span class="muted small">· ${new Date(a.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><button type="button" class="btn sm ghost danger" data-rm="${a.id}">remover</button></div>`).join('')}</div>` : ''}`, (s) => {
    const inp = $('[name=ml]', s);
    const add = () => { const ml = num(inp.value); if (!(ml > 0)) { toast('Informe uma quantidade em ml maior que zero.'); return; } dia.agua.push({ id: uid(), ml: Math.round(ml), em: new Date().toISOString() }); salvar(); fecharFolha(); render(); };
    $('[data-ok]', s).addEventListener('click', add); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $$('.chip', s).forEach((c) => c.addEventListener('click', () => { inp.value = c.dataset.v; add(); }));
    $$('[data-rm]', s).forEach((b) => b.addEventListener('click', () => { dia.agua = dia.agua.filter((a) => a.id !== b.dataset.rm); salvar(); fecharFolha(); render(); }));
    inp.focus();
  });
}

// ---------- Backup ----------
function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportarJSON() { baixar(`meu-prato-backup-${hojeISO()}${modoDemo() ? '-demo' : ''}.json`, JSON.stringify({ ...D, exportadoEm: new Date().toISOString(), app: 'Meu Prato' }, null, 2), 'application/json'); toast('Backup gerado.'); }
function exportarCSV() {
  const linhas = [['data', 'refeicao', 'alimento', 'tipo', 'quantidade', 'unidade', 'kcal', 'proteina_g', 'carboidrato_g', 'gordura_g', 'fibra_g', 'sodio_mg', 'dia_concluido']];
  const opc = (v, d) => v == null ? '' : v.toFixed(d); // vazio = não informado
  const datas = Object.keys(D.dias).sort();
  for (const data of datas) {
    for (const r of D.dias[data].refeicoes) for (const it of r.itens)
      linhas.push([data, r.nome, it.rotulo, it.tipo, it.qtd, it.unidade, it.kcal.toFixed(1), it.prot.toFixed(2), it.carb.toFixed(2), it.gord.toFixed(2), opc(it.fibra, 2), opc(it.sodio, 0), D.dias[data].concluido ? 'sim' : 'nao']);
    const ml = aguaDia(D.dias[data]); if (ml) linhas.push([data, 'Água', 'Água', 'agua', ml, 'ml', '0.0', '0.00', '0.00', '0.00', '', '', D.dias[data].concluido ? 'sim' : 'nao']);
  }
  const cel = (v) => { const s = String(v).replace(/\./g, ',' ); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Números com vírgula decimal e separador ";" para abrir direto no Excel/LibreOffice em pt-BR.
  const csv = '﻿' + linhas.map((l) => l.map((v, i) => (typeof v === 'number' || (i >= 6 && i <= 11)) ? String(v).replace('.', ',') : cel(v)).join(';')).join('\r\n');
  baixar(`meu-prato-historico-${hojeISO()}.csv`, csv, 'text/csv;charset=utf-8'); toast(linhas.length - 1 ? 'CSV gerado.' : 'CSV gerado (sem registros).');
}
function importarJSON(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    let obj; try { obj = JSON.parse(leitor.result); } catch { alert('Arquivo não é um JSON válido.'); return; }
    const v = validarDados(obj); if (!v.ok) { alert('Backup inválido: ' + v.erro); return; }
    const nDias = Object.values(obj.dias).filter(diaTemRegistro).length;
    const atual = `Dados atuais: ${D.alimentos.length} alimentos, ${D.receitas.length} receitas, ${Object.values(D.dias).filter(diaTemRegistro).length} dias com registro.`;
    const novo = `Backup: ${obj.alimentos.length} alimentos, ${obj.receitas.length} receitas, ${nDias} dias com registro${obj.exportadoEm ? ` (exportado em ${new Date(obj.exportadoEm).toLocaleString('pt-BR')})` : ''}.`;
    if (!confirmar(`${novo}\n\n${atual}\n\nSUBSTITUIR os dados atuais pelo backup? Esta ação não pode ser desfeita.`)) return;
    D = normalizar(obj); salvar(); UI.data = hojeISO(); render(); toast('Backup importado.');
  };
  leitor.readAsText(arquivo);
}

// ---------- Alimentos comuns (TACO) ----------
// Estado de cada item da lista embutida em relação ao cadastro atual.
function estadoBase() {
  const porNome = new Map(D.alimentos.map((a) => [a.nome.toLowerCase(), a]));
  const mesmaFonte = (a, b) => (a.fonte || '') === (b.fonte || FONTE_TACO);
  return ALIMENTOS_BASE.map((b) => {
    const a = porNome.get(b.nome.toLowerCase());
    const completarMed = !!(a && b.medidas && !a.medidas.length);
    const completarOpc = !!(a && mesmaFonte(a, b) && NUTR_OPC.some((k) => a[k] == null && b[k] != null));
    return { b, a, novo: !a, completar: completarMed || completarOpc, completarMed, completarOpc };
  });
}
function aplicarBase(escolhidos, completarTambem) {
  const est = estadoBase(); let n = 0, c = 0;
  for (const e of est) {
    if (e.novo && escolhidos.has(e.b.nome)) {
      const b = e.b; D.alimentos.push({ id: uid(), nome: b.nome, marca: '', estado: b.estado, refQtd: 100, refUnidade: b.refUnidade || 'g', kcal: b.kcal, prot: b.prot, carb: b.carb, gord: b.gord, fibra: b.fibra ?? null, sodio: b.sodio ?? null, medidas: (b.medidas || []).map((m) => ({ ...m })), favorito: false, fonte: b.fonte || FONTE_TACO, obs: b.obs || '', criadoEm: new Date().toISOString() }); n++;
    } else if (!e.novo && completarTambem && e.completar) {
      if (e.completarMed) { e.a.medidas = e.b.medidas.map((m) => ({ ...m })); if (!e.a.obs) e.a.obs = e.b.obs || ''; }
      if (e.completarOpc) for (const k of NUTR_OPC) if (e.a[k] == null && e.b[k] != null) e.a[k] = e.b[k];
      c++;
    }
  }
  D.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  if (salvar()) toast(`${n} adicionado(s)${c ? `, ${c} completado(s)` : ''}.`);
  return n + c;
}
// Folha de importação: escolher quais itens entram, com estado (cru/cozido) e fonte visíveis.
function folhaImportarBase(aoTerminar) {
  const est = estadoBase(); const sel = new Set(est.filter((e) => e.novo).map((e) => e.b.nome)); let busca = '';
  const nCompletar = est.filter((e) => e.completar).length;
  const desenhar = (s) => {
    const q = busca.trim();
    const vis = est.filter((e) => !q || pontuarBusca(q, e.b.nome) > 0);
    $('.lista', s).innerHTML = vis.map((e) => { const b = e.b; const d = NUTR.find((n) => n.k === 'kcal');
      return `<label class="list-item" style="cursor:pointer;gap:8px"><input type="checkbox" data-nome="${esc(b.nome)}" ${e.novo ? (sel.has(b.nome) ? 'checked' : '') : 'checked disabled'} style="width:22px;height:22px;flex:none">
        <div class="grow"><div class="name">${esc(b.nome)}${b.estado !== 'na' ? ` <span class="badge neutral">${b.estado}</span>` : ''}${b.fonte ? ` <span class="badge neutral">${esc(b.fonte)}</span>` : ''}</div>
        <div class="meta">${fmt(b.kcal)} kcal · ${fmt(b.prot, 1)} g prot${b.fibra != null ? ` · fibra ${fmt(b.fibra, 1)}` : ''}${b.sodio != null ? ` · Na ${fmt(b.sodio)} mg` : ''} por 100 ${b.refUnidade || 'g'}${e.novo ? '' : e.completar ? ' · <b>já cadastrado, completável</b>' : ' · já cadastrado'}</div></div></label>`; }).join('') || '<div class="empty">Nada encontrado.</div>';
    $$('input[data-nome]', s).forEach((c) => c.addEventListener('change', () => { if (c.checked) sel.add(c.dataset.nome); else sel.delete(c.dataset.nome); atualizarBotao(s); }));
    atualizarBotao(s);
  };
  const atualizarBotao = (s) => { const ok = $('[data-ok]', s); const comp = $('[name=completar]', s)?.checked && nCompletar; ok.disabled = !sel.size && !comp; ok.textContent = sel.size ? `Adicionar ${sel.size} ${sel.size === 1 ? 'alimento' : 'alimentos'}` : comp ? `Completar ${nCompletar} já cadastrado(s)` : 'Nada selecionado'; };
  abrirFolha(`${cab('Alimentos comuns')}
    <p class="help" style="margin-top:-6px">Valores por 100 g da ${FONTE_TACO}, lidos do PDF oficial; item de outra fonte está marcado. Entram como cadastro normal, editável. Pesos por unidade são médias: confira pesando.</p>
    <input class="search" type="search" placeholder="Filtrar a lista" aria-label="Filtrar">
    <div class="row between small" style="margin-bottom:6px"><button type="button" class="btn sm ghost" data-todos>Marcar todos os novos</button><button type="button" class="btn sm ghost" data-nenhum>Desmarcar</button></div>
    <div class="lista"></div>
    ${nCompletar ? `<label class="check" style="margin-top:8px"><input type="checkbox" name="completar" checked> <span class="small">Também preencher fibras/sódio e medidas vazias em ${nCompletar} item(ns) já cadastrado(s) da mesma fonte, sem sobrescrever valores.</span></label>` : ''}
    <button class="btn primary full" data-ok style="margin-top:10px">Adicionar</button>`, (s) => {
    $('.search', s).addEventListener('input', (e) => { busca = e.target.value; desenhar(s); });
    $('[data-todos]', s).addEventListener('click', () => { est.filter((e) => e.novo).forEach((e) => sel.add(e.b.nome)); desenhar(s); });
    $('[data-nenhum]', s).addEventListener('click', () => { sel.clear(); desenhar(s); });
    $('[name=completar]', s)?.addEventListener('change', () => atualizarBotao(s));
    $('[data-ok]', s).addEventListener('click', () => { const comp = !!$('[name=completar]', s)?.checked; fecharFolha(); aplicarBase(sel, comp); UI.aba = 'alimentos'; UI.filtroAlimentos = 'todos'; render(); if (aoTerminar) aoTerminar(); });
    desenhar(s);
  });
}
function novoDeModelo(i) {
  const m = MODELOS_BASE[i];
  folhaAlimento(null, { nome: m.nome, refQtd: m.refQtd, refUnidade: m.refUnidade, medidas: m.medidas.map((x) => ({ ...x })), obs: m.obs });
}

// ---------- Demonstração ----------
function semearDemo(d) {
  const mk = (nome, marca, refQtd, refUnidade, kcal, prot, carb, gord, medidas = [], estado = 'na', favorito = false) => ({ id: uid(), nome, marca, estado, refQtd, refUnidade, kcal, prot, carb, gord, medidas, favorito, criadoEm: new Date().toISOString() });
  const ovo = mk('Ovo de galinha (exemplo)', '', 100, 'g', 143, 13, 1, 10, [{ nome: 'unidade', equivale: 50 }], 'cozido', true);
  const pao = mk('Pão francês (exemplo)', '', 100, 'g', 300, 8, 58, 3, [{ nome: 'unidade', equivale: 50 }]);
  const arroz = mk('Arroz branco cozido (exemplo)', '', 100, 'g', 128, 2.5, 28, 0.2, [{ nome: 'colher de servir', equivale: 45 }], 'cozido');
  const feijao = mk('Feijão carioca cozido (exemplo)', '', 100, 'g', 76, 4.8, 13.6, 0.5, [{ nome: 'concha', equivale: 80 }], 'cozido');
  const frango = mk('Peito de frango grelhado (exemplo)', '', 100, 'g', 159, 32, 0, 2.5, [], 'cozido', true);
  const whey = mk('Whey protein (exemplo)', 'Marca X', 30, 'g', 120, 24, 3, 2, [{ nome: 'scoop', equivale: 30 }], 'na', true);
  const iog = mk('Iogurte natural (exemplo)', '', 100, 'g', 60, 4, 5, 3);
  d.config.metas = { ...METAS_VAZIAS(), kcal: 2000, prot: 120 }; d.config.historicoMetas = [{ desde: '1970-01-01', metas: { ...d.config.metas }, origem: 'demonstração' }];
  d.alimentos.push(ovo, pao, arroz, feijao, frango, whey, iog);
  d.alimentos.sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
  const ing = (a, qtd, unidade) => ({ alimentoId: a.id, rotulo: a.nome, qtd, unidade, ...nutrientesAlimentoDe(a, qtd, unidade) });
  d.receitas.push({ id: uid(), nome: 'Pão com ovo (exemplo)', porcoes: 1, pesoFinal: null, favorito: true, ingredientes: [ing(pao, 1, 'unidade'), ing(ovo, 1, 'unidade')], criadoEm: new Date().toISOString() },
    { id: uid(), nome: 'Iogurte com whey (exemplo)', porcoes: 1, pesoFinal: 230, favorito: false, ingredientes: [ing(iog, 200, 'g'), ing(whey, 1, 'scoop')], criadoEm: new Date().toISOString() });
  const hoje = hojeISO();
  for (let i = 1; i <= 5; i++) {
    const iso = somarDias(hoje, -i);
    const dia = { refeicoes: REFEICOES_PADRAO.map((n) => ({ id: uid(), nome: n, itens: [] })), concluido: i !== 2, agua: [] };
    const add = (ref, a, qtd, unidade) => dia.refeicoes[ref].itens.push({ id: uid(), tipo: 'alimento', refId: a.id, rotulo: a.nome, qtd, unidade, criadoEm: new Date().toISOString(), ...nutrientesAlimentoDe(a, qtd, unidade) });
    dia.agua = [250, 500, 250, 350].slice(0, 2 + (i % 3)).map((ml) => ({ id: uid(), ml, em: new Date().toISOString() }));
    add(0, pao, 2, 'unidade'); add(0, ovo, 2, 'unidade'); add(1, arroz, 150 + i * 10, 'g'); add(1, feijao, 1, 'concha'); add(1, frango, 150, 'g'); add(2, whey, 1, 'scoop'); add(3, frango, 120, 'g'); add(3, arroz, 100, 'g');
    d.dias[iso] = dia;
  }
}
function nutrientesAlimentoDe(a, qtd, unidade) { const u = [{ nome: a.refUnidade, fator: 1 }, ...a.medidas.map((m) => ({ nome: m.nome, fator: m.equivale }))].find((x) => x.nome === unidade); return escalar(a, (qtd * u.fator) / a.refQtd); }
function alternarDemo() {
  const entrando = !modoDemo();
  try { if (entrando) localStorage.setItem(CHAVE_MODO, 'demo'); else localStorage.removeItem(CHAVE_MODO); } catch { toast('Sem acesso ao armazenamento.'); return; }
  D = carregar(); if (entrando) salvar(); UI.data = hojeISO(); UI.aba = 'hoje'; render();
  toast(entrando ? 'Modo demonstração ativado.' : 'De volta aos seus dados reais.');
}

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab'); if (tab) { UI.aba = tab.dataset.tab; render(); return; }
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  const act = el.dataset.act;
  const acoes = {
    'dia-ant': () => { UI.data = somarDias(UI.data, -1); render(); },
    'dia-prox': () => { UI.data = somarDias(UI.data, 1); render(); },
    'ir-hoje': () => { UI.data = hojeISO(); render(); },
    'ir-config': () => { UI.aba = 'config'; render(); },
    'agua-mais': () => { const ml = num(el.dataset.ml); const dia = obterDia(UI.data); dia.agua.push({ id: uid(), ml, em: new Date().toISOString() }); salvar(); render(); },
    'agua-outro': () => folhaAgua(),
    'agua-desfazer': () => { const dia = obterDia(UI.data); const u = dia.agua.pop(); if (u) { salvar(); render(); toast(`Removidos ${fmt(u.ml)} ml.`); } },
    'adicionar': () => { obterDia(UI.data); abrirSeletor(Number(el.dataset.idx)); },
    'editar-item': () => folhaItem(Number(el.dataset.idx), el.dataset.item),
    'detalhe': () => folhaDetalheDia(el.dataset.n),
    'menu-refeicao': () => { obterDia(UI.data); menuRefeicao(Number(el.dataset.idx)); },
    'repetir': () => { obterDia(UI.data); repetirUltima(Number(el.dataset.idx)); },
    'abrir-combinacao': () => menuCombinacao(el.dataset.id),
    'nova-refeicao': () => { const n = prompt('Nome da nova refeição:', 'Ceia'); if (n && n.trim()) { obterDia(UI.data).refeicoes.push({ id: uid(), nome: n.trim(), itens: [] }); salvar(); render(); } },
    'filtro-alimentos': () => { UI.filtroAlimentos = el.dataset.f; render(); },
    'novo-alimento': () => folhaAlimento(null),
    'ler-codigo': () => folhaCodigo((a) => menuAlimento(a.id)),
    'nova-receita': () => folhaReceita(null),
    'abrir-alimento': () => menuAlimento(el.dataset.id),
    'abrir-receita': () => menuReceita(el.dataset.id),
    'hist-dias': () => { UI.histDias = Number(el.dataset.n); render(); },
    'abrir-dia': () => { UI.data = el.dataset.data; UI.aba = 'hoje'; render(); },
    'exportar-json': exportarJSON,
    'baixar-corrompido': () => { const b = brutoCorrompido(); if (b) baixar(`meu-prato-dados-brutos-${hojeISO()}.txt`, b, 'text/plain;charset=utf-8'); },
    'descartar-corrompido': () => { if (!confirmar('Descartar os dados brutos preservados? Baixe antes se ainda não baixou.')) return; try { localStorage.removeItem(chaveAtual() + '.corrompido'); } catch { /* ignore */ } UI.dadosCorrompidos = null; mostrarBannerErro(); render(); },
    'exportar-csv': exportarCSV,
    'importar-json': () => $('[data-act="arquivo-json"]').click(),
    'alternar-demo': alternarDemo,
    'importar-base': () => folhaImportarBase(),
    'modelo': () => novoDeModelo(Number(el.dataset.i)),
    'apagar-tudo': () => { if (!confirmar('Apagar TODOS os alimentos, receitas e registros deste modo? Não dá para desfazer. Exporte um backup antes, se quiser.')) return; if (!confirmar('Confirma mesmo? Última chance.')) return; D = dadosVazios(); salvar(); render(); toast('Dados apagados.'); },
  };
  if (acoes[act]) acoes[act]();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || el.closest('#sheet-root')) return;
  if (el.dataset.act === 'data' && el.value) { UI.data = el.value; render(); }
  if (el.dataset.act === 'toggle-off') { D.config.consultarOFF = el.checked; salvar(); toast(el.checked ? 'Consulta ligada.' : 'Consulta desligada.'); }
  if (el.dataset.act === 'concluir') { const dia = obterDia(UI.data); dia.concluido = el.checked; salvar(); toast(el.checked ? 'Dia marcado como concluído.' : 'Dia reaberto.'); }
  if (el.dataset.act === 'arquivo-json' && el.files[0]) { importarJSON(el.files[0]); el.value = ''; }
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-act="busca-alimentos"]'); if (!el) return;
  UI.buscaAlimentos = el.value; const pos = el.selectionStart; render(); const novo = $('[data-act="busca-alimentos"]'); novo.focus(); novo.setSelectionRange(pos, pos);
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]'); if (!f || f.closest('#sheet-root')) return;
  e.preventDefault();
  if (f.dataset.form === 'metas') {
    const novas = METAS_VAZIAS();
    for (const n of NUTR) { const v = f[n.k].value.trim(); if (v === '') continue; const x = num(v); if (!(x > 0)) { toast(`${n.nome}: use um número maior que zero ou deixe em branco.`); return; } novas[n.k] = x; }
    const hoje = hojeISO(); D.config.metas = novas;
    D.config.historicoMetas = (D.config.historicoMetas || []).filter((h) => h.desde !== hoje);
    D.config.historicoMetas.push({ desde: hoje, metas: { ...novas } }); D.config.historicoMetas.sort((a, b) => a.desde.localeCompare(b.desde));
    if (salvar()) { toast(temAlgumaMeta(novas) ? 'Metas salvas, valendo a partir de hoje.' : 'Metas removidas a partir de hoje.'); render(); }
  }
  if (f.dataset.form === 'agua') {
    const meta = num(f.meta.value), copo = num(f.copo.value);
    if (!(meta > 0) || !(copo > 0)) { toast('Meta e copo devem ser números maiores que zero.'); return; }
    D.config.metaAgua = Math.round(meta); D.config.copoAgua = Math.round(copo); if (salvar()) toast('Água salva.');
  }
  if (f.dataset.form === 'refeicoes') {
    const lista = f.lista.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!lista.length) { toast('Informe ao menos uma refeição.'); return; }
    D.config.refeicoesPadrao = lista; salvar(); toast('Refeições padrão salvas.');
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharFolha(); });
// Se o app ficou aberto de um dia para o outro, volta para a data atual ao retomar.
document.addEventListener('visibilitychange', () => { if (!document.hidden && UI.aba === 'hoje' && UI.data === UI._ultimoHoje) { UI.data = hojeISO(); UI._ultimoHoje = UI.data; render(); } });
UI._ultimoHoje = hojeISO();

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

// Exposto para testes automatizados (não usado pela interface).
window.MeuPrato = { calc: { nutrientesAlimento, nutrientesReceita, totaisReceita }, dados: () => D, validar: validarDados, busca: { normTexto, pontuarBusca }, ui: UI };
render();
})();
