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
- **Leite de vaca integral**: a TACO não traz leite líquido (linhas com asterisco). Valores médios de outras
  tabelas, por 100 ml, marcados como tal. Prefira o rótulo.
- **Azeite de oliva extra virgem**: TACO linha 260 (884 kcal, 100 g lipídeos; fibra e sódio “NA”).

Convenções: `null` = não informado; `Tr` (traço) na TACO vira 0; `NA` vira null. Medidas por unidade são
aproximações de tabelas de medidas caseiras e vêm com aviso no cadastro.
