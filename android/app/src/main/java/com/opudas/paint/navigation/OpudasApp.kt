package com.opudas.paint.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.opudas.paint.core.designsystem.TabGlyph
import com.opudas.paint.feature.colours.ColourDetailScreen
import com.opudas.paint.feature.colours.ColoursScreen
import com.opudas.paint.feature.home.HomeScreen
import com.opudas.paint.feature.more.MoreScreen

/**
 * The app's shell: one scaffold, one navigation graph, one bottom bar.
 *
 * The bar hides on detail screens. A bottom bar on a colour's own page is a bar
 * whose three destinations are all "go back to where you were", and the space it
 * takes is space the swatch could have used.
 */
@Composable
fun OpudasApp(navController: NavHostController = rememberNavController()) {
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val showBar = TopLevelDestination.entries.any { tab ->
        currentDestination?.hierarchy?.any { it.route == tab.route } == true
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (showBar) {
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                    TopLevelDestination.entries.forEach { tab ->
                        val selected = currentDestination?.hierarchy?.any { it.route == tab.route } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = { navController.navigateToTab(tab.route) },
                            icon = {
                                TabGlyph(
                                    kind = tab.glyph,
                                    tint = if (selected) {
                                        MaterialTheme.colorScheme.onSecondaryContainer
                                    } else {
                                        MaterialTheme.colorScheme.onSurfaceVariant
                                    },
                                )
                            },
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                selectedTextColor = MaterialTheme.colorScheme.onSecondaryContainer,
                                indicatorColor = MaterialTheme.colorScheme.secondaryContainer,
                                unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                                unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            ),
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Destinations.HOME,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(Destinations.HOME) {
                HomeScreen(
                    onOpenColours = { navController.navigate(Destinations.COLOURS) },
                    onOpenColour = { id -> navController.navigate(Destinations.colour(id)) },
                    onOpenMore = { navController.navigate(Destinations.MORE) },
                )
            }

            composable(Destinations.COLOURS) {
                ColoursScreen(onOpenColour = { id -> navController.navigate(Destinations.colour(id)) })
            }

            composable(
                route = Destinations.COLOUR_DETAIL,
                arguments = listOf(navArgument("colourId") { type = NavType.StringType }),
            ) { entry ->
                ColourDetailScreen(
                    colourId = entry.arguments?.getString("colourId").orEmpty(),
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Destinations.MORE) {
                MoreScreen(
                    onOpenColourLibrary = { navController.navigate(Destinations.COLOURS) },
                )
            }
        }
    }
}

/**
 * Tab navigation that behaves like a tab bar rather than a stack.
 *
 * Popping to the graph's start destination and using `singleTop` means the
 * Colours tab does not accumulate a copy of itself every time it is tapped, and
 * the back button from any tab returns to Home instead of walking back through
 * twenty previous taps.
 */
private fun NavHostController.navigateToTab(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}
