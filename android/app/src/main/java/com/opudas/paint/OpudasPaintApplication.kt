package com.opudas.paint

import android.app.Application
import android.content.Context
import com.opudas.paint.di.AppContainer

/**
 * The [Application], and the one place the dependency graph is created.
 *
 * Kept deliberately thin. Process start on a low-end Android device is already
 * the slowest part of opening the app, so nothing here touches the network,
 * opens the database or starts a worker: those happen when a screen asks for
 * them.
 */
class OpudasPaintApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}

/** The graph, from any [Context] — the idiomatic replacement for a static holder. */
val Context.container: AppContainer
    get() = (applicationContext as OpudasPaintApplication).container
