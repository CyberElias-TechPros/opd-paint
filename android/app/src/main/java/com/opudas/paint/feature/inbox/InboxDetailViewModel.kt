package com.opudas.paint.feature.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opudas.paint.core.data.remote.AdminApi
import com.opudas.paint.core.data.remote.ApiResult
import com.opudas.paint.core.data.remote.InboxEnquiry
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class InboxDetailUiState(
    val isLoading: Boolean = true,
    val enquiry: InboxEnquiry? = null,
    val error: String? = null,
    /** The session ended, so this cannot be read until somebody signs in again. */
    val needsSignIn: Boolean = false,
    /** Read successfully, and the reference was not in what was read. */
    val notFound: Boolean = false,
    val searchedCount: Int = 0,
    val totalCount: Int = 0,
)

/**
 * One enquiry, by reference.
 *
 * The service has no endpoint for a single enquiry — it serves a page — so this reads
 * the widest page it is allowed and picks the reference out of it. That is a real cost
 * and it is named here rather than hidden: opening one enquiry moves up to
 * [AdminApi.MAX_PAGE] of them across the network. It is still far less than the CSV
 * export, which is the whole log and the reason the JSON page exists at all, and it is
 * the same data this account may already read on the list screen.
 *
 * A reference outside that page is reported as exactly that, with the counts, rather
 * than as a missing record: "not in the most recent 200 of 517" tells somebody where to
 * look next, and "not found" tells them nothing true.
 */
class InboxDetailViewModel(
    private val admin: AdminApi,
    private val reference: String,
) : ViewModel() {

    private val mutableState = MutableStateFlow(InboxDetailUiState())
    val uiState: StateFlow<InboxDetailUiState> = mutableState.asStateFlow()

    init {
        load()
    }

    fun refresh() {
        if (!mutableState.value.isLoading) load()
    }

    private fun load() {
        viewModelScope.launch {
            mutableState.update { it.copy(isLoading = true, error = null) }
            when (val result = admin.enquiries(AdminApi.MAX_PAGE)) {
                is ApiResult.Success -> {
                    val page = result.value
                    val found = page.enquiries.firstOrNull { it.reference == reference }
                    mutableState.update {
                        it.copy(
                            isLoading = false,
                            enquiry = found,
                            notFound = found == null,
                            searchedCount = page.returned,
                            totalCount = page.total,
                        )
                    }
                }

                is ApiResult.Rejected -> mutableState.update {
                    it.copy(
                        isLoading = false,
                        needsSignIn = result.status == HTTP_UNAUTHORISED,
                        error = result.message,
                    )
                }

                is ApiResult.Unreachable -> mutableState.update {
                    it.copy(
                        isLoading = false,
                        error = "The inbox could not be reached (${result.reason}). The enquiry " +
                            "is still on the service; nothing was changed by trying.",
                    )
                }
            }
        }
    }

    companion object {
        private const val HTTP_UNAUTHORISED = 401
    }
}
