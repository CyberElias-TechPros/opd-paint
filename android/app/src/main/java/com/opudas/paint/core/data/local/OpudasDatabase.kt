package com.opudas.paint.core.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * The app's one database: the outbox.
 *
 * Room is used for a single table, which invites the question of why not
 * SharedPreferences or a JSON file. Because the thing being stored is a queue
 * that a background worker drains while a screen observes it, and those three
 * parties need one atomic write, one consistent read and no hand-rolled locking.
 * A JSON file gives you a corrupt file the first time the process is killed
 * mid-write — and the file in question is somebody's enquiry.
 *
 * Two deliberate omissions:
 *
 *  - No `fallbackToDestructiveMigration`. The table holds submissions that have
 *    not been accepted yet. Wiping it on upgrade to avoid writing a migration
 *    would lose a customer's quote request, quietly, at exactly the moment they
 *    believe it has been sent. Migrations get written instead.
 *  - No content cache. Colours, products, dealers and guides ship inside the APK
 *    as generated JSON and are parsed once per process; copying them into SQLite
 *    would duplicate the bundle, add a migration surface for content that is not
 *    the app's to migrate, and buy nothing — see ADR 0002.
 */
@Database(entities = [OutboxEntity::class], version = 1, exportSchema = true)
abstract class OpudasDatabase : RoomDatabase() {

    abstract fun outboxDao(): OutboxDao

    companion object {
        private const val NAME = "opudas.db"

        @Volatile
        private var instance: OpudasDatabase? = null

        /**
         * The single instance for the process.
         *
         * Held here rather than in a DI graph because there is no graph: the app
         * has one process, one activity and a handful of singletons, all
         * constructed in [com.opudas.paint.di.AppContainer].
         */
        fun build(context: Context): OpudasDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(
                context.applicationContext,
                OpudasDatabase::class.java,
                NAME,
            )
                .build()
                .also { instance = it }
        }

        /** Only for a test that needs to start from nothing. */
        fun forget() {
            instance = null
        }
    }
}
