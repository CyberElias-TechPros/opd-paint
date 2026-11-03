package com.opudas.paint.core.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.opudas.paint.core.data.OutboxScheduler
import java.util.concurrent.TimeUnit

/**
 * Delivery, as WorkManager understands it.
 *
 * The network constraint is the "sync when online" half of offline-first: the
 * request is persisted by WorkManager and held until connectivity exists, which
 * covers the cases that matter — no signal at the moment of sending, the app
 * swiped away, the device rebooted, the submission written on a flight and
 * delivered on landing. None of that needs the app to be running or a timer to be
 * kept alive by this code.
 *
 * [ExistingWorkPolicy.KEEP] rather than REPLACE or APPEND: if a drain is already
 * queued or running, a second one would be sending the same rows concurrently and
 * could post one enquiry twice. The worker reads the whole pending set, so one
 * request is always enough.
 *
 * Backoff is exponential from thirty seconds. A tight retry loop against a service
 * that is down is radio usage and battery for nothing, and WorkManager's own cap
 * plus the worker's attempt ceiling are what stop it becoming permanent.
 */
class WorkManagerOutboxScheduler(private val context: Context) : OutboxScheduler {

    override fun requestSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val request = OneTimeWorkRequestBuilder<OutboxWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, INITIAL_BACKOFF_SECONDS, TimeUnit.SECONDS)
            .build()

        WorkManager.getInstance(context)
            .enqueueUniqueWork(UNIQUE_SYNC, ExistingWorkPolicy.KEEP, request)
    }

    companion object {
        /** One name for the drain, so there is only ever one of them. */
        const val UNIQUE_SYNC = "opudas-outbox-sync"

        private const val INITIAL_BACKOFF_SECONDS = 30L
    }
}
