package com.opudas.paint.di

import android.content.Context
import com.opudas.paint.core.data.ContentRepository
import com.opudas.paint.core.designsystem.BrandTokens

/**
 * Hand-rolled dependency injection.
 *
 * No Hilt, no Dagger, no annotations to process: the app has one process, one
 * activity and a handful of singletons, and a graph library would add a build
 * step, an annotation processor and a failure mode (a missing binding discovered
 * at runtime rather than at compile time) in exchange for nothing this app needs.
 * Everything is constructed here, in dependency order, once.
 *
 * A test can construct the same objects directly — [ContentRepository] takes an
 * [android.content.res.AssetManager], which is the only Android dependency in the
 * data layer, and the engines underneath it take nothing at all.
 */
class AppContainer(context: Context) {

    /** The content bundle: colours, products, palettes, projects, guides, dealers, tools, media. */
    val content: ContentRepository = ContentRepository(context.assets)

    /**
     * The brand tokens, resolved eagerly.
     *
     * This is the one read that happens on the main thread at startup, and it is
     * 771 bytes: the alternative is a first frame drawn with placeholder colours
     * and then repainted, which on a low-end device is a visible flash of the
     * wrong brand.
     */
    val brand: BrandTokens = BrandTokens(content.themeSync())
}
