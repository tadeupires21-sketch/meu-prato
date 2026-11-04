# Meu Prato — acompanhamento alimentar pessoal (PWA)

Publicado em https://tadeupires21-sketch.github.io/meu-prato/ (GitHub Pages, workflow em `.github/workflows/pages.yml`).

App estático: `index.html` + `styles.css` + módulos ES em `js/` + `sw.js` + `manifest.webmanifest`. Sem build, sem
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
- Única lista embutida: 107 alimentos comuns, com energia, macros, **fibras e sódio lidos direto do PDF oficial da
  TACO 4ª ed.** (NEPA/Unicamp), conferidos item a item; tilápia (crua e grelhada) purê de batata, ovo mexido, clara crua, bolos caseiros e pizza vêm das fichas da TBCA/USP e
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

## Estrutura do código

Módulos ES nativos em `js/`, carregados por `index.html` sem etapa de build. Por isso o app precisa ser
servido por HTTP(S); abrir o `index.html` direto do disco (`file://`) não funciona.

| Módulo | Responsabilidade |
|---|---|
| `main.js` | Ponto de entrada: eventos globais, inicialização, service worker |
| `nutrientes.js` | Definição central dos nutrientes (unidade, casas decimais, obrigatório ou opcional) |
| `alimentos-base.js` | Lista embutida da TACO/TBCA e modelos (dados, sem lógica) |
| `calculos.js` | Cálculos proporcionais, somas com cobertura e receitas. Puro: não lê estado nem tela |
| `estado.js` | Persistência no `localStorage`, validação de dados e backup, documento atual `D` |
| `dominio.js` | Dias, metas com vigência, histórico, porções lembradas, combinações e lista embutida |
| `off.js` | Consulta ao Open Food Facts e conversão para o formato do app |
| `backup.js`, `demo.js` | Exportação/importação e modo demonstração |
| `util.js`, `dom.js` | Datas, números, busca; seletores, avisos e confirmações |
| `ui.js` | Telas e folhas da interface |

O documento de dados `D` é lido por todos e só é trocado inteiro por `definirD()`. `js/package.json`
marca a pasta como módulos ES para o Node, o que permite testar `calculos.js` sem navegador.

## Testes

Todos os roteiros (oito no navegador e um de cálculos sem navegador) rodam com um único comando e são obrigatórios antes de publicar.

Requisitos: Node 20 ou mais novo.

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

Para rodar só alguns roteiros, passe os nomes depois de `--`:

```bash
npm run test:e2e -- agua recorte1
```

O comando sobe um servidor local só com Node, espera ele responder e roda os roteiros de `testes/` um a um,
começando pelo principal (`e2e`). Cada roteiro abre um navegador Chromium próprio, sem interface e com
armazenamento vazio: nenhum lê ou altera registros reais. No fim, mostra um resumo com o resultado e o tempo
de cada um. Termina com código 0 só se todos passarem; qualquer falha devolve código diferente de zero.
Capturas de tela ficam em `test-results/<roteiro>/`; quando um roteiro falha, ele salva `falha.png` ali e
fecha o navegador.

| Roteiro | O que verifica |
|---|---|
| `calculos` | Sem navegador: proporcionalidade, decimal, medida caseira e medida recusada, “não informado” × zero, cobertura das somas, receitas por porção e por grama, ingrediente editado e excluído |
| `e2e` | Cadastro e cálculo proporcional (200 kcal e 10 g de proteína por 100 g; 150 g dão 300 kcal e 15 g), medida sem equivalência recusada, editar/duplicar/excluir, cadastro alterado sem mudar consumos anteriores, receita por porção e por grama, cópia de refeição e troca de dia, persistência, histórico, JSON/CSV, importação inválida e válida, modo demonstração isolado, metas, manifest e service worker |
| `agua` | Contador de água: copo, 500 ml, quantidade livre, desfazer, isolamento entre dias, meta e copo, histórico |
| `alimentos-base` | Lista embutida: importação, medidas sugeridas, itens já cadastrados completados sem sobrescrever, modelo de whey |
| `codigo-barras` | Leitura por código com Open Food Facts simulado: produto encontrado, reconhecido sem rede, não encontrado, servidor fora do ar, consulta desligada |
| `recorte1` | Cache offline, busca sem acento, adicionar e continuar, desfazer, última porção, detalhe de macros, escape de HTML, validação de backup, dados corrompidos preservados, falha de gravação |
| `entrega2` | Seleção em lote, combinações, repetir e copiar com prévia editável, desfazer o lote |
| `entrega3` | Metas opcionais com vigência, fibras e sódio com “não informado”, receita com dado incompleto, CSV, histórico com denominadores |
| `recorte3` | Importação seletiva, cadastro por porção do rótulo, sugestões por refeição |

`testes/_comum.js` reúne o endereço do servidor, a pasta de resultados e o encerramento dos navegadores.
Arquivos que começam com `_` não são roteiros.

No GitHub Actions (`.github/workflows/pages.yml`) todos os roteiros rodam em todo pull request e em todo
push na `main`. A publicação no Pages depende deles: se algum falhar, o site continua na última versão boa e
o log e as capturas ficam no artefato `resultados-e2e` da execução. Só os arquivos do app vão para o site.
O roteiro de código de barras simula o Open Food Facts; ele não testa a câmera nem a API real.
