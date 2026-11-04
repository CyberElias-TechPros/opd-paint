/*
 * Root build file.
 *
 * Every plugin is declared here with `apply false` and versioned once in
 * `gradle/libs.versions.toml`, so there is a single place where "which Kotlin"
 * or "which AGP" is answered. The versions in that file are a matched set —
 * AGP, Gradle, Kotlin, KSP and the Compose BOM all constrain each other — so
 * bump one and read the compatibility notes for all of them.
 */
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.ksp) apply false
}
