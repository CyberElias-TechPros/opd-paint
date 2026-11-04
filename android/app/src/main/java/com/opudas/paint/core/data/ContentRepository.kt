package com.opudas.paint.core.data

import android.content.res.AssetManager
import android.util.Log
import com.opudas.paint.core.data.model.BrandContact
import com.opudas.paint.core.data.model.BrandDocument
import com.opudas.paint.core.data.model.ColorsBundle
import com.opudas.paint.core.data.model.Dealer
import com.opudas.paint.core.data.model.DealersBundle
import com.opudas.paint.core.data.model.DocumentsBundle
import com.opudas.paint.core.data.model.Guide
import com.opudas.paint.core.data.model.GuidesBundle
import com.opudas.paint.core.data.model.LegalBundle
import com.opudas.paint.core.data.model.LegalDoc
import com.opudas.paint.core.data.model.MediaBundle
import com.opudas.paint.core.data.model.MediaEntry
import com.opudas.paint.core.data.model.Palette
import com.opudas.paint.core.data.model.PalettesBundle
import com.opudas.paint.core.data.model.PaintColor
import com.opudas.paint.core.data.model.Product
import com.opudas.paint.core.data.model.ProductsBundle
import com.opudas.paint.core.data.model.Project
import com.opudas.paint.core.data.model.ProjectsBundle
import com.opudas.paint.core.data.model.PrepSituation
import com.opudas.paint.core.data.model.ThemeBundle
import com.opudas.paint.core.data.model.ToolCard
import com.opudas.paint.core.data.model.ToolOption
import com.opudas.paint.core.data.model.ToolQuestion
import com.opudas.paint.core.data.model.ToolsBundle
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json

/**
 * Everything the app knows about paint, read from the bundle inside the APK.
 *
 * The app is offline-first by decision, not by accident: a customer standing in a
 * hardware store in Port Harcourt on one bar of signal should still be able to
 * look up a colour code, size a job and write an enquiry. So the content ships
 * in the APK rather than being fetched, and the network is used for the two
 * things that genuinely need it — delivering a submission and refreshing the
 * dealer list.
 *
 * The bundle is generated, not hand-written: `tools/build-android-data.mjs`
 * serialises the same TypeScript modules under `app/src/data` that the website
 * renders, so the app and the site cannot drift apart without CI failing
 * (see `tools/check-assets.py`).
 *
 * Loading is lazy and parallel. Ten files, ~160 KB, parsed once per process and
 * held: the first screen that asks for colours pays for colours only, and the
 * parse happens on [Dispatchers.IO] so the main thread is never blocked by JSON.
 */
class ContentRepository(private val assets: AssetManager) {

