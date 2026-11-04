package com.opudas.paint.core.data

import com.opudas.paint.core.data.local.BoardDao
import com.opudas.paint.core.data.local.BoardEntity
import com.opudas.paint.core.data.model.BoardState
import com.opudas.paint.core.data.model.SavedEstimate
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json

/**
 * Reading and changing the project board.
 *
 * The rules here are the website's, from the reducer in `app/src/store/AppStore.tsx`,
 * and they are not arbitrary — each one is an answer to something that actually happens
 * to somebody planning a job:
 *
 *  - **Re-measuring a room replaces the old figure.** Saving a second estimate for the
 *    same product and the same room label drops the first, because a person who walks
 *    the lounge again and retypes it should end up with one number, not two that
 *    disagree on a checklist they hand to a dealer.
 *  - **Saving a quantity also saves the product.** An estimate for the matt emulsion
 *    puts the matt emulsion on the board, so "what to buy" and "how to apply it" are
 *    complete without a second tap.
 *  - **Twelve estimates, eight recent colours, a sixty-character name.** Caps rather
 *    than growth: a board is a shopping list, not an archive.
 *  - **Clearing keeps the recently viewed colours.** Those are a browsing history, not
 *    part of the project, and throwing them away makes "clear the board" feel like it
 *    cost more than it did.
 *  - **Colours and products are prepended, preparation situations appended.** Newest
 *    first for the things you compare while choosing; in the order chosen for the
 *    sequence you will actually work through, because preparation order is meaning.
 *
 * Every change is a read-modify-write of one row, so it happens under a [Mutex]. Two
 * taps in quick succession — saving a quantity while toggling a colour — would otherwise
 * be a race where the second write silently reverts the first, and the symptom would be
 * a board that forgets things.
 */
class BoardRepository(
    private val dao: BoardDao,
    private val json: Json,
) {

    private val lock = Mutex()

    /** The board, as a flow: saving from the calculator updates the board screen by itself. */
    fun observe(): Flow<BoardState> = dao.observe().map { entity -> entity?.decode() ?: BoardState() }

    /** Save a quantity from the calculator, replacing any earlier figure for the same room. */
    suspend fun saveEstimate(estimate: SavedEstimate) = mutate { board ->
        val others = board.estimates.filterNot {
            it.productId == estimate.productId && it.label == estimate.label
        }
        board.copy(
            estimates = (listOf(estimate) + others).take(MAX_ESTIMATES),
            savedProducts = if (board.savedProducts.contains(estimate.productId)) {
                board.savedProducts
            } else {
                listOf(estimate.productId) + board.savedProducts
            },
            updatedAt = now(),
        )
    }

    suspend fun removeEstimate(id: String) = mutate { board ->
        board.copy(
            estimates = board.estimates.filterNot { it.id == id },
            updatedAt = now(),
        )
    }

    suspend fun rename(name: String) = mutate { board ->
        board.copy(boardName = name.take(NAME_LIMIT), updatedAt = now())
    }

    suspend fun toggleColor(id: String) = mutate { board ->
        board.copy(savedColors = toggled(board.savedColors, id), updatedAt = now())
    }

    suspend fun toggleProduct(id: String) = mutate { board ->
        board.copy(savedProducts = toggled(board.savedProducts, id), updatedAt = now())
    }

    /** Appended, not prepended: this list is a sequence of work, and order is meaning. */
    suspend fun togglePrep(id: String) = mutate { board ->
        board.copy(
            prep = if (board.prep.contains(id)) {
                board.prep.filterNot { it == id }
            } else {
                board.prep + id
            },
            updatedAt = now(),
        )
    }

    /**
     * Note a colour as recently viewed.
     *
     * The one change that does not stamp `updatedAt`, as on the website: looking at a
     * colour is not editing the project, and a board that says "changed two minutes ago"
     * because somebody browsed would be telling them something untrue about their own
     * work.
     */
    suspend fun pushRecent(id: String) = mutate { board ->
        board.copy(
            recentColors = (listOf(id) + board.recentColors.filterNot { it == id }).take(MAX_RECENT),
        )
    }

    /** Empty the board, keeping the browsing history and dropping the row if there is none. */
    suspend fun clear() {
        lock.withLock {
            val recent = (dao.current()?.decode() ?: BoardState()).recentColors
            if (recent.isEmpty()) {
                dao.delete()
            } else {
                dao.save(BoardState(recentColors = recent, updatedAt = now()).encode())
            }
        }
    }

    private fun toggled(ids: List<String>, id: String): List<String> =
        if (ids.contains(id)) ids.filterNot { it == id } else listOf(id) + ids

    private suspend fun mutate(change: (BoardState) -> BoardState) {
        lock.withLock {
            val current = dao.current()?.decode() ?: BoardState()
            dao.save(change(current).encode())
        }
    }

    private fun now(): Long = System.currentTimeMillis()

    private fun BoardState.encode() = BoardEntity(
        id = SINGLE_ROW,
        boardName = boardName,
        savedColors = encodeIds(savedColors),
        savedProducts = encodeIds(savedProducts),
        recentColors = encodeIds(recentColors),
        prep = encodeIds(prep),
        estimates = json.encodeToString(ESTIMATES, estimates),
        updatedAt = updatedAt,
    )

    /*
     * Decoding is defensive in the same way the website's hydration is. Everything in
     * these columns was written by this class, so a failure means a board written by a
     * different version of the app — and the honest response to that is an empty board
     * the person can rebuild, not a crash on the screen that opens it.
     */
    private fun BoardEntity.decode() = BoardState(
        savedColors = decodeIds(savedColors),
        savedProducts = decodeIds(savedProducts),
        recentColors = decodeIds(recentColors),
        boardName = boardName,
        estimates = try {
            json.decodeFromString(ESTIMATES, estimates)
        } catch (error: SerializationException) {
            emptyList()
        },
        prep = decodeIds(prep),
        updatedAt = updatedAt,
    )

    private fun encodeIds(ids: List<String>): String = json.encodeToString(IDS, ids)

    private fun decodeIds(raw: String): List<String> = try {
        json.decodeFromString(IDS, raw)
    } catch (error: SerializationException) {
        emptyList()
    }

    companion object {
        /** The website's cap on saved quantities. A board is a shopping list, not an archive. */
        const val MAX_ESTIMATES = 12

        /** The website's cap on recently viewed colours. */
        const val MAX_RECENT = 8

        /** The website's cap on a board's name. */
        const val NAME_LIMIT = 60

        private const val SINGLE_ROW = 1

        private val IDS = ListSerializer(String.serializer())
        private val ESTIMATES = ListSerializer(SavedEstimate.serializer())
    }
}
