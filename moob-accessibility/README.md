# Moob Acessibilidade — APK companion do MoobFinance

Aplicativo Android pequeno que usa o **AccessibilityService** do Android para ler a tela do **Uber Driver** e **99 Motoristas** quando um chamado de corrida chega, extrai os dados e os envia automaticamente para o MoobFinance preencher o formulário de registro.

---

## Como funciona

```
Uber/99 (tela de chamado)
        ↓  AccessibilityService lê os nós de UI
MoobAccessibilityService.kt extrai endereços, km, tempo, valor
        ↓  POST http://localhost:5000/moob-api/ride-prefill
MoobFinance (backend) armazena em memória
        ↓  frontend faz polling a cada 3 s
QuickRegister mostra banner → motorista toca "Preencher" → formulário preenchido
```

---

## Dados capturados

| Campo | Descrição |
|-------|-----------|
| Plataforma | Uber ou 99 |
| Tipo de corrida | UberX, Comfort, 99Pop, etc. |
| Endereço de embarque | Rua/nome do local de retirada |
| km até o embarque | Distância do carro até o passageiro |
| Tempo até o embarque | Minutos estimados |
| Endereço de destino | Rua/nome do destino final |
| km da corrida | Distância total da corrida |
| Tempo da corrida | Duração estimada |
| Valor estimado | R$ exibido no app |

---

## Como compilar o APK

### Opção A — Android Studio (recomendado)

1. Instale o [Android Studio](https://developer.android.com/studio).
2. Abra a pasta `moob-accessibility/` como projeto.
3. Aguarde o Gradle sincronizar.
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. O APK fica em `app/build/outputs/apk/debug/app-debug.apk`.

### Opção B — Linha de comando (PC com JDK 17+)

```bash
cd moob-accessibility
./gradlew assembleDebug
# APK gerado em app/build/outputs/apk/debug/app-debug.apk
```

### Opção C — GitHub Actions (build automático)

O repositório pode ser configurado para compilar o APK automaticamente.
Crie `.github/workflows/build-apk.yml` com:

```yaml
name: Build APK
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
      - name: Build APK
        working-directory: moob-accessibility
        run: ./gradlew assembleDebug
      - uses: actions/upload-artifact@v4
        with:
          name: MoobAccessibility-debug
          path: moob-accessibility/app/build/outputs/apk/debug/app-debug.apk
```

---

## Instalação no celular

1. No celular, vá em **Configurações → Segurança → Fontes desconhecidas** e habilite.
2. Transfira o APK para o celular (cabo USB, Google Drive, WhatsApp, etc.).
3. Toque no arquivo APK para instalar.

---

## Configuração após instalar

1. Abra o app **Moob Acessibilidade**.
2. Toque em **Abrir configurações de acessibilidade**.
3. Encontre **Moob Acessibilidade** na lista e ative.
4. Confirme a permissão de acessibilidade.
5. Volte ao app. A URL padrão é `http://localhost:5000` — só mude se o MoobFinance estiver em outro endereço.
6. Toque em **Salvar**.

---

## Ajuste de padrões (após atualização do Uber/99)

Se o Uber ou 99 atualizarem o layout da tela de chamado e o serviço parar de capturar dados, habilite logs no Android Studio (Logcat, tag `MoobAccessibility`) para ver todos os textos coletados da tela e ajuste as constantes na classe `MoobAccessibilityService.kt`:

- `PICKUP_INDICATORS` — palavras que precedem o endereço de embarque
- `DESTINATION_INDICATORS` — palavras que precedem o endereço de destino
- `UBER_ACCEPT_KEYWORDS` / `TAXI99_ACCEPT_KEYWORDS` — texto do botão de aceitar corrida

---

## Pacotes monitorados

| App | Pacote |
|-----|--------|
| Uber Driver | `com.ubercab.driver` |
| 99 Motoristas | `com.taxis99` |
| 99 Motoristas (variante) | `br.com.taxis99.motorista` |
| 99 Driver (variante) | `com.taxis99.driver` |

Para confirmar o pacote instalado no seu celular:
```bash
# No Termux
pm list packages | grep -i uber
pm list packages | grep -i taxis99
```
