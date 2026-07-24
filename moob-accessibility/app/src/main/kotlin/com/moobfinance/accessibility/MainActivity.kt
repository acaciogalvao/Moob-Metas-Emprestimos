package com.moobfinance.accessibility

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var tvLastRide: TextView
    private lateinit var etMoobUrl: EditText

    companion object {
        const val PREFS = "moob_prefs"
        const val PREF_URL = "moob_url"
        const val DEFAULT_URL = "http://localhost:5000"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        tvLastRide = findViewById(R.id.tvLastRide)
        etMoobUrl = findViewById(R.id.etMoobUrl)

        // Carrega URL salva
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        etMoobUrl.setText(prefs.getString(PREF_URL, DEFAULT_URL))

        // Botão: abre configurações de acessibilidade do Android
        findViewById<Button>(R.id.btnOpenSettings).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        // Botão: salva URL do MoobFinance
        findViewById<Button>(R.id.btnSave).setOnClickListener {
            val url = etMoobUrl.text.toString().trim().trimEnd('/')
            prefs.edit().putString(PREF_URL, url.ifEmpty { DEFAULT_URL }).apply()
            tvStatus.text = "URL salva: ${url.ifEmpty { DEFAULT_URL }}"
        }
    }

    override fun onResume() {
        super.onResume()
        updateStatus()

        // Mostra último chamado capturado (atualizado pelo serviço via SharedPreferences)
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val lastRide = prefs.getString("last_ride_log", null)
        tvLastRide.text = lastRide ?: "Nenhum chamado capturado ainda."
    }

    private fun updateStatus() {
        val enabled = isAccessibilityServiceEnabled()
        tvStatus.text = if (enabled) {
            tvStatus.setTextColor(0xFF34D399.toInt())
            "✅ Serviço ativo — monitorando Uber e 99"
        } else {
            tvStatus.setTextColor(0xFFF87171.toInt())
            "❌ Serviço desativado — toque em 'Abrir configurações de acessibilidade'"
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val service = "$packageName/${MoobAccessibilityService::class.java.canonicalName}"
        return try {
            val enabled = Settings.Secure.getString(
                contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false
            val colonSplitter = TextUtils.SimpleStringSplitter(':')
            colonSplitter.setString(enabled)
            colonSplitter.any { it.equals(service, ignoreCase = true) }
        } catch (e: Exception) {
            false
        }
    }
}
