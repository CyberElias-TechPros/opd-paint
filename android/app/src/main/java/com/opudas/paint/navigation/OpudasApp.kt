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
import androidx.compose.ui.platform.LocalContext
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
import com.opudas.paint.core.engine.ChecklistLink
import com.opudas.paint.feature.board.BoardScreen
import com.opudas.paint.feature.board.ChecklistScreen
import com.opudas.paint.feature.calculator.CalculatorScreen
import com.opudas.paint.feature.colours.ColourDetailScreen
import com.opudas.paint.feature.colours.ColoursScreen
import com.opudas.paint.feature.dealers.DealerDetailScreen
import com.opudas.paint.feature.dealers.DealersScreen
import com.opudas.paint.feature.documents.DocumentScreen
import com.opudas.paint.feature.documents.DocumentsScreen
import com.opudas.paint.feature.guides.GuideDetailScreen
import com.opudas.paint.feature.guides.GuidesScreen
import com.opudas.paint.feature.home.HomeScreen
import com.opudas.paint.feature.inbox.InboxDetailScreen
import com.opudas.paint.feature.inbox.InboxScreen
import com.opudas.paint.feature.legal.LegalDocScreen
import com.opudas.paint.feature.legal.LegalScreen
import com.opudas.paint.feature.more.MoreScreen
import com.opudas.paint.feature.palettes.PaletteDetailScreen
import com.opudas.paint.feature.palettes.PalettesScreen
import com.opudas.paint.feature.privacy.PrivacyRequestScreen
import com.opudas.paint.feature.products.ProductDetailScreen
import com.opudas.paint.feature.products.ProductsScreen
import com.opudas.paint.feature.projects.ProjectDetailScreen
import com.opudas.paint.feature.projects.ProjectsScreen
import com.opudas.paint.feature.tools.FinishFinderScreen
import com.opudas.paint.feature.tools.SurfacePrepDetailScreen
import com.opudas.paint.feature.tools.SurfacePrepScreen
import com.opudas.paint.feature.tools.ToolTarget
import com.opudas.paint.feature.tools.ToolsScreen
import com.opudas.paint.feature.quote.QuoteScreen
import com.opudas.paint.feature.visualiser.VisualiserScreen

/**
 * The app's shell: one scaffold, one navigation graph, one bottom bar.
 *
 * The bar hides on detail screens. A bottom bar on a colour's own page is a bar
 * whose three destinations are all "go back to where you were", and the space it
 * takes is space the swatch could have used.
 */
