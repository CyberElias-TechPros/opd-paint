package com.opudas.paint

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.opudas.paint.core.designsystem.OpudasTheme
import com.opudas.paint.navigation.OpudasApp

/**
 * The only activity.
 *
 * One activity with a Compose navigation graph, rather than an activity per
 * screen: state survives navigation, transitions are handled by the graph, and
 * there is exactly one place where the theme is applied — which is what makes
 * "every screen is on brand" a property of the app instead of a habit.
 *
 * Edge to edge is enabled before `super.onCreate` so the window is laid out
 * behind the status bar from the first frame; each screen then applies its own
 * insets, which is why the scaffold in [OpudasApp] consumes them once.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val application = application as OpudasPaintApplication
        setContent {
            OpudasTheme(brand = application.container.brand) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    OpudasApp()
                }
            }
        }
    }
}
