# Leitor: referências e validação

Referências públicas consultadas:
- https://github.com/ericblade/quagga2 — documentação de locator, halfSample e patchSize: preservar resolução para códigos pequenos, equilibrando custo de processamento.
- https://github.com/zxing-js/browser — integração de decodificação de vídeo/câmera no navegador.

Implementação própria, sem copiar código nem adicionar dependência: alterna vídeo original, recorte central de 70% ampliado até 1920 pixels e o mesmo recorte com contraste por percentis. O original continua sendo tentado para códigos fora do centro e situações em que o processamento prejudica a imagem. Mantém foco, zoom e lanterna disponíveis no aparelho. Corrige encerramento durante a abertura assíncrona da câmera e mostra todo o quadro na prévia.

Limites: continua dependendo de BarcodeDetector. Ampliação não recupera detalhes perdidos por desfoque. Não foi medida melhoria de taxa de leitura em câmera real. Testes sintéticos verificam transformação, não a capacidade do decodificador nativo.

Validação manual necessária no Android: comparar embalagem com código pequeno e de baixo contraste, centralizado com margens; testar reflexos, zoom e lanterna; medir tempo e sucesso com a versão anterior; fechar o leitor enquanto a permissão está aberta e verificar que a câmera desliga. Testar também códigos grandes e fora do centro para regressões.

## Foto do código (11/11/2026)

Relato de uso: o leitor ao vivo falhou num código pequeno, vertical e curvo (tubo), e a imagem da câmera
parecia ruim. O vídeo do `getUserMedia` costuma ser bem inferior à foto do app de câmera: menor resolução
efetiva, foco contínuo de vídeo, sem o processamento de foto do aparelho. Recortar e ampliar quadros não
recupera esse detalhe.

- **Tirar foto do código**: `<input type="file" accept="image/*" capture="environment">` abre o app de
  câmera nativo (foco por toque, resolução total). A foto é decodificada pelo mesmo `BarcodeDetector` em
  até 16 tentativas: inteira e em recortes (centro, faixas), em pé e girada 90°, com e sem contraste.
- **Dígito verificador**: leituras ao vivo e na foto só valem se o GTIN tiver dígito verificador correto.
- **Diagnóstico**: a folha mostra a resolução que o Chrome entrega ao vídeo (`getSettings()`).

Validação automatizada (`testes/leitor-foto.js`): detector simulado que só lê a foto girada e devolve
leitura com dígito errado nas demais; câmera falsa do Chromium. Não mede o decodificador real: a primeira
validação de verdade é no celular.

A câmera contínua exige o mesmo código válido em duas detecções consecutivas. Quadros sem código, ambíguos ou com erro reiniciam a sequência. Cada sessão confirma uma única vez; fechar o leitor cancela resultados pendentes. Leitura por foto e entrada manual mantêm seu fluxo. Testes de estado cobrem alternância, repetição, interrupção e cancelamento.

## Câmera certa e foto automática (23/11/2026)

Relato de uso: a câmera ao vivo não lê códigos pequenos porque a imagem não fica nítida. Recorte, contraste,
zoom, lanterna e foco contínuo já existiam; faltava atacar a origem da imagem.

- **Escolha da câmera**: em celular com várias câmeras traseiras, o navegador pode entregar uma de foco fixo
  (grande-angular), que nunca fica nítida de perto. Se a câmera aberta declara modos de foco e nenhum é
  automático, o app testa as outras traseiras e fica na primeira com foco automático; se nenhuma tiver, volta
  à inicial.
- **Trocar câmera**: botão no leitor quando há mais de uma traseira. A escolha (automática ou manual) fica em
  `localStorage`, chave `meuprato.camera`, só neste aparelho e fora do backup.
- **Foto automática**: depois de 4 s sem leitura, e a cada 3 s, o app tira uma foto em resolução total pela
  mesma câmera (`ImageCapture.takePhoto`) e a decodifica com as mesmas tentativas da foto manual, sem sair da
  tela. O vídeo continua sendo lido em paralelo. A folha mostra a resolução da foto.

Limites: nada disso foi medido em câmera real. Não se sabe como cada aparelho declara `focusMode` na câmera de
foco fixo, nem se `takePhoto` congela a prévia ou mexe no zoom em algum modelo. Validação manual no Android:
código pequeno com cada câmera do botão, conferir se "Foto automática: L×A" aparece com resolução maior que a
do vídeo, e se zoom e lanterna continuam valendo depois da primeira foto.

Validação automatizada (`testes/leitor-camera.js`): câmeras, capacidades, foto e detector simulados.

Correção (23/11/2026, relato de uso): depois de "Tirar foto do código", a câmera ao vivo não voltava. O toque
no botão encerrava o leitor de vez. Agora a foto externa só pausa o vídeo: foto sem leitura, foto cancelada
ou volta ao app sem foto reabrem a câmera lembrada, com o aviso na tela.
