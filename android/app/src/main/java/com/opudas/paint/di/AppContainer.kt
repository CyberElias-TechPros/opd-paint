package com.opudas.paint.di

import android.content.Context
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.data.OutboxScheduler
import com.opudas.paint.core.data.SubmissionRepository
import com.opudas.paint.core.data.local.OpudasDatabase
import com.opudas.paint.core.data.remote.ApiClient
import com.opudas.paint.core.designsystem.BrandTokens
import com.opudas.paint.core.sync.WorkManagerOutboxScheduler
import kotlinx.serialization.json.Json

/**
 * Hand-rolled dependency injection.
 *
 * No Hilt, no Dagger, no annotations to process: the app has one process, one
 * activity and a handful of singletons, and a graph library would add a build
 * step, an annotation processor and a failure mode (a missing binding discovered
 * at runtime rather than at compile time) in exchange for nothing this app needs.
 *
 * What is built eagerly and what is built on first use is a decision about
 * startup, not about style. Opening the app to look at colours should not open
 * SQLite, construct an OkHttp connection pool, or touch WorkManager — a person on
 * a low-end device in a shop with no signal should get the palette at the same
 * speed as one on a flagship with full bars. So the two things the first frame
 * needs are built at process start, and everything that serves a submission is
 * `by lazy`.
 *
 * A test can construct the same objects directly: [ContentRepository] takes an
 * [android.content.res.AssetManager], which is the only Android dependency in the
 * read path, and the engines underneath it take nothing at all. The write path
 * takes a DAO and an [OutboxScheduler], both of which are interfaces or plain
 * classes rather than framework singletons, so a JVM test can drive the queue
 * with a fake scheduler and never start WorkManager.
 */
class AppContainer(private val context: Context) {

    /** The content bundle: colours, products, palettes, projects, guides, dealers, tools, media. */
    val content: ContentRepository = ContentRepository(context.assets)

    /**
     * The brand tokens, resolved eagerly.
     *
     * This is one of the two reads that happen on the main thread at startup, and
     * it is 771 bytes: the alternative is a first frame drawn with placeholder
     * colours and then repainted, which on a low-end device is a visible flash of
     * the wrong brand.
     */
    val brand: BrandTokens = BrandTokens(content.themeSync())

    /**
     * JSON, configured once and shared.
     *
     * The configuration is the contract: unknown keys ignored so a service that
     * adds a field does not break installed builds, and defaults and explicit
     * nulls not written so an absent optional field is omitted exactly as the
     * browser omits an `undefined` one.
     */
    val json: Json = ApiClient.defaultJson()

    /** The outbox database. Opens on first submission, not at process start. */
    val database: OpudasDatabase by lazy { OpudasDatabase.build(context) }

    /** The service. Constructed on first use because an OkHttp client owns thread pools. */
    val api: ApiClient by lazy { ApiClient() }

    /** How delivery is requested. WorkManager, behind an interface the data layer does not know about. */
    val scheduler: OutboxScheduler by lazy { WorkManagerOutboxScheduler(context) }

    /** Writing submissions down and reading back what happened to them. */
    val submissions: SubmissionRepository by lazy {
        SubmissionRepository(database.outboxDao(), json, scheduler)
    }
}
