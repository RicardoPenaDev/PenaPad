# Ditado em PT-BR e inglês

Recurso da versão 1.3.0, de 24/11/2026, disponível no macOS.

## Uso

Início → Ditado (ou paleta de comandos → Ditado). Selecione Português (Brasil) ou English (US),
inicie, fale, pare e revise. Inserir texto substitui a seleção capturada ao abrir a janela, ou insere no cursor,
como uma ação de desfazer. Se o documento tiver mudado, a inserção é recusada e a prévia é preservada para copiar.
Cancelar/Esc interrompe sem inserir. O idioma escolhido é lembrado separadamente do idioma da interface.

## Integração

- `src-tauri/native/dictation.m`: AVAudioEngine + Speech framework, compilado no macOS com o SDK do Xcode.
- `src-tauri/src/dictation.rs`: comandos Tauri e eventos identificados por sessão; os outros sistemas retornam sem suporte.
- `src/components/DictationDialog.tsx`: assinatura dos eventos antes de iniciar, prévia, edição e cancelamento.
- `Info.plist` e `Entitlements.plist`: descrições de uso de microfone/reconhecimento e permissão de entrada de áudio.
- Não grava áudio nem registra transcrições em logs. O texto inserido participa do salvamento e histórico normais.
- Solicita processamento local quando suportado; caso contrário, o macOS pode enviar áudio à Apple, conforme aviso na janela.
- Para em 55 segundos e aguarda até 5 segundos pelo resultado final; Cancelar libera a captura imediatamente.

## Validação e limites

- 48 testes Vitest, 24 testes Playwright e 18 testes Rust passaram no Mac.
- O Playwright simula a parte nativa: confirma seleção do idioma, prévias sem duplicação, inserção/desfazer/refazer,
  cancelamento, permissões negadas, rejeição de eventos antigos e proteção de documento alterado.
- Build nativo arm64 concluído; descrições de privacidade conferidas no pacote.
- Fala real em PT-BR confirmada no microfone deste Mac após a ativação do Ditado e autorização do usuário.
  O texto apareceu na prévia, a captura foi parada e Inserir texto ficou habilitado. A prévia foi preservada para revisão.
  A transcrição real em inglês ainda não foi testada.
- Diagnóstico real: o serviço local retornou `kLSRErrorDomain`, código 201, "Siri and Dictation are disabled".
  O Ditado foi ativado com autorização do usuário em Ajustes → Teclado, com PT-BR e English (US).
  A atualização da assinatura ad hoc do Developer provocou um novo pedido de permissão de fala;
  o usuário autorizou e a transcrição em PT-BR funcionou.
- A interface agora orienta a ativar o Ditado quando recebe esse erro e oferece detalhes de outras falhas,
  sem incluir áudio nem transcrições. Os 6 testes específicos de ditado passaram após essa correção.
- Windows/Linux não têm mecanismo de ditado integrado nesta implementação.

## Versão separada para experimentar

`npm run build:developer` gera `src-tauri/target/debug/bundle/macos/PenaPad Developer.app`.
O identificador `com.ricardopena.penapad.developer` separa dados e preferências do aplicativo oficial.
A configuração Developer não consulta endpoints de atualização. O pacote de desenvolvimento não é uma versão publicada.
