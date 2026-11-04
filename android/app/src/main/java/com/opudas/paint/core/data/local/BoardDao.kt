package com.opudas.paint.core.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * The board, observed rather than fetched.
 *
 * [observe] is a [Flow] for the reason the outbox's is: saving a quantity from the
 * calculator and watching it appear on the board are two screens, and a board that has
 * to be told to refresh is a board that eventually shows a room the person already
 * re-measured.
 *
 * [current] exists for writes. A mutation has to read the board to change it, and
 * collecting the first value of a Flow to do that would work and would read as though
 * the write were interested in updates.
 */
@Dao
interface BoardDao {

    @Query("SELECT * FROM board WHERE id = 1")
    fun observe(): Flow<BoardEntity?>

    @Query("SELECT * FROM board WHERE id = 1")
    suspend fun current(): BoardEntity?

    /** REPLACE, because there is one row and writing the board means writing all of it. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun save(board: BoardEntity)

    @Query("DELETE FROM board WHERE id = 1")
    suspend fun delete()
}
