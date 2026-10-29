# Meu Prato — acompanhamento alimentar pessoal (PWA)

Publicado em https://tadeupires21-sketch.github.io/meu-prato/ (GitHub Pages, workflow em `.github/workflows/pages.yml`).

App estático: `index.html` + `styles.css` + `app.js` + `sw.js` + `manifest.webmanifest`. Sem build, sem
dependência, sem servidor de dados. Interface em pt-BR, feita para celular (Android primeiro).

## Como usar

1. Sirva a pasta por HTTPS (ou `localhost`) — PWA exige isso. Exemplo local:
   `python -m http.server 8765` dentro de `app-alimentar/` e abra `http://localhost:8765/`.
   Para o celular, publique a pasta em qualquer hospedagem estática (GitHub Pages, Netlify, etc.).
2. No Chrome do Android: menu ⋮ → **Instalar aplicativo** (ou "Adicionar à tela inicial").
3. **Ajustes** → defina metas de calorias e proteínas (carboidratos e gorduras são opcionais).
4. **Alimentos** → `+ Alimento`: nome, marca, estado (cru/cozido), quantidade de referência (100 g, 100 ml
   ou 1 porção) e os valores do rótulo. Cadastre medidas caseiras (unidade = 50 g, scoop = 30 g…) se
   quiser registrar por elas — sem equivalência cadastrada o app não converte.
5. **Hoje** → `+ Adicionar alimento` na refeição: busca em recentes/favoritos/todos/receitas, informa a
   quantidade (aceita vírgula decimal) e vê a prévia dos nutrientes antes de confirmar.
6. Toque num item registrado para alterar quantidade, duplicar, mover, favoritar ou excluir.
   O `⋯` da refeição copia uma refeição de outro dia, renomeia ou remove.
7. **Receitas**: ingredientes + rendimento em porções (+ peso final opcional). Registra-se por porção ou,
   com peso final, por grama.
8. **Código de barras**: botão ▥ na busca de alimentos ou na aba Alimentos. Lê com a câmera ou aceita o código
   digitado; produto já cadastrado é reconhecido na hora, produto novo é consultado no Open Food Facts e
   aberto para conferência.
9. Marque **Dia concluído** para o dia entrar nas médias do Histórico (7 ou 30 dias).

## Como os dados são guardados

- `localStorage` do navegador, chave `meuprato.v1` (um JSON). Modo demonstração usa `meuprato.demo.v1`,
  totalmente separado.
- Cada registro guarda os nutrientes já calculados: editar ou excluir um alimento/receita depois **não**
  altera dias anteriores.
- Backup: Ajustes → Exportar JSON / Importar JSON (valida e pede confirmação antes de substituir) /
  Exportar CSV (`;` e vírgula decimal, abre direto no Excel pt-BR).

## Limitações desta versão

- Dados ficam só neste aparelho e navegador: limpar dados do site, trocar de celular ou desinstalar apaga
  tudo. Exporte o backup com frequência.
- Única lista embutida: 26 alimentos comuns (ovo, arroz, feijões, frango, patinho, pães, leite, iogurtes,
  queijos, frutas, legumes, aveia, cuscuz, azeite) com valores por 100 g copiados da TACO 4ª ed. (NEPA/Unicamp),
  opcionais, marcados com a fonte e editáveis. Medidas por unidade (ovo 50 g, banana 65 g, fatia de pão
  25 g, colher de aveia 15 g) são médias aproximadas de tabelas de medidas caseiras e vêm com aviso para
  pesar e ajustar; maçã e batata-doce não têm unidade sugerida. Whey é só um modelo: valores vêm do rótulo.
- Código de barras: leitor pela câmera só no Chrome Android (`BarcodeDetector` nativo); em outros navegadores,
  digitação do código. A consulta vai ao Open Food Facts (base colaborativa, cobertura parcial no Brasil) e
  envia apenas o código; o resultado abre no formulário para conferência e pode ser desligada em Ajustes.
- Sem conta, sincronização, exercícios ou foto.
- O cache offline (`sw.js`) guarda a versão instalada; ao mudar arquivos, suba `VERSAO` em `sw.js`.

## Testes

`testes/e2e.js` (Playwright; servidor em `127.0.0.1:8765`, rode `node testes/e2e.js <pasta-capturas>`) cobre: cadastro, cálculo proporcional (200 kcal/10 g por 100 g →
150 g = 300 kcal/15 g), edição/duplicação/exclusão, receita por porção e por grama, cópia de refeição,
troca de data sem mistura, persistência após recarregar, exportação/importação, modo demo isolado.
