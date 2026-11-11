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
