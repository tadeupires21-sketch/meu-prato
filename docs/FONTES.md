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
- **Leite de vaca integral**: a TACO não traz leite líquido (linhas com asterisco). Valores médios de outras
  tabelas, por 100 ml, marcados como tal. Prefira o rótulo.
- **Azeite de oliva extra virgem**: TACO linha 260 (884 kcal, 100 g lipídeos; fibra e sódio “NA”).

Convenções: `null` = não informado; `Tr` (traço) na TACO vira 0; `NA` vira null. Medidas por unidade são
aproximações de tabelas de medidas caseiras e vêm com aviso no cadastro.
