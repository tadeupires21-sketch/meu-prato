// Definição central dos nutrientes. Os quatro primeiros são obrigatórios no cadastro; os opcionais podem ser
// null = "não informado" (diferente de 0). Somas só consideram valores conhecidos e informam a cobertura.
export const NUTR = [
  { k: 'kcal', nome: 'Calorias', un: 'kcal', dec: 0, obrigatorio: true, meta: 'meta' },
  { k: 'prot', nome: 'Proteínas', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'carb', nome: 'Carboidratos', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'gord', nome: 'Gorduras', un: 'g', dec: 1, obrigatorio: true, meta: 'meta' },
  { k: 'fibra', nome: 'Fibras', un: 'g', dec: 1, obrigatorio: false, meta: 'meta' },
  { k: 'sodio', nome: 'Sódio', un: 'mg', dec: 0, obrigatorio: false, meta: 'limite' },
];
export const NUTR_OBRIG = NUTR.filter((n) => n.obrigatorio).map((n) => n.k);
export const NUTR_OPC = NUTR.filter((n) => !n.obrigatorio).map((n) => n.k);
export const METAS_VAZIAS = () => Object.fromEntries(NUTR.map((n) => [n.k, null]));
// ----- Detalhe do dia: de onde vem cada nutriente -----
export const NUTRIENTES = Object.fromEntries(NUTR.map((n) => [n.k, n]));
