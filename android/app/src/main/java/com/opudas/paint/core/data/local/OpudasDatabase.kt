package com.opudas.paint.core.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * The app's one database: the outbox and the project board.
 *
 * Room is used for two tables, which invites the question of why not
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
 *  - No `fallbackToDestructiveMigration` shortcut for the board either. The board is
 *    somebody's measured quantities for a job they are about to buy paint for; losing
 *    it on upgrade is losing the numbers they walked a room with.
 *  - No content cache. Colours, products, dealers and guides ship inside the APK
 *    as generated JSON and are parsed once per process; copying them into SQLite
 *    would duplicate the bundle, add a migration surface for content that is not
 *    the app's to migrate, and buy nothing — see ADR 0002.
 */
@Database(entities = [OutboxEntity::class, BoardEntity::class], version = 2, exportSchema = true)
abstract class OpudasDatabase : RoomDatabase() {

    abstract fun outboxDao(): OutboxDao

    abstract fun boardDao(): BoardDao

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
                .addMigrations(MIGRATION_1_2)
                .build()
                .also { instance = it }
        }

        /**
         * Version 1 to 2: the project board.
         *
         * Written out rather than left to `fallbackToDestructiveMigration`, per the rule
         * above. The SQL has to match the schema Room derives from [BoardEntity] —
         * column names, types and nullability — because Room validates a migrated table
         * against its own expectation when it opens, and a mismatch is an exception at
         * startup on every phone that upgrades. `INTEGER NOT NULL` for the Kotlin `Int`
         * and `Long`, `TEXT NOT NULL` for the non-nullable `String`s, and the primary key
         * on `id`.
         */
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "CREATE TABLE IF NOT EXISTS `board` (" +
                        "`id` INTEGER NOT NULL, " +
                        "`boardName` TEXT NOT NULL, " +
                        "`savedColors` TEXT NOT NULL, " +
                        "`savedProducts` TEXT NOT NULL, " +
                        "`recentColors` TEXT NOT NULL, " +
                        "`prep` TEXT NOT NULL, " +
                        "`estimates` TEXT NOT NULL, " +
                        "`updatedAt` INTEGER NOT NULL, " +
                        "PRIMARY KEY(`id`))",
                )
            }
        }

        /** Only for a test that needs to start from nothing. */
        fun forget() {
            instance = null
        }
    }
}
