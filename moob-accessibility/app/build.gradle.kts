plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.moobfinance.accessibility"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.moobfinance.accessibility"
        minSdk = 26          // Android 8.0+ — suporte seguro a AccessibilityService moderno
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    // OkHttp para enviar os dados ao MoobFinance local
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    // Gson para serializar o JSON
    implementation("com.google.code.gson:gson:2.10.1")
}
