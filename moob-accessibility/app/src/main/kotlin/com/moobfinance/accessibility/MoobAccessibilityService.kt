package com.moobfinance.accessibility

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.google.gson.Gson
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

/**
 * MoobAccessibilityService
 *
 * Monitora as telas do Uber Driver (com.ubercab.driver) e 99 Driver
 * (com.taxis99 / br.com.taxis99.motorista) quando um chamado de corrida chega.
 *
 * Fluxo:
 *  1. Recebe evento de mudança de janela ou conteúdo dos pacotes monitorados.
 *  2. Coleta todos os textos visíveis na tela.
 *  3. Aplica extratores específicos por plataforma.
 *  4. Se encontrou dados suficientes (embarque + destino), envia ao MoobFinance.
 *  5. Guarda o ID do último chamado enviado para não repetir o envio.
 *
 * NOTA SOBRE PADRÕES DE TEXTO:
 *  Os apps Uber e 99 mudam periodicamente. Se os padrões deixarem de funcionar
 *  após uma atualização, habilite o log DEBUG (BuildConfig.DEBUG) para ver
 *  todos os textos coletados da tela e ajuste as constantes de regex abaixo.
 */
class MoobAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "MoobAccessibility"

        // Pacotes que o serviço vai monitorar (declarados também no XML de config)
        private val MONITORED_PACKAGES = setOf(
            "com.ubercab.driver",
            "com.taxis99",
            "br.com.taxis99.motorista",
            "com.taxis99.driver"
        )

        private val UBER_PACKAGES = setOf("com.ubercab.driver")
        private val TAXI99_PACKAGES = setOf("com.taxis99", "br.com.taxis99.motorista", "com.taxis99.driver")

        // ── Padrões de detecção de chamado ───────────────────────────────────
        // Uber: a tela de chamado contém "ACEITAR" ou "RECUSAR"
        private val UBER_ACCEPT_KEYWORDS = listOf("ACEITAR", "ACCEPT", "Aceitar")
        // 99: botão de aceite costuma ter "ACEITAR CORRIDA" ou "ACCEPT"
        private val TAXI99_ACCEPT_KEYWORDS = listOf("ACEITAR CORRIDA", "ACEITAR", "Aceitar corrida")

        // ── Padrões de extração de distância e tempo ─────────────────────────
        // Formato: "2,3 km" ou "2.3 km" ou "2 km"
        private val KM_PATTERN = Regex("""(\d+[,.]?\d*)\s*km""", RegexOption.IGNORE_CASE)
        // Formato: "8 min" ou "~8 min"
        private val MIN_PATTERN = Regex("""~?(\d+)\s*min""", RegexOption.IGNORE_CASE)
        // Valor monetário: "R$ 22,50" ou "R$22.50"
        private val FARE_PATTERN = Regex("""R\$\s*(\d+[.,]\d{2})""")

        // ── Palavras-chave que identificam TIPO de corrida ───────────────────
        private val RIDE_TYPES = listOf(
            "UberX", "Uber Black", "Comfort", "UberXL", "Flash",
            "Motos 99", "99Pop", "99Comfort", "Pop", "Confort"
        )

        // ── Indicadores de seção de embarque ────────────────────────────────
        private val PICKUP_INDICATORS = listOf(
            "Embarque", "Origem", "De:", "Ponto de partida",
            "Pickup", "Pick up", "Pegar em", "Retirada"
        )
        // ── Indicadores de seção de destino ─────────────────────────────────
        private val DESTINATION_INDICATORS = listOf(
            "Destino", "Para:", "Chegada", "Deixar em",
            "Destination", "Drop off", "Entregar em", "Destino final"
        )

        // Distância mínima de km esperada para um endereço real (evita capturar "0 km")
        private const val MIN_KM_THRESHOLD = 0.1
    }

    private val http = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .readTimeout(5, TimeUnit.SECONDS)
        .build()
    private val gson = Gson()
    private val handler = Handler(Looper.getMainLooper())
    private var lastSentId: String? = null
    private var debounceRunnable: Runnable? = null

    // ── Ponto de entrada do AccessibilityService ──────────────────────────────
    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in MONITORED_PACKAGES) return

        // Debounce: agrupa eventos rápidos em um único processamento (300 ms)
        debounceRunnable?.let { handler.removeCallbacks(it) }
        debounceRunnable = Runnable { processScreen(pkg) }
        handler.postDelayed(debounceRunnable!!, 300)
    }

    override fun onInterrupt() {
        Log.w(TAG, "Serviço interrompido pelo sistema.")
    }

    // ── Leitura e extração da tela ────────────────────────────────────────────
    private fun processScreen(pkg: String) {
        val root = rootInActiveWindow ?: return
        val texts = mutableListOf<String>()
        collectTexts(root, texts)
        root.recycle()

        if (texts.isEmpty()) return

        Log.d(TAG, "[$pkg] Textos coletados (${texts.size}): ${texts.take(20)}")

        val platform = when {
            pkg in UBER_PACKAGES -> "UBER"
            pkg in TAXI99_PACKAGES -> "99"
            else -> return
        }

        // Verifica se a tela atual é realmente um chamado de corrida
        val acceptKeywords = if (platform == "UBER") UBER_ACCEPT_KEYWORDS else TAXI99_ACCEPT_KEYWORDS
        val isRideRequest = texts.any { text -> acceptKeywords.any { text.contains(it, ignoreCase = true) } }
        if (!isRideRequest) return

        // Tenta extrair os dados do chamado
        val rideData = extractRideData(texts, platform) ?: return

        // Evita reenviar o mesmo chamado (mesmo endereço de embarque = mesmo chamado)
        val rideSignature = "${rideData.pickup.address}|${rideData.destination.address}"
        if (rideSignature == lastSentId) return
        lastSentId = rideSignature

        // Vibra 3 pulsos para alertar que capturou um chamado
        try {
            val vibrator = getSystemService(VIBRATOR_SERVICE) as? android.os.Vibrator
            vibrator?.vibrate(longArrayOf(0, 200, 100, 200, 100, 400), -1)
        } catch (_: Exception) {}

        Log.i(TAG, "[$platform] Chamado detectado: ${rideData.pickup.address} → ${rideData.destination.address}")
        sendToMoobFinance(rideData)
    }

    // ── Coleta recursiva de textos visíveis na tela ───────────────────────────
    private fun collectTexts(node: AccessibilityNodeInfo, out: MutableList<String>) {
        val text = node.text?.toString()?.trim()
        if (!text.isNullOrBlank() && text.length > 1) {
            out.add(text)
        }
        val desc = node.contentDescription?.toString()?.trim()
        if (!desc.isNullOrBlank() && desc.length > 1 && desc != text) {
            out.add(desc)
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectTexts(child, out)
            child.recycle()
        }
    }

    // ── Extração de dados do chamado a partir dos textos da tela ─────────────
    private fun extractRideData(texts: List<String>, platform: String): RidePayload? {
        // Tipo de corrida (UberX, 99Pop, etc.)
        val rideType = texts.firstOrNull { text ->
            RIDE_TYPES.any { text.contains(it, ignoreCase = true) }
        }

        // Valor da corrida
        val fareText = texts.firstOrNull { FARE_PATTERN.containsMatchIn(it) }
        val fareEstimate = fareText?.let { FARE_PATTERN.find(it)?.value }

        // Endereços + distâncias: a estratégia é buscar o indicador de embarque/destino
        // e pegar o texto seguinte como endereço.
        val pickup = extractLocation(texts, PICKUP_INDICATORS)
        val destination = extractLocation(texts, DESTINATION_INDICATORS)

        if (pickup == null || destination == null) {
            // Fallback: se não encontrou pelos indicadores, tenta heurística posicional.
            // Uber em geral mostra: km embarque → min embarque → endereço embarque →
            // km corrida → min corrida → endereço destino
            return extractFallback(texts, platform, rideType, fareEstimate)
        }

        // Extrai km e tempo de textos próximos ao indicador
        val allKms = texts.mapNotNull { t ->
            KM_PATTERN.find(t)?.groupValues?.get(1)?.replace(',', '.')?.toDoubleOrNull()
        }.filter { it > MIN_KM_THRESHOLD }

        val allMins = texts.mapNotNull { t ->
            MIN_PATTERN.find(t)?.groupValues?.get(1)?.toIntOrNull()
        }

        return RidePayload(
            id = UUID.randomUUID().toString(),
            timestamp = System.currentTimeMillis(),
            platform = platform,
            rideType = rideType?.let { rt -> RIDE_TYPES.firstOrNull { rt.contains(it, ignoreCase = true) } },
            pickup = LocationInfo(
                address = pickup,
                distanceKm = allKms.getOrNull(0),
                etaMinutes = allMins.getOrNull(0)
            ),
            destination = LocationInfo(
                address = destination,
                distanceKm = allKms.getOrNull(1),
                etaMinutes = allMins.getOrNull(1)
            ),
            fareEstimate = fareEstimate
        )
    }

    /** Busca um indicador na lista e retorna o texto da linha seguinte como endereço */
    private fun extractLocation(texts: List<String>, indicators: List<String>): String? {
        for (i in texts.indices) {
            val isIndicator = indicators.any { texts[i].contains(it, ignoreCase = true) }
            if (isIndicator && i + 1 < texts.size) {
                val candidate = texts[i + 1].trim()
                // Ignora candidatos que sejam distâncias ou tempos (muito curtos)
                if (candidate.length > 5 && !KM_PATTERN.containsMatchIn(candidate) &&
                    !MIN_PATTERN.containsMatchIn(candidate)) {
                    return candidate
                }
                // Tenta o próximo se o imediato for inválido
                if (i + 2 < texts.size) {
                    val next = texts[i + 2].trim()
                    if (next.length > 5) return next
                }
            }
        }
        return null
    }

    /**
     * Fallback heurístico para quando os indicadores de seção não foram encontrados.
     * Assume que endereços são textos longos (>15 chars) que não são distância/tempo/valor,
     * e seleciona o primeiro como embarque e o segundo como destino.
     */
    private fun extractFallback(
        texts: List<String>,
        platform: String,
        rideType: String?,
        fareEstimate: String?
    ): RidePayload? {
        val addressCandidates = texts.filter { t ->
            t.length > 15 &&
            !KM_PATTERN.containsMatchIn(t) &&
            !MIN_PATTERN.containsMatchIn(t) &&
            !FARE_PATTERN.containsMatchIn(t) &&
            !RIDE_TYPES.any { t.equals(it, ignoreCase = true) } &&
            !UBER_ACCEPT_KEYWORDS.any { t.equals(it, ignoreCase = true) } &&
            !TAXI99_ACCEPT_KEYWORDS.any { t.equals(it, ignoreCase = true) }
        }

        if (addressCandidates.size < 2) return null

        val allKms = texts.mapNotNull { t ->
            KM_PATTERN.find(t)?.groupValues?.get(1)?.replace(',', '.')?.toDoubleOrNull()
        }.filter { it > MIN_KM_THRESHOLD }

        val allMins = texts.mapNotNull { t ->
            MIN_PATTERN.find(t)?.groupValues?.get(1)?.toIntOrNull()
        }

        return RidePayload(
            id = UUID.randomUUID().toString(),
            timestamp = System.currentTimeMillis(),
            platform = platform,
            rideType = rideType?.let { rt -> RIDE_TYPES.firstOrNull { rt.contains(it, ignoreCase = true) } },
            pickup = LocationInfo(
                address = addressCandidates[0],
                distanceKm = allKms.getOrNull(0),
                etaMinutes = allMins.getOrNull(0)
            ),
            destination = LocationInfo(
                address = addressCandidates[1],
                distanceKm = allKms.getOrNull(1),
                etaMinutes = allMins.getOrNull(1)
            ),
            fareEstimate = fareEstimate
        )
    }

    // ── Envio ao MoobFinance ──────────────────────────────────────────────────
    private fun sendToMoobFinance(payload: RidePayload) {
        val prefs = getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE)
        val baseUrl = prefs.getString(MainActivity.PREF_URL, MainActivity.DEFAULT_URL) ?: MainActivity.DEFAULT_URL
        val url = "$baseUrl/moob-api/ride-prefill"

        val json = gson.toJson(payload)
        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url(url).post(body).build()

        http.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Falha ao enviar para MoobFinance: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (response.isSuccessful) {
                        Log.i(TAG, "Chamado enviado ao MoobFinance com sucesso.")
                        // Salva log do último chamado para exibir na MainActivity
                        val log = "Último: ${payload.platform} | " +
                            "${payload.pickup.address} → ${payload.destination.address} | " +
                            "${payload.destination.distanceKm ?: "?"}km | " +
                            "${payload.fareEstimate ?: "sem valor"}"
                        getSharedPreferences(MainActivity.PREFS, MODE_PRIVATE)
                            .edit().putString("last_ride_log", log).apply()
                    } else {
                        Log.w(TAG, "MoobFinance retornou ${response.code}: ${response.body?.string()}")
                    }
                }
            }
        })
    }

    // ── Data classes para serialização JSON ───────────────────────────────────
    data class LocationInfo(
        val address: String,
        val distanceKm: Double?,
        val etaMinutes: Int?
    )

    data class RidePayload(
        val id: String,
        val timestamp: Long,
        val platform: String,
        val rideType: String?,
        val pickup: LocationInfo,
        val destination: LocationInfo,
        val fareEstimate: String?
    )
}
