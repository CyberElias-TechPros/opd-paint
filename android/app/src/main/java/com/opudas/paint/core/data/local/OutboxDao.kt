package com.opudas.paint.core.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

/**
 * The queue.
 *
 * Everything that reads a list returns a [Flow] rather than a one-shot value, so
 * the screen showing "waiting to send" updates itself when the worker drains the
 * queue in the background. A screen that has to be told to refresh is a screen
 * that eventually shows a submission as pending after it has already been
 * accepted — and the person taps send again.
 */
@Dao
interface OutboxDao {

    @Insert
    suspend fun insert(entry: OutboxEntity): Long

    /** Oldest first: a queue that delivers out of order is a queue that loses arguments about what happened when. */
    @Query("SELECT * FROM outbox WHERE state = 'pending' ORDER BY createdAt ASC")
    suspend fun pending(): List<OutboxEntity>

    @Query("SELECT * FROM outbox ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<OutboxEntity>>

    @Query("SELECT COUNT(*) FROM outbox WHERE state = 'pending'")
    fun observePendingCount(): Flow<Int>

    @Query(
        "UPDATE outbox SET state = 'sent', reference = :reference, sentAt = :sentAt, " +
            "lastError = NULL, fieldErrors = NULL WHERE id = :id",
    )
    suspend fun markSent(id: Long, reference: String?, sentAt: Long)

    /**
     * Record a refusal.
     *
     * [state] is passed in rather than decided here: an unreachable service leaves
     * the entry pending so the worker tries again, while a 422 with per-field
     * messages marks it failed, because retrying a submission the service has
     * explained is not persistence, it is noise.
     */
    @Query(
        "UPDATE outbox SET attempts = attempts + 1, state = :state, " +
            "lastError = :error, fieldErrors = :fieldErrors WHERE id = :id",
    )
    suspend fun markAttempted(id: Long, state: String, error: String?, fieldErrors: String?)

    /**
     * Put a refused submission back in the queue.
     *
     * Distinct from [markAttempted] because it does not touch [OutboxEntity.attempts]:
     * a person tapping "try again" is not an attempt, it is a request for one, and
     * counting it would make the retry counter describe taps rather than deliveries.
     */
    @Query("UPDATE outbox SET state = 'pending', lastError = NULL, fieldErrors = NULL WHERE id = :id")
    suspend fun markPending(id: Long)

    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun delete(id: Long)

    /**
     * Drop accepted submissions older than [cutoff].
     *
     * Sent entries are kept long enough to answer "did that enquiry go through,
     * and what was the reference?" and no longer. Retention of the enquiry itself
     * is the service's business and is governed there; this is a phone's own
     * scratch copy of a conversation it has finished having.
     */
    @Query("DELETE FROM outbox WHERE state = 'sent' AND sentAt IS NOT NULL AND sentAt < :cutoff")
    suspend fun deleteSentBefore(cutoff: Long)
}
