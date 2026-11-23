// Gera js/taco-completa.js: todos os alimentos da TACO 4ª ed. que ainda não estão na lista conferida à mão
// (js/alimentos-base.js). Uso: node docs/taco_completa.mjs
// Entrada: docs/dados/taco_*.csv (planilha da TACO em CSV, ver docs/FONTES.md).
// Convenções: célula vazia (NA, * ou em branco na TACO) vira null em fibra e sódio; "Tr" já vem como 0.
// Itens sem energia ou sem lipídeos medidos (linhas com "*") ficam de fora, exceto os sais (energia NA = 0).
// Óleos e aguardente trazem proteína/carboidrato "NA" (não se aplica): entram como 0.
import { readFileSync, writeFileSync } from 'node:fs';
import { ALIMENTOS_BASE } from '../js/alimentos-base.js';
const aqui = new URL('.', import.meta.url);
const csv = (nome) => {
  const [cab, ...linhas] = readFileSync(new URL(`dados/${nome}`, aqui), 'utf8').trim().split(/\r?\n/);
  const partir = (l) => { const o = []; let c = '', asp = false; for (const ch of l) { if (ch === '"') asp = !asp; else if (ch === ',' && !asp) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
  const chaves = partir(cab);
  return linhas.map((l) => Object.fromEntries(partir(l).map((v, i) => [chaves[i], v.trim()])));
};
const n = (v) => (v === '' || v == null || !isFinite(Number(v)) ? null : Number(v));
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nutr = new Map(csv('taco_nutrientes.csv').map((r) => [r.foodId, r]));
const BEBIDAS = '8', SAIS = new Set(['516', '517']);
const chaveMacro = (o) => [o.kcal, o.prot, o.carb, o.gord].join('|');
const curados = ALIMENTOS_BASE.filter((b) => !b.fonte);
const todos = [], fora = [];
for (const f of csv('taco_alimentos.csv')) {
  const r = nutr.get(f.id); const nome = f.name.replace(/\s+/g, ' ').replace(/ (\d)$/, '').trim();
  let kcal = n(r.kcal), gord = n(r.lipids), prot = n(r.protein), carb = n(r.carbohydrates);
  if (SAIS.has(f.id)) { kcal = 0; gord = 0; }
  if (f.id === '472') gord = 0; // aguardente: lipídeos em branco na tabela
  if (kcal == null || gord == null) { fora.push(`${f.id} ${nome}`); continue; }
  const nn = norm(nome);
  const estado = /\bcru(a|s|as)?\b/.test(nn) ? 'cru' : /\b(cozid|grelhad|assad|frit|refogad|ensopad|empanad|moqueado|torrad)/.test(nn) ? 'cozido' : 'na';
  todos.push({ num: Number(f.id), nome, estado, kcal: Math.round(kcal), prot: prot ?? 0, carb: carb ?? 0, gord, fibra: n(r.dietaryFiber), sodio: n(r.sodium), ml: f.categoryId === BEBIDAS });
}
// Já está na lista conferida: mesmos macros e mesma primeira palavra do nome (óleos têm macros iguais entre si).
const p1 = (t) => norm(t).split(/[ ,]/)[0];
// Exceções conferidas à mão: nomes que a regra não casa, e um que ela casaria por engano.
const MESMO = new Set(['Batata, doce, cozida', 'Ovo, de galinha, clara, cozida/10minutos', 'Queijo, requeijão, cremoso', 'Laranja, pêra, suco']);
const OUTRO = new Set(['Azeite, de dendê']);
const pares = [];
const repetido = (t) => { if (OUTRO.has(t.nome)) return false; const b = curados.find((c) => chaveMacro(c) === chaveMacro(t) && (MESMO.has(t.nome) || p1(c.nome) === p1(t.nome))); if (b) pares.push(`${b.nome} = ${t.nome}`); return !!b; };
const novos = todos.filter((t) => !repetido(t));
const semPar = curados.filter((b) => !todos.some((t) => chaveMacro(b) === chaveMacro(t)));
const nomesCurados = new Set(ALIMENTOS_BASE.map((b) => norm(b.nome)));
const colisao = novos.filter((t) => nomesCurados.has(norm(t.nome)));
if (colisao.length) throw new Error('nome repetido com a lista conferida: ' + colisao.map((t) => t.nome).join('; '));
const linhas = novos.map((t) => JSON.stringify([t.num, t.nome, t.estado, t.kcal, t.prot, t.carb, t.gord, t.fibra, t.sodio, ...(t.ml ? [1] : [])]));
writeFileSync(new URL('../js/taco-completa.js', aqui), `// GERADO por docs/taco_completa.mjs a partir de docs/dados/taco_*.csv. Não edite à mão.
// Alimentos da TACO 4ª ed. (NEPA/Unicamp) que não estão na lista conferida de alimentos-base.js.
// Colunas: nº na TACO, nome, estado, kcal, proteína, carboidrato, gordura, fibra, sódio (mg), 1 = bebida.
// Por 100 g de parte comestível; null = não informado. Aparecem só na busca e entram no cadastro ao toque.
const LINHAS = [
${linhas.join(',\n')},
];
export const TACO_COMPLETA = LINHAS.map(([num, nome, estado, kcal, prot, carb, gord, fibra, sodio, bebida]) => ({
  nome, estado, kcal, prot, carb, gord, fibra, sodio, ...(bebida ? { refUnidade: 'ml' } : {}),
  obs: \`TACO nº \${num}, valores por 100 g\${bebida ? ' (aqui tratados como 100 ml)' : ''}. Lista completa da tabela, sem conferência item a item: confira se estranhar algum valor.\`,
}));
`);
console.log(`TACO: ${todos.length + fora.length} linhas | fora por falta de dado: ${fora.length} (${fora.join('; ')})`);
console.log(`já na lista conferida: ${todos.length - novos.length} | gerados: ${novos.length}`);
console.log(`itens conferidos sem par exato de macros na planilha (${semPar.length}):`); for (const b of semPar) console.log('  ', b.nome, chaveMacro(b));
if (process.argv.includes('--pares')) console.log(pares.join('\n'));