    private val json = Json {
        /*
         * A field the app does not know about is not an error. The bundle is
         * generated from TypeScript that a content editor can extend, and an app
         * already installed on somebody's phone has to keep working when the next
         * release of the *data* adds a field. The reverse — a field the app
         * expects and the data omits — stays an error, because that is a real
         * mismatch and silently defaulting it would show customers a blank.
         */
        ignoreUnknownKeys = true
        // `null` where the type says non-null falls back to the property default.
        coerceInputValues = true
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private inline fun <reified T> deferred(file: String): Deferred<T> = scope.async {
        val text = assets.open("data/$file").use { stream ->
            stream.bufferedReader(Charsets.UTF_8).readText()
        }
        json.decodeFromString<T>(text)
    }

    private val colorsDeferred: Deferred<ColorsBundle> = deferred("colors.json")
    private val productsDeferred: Deferred<ProductsBundle> = deferred("products.json")
    private val palettesDeferred: Deferred<PalettesBundle> = deferred("palettes.json")
    private val projectsDeferred: Deferred<ProjectsBundle> = deferred("projects.json")
    private val guidesDeferred: Deferred<GuidesBundle> = deferred("guides.json")
    private val legalDeferred: Deferred<LegalBundle> = deferred("legal.json")
    private val documentsDeferred: Deferred<DocumentsBundle> = deferred("documents.json")
    private val dealersDeferred: Deferred<DealersBundle> = deferred("dealers.json")
    private val toolsDeferred: Deferred<ToolsBundle> = deferred("tools.json")
    private val mediaDeferred: Deferred<MediaBundle> = deferred("media.json")

    /* ------------------------------------------------------------- colours */

    suspend fun colors(): List<PaintColor> = colorsDeferred.await().colors
    suspend fun families(): List<String> = colorsDeferred.await().families
    suspend fun rooms(): List<String> = colorsDeferred.await().rooms
    suspend fun collections(): List<String> = colorsDeferred.await().collections
    suspend fun familySwatch(family: String): String? = colorsDeferred.await().familySwatch[family]

    suspend fun color(id: String): PaintColor? = colors().firstOrNull { it.id == id }

    suspend fun colorsByIds(ids: List<String>): List<PaintColor> {
        val byId = colors().associateBy { it.id }
        return ids.mapNotNull { byId[it] }
    }

    /* ------------------------------------------------------------ products */

    suspend fun products(): List<Product> = productsDeferred.await().products
    suspend fun product(id: String): Product? = products().firstOrNull { it.id == id }
    suspend fun productsByIds(ids: List<String>): List<Product> {
        val byId = products().associateBy { it.id }
        return ids.mapNotNull { byId[it] }
    }

    suspend fun sheenLabel(finish: String): String? = productsDeferred.await().sheenLabels[finish]

    /* ------------------------------------------------------------ palettes */

    suspend fun palettes(): List<Palette> = palettesDeferred.await().palettes
    suspend fun palette(id: String): Palette? = palettes().firstOrNull { it.id == id }

    /**
     * The palettes a colour belongs to, each with the role it plays.
     *
     * A palette's `colors` and `roles` are parallel lists, so the pairing is by
     * position. Where a palette has more colours than roles — a content mistake
     * the website's own test guards against — the extra colours get no role
     * rather than crashing on an index that does not exist.
     */
    suspend fun palettesFor(colorId: String): List<PaletteRole> =
        palettes().mapNotNull { palette ->
            val index = palette.colors.indexOf(colorId)
            if (index < 0) return@mapNotNull null
            PaletteRole(palette, palette.roles.getOrNull(index) ?: "")
        }

    /* ------------------------------------------------------------ projects */

    suspend fun projects(): List<Project> = projectsDeferred.await().projects
    suspend fun project(id: String): Project? = projects().firstOrNull { it.id == id }
    suspend fun projectsUsing(colorId: String): List<Project> =
        projects().filter { colorId in it.colorIds }

    /* -------------------------------------------------------------- guides */

    suspend fun guides(): List<Guide> = guidesDeferred.await().guides
    suspend fun guideCategories(): List<String> = guidesDeferred.await().categories

    /* -------------------------------------------------------------- legal */

    /**
     * The three notices, in the order they are read: what is collected and why, the
     * terms of use, and whether the site can be used at all.
     *
     * They ship in the APK rather than being fetched. Somebody exercising a data
     * right on a plane, or in a basement on one bar of signal, should be able to read
     * what they are entitled to without a network — and the app has a form that
     * submits a statutory request, so the notice explaining it has to be reachable
     * offline too.
     */
    suspend fun legalDocs(): List<LegalDoc> = legalDeferred.await().docs

    suspend fun legalDoc(slug: String): LegalDoc? = legalDocs().firstOrNull { it.slug == slug }

    /* ---------------------------------------------------------- documents */

    /**
     * The brand books and the specification sheet, in the order the website lists them.
     *
     * These are the documents that belong to nobody in particular. The data sheets are
     * not among them: they hang off their products, which is where somebody looking for
     * one is already standing.
     */
    suspend fun documents(): List<BrandDocument> = documentsDeferred.await().documents

    suspend fun document(file: String): BrandDocument? =
        documents().firstOrNull { it.file == file }
    suspend fun guide(id: String): Guide? = guides().firstOrNull { it.id == id }

    /* ------------------------------------------------------------- dealers */

    suspend fun dealers(): List<Dealer> = dealersDeferred.await().dealers

    /**
     * One counter by id, or null.
     *
     * Every other entity in the bundle has this accessor — colour, product,
     * palette, project, guide, preparation situation — and dealers were the odd
     * one out, which pushed a `firstOrNull` into a screen that then had to know
     * the list was the source. Null is a real answer here: an id from a deep link
     * to a counter that has since been removed should render "not found" rather
     * than an empty card.
     */
    suspend fun dealer(id: String): Dealer? = dealers().firstOrNull { it.id == id }

    suspend fun dealerStates(): List<String> = dealersDeferred.await().states
    suspend fun dealerServices(): List<String> = dealersDeferred.await().services
    suspend fun contact(): BrandContact = dealersDeferred.await().contact

    /** Unverified dealers, surfaced so the settings screen can say how many there are rather than hiding it. */
    suspend fun unverifiedDealerCount(): Int = dealers().count { !it.verified }

    /* --------------------------------------------------------------- tools */

    suspend fun toolCards(): List<ToolCard> = toolsDeferred.await().toolCards
    suspend fun finishQuestions(): List<ToolQuestion> = toolsDeferred.await().finishQuestions
    suspend fun prepSituations(): List<PrepSituation> = toolsDeferred.await().prepSituations
    suspend fun prepSituation(id: String): PrepSituation? = prepSituations().firstOrNull { it.id == id }

    /**
     * The answer options for one finish-finder question, by question id.
     *
     * `optionsFor` is keyed the way the website keys it (`surface`, `condition`,
     * `wear`, `sheen`), and the questions carry those same ids, so a question
     * whose options are missing is a content bug — the empty list it would
     * produce is caught by the app's own content test rather than reaching a
     * visitor as a dead end.
     */
    suspend fun optionsFor(questionId: String): List<ToolOption> =
        toolsDeferred.await().optionsFor[questionId] ?: emptyList()

    /* --------------------------------------------------------------- media */

    suspend fun media(key: String): MediaEntry? = mediaDeferred.await().images[key]
    suspend fun mediaKeys(): Set<String> = mediaDeferred.await().images.keys

    /* ----------------------------------------------------------- documents */

    /**
     * The bundled asset path for a document href from the content data.
     *
     * The data says `/documents/opudas-matt-tds.pdf`, which is a URL on a web
     * server. Inside the APK the same file is at `documents/opudas-matt-tds.pdf`,
     * and the master catalogue is not bundled at all (it is 6.2 MB of the 7.3 MB
     * in that directory and nobody reads 126 pages on a phone), so this returns
     * null for it and the screen offers the website instead.
     */
    fun documentAsset(href: String): String? {
        val path = href.removePrefix("/")
        if (!path.startsWith("documents/")) return null
        if (path == EXCLUDED_DOCUMENT) return null
        return path
    }

    /* --------------------------------------------------------------- theme */

    /**
     * The design tokens, read synchronously.
     *
     * Blocking is the right call here and nowhere else: the theme is needed for
     * the very first frame, it is 771 bytes, and a Compose tree that composes
     * with placeholder colours and then repaints is a visible flash on a slow
     * device. Everything larger is loaded the lazy way above.
     *
     * On failure the brand's own fallback tokens are used and the fault is
     * logged, because an app with no theme at all is an app that renders black on
     * white — usable, and better than a crash on the splash screen.
     */
    fun themeSync(): ThemeBundle = try {
        val text = assets.open("data/theme.json").use { it.bufferedReader(Charsets.UTF_8).readText() }
        json.decodeFromString<ThemeBundle>(text)
    } catch (error: Exception) {
        Log.e(TAG, "theme.json could not be read; falling back to the built-in brand tokens", error)
        FALLBACK_THEME
    }

    private companion object {
        const val TAG = "ContentRepository"
        const val EXCLUDED_DOCUMENT = "documents/opudas-catalogue.pdf"

        /**
         * The tokens the brand cannot do without, in the same shape the generator
         * emits. `ThemeTokensTest` asserts these match `theme.json`, so the
         * fallback cannot quietly become a second, stale copy of the palette.
         */
        val FALLBACK_THEME = ThemeBundle(
            colors = mapOf(
                "paper" to "#f7f2e9",
                "paper-2" to "#fcf9f3",
                "plaster" to "#ece3d5",
                "sand" to "#e2d6c3",
                "ink" to "#0b1a13",
                "ink-soft" to "#26362e",
                "moss" to "#4d6157",
                "green" to "#0c6b45",
                "green-deep" to "#07452d",
                "green-bright" to "#12965f",
                "green-mist" to "#5cc98f",
                "crimson" to "#c1121f",
                "line" to "#d8cdbb",
                "line-strong" to "#8a8478",
            ),
            radii = mapOf("xs" to 3, "sm" to 6, "md" to 12, "lg" to 20, "xl" to 32),
            fonts = emptyMap(),
        )
    }
}

/** A palette, and what one particular colour is doing in it. */
data class PaletteRole(val palette: Palette, val role: String)

/**
 * The `file:///android_asset/` URI Coil loads.
 *
 * Coil understands the asset scheme, so an image never has to be copied to the
 * cache directory to be displayed — which matters when the photography in the
 * bundle is 7 MB and the phone may have less free than that.
 */
val MediaEntry.assetUri: String
    get() = "file:///android_asset/$src"

/** The thumbnail, for grids where decoding a 1024 px frame to draw a 96 dp chip is waste. */
val MediaEntry.thumbUri: String
    get() = "file:///android_asset/$thumb"

/**
 * The bundle parsed on the calling thread.
 *
 * Only for tests and for the one synchronous read in [ContentRepository.themeSync];
 * production code goes through the suspending accessors above.
 */
fun ContentRepository.themeBlocking(): ThemeBundle = runBlocking { themeSync() }
