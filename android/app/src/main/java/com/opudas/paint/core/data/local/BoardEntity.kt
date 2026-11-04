package com.opudas.paint.core.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * The project board: one row, because a phone has one board.
 *
 * The website keeps this in local storage as a single JSON object, and the app keeps it
 * as a single row for the same reason — it is read whole and written whole, always by
 * the person holding the phone, and there is no query that wants one estimate out of it
 * without the rest. A row per estimate would be a more normal shape and would buy
 * nothing here except a join and a second migration surface.
 *
 * The lists are JSON text rather than Room type converters. That is not laziness about
 * schema: it means the columns hold exactly the bytes [com.opudas.paint.core.data.BoardRepository]
 * writes and reads, the migration below is one `CREATE TABLE`, and a field added to the
 * board later does not need another one. The cost is that SQLite cannot filter by
 * colour id, and nothing in this app ever wants to.
 */
@Entity(tableName = "board")
data class BoardEntity(
    /** Always 1. The primary key exists because Room requires one, not because there are many. */
    @PrimaryKey val id: Int = 1,
    val boardName: String,
    /** Colour ids, as a JSON array. */
    val savedColors: String,
    /** Product ids, as a JSON array. */
    val savedProducts: String,
    /** Colours looked at recently, as a JSON array. Survives clearing the board. */
    val recentColors: String,
    /** Preparation situation ids, as a JSON array. */
    val prep: String,
    /** Saved quantities, as a JSON array of `SavedEstimate`. */
    val estimates: String,
    val updatedAt: Long,
)
