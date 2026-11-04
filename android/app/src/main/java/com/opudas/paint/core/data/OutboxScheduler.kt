package com.opudas.paint.core.data

/**
 * A request to deliver the outbox soon.
 *
 * An interface, and a one-method one, for two reasons. The repository should not
 * know that delivery happens to be WorkManager: today it is a
 * `OneTimeWorkRequest` with a network constraint, and that is an implementation
 * detail of `core.sync`. And a JVM test can then assert that writing a
 * submission asks for a sync, without a Robolectric runtime and without a
 * WorkManager test harness — neither of which is in this project's dependencies.
 */
fun interface OutboxScheduler {
    fun requestSync()
}
