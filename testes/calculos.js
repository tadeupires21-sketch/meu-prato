// Testes de unidade dos cálculos, sem navegador: js/calculos.js é puro (só depende de js/nutrientes.js).
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const c = await import(pathToFileURL(path.join(__dirname, '..', 'js', 'calculos.js')).href);
  const arroz = { id: 'a', nome: 'Arroz', marca: '', refQtd: 100, refUnidade: 'g', kcal: 200, prot: 10, carb: 40, gord: 2, fibra: 1.6, sodio: null, medidas: [{ nome: 'colher', equivale: 25 }] };
  const ovo = { id: 'o', nome: 'Ovo', marca: 'Granja', refQtd: 100, refUnidade: 'g', kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5, fibra: null, sodio: 146, medidas: [] };
  let n = 0; const ok = (m) => { n++; console.log('ok', m); };
  const perto = (a, b, m) => assert.ok(a != null && Math.abs(a - b) < 1e-9, `${m}: ${a} ≠ ${b}`);

  // proporcional: 200 kcal / 10 g prot por 100 g → 150 g = 300 kcal e 15 g
  const r150 = c.nutrientesAlimento(arroz, 150, 'g');
  assert.deepStrictEqual([r150.kcal, r150.prot], [300, 15]); ok('150 g de um alimento de 200 kcal/100 g dá 300 kcal e 15 g de proteína');
  assert.strictEqual(c.nutrientesAlimento(arroz, 37.5, 'g').kcal, 75); ok('quantidade decimal');
  assert.strictEqual(c.nutrientesAlimento(arroz, 2, 'colher').kcal, 100); ok('medida caseira usa a equivalência cadastrada');
  assert.throws(() => c.nutrientesAlimento(arroz, 1, 'xícara'), /sem equivalência/); ok('medida sem equivalência é recusada, sem conversão presumida');

  // desconhecido ≠ zero
  assert.strictEqual(r150.sodio, null); perto(r150.fibra, 2.4, 'fibra'); ok('opcional desconhecido continua null; conhecido escala');
  const s = c.somar([r150, c.nutrientesAlimento(ovo, 50, 'g')]);
  assert.strictEqual(s.kcal, 373); assert.deepStrictEqual(s.cob.fibra, { conhecidos: 1, total: 2 }); assert.deepStrictEqual(s.cob.sodio, { conhecidos: 1, total: 2 });
  ok('soma informa cobertura dos opcionais');
  const f = c.fecharSoma(s); assert.strictEqual(f.fibra, null); assert.strictEqual(f.kcal, 373); ok('soma incompleta não vira total conhecido');
  perto(c.fecharSoma(c.somar([r150])).fibra, 2.4, 'fibra fechada'); ok('soma completa vira total conhecido');

  // receitas
  const receita = { id: 'r', nome: 'Arroz com ovo', porcoes: 2, pesoFinal: 300, ingredientes: [
    { alimentoId: 'a', rotulo: 'Arroz', qtd: 200, unidade: 'g', kcal: 400, prot: 20, carb: 80, gord: 4, fibra: 3.2, sodio: null },
    { alimentoId: 'o', rotulo: 'Ovo', qtd: 100, unidade: 'g', kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5, fibra: null, sodio: 146 }] };
  const p1 = c.nutrientesReceita(receita, 1, 'porção', [arroz, ovo]);
  assert.strictEqual(p1.kcal, 273); assert.strictEqual(p1.fibra, null); ok('receita por porção; fibra desconhecida num ingrediente propaga');
  assert.strictEqual(c.nutrientesReceita(receita, 150, 'g', [arroz, ovo]).kcal, 273); ok('receita por grama usa o peso final');
  assert.throws(() => c.nutrientesReceita({ ...receita, pesoFinal: null }, 100, 'g', [arroz, ovo])); ok('sem peso final, receita não aceita gramas');
  const editado = { ...arroz, kcal: 1000 };
  assert.strictEqual(c.totaisReceita(receita, [editado, ovo]).kcal, 2146); ok('receita usa o cadastro atual dos ingredientes');
  assert.strictEqual(c.totaisReceita(receita, [ovo]).kcal, 546); ok('ingrediente excluído usa o valor guardado na receita');
  assert.strictEqual(c.rotuloAlimento(ovo), 'Ovo (Granja)'); ok('rótulo com marca');
  console.log(`OK (${n} verificações)`);
})().catch((e) => { console.error('FALHA', e); process.exit(1); });
