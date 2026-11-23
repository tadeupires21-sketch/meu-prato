# Fontes da lista embutida

- **TACO 4ª edição ampliada e revisada** (NEPA/Unicamp, 2011), PDF oficial hospedado pelo CFN:
  https://cfn.org.br/wp-content/uploads/2017/03/taco_4_edicao_ampliada_e_revisada.pdf
  Extraído com `pdftotext -layout` e `docs/taco_parse.py` (Tabela 1: energia, proteína, lipídeos, carboidrato,
  fibra; Tabela 2: sódio). a maior parte dos itens vem daí, com nome TACO mapeado no gerador.
- **TBCA** (USP/FoRC), fichas BRC0031E (tilápia filé cru), BRC0486E (grelhado sem óleo e sem sal) e BRC0488E
  (grelhado com óleo de soja, sem sal). Energia informada em kJ; kcal = kJ ÷ 4,184.
- **TBCA**, pizza: BRC0225A (muçarela, artesanal, assada) e BRC0685A (marguerita), com a fatia média de 90 g
  das medidas caseiras da própria ficha. A TACO não tem pizza.
- **TBCA**, bolo de chocolate caseiro: BRC0460A (sem recheio), BRC1000A (com cobertura), BRC1008A (recheio de brigadeiro e cobertura). O industrializado vem da TACO, linha 16.
- **TBCA**, clara de ovo crua: BRC0005J (a cozida vem da TACO, linha 486).
- **TBCA**, ovo mexido: BRC0065J (sem óleo e sem sal), BRC0027J (com margarina e sal), BRC0062J (com óleo de soja e sal).
- **TBCA**, purê de batata: BRC1195B (com manteiga e sal) e BRC0323B (com margarina e sal), receitas-padrão.
- **Hambúrguer de alcatra**: TACO não tem; usa o miolo de alcatra sem gordura (linhas 369 e 370). O industrializado
  é a linha 417 (fibra “*” na TACO, sódio 1090 mg).
- **Açaí**: TACO linhas 167 (com xarope de guaraná e glucose) e 168 (polpa congelada); medidas de pote pela
  equivalência da TBCA BRC0095C (copo de 240 ml = 240 g); com granola e mel da TBCA BRC0177C (unidade de 200 g).
- **Coxa de frango**: TACO linhas 396 a 399; unidade das versões prontas pelas medidas caseiras da TBCA
  (BRC0108F assada com pele, 75 g; BRC0109F cozida sem pele, 60 g).
- **Peito de frango desfiado**: TACO linha 408 (peito sem pele cozido).
- **Queijo coalho**: TBCA BRC0048G (pedaço de 50 g) e BRC0139G (espeto grelhado, 80 g). A TACO não tem.
- **Champignon**: fresco cru da TBCA BRC0698B. Em conserva não existe em nenhuma das tabelas: usa o cozido sem sal
  da TBCA BRC0701B como aproximação, com sódio não informado (a salmoura varia por marca).
- **Twix**: tabela do rótulo do Twix Caramelo 40 g (Mars), publicada pelo varejista; conferida com outra base (40 g ≈ 196 kcal).
- **Kebab de carne**: aproximação pela TBCA BRC0844A (pão sírio com carne grelhada e molho de iogurte), unidade de 170 g.
- **Fettuccine pomodoro com calabresa (Spoleto)**: o Spoleto não publica tabela; aproximação pela TBCA BRC0853A (macarrão com linguiça calabresa e molho de tomate). Prato de 365 g estimado pelas porções de bases de terceiros (FatSecret: massa 200 g, molho 2 conchas 150 g, calabresa 15 g).
- **Bacon (toucinho defumado), frito**: TBCA BRC0941F, pedaço médio de 15 g.
- **Leite de vaca integral**: a TACO não traz leite líquido (linhas com asterisco). Valores médios de outras
  tabelas, por 100 ml, marcados como tal. Prefira o rótulo.
- **Azeite de oliva extra virgem**: TACO linha 260 (884 kcal, 100 g lipídeos; fibra e sódio “NA”).

Convenções: `null` = não informado; `Tr` (traço) na TACO vira 0; `NA` vira null. Medidas por unidade são
aproximações de tabelas de medidas caseiras e vêm com aviso no cadastro.

## TACO completa (23/11/2026)

`js/taco-completa.js` traz os 496 alimentos da TACO que não estão na lista conferida à mão. É gerado por
`node docs/taco_completa.mjs` a partir de `docs/dados/taco_*.csv`, a planilha da TACO 4ª ed. em CSV publicada no
repositório público `raulfdm/taco-api` (pasta `references/csv`). O site do CFN, de onde veio o PDF, não estava
acessível no ambiente em que a lista foi gerada.

- **Conferência**: os 99 itens da lista conferida que vêm da TACO têm, todos, uma linha na planilha com energia,
  proteína, carboidrato e gordura idênticos. Os 496 restantes não foram conferidos item a item com o PDF, e
  cada um leva essa observação e o número da linha na TACO.
- **Por que não o `taco_parse.py`**: no PDF, linhas com coluna vazia deslocam os valores (em croquete, quibe e
  estrogonofe a cinza era lida como fibra; em tremoço e açúcar, o sódio saía de outra coluna) e os óleos caíam
  na tabela de ácidos graxos. A planilha não tem esse problema.
- **Fora da lista**: iogurte sabor abacaxi, leite de vaca desnatado UHT, leite de vaca integral e coco verde
  cru, que a TACO traz com "*" no lugar dos valores.
- **Convenções**: fibra e sódio vazios viram `null`; "Tr" é 0. Óleos e aguardente têm proteína e carboidrato
  "NA" (não se aplica) e entram como 0; sais têm energia "NA" e entram como 0 kcal. Bebidas ficam por 100 ml,
  como já era na lista conferida, embora a TACO informe por 100 g.
- **Uso no app**: esses itens não entram em "Adicionar alimentos comuns"; aparecem só como sugestão na busca do
  registro e entram no cadastro ao toque. Em empate, a lista conferida vem antes.

## Busca de produtos por nome (23/11/2026)

Com três letras ou mais, a busca do registro oferece "Buscar … em produtos de marca". Só ao toque o app envia o
texto digitado ao Open Food Facts (`cgi/search.pl`, filtrado por produtos vendidos no Brasil) e lista os que têm
nome e energia. Tocar abre o cadastro preenchido para conferência com o rótulo, como no código de barras.
Desligar a consulta em Ajustes remove a opção. A chamada real ao Open Food Facts não pôde ser exercitada no
ambiente de desenvolvimento (rede bloqueada): o roteiro `base-completa` usa respostas simuladas.