@Composable
fun OpudasApp(navController: NavHostController = rememberNavController()) {
    val context = LocalContext.current

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
                    onVisualise = { id -> navController.navigate(Destinations.visualiser(id)) },
                )
            }

            composable(Destinations.PRODUCTS) {
                ProductsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenProduct = { id -> navController.navigate(Destinations.product(id)) },
                )
            }

            composable(
                route = Destinations.PRODUCT_DETAIL,
                arguments = listOf(navArgument("productId") { type = NavType.StringType }),
            ) { entry ->
                ProductDetailScreen(
                    productId = entry.arguments?.getString("productId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onSizeThisJob = { id -> navController.navigate(Destinations.calculator(id)) },
                    onOpenDocument = { path, title ->
                        navController.navigate(Destinations.document(path, title))
                    },
                )
            }

            /*
             * One registration for both the bare route and the one carrying a
             * product: `productId` is nullable with a default, so Navigation
             * matches "calculator" and "calculator?productId=matt" here alike.
             */
            composable(
                route = Destinations.CALCULATOR_WITH_PRODUCT,
                arguments = listOf(
                    navArgument("productId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                CalculatorScreen(
                    onBack = { navController.popBackStack() },
                    preselectedProductId = entry.arguments?.getString("productId"),
                )
            }

            composable(Destinations.PALETTES) {
                PalettesScreen(
                    onBack = { navController.popBackStack() },
                    onOpenPalette = { id -> navController.navigate(Destinations.palette(id)) },
                    onOpenColour = { id -> navController.navigate(Destinations.colour(id)) },
                )
            }

            composable(
                route = Destinations.PALETTE_DETAIL,
                arguments = listOf(navArgument("paletteId") { type = NavType.StringType }),
            ) { entry ->
                PaletteDetailScreen(
                    paletteId = entry.arguments?.getString("paletteId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenColour = { id -> navController.navigate(Destinations.colour(id)) },
                    onOpenProject = { id -> navController.navigate(Destinations.project(id)) },
                    onEnquire = { colourId ->
                        navController.navigate(Destinations.quote(colourId = colourId))
                    },
                )
            }

            composable(Destinations.PROJECTS) {
                ProjectsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenProject = { id -> navController.navigate(Destinations.project(id)) },
                )
            }

            composable(
                route = Destinations.PROJECT_DETAIL,
                arguments = listOf(navArgument("projectId") { type = NavType.StringType }),
            ) { entry ->
                ProjectDetailScreen(
                    projectId = entry.arguments?.getString("projectId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenColour = { id -> navController.navigate(Destinations.colour(id)) },
                    onOpenProduct = { id -> navController.navigate(Destinations.product(id)) },
                    onOpenPalette = { id -> navController.navigate(Destinations.palette(id)) },
                    onEnquire = { colourId ->
                        navController.navigate(Destinations.quote(colourId = colourId))
                    },
                )
            }

            composable(Destinations.DEALERS) {
                DealersScreen(
                    onBack = { navController.popBackStack() },
                    onOpenDealer = { id -> navController.navigate(Destinations.dealer(id)) },
                )
            }

            composable(
                route = Destinations.DEALER_DETAIL,
                arguments = listOf(navArgument("dealerId") { type = NavType.StringType }),
            ) { entry ->
                DealerDetailScreen(
                    dealerId = entry.arguments?.getString("dealerId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenDealer = { id -> navController.navigate(Destinations.dealer(id)) },
                )
            }

            composable(Destinations.LEGAL) {
                LegalScreen(
                    onBack = { navController.popBackStack() },
                    onOpenDoc = { slug -> navController.navigate(Destinations.legal(slug)) },
                )
            }

            composable(
                route = Destinations.LEGAL_DOC,
                arguments = listOf(navArgument("slug") { type = NavType.StringType }),
            ) { entry ->
                LegalDocScreen(
                    slug = entry.arguments?.getString("slug").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenDoc = { slug -> navController.navigate(Destinations.legal(slug)) },
                    onRequestData = { navController.navigate(Destinations.PRIVACY_REQUEST) },
                )
            }

            composable(Destinations.TOOLS) {
                ToolsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenTool = { target ->
                        when (target) {
                            ToolTarget.FINISH_FINDER ->
                                navController.navigate(Destinations.FINISH_FINDER)
                            ToolTarget.SURFACE_PREP ->
                                navController.navigate(Destinations.SURFACE_PREP)
                            ToolTarget.CALCULATOR ->
                                navController.navigate(Destinations.CALCULATOR)
                            // Not a dead end: the hub says so on the card itself.
                            ToolTarget.NOT_IN_THIS_BUILD -> Unit
                        }
                    },
                )
            }

            composable(Destinations.FINISH_FINDER) {
                FinishFinderScreen(
                    onBack = { navController.popBackStack() },
                    onOpenProduct = { id -> navController.navigate(Destinations.product(id)) },
                    onOpenGuide = { id -> navController.navigate(Destinations.guide(id)) },
                    onOpenPrep = { id -> navController.navigate(Destinations.prepSituation(id)) },
                    onAskQuote = { id ->
                        navController.navigate(Destinations.quote(productId = id))
                    },
                )
            }

            composable(Destinations.SURFACE_PREP) {
                SurfacePrepScreen(
                    onBack = { navController.popBackStack() },
                    onOpenSituation = { id -> navController.navigate(Destinations.prepSituation(id)) },
                )
            }

            composable(
                route = Destinations.SURFACE_PREP_DETAIL,
                arguments = listOf(navArgument("situationId") { type = NavType.StringType }),
            ) { entry ->
                SurfacePrepDetailScreen(
                    situationId = entry.arguments?.getString("situationId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenProduct = { id -> navController.navigate(Destinations.product(id)) },
                    onOpenGuide = { id -> navController.navigate(Destinations.guide(id)) },
                )
            }

            composable(Destinations.GUIDES) {
                GuidesScreen(
                    onBack = { navController.popBackStack() },
                    onOpenGuide = { id -> navController.navigate(Destinations.guide(id)) },
                )
            }

            composable(
                route = Destinations.GUIDE_DETAIL,
                arguments = listOf(navArgument("guideId") { type = NavType.StringType }),
            ) { entry ->
                GuideDetailScreen(
                    guideId = entry.arguments?.getString("guideId").orEmpty(),
                    onBack = { navController.popBackStack() },
                    onOpenGuide = { id -> navController.navigate(Destinations.guide(id)) },
                    onOpenColour = { id -> navController.navigate(Destinations.colour(id)) },
                    onOpenProduct = { id -> navController.navigate(Destinations.product(id)) },
                )
            }

            composable(Destinations.PRIVACY_REQUEST) {
                PrivacyRequestScreen(onBack = { navController.popBackStack() })
            }

            composable(Destinations.MORE) {
                MoreScreen(
                    onOpenColourLibrary = { navController.navigate(Destinations.COLOURS) },
                    onOpenProducts = { navController.navigate(Destinations.PRODUCTS) },
                    onOpenCalculator = { navController.navigate(Destinations.CALCULATOR) },
                    onOpenQuote = { navController.navigate(Destinations.QUOTE) },
                    onOpenDealers = { navController.navigate(Destinations.DEALERS) },
                    onOpenPalettes = { navController.navigate(Destinations.PALETTES) },
                    onOpenProjects = { navController.navigate(Destinations.PROJECTS) },
                    onOpenPrivacyRequest = { navController.navigate(Destinations.PRIVACY_REQUEST) },
                    onOpenGuides = { navController.navigate(Destinations.GUIDES) },
                    onOpenTools = { navController.navigate(Destinations.TOOLS) },
                    onOpenLegal = { navController.navigate(Destinations.LEGAL) },
                    onOpenPrivacyNotice = {
                        navController.navigate(Destinations.legal("privacy"))
                    },
                    onOpenBoard = { navController.navigate(Destinations.BOARD) },
                    onOpenDocuments = { navController.navigate(Destinations.DOCUMENTS) },
                    onOpenVisualiser = { navController.navigate(Destinations.visualiser(null)) },
                    onOpenInbox = { navController.navigate(Destinations.INBOX) },
                )
            }

            /*
             * The enquiries inbox: the one part of the product that is not for
             * customers. It signs in against the same service and the same accounts as
             * the inbox on the website, and keeps nothing on the device — no password,
             * no code, no session cookie, no page already read.
             */
            composable(Destinations.INBOX) {
                InboxScreen(
                    onBack = { navController.popBackStack() },
                    onOpenEnquiry = { reference ->
                        navController.navigate(Destinations.inboxDetail(reference))
                    },
                )
            }

            composable(
                route = Destinations.INBOX_DETAIL,
                arguments = listOf(navArgument("reference") { type = NavType.StringType }),
            ) { entry ->
                InboxDetailScreen(
                    reference = entry.arguments?.getString("reference").orEmpty(),
                    onBack = { navController.popBackStack() },
                )
            }

            /*
             * A document from inside the APK. The path is untrusted - it can arrive
             * through a deep link - so the viewer validates it as a bare filename
             * before it goes anywhere near the filesystem.
             */
            /*
             * The room preview. The colour argument is optional and nullable: the hub
             * arrives with nothing selected and a colour page arrives with one.
             */
            composable(
                route = Destinations.VISUALISER,
                arguments = listOf(
                    navArgument("colourId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                VisualiserScreen(
                    colourId = entry.arguments?.getString("colourId"),
                    onBack = { navController.popBackStack() },
                )
            }

            composable(Destinations.DOCUMENTS) {
                DocumentsScreen(
                    onBack = { navController.popBackStack() },
                    onOpenDocument = { path, title ->
                        navController.navigate(Destinations.document(path, title))
                    },
                )
            }

            composable(
                route = Destinations.DOCUMENT_VIEWER,
                arguments = listOf(
                    navArgument("path") { type = NavType.StringType },
                    navArgument("title") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                DocumentScreen(
                    path = entry.arguments?.getString("path").orEmpty(),
                    title = entry.arguments?.getString("title"),
                    onBack = { navController.popBackStack() },
                )
            }

            /*
             * The project board and the checklist it produces. Two screens where the
             * website has one page: managing what is saved and reading the order of work
             * are different jobs on a phone, and one long scrolling page does neither
             * well with a thumb.
             */
            composable(Destinations.BOARD) {
                BoardScreen(
                    onBack = { navController.popBackStack() },
                    onOpenChecklist = { navController.navigate(Destinations.CHECKLIST) },
                )
            }

            composable(Destinations.CHECKLIST) {
                ChecklistScreen(
                    onBack = { navController.popBackStack() },
                    /*
                     * Each line knows what it refers to, not which URL the website would
                     * have used: a link is a decision about a destination, and parsing
                     * another platform's route string to make it means the day somebody
                     * renames a path, a phone navigates somewhere wrong without anything
                     * failing.
                     */
                    onOpenLink = { link ->
                        when (link) {
                            ChecklistLink.Calculator ->
                                navController.navigate(Destinations.CALCULATOR)

                            ChecklistLink.SampleRequest -> navController.navigate(
                                Destinations.quoteForProjectType(Destinations.SAMPLE_PROJECT_TYPE),
                            )

                            ChecklistLink.SurfacePrep ->
                                navController.navigate(Destinations.SURFACE_PREP)

                            ChecklistLink.Dealers -> navController.navigate(Destinations.DEALERS)
                            ChecklistLink.Colours -> navController.navigate(Destinations.COLOURS)
                            is ChecklistLink.Product ->
                                navController.navigate(Destinations.product(link.id))
                        }
                    },
                )
            }

            /*
             * One registration for the bare route and the one carrying context: all
             * three arguments are nullable with defaults, so "quote" and
             * "quote?productId=matt&quantity=9%20tins" both match here.
             */
            composable(
                route = Destinations.QUOTE_WITH_CONTEXT,
                arguments = listOf(
                    navArgument("colourId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("productId") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("quantity") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                    navArgument("projectType") {
                        type = NavType.StringType
                        nullable = true
                        defaultValue = null
                    },
                ),
            ) { entry ->
                QuoteScreen(
                    onBack = { navController.popBackStack() },
                    /*
                     * The notice itself, not a link to it. The consent wording
                     * refers to the notice, so a person deciding whether to send
                     * their phone number has to be able to read it — including with
                     * no signal, which is what opening the website could not do.
                     */
                    onOpenPrivacyNotice = {
                        navController.navigate(Destinations.legal("privacy"))
                    },
                    colourId = entry.arguments?.getString("colourId"),
                    productId = entry.arguments?.getString("productId"),
                    quantity = entry.arguments?.getString("quantity"),
                    projectType = entry.arguments?.getString("projectType"),
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
