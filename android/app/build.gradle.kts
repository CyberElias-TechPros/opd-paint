import org.gradle.api.tasks.testing.Test
import org.gradle.api.tasks.testing.logging.TestExceptionFormat
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

/*
 * The app module.
 *
 * Three things about this build are decisions rather than defaults, and each is
 * commented where it is made: the assets are copied in from the website's
 * `app/public` at build time instead of being committed twice; the debug build
 * carries an applicationId suffix so it can sit beside a release build on one
 * phone; and the release build is minified but unsigned, because signing
 * material does not belong in a repository.
 */
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.opudas.paint"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.opudas.paint"
        /*
         * 24 (Android 7.0) rather than something newer: this is a market where
         * a five-year-old mid-range phone is a normal phone, and nothing in the
         * app needs an API above it. The visualiser is Bitmap and Canvas, the
         * networking is OkHttp, the storage is Room — all of it works on 24.
         */
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    buildTypes {
        debug {
            /*
             * A separate applicationId means the debug build installs beside a
             * release build instead of replacing it, which is the difference
             * between testing a build and uninstalling somebody's saved projects.
             */
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            /*
             * Unsigned on purpose. A keystore committed to Git is a keystore
             * leaked, and a CI job that signs with a checked-in key produces a
             * "release" anybody with read access can forge. Release signing comes
             * from repository secrets when there is a store to publish to; until
             * then `assembleRelease` produces an APK that must be signed before
             * it installs (docs/android.md).
             */
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        /*
         * The app reasons about deadlines — a data-subject request is due 30 days
         * after it arrives, an SLA is 24 or 48 hours — and doing that arithmetic
         * in milliseconds by hand is how a deadline ends up a day out. java.time
         * on API 24-25 needs desugaring, so it is on.
         */
        isCoreLibraryDesugaringEnabled = true
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "/META-INF/DEPENDENCIES")
        }
    }

    lint {
        abortOnError = true
        // Warnings stay warnings. Several are worth reading and none is worth
        // blocking a build over; errors are, and the difference is the point of
        // having the setting at all.
        warningsAsErrors = false
        checkDependencies = true

        /*
         * Findings go to the console as well as the reports directory, with the
         * explanation text included. Lint writes its detail to HTML and XML under
         * build/reports, and a build failure that can only be read in a browser is
         * a failure nobody fixes: this repository's Android build runs in CI
         * because no development machine here can reach Google's Maven repository,
         * so the console is the one place the findings are guaranteed to be seen.
         */
        textReport = true
        // `file("stdout")`, not the string "stdout": the property is a File, and
        // Lint treats one named `stdout` as "write to the console".
        textOutput = file("stdout")
        explainIssues = true
    }

    testOptions {
        /*
         * Unit tests run on the JVM against an `android.jar` whose methods throw
         * by default. Returning default values instead means a test can touch
         * `TextUtils` or `Log` without becoming an instrumented test, which is
         * the difference between a suite that runs in twenty seconds in CI and
         * one that needs an emulator.
         */
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

ksp {
    /*
     * Room schemas are exported to app/schemas. A migration without the schema it
     * migrates *from* cannot be tested, and an untested migration against a
     * database holding somebody's queued enquiries is a way to lose them.
     *
     * The generated JSON is not in the repository yet, and cannot be produced
     * anywhere except a machine with the Android toolchain: the build writes it
     * during KSP. The Android workflow therefore uploads app/schemas as an
     * artifact, and the first build on a machine that has one should have its
     * output committed. Until then the export is on and the directory is empty —
     * which is a gap to close, not a reason to turn the export off.
     */
    arg("room.schemaLocation", "$projectDir/schemas")
    arg("room.incremental", "true")
}

/* ------------------------------------------------------------------ assets */

/*
 * The APK ships the website's own media, brand marks and customer documents.
 *
 * They are copied at build time from `../../app/public` rather than committed
 * under `android/`, because a second copy of a 7 MB photography set is a second
 * copy to forget: the app would keep serving last year's project photographs
 * after the media pipeline regenerated them, and nothing would fail. Copying
 * means the app and the site cannot disagree.
 *
 * The generated JSON content bundle under `src/main/assets/data/` *is* committed
 * — it is small, it is a build artefact in the same sense as
 * `server/colour-index.json`, and committing it means the APK can be built
 * without a Node toolchain. `tools/check-assets.py` fails CI if it drifts.
 */
val webPublicDir: java.io.File = rootProject.projectDir.parentFile.resolve("app/public")
val bundledAssetsDir = layout.buildDirectory.dir("generated/bundledAssets")

val syncBundledAssets = tasks.register<Copy>("syncBundledAssets") {
    group = "opudas"
    description = "Copies the site's media, brand marks and customer documents into the APK assets."

    from(webPublicDir.resolve("media")) { into("media") }
    from(webPublicDir.resolve("brand")) { into("brand") }
    from(webPublicDir.resolve("documents")) {
        into("documents")
        /*
         * The master catalogue is 6.2 MB of the 7.3 MB in that directory — a
         * 126-page print artefact nobody reads on a phone, and bundling it would
         * nearly double the download on a metered connection. The colour book,
         * room book, fan deck, colour wheel, spec sheet and every TDS and SDS
         * still ship, because those are the ones a customer or a dealer actually
         * opens. The catalogue is a download-on-demand decision, not a deletion.
         */
        exclude("opudas-catalogue.pdf")
    }
    into(bundledAssetsDir)
}

android.sourceSets["main"].assets.srcDir(bundledAssetsDir)
tasks.named("preBuild") { dependsOn(syncBundledAssets) }

/* ------------------------------------------------------------- dependencies */

dependencies {
    coreLibraryDesugaring(libs.desugar.jdk.libs)

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)

    /*
     * The BOM decides every Compose artefact's version, so the modules below
     * carry none. That is what keeps ui, foundation and material3 from drifting
     * apart, which they do silently and fail at runtime rather than at compile
     * time.
     */
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.text)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material3.window)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.androidx.datastore.preferences)

    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.coil.compose)

    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.androidx.arch.core.testing)

    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)

    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
}

/*
 * A failing test names itself, with its full exception, in the console.
 *
 * Configured here rather than through `android.testOptions.unitTests.all`, which
 * AGP declares with both a Groovy `Closure` and a Gradle `Action` overload: a
 * lambda with a named parameter does not resolve between the two, and the
 * resulting error points at the lambda instead of at the ambiguity.
 * `tasks.withType` has one overload, and the task is the lambda's receiver, so
 * `testLogging` and its own settings are both in scope.
 *
 * The reason to do this at all is that Gradle's default is to report a failing
 * test as a path to an HTML report under build/reports. This repository's Android
 * build runs in CI because no development machine here can reach Google's Maven
 * repository, and the Actions log host is not reachable from here either — so a
 * failure that is only in a report is a failure that cannot be read, and cannot
 * be fixed.
 */
tasks.withType<Test>().configureEach {
    testLogging {
        events("failed", "skipped")
        exceptionFormat = TestExceptionFormat.FULL
        showStackTraces = true
        showCauses = true
    }
}
