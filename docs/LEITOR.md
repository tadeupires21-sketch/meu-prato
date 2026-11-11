# Leitor: referências e validação

Referências públicas consultadas:
- https://github.com/ericblade/quagga2 — documentação de locator, halfSample e patchSize: preservar resolução para códigos pequenos, equilibrando custo de processamento.
- https://github.com/zxing-js/browser — integração de decodificação de vídeo/câmera no navegador.

Implementação própria, sem copiar código nem adicionar dependência: alterna vídeo original, recorte central de 70% ampliado até 1920 pixels e o mesmo recorte com contraste por percentis. O original continua sendo tentado para códigos fora do centro e situações em que o processamento prejudica a imagem. Mantém foco, zoom e lanterna disponíveis no aparelho. Corrige encerramento durante a abertura assíncrona da câmera e mostra todo o quadro na prévia.

Limites: continua dependendo de BarcodeDetector. Ampliação não recupera detalhes perdidos por desfoque. Não foi medida melhoria de taxa de leitura em câmera real. Testes sintéticos verificam transformação, não a capacidade do decodificador nativo.

Validação manual necessária no Android: comparar embalagem com código pequeno e de baixo contraste, centralizado com margens; testar reflexos, zoom e lanterna; medir tempo e sucesso com a versão anterior; fechar o leitor enquanto a permissão está aberta e verificar que a câmera desliga. Testar também códigos grandes e fora do centro para regressões.
