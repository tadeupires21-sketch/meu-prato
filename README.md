# Meu Prato — acompanhamento alimentar pessoal (PWA)

Publicado em https://tadeupires21-sketch.github.io/meu-prato/ (GitHub Pages, workflow em `.github/workflows/pages.yml`).

App estático: `index.html` + `styles.css` + `app.js` + `sw.js` + `manifest.webmanifest`. Sem build, sem
dependência, sem servidor de dados. Interface em pt-BR, feita para celular (Android primeiro).

## Como usar

1. Sirva a pasta por HTTPS (ou `localhost`) — PWA exige isso. Exemplo local:
   `python -m http.server 8765` dentro de `app-alimentar/` e abra `http://localhost:8765/`.
   Para o celular, publique a pasta em qualquer hospedagem estática (GitHub Pages, Netlify, etc.).
2. No Chrome do Android: menu ⋮ → **Instalar aplicativo** (ou "Adicionar à tela inicial").
3. **Ajustes** → metas diárias, todas opcionais (calorias, proteínas, carboidratos, gorduras, fibras e sódio como
   limite). São referências suas; o app não calcula dieta. Sem meta, a tela mostra só o consumo. Cada salvamento
   vale a partir do dia; dias anteriores continuam comparados com a meta que valia neles (vigência).
4. **Alimentos** → `+ Alimento`: nome, marca, estado (cru/cozido), quantidade de referência (100 g, 100 ml
   ou 1 porção) e os valores do rótulo. Cadastre medidas caseiras (unidade = 50 g, scoop = 30 g…) se
   quiser registrar por elas — sem equivalência cadastrada o app não converte.
5. **Hoje** → `+ Adicionar alimento` na refeição: busca em recentes/favoritos/todos/receitas (sem acento, palavras
   em qualquer ordem), informa a quantidade (aceita vírgula decimal) e vê a prévia antes de confirmar. O app
   sugere a última porção usada daquele alimento e oferece atalhos (50/100/150 g ou ½/1/2 medidas).
   “Adicionar e continuar” mantém o seletor aberto, com o parcial da refeição no topo; cada inclusão tem
   “Desfazer” no aviso.
   Toque em calorias, proteínas, carboidratos ou gorduras no resumo para ver **de onde veio** cada nutriente:
   total por refeição com participação e os alimentos que mais contribuíram, com acesso ao registro.
6. Toque num item registrado para alterar quantidade, duplicar, mover, favoritar ou excluir.
   O `⋯` da refeição oferece **Repetir** a última ocorrência daquela refeição, **Copiar** de outro dia (ambas com
   prévia editável e valores históricos preservados), **Salvar como combinação**, renomear ou remover.
   Refeição vazia mostra o atalho “↻ Repetir última”.
   **Combinações** (ex.: “Meu café”) reúnem consumos independentes e aparecem no seletor, no filtro
   Combinações; ao usar, a prévia recalcula com os cadastros atuais e deixa desmarcar e ajustar. Não são
   receitas: receita tem ingredientes e rendimento.
   No seletor, **☑ Vários** marca vários alimentos de uma vez; “Revisar” abre a prévia com quantidades
   sugeridas pela última porção. Toda inclusão em lote tem um único “Desfazer”.
7. **Receitas**: ingredientes + rendimento em porções (+ peso final opcional). Registra-se por porção ou,
   com peso final, por grama.
8. **Código de barras**: botão ▥ na busca de alimentos ou na aba Alimentos. Lê com a câmera ou aceita o código
   digitado; produto já cadastrado é reconhecido na hora, produto novo é consultado no Open Food Facts e
   aberto para conferência.
9. **Histórico**: médias de calorias, macros, fibras, sódio e água só de dias concluídos, cada uma com o próprio
   número de dias, comparadas com o período anterior; dias sem registro não entram como zero; dias só com água
   aparecem como tal. A barra de cada dia marca a meta vigente naquele dia.
10. **Água**: cartão na tela Hoje com copo que enche até a meta. Botões de copo, 500 ml, quantidade livre e
   desfazer; meta e tamanho do copo em Ajustes. Entra no backup, no histórico e no CSV.
11. Marque **Dia concluído** para o dia entrar nas médias do Histórico (7 ou 30 dias).

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
- Única lista embutida: 98 alimentos comuns, com energia, macros, **fibras e sódio lidos direto do PDF oficial da
  TACO 4ª ed.** (NEPA/Unicamp), conferidos item a item; tilápia (crua e grelhada) purê de batata, ovo mexido e clara crua vêm das fichas da TBCA/USP e
  está marcada com o código; leite líquido não existe na TACO e está marcado como média de tabelas com valores por 100 g copiados da TACO 4ª ed. (NEPA/Unicamp),
  opcionais, marcados com a fonte e editáveis. Medidas por unidade (ovo 50 g, banana 65 g, fatia de pão
  25 g, colher de aveia 15 g) são médias aproximadas de tabelas de medidas caseiras e vêm com aviso para
  pesar e ajustar; maçã e batata-doce não têm unidade sugerida. Whey é só um modelo: valores vêm do rótulo.
- Código de barras: leitor pela câmera só no Chrome Android (`BarcodeDetector` nativo); em outros navegadores,
  digitação do código. A consulta vai ao Open Food Facts (base colaborativa, cobertura parcial no Brasil) e
  envia apenas o código; o resultado abre no formulário para conferência e pode ser desligada em Ajustes.
- Sem conta, sincronização, exercícios ou foto.
- O cache offline (`sw.js`) guarda a versão instalada; ao mudar arquivos, suba `VERSAO` em `sw.js`. Entre as
  versões 2 e 8 o arquivo estava vazio por um erro de edição e o app não abria offline; corrigido na 9.
- Se os dados salvos estiverem ilegíveis ao abrir, o app preserva o conteúdo original à parte e avisa em
  Ajustes, com botão para baixá-lo; nada é sobrescrito. Falha ao gravar mostra um banner persistente.

## Testes

### Teste principal (obrigatório antes de publicar)

Requisitos: Node 20 ou mais novo.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

O comando sobe um servidor local só com Node, espera ele responder, roda `testes/e2e.js` num navegador
Chromium sem interface e encerra o servidor. Termina com código 0 só se todas as verificações passarem;
qualquer falha devolve código diferente de zero. Cada execução usa um contexto de navegador novo, com
armazenamento vazio: não lê nem altera registros reais.

Capturas de tela, o backup exportado e, em caso de falha, `falha.png` ficam em `test-results/e2e/`.

O que ele verifica: cadastro de alimento e cálculo proporcional (200 kcal e 10 g de proteína por 100 g,
150 g registram 300 kcal e 15 g), medida sem equivalência recusada, editar/duplicar/excluir consumo,
alteração do cadastro sem mudar consumos anteriores, receita por porção e por grama, cópia de refeição e
troca de dia sem mistura, persistência após recarregar, histórico, exportação JSON/CSV, importação inválida
recusada e válida restaurada, isolamento do modo demonstração, metas, manifest e service worker.

No GitHub Actions (`.github/workflows/pages.yml`) o teste roda em todo pull request e em todo push na
`main`. A publicação no Pages depende dele: se o teste falhar, o site continua na última versão boa e o
log e as capturas ficam no artefato `resultados-e2e` da execução. Só os arquivos do app vão para o site.

### Outros roteiros

Os demais scripts em `testes/` (recortes e entregas, água, código de barras, alimentos-base) ainda
esperam um servidor já rodando em `127.0.0.1:8765` e não fazem parte da verificação obrigatória.
