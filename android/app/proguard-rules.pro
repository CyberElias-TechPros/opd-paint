# Release shrinking rules.
#
# The rule of thumb this file follows: keep what reflection reaches, and nothing
# else. R8 can see every direct call in the app, so a long list of -keep lines is
# a list of code that will never be shrunk and never be questioned.

# --- kotlinx.serialization -------------------------------------------------
# The plugin generates a serializer per @Serializable class and looks it up
# through a Companion object. R8 sees the lookup as reflection and removes the
# Companion, which fails at runtime on the first JSON parse — that is, on the
# first screen of the app, only in a release build. These are the rules the
# library documents.
-keepattributes *Annotation*, InnerClasses, Signature, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class ** {
    public static ** INSTANCE;
}
-keepclassmembers class <1> {
    public static <1> INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}

# --- OkHttp ----------------------------------------------------------------
# OkHttp ships its own consumer rules; these two cover the optional platform
# probes it makes, which otherwise arrive as warnings in every release build.
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# --- Room ------------------------------------------------------------------
# Room's generated code is referenced by name from the annotation processor
# output. Kept narrowly: the entities themselves are plain classes R8 handles.
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# --- Models ----------------------------------------------------------------
# The content bundle is parsed into @Serializable data classes by generated
# serializers, so nothing here needs a blanket keep. If a model is ever read by
# reflection instead, add it explicitly and say why.
