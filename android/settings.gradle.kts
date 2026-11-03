/*
 * OPUDA'S PAINT — Android.
 *
 * The repositories here are the reason this project can only be built on a
 * machine that can reach the internet: Gradle itself, the Android Gradle Plugin
 * and every AndroidX artefact come from Google's and Maven Central's
 * repositories. Nothing is vendored into the tree, and nothing should be.
 */
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    /*
     * Fail rather than fall back: a module that declares its own repository is a
     * module that can resolve a dependency the rest of the app cannot, which is
     * how a build starts passing on one machine and failing on another.
     */
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "opudas-paint"
include(":app")
