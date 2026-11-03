#!/usr/bin/env python3
"""
Pre-flight checks for the Android tree, for the times a compiler is not available.

A development sandbox cannot reach Google's Maven repository, so the only Kotlin
compiler this project has is the one in CI, and a round trip costs minutes. These
checks run in well under a second and catch the classes of mistake that are
invisible to the eye but fatal to `kotlinc`:

  1. Nested block comments. Kotlin block comments nest, unlike Java's, so a glob
     written inside KDoc — `src/data/*.ts`, the natural way to name those files —
     opens a comment that nothing ever closes, and the file fails with
     "Unclosed comment" at end of file. This one has already happened twice.
  2. Unbalanced braces and parentheses, which is what a truncated write looks
     like, and which otherwise surfaces as a dozen misleading downstream errors.
  3. Resource references (`R.drawable.x`, `R.string.x`, …) that do not exist.
     Kotlin resolves these at compile time, so a typo is a build failure, not a
     warning.
  4. Asset paths in the generated bundle that are not actually bundled.
  5. A `return` inside an expression-body function, which Kotlin rejects outright
     rather than treating as a warning.
  6. Imports of symbols from this project's own packages that nothing declares.
     Library imports cannot be checked without a classpath and are skipped; this
     project's own can be, because the declarations are all here. The names the
     Android Gradle Plugin generates into the module namespace are excepted:
     `R` and `BuildConfig` are real at compile time and absent from the sources.

It cannot type-check, resolve a Compose overload or verify a library's API — only
a compiler can. What it does catch, it catches in under a second instead of a CI
round trip.

Usage:  python3 tools/check-android-static.py [--android-dir DIR]
Exit:   0 when clean, 1 when something is wrong.
"""

from __future__ import annotations

import argparse
import glob
import os
import re
import sys

# ---------------------------------------------------------------------------
# A scanner that understands Kotlin comments and strings
# ---------------------------------------------------------------------------


def strip_comments_and_strings(src: str) -> tuple[str, list[tuple[int, str]]]:
    """
    Return `src` with comment text and string contents blanked to spaces
    (newlines preserved, so line numbers still match), plus a list of problems
    found while scanning.

    Kotlin specifics handled here:
      * block comments nest — `/* /* */ */` is one comment;
      * `//` runs to end of line;
      * triple-quoted raw strings run to the next triple quote, across lines;
      * `\\` escapes the next character inside a normal string.
    """
    out = list(src)
    problems: list[tuple[int, str]] = []
    depth = 0
    i = 0
    line = 1
    n = len(src)

    def blank(index: int) -> None:
        if out[index] != "\n":
            out[index] = " "

    while i < n:
        ch = src[i]
        two = src[i : i + 2]

        if ch == "\n":
            line += 1
            i += 1
            continue

        if depth == 0:
            if two == "/*":
                depth = 1
                blank(i)
                blank(i + 1)
                i += 2
                continue
            if two == "//":
                while i < n and src[i] != "\n":
                    blank(i)
                    i += 1
                continue
            if ch == '"':
                if src[i : i + 3] == '"""':
                    j = i + 3
                    while j < n and src[j : j + 3] != '"""':
                        blank(j)
                        if src[j] == "\n":
                            line += 1
                        j += 1
                    i = j + 3
                    continue
                j = i + 1
                while j < n and src[j] != '"':
                    if src[j] == "\\":
                        j += 1
                    if j < n:
                        blank(j)
                    j += 1
                i = j + 1
                continue
            if ch == "'":
                j = i + 1
                while j < n and src[j] != "'":
                    if src[j] == "\\":
                        j += 1
                    j += 1
                i = j + 1
                continue
            i += 1
            continue

        # Inside a block comment.
        if two == "/*":
            # A second opener inside comment prose. Kotlin nests, so this needs a
            # matching closer that comment prose never supplies: the file then
            # fails to compile at EOF. Almost always a glob in a doc comment.
            context = src[max(0, i - 40) : i + 20].replace("\n", " ")
            problems.append(
                (
                    line,
                    "'/*' inside a comment opens a nested comment that is never "
                    f"closed (Kotlin block comments nest): …{context.strip()}…",
                )
            )
            depth += 1
            blank(i)
            blank(i + 1)
            i += 2
            continue
        if two == "*/":
            depth -= 1
            blank(i)
            blank(i + 1)
            i += 2
            continue
        blank(i)
        i += 1

    if depth > 0:
        problems.append((line, f"block comment still open at end of file (depth {depth})"))

    return "".join(out), problems


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

DECLARATION_RE = re.compile(
    r"""^\s*
        (?:@\w+(?:\([^)]*\))?\s+)*                     # annotations
        (?:(?:public|internal|private|protected)\s+)?  # visibility
        (?:(?:actual|expect|abstract|sealed|open|data|value|enum|annotation|inline|
             external|suspend|tailrec|operator|infix|const|lateinit|vararg|
             fun|companion|inner)\s+)*
        (?:class|object|interface|fun|val|var|typealias)\s+
        (?:<[^>]*>\s*)?                                # receiver generics
        (?:[\w.<>?\[\]]+\.)?                           # extension receiver
        (\w+)                                          # the declared name
    """,
    re.VERBOSE | re.MULTILINE,
)


def collect_declarations(stripped: str) -> set[str]:
    """Every name this file declares, nested or top level."""
    return set(DECLARATION_RE.findall(stripped))


def package_of(stripped: str) -> str | None:
    match = re.search(r"^\s*package\s+([\w.]+)", stripped, re.MULTILINE)
    return match.group(1) if match else None


def imports_of(stripped: str) -> list[tuple[int, str]]:
    out = []
    for index, line in enumerate(stripped.splitlines(), start=1):
        match = re.match(r"\s*import\s+([\w.]+)(?:\s+as\s+\w+)?\s*$", line)
        if match:
            out.append((index, match.group(1)))
    return out


def split_import(qualified: str) -> tuple[str, str]:
    """
    Split `com.opudas.paint.core.data.ContentRepository.ThemeTokens` into the
    package (`com.opudas.paint.core.data`) and the first class segment
    (`ContentRepository`). Package segments are lowercase by convention, so the
    first capitalised segment starts the class path — which is what makes nested
    imports resolvable.
    """
    parts = qualified.split(".")
    index = 0
    while index < len(parts) and parts[index][:1].islower():
        index += 1
    if index == 0 or index >= len(parts):
        return qualified, ""
    return ".".join(parts[:index]), parts[index]


# `fun f(x: T): R = expr` — an expression body. The capture group is the expression.
EXPRESSION_BODY_RE = re.compile(r"\bfun\s+[\w.<>`]+\s*\([^)]*\)\s*(?::[^={]*)?=\s*(.+)$")


def check_expression_body_returns(stripped: str, path: str) -> list[str]:
    """
    A `return` in an expression-body function is a compile error, not a warning:
    "Returns are prohibited for functions with an expression body."

    `return@label` is legal — that is a lambda's own return — so it is not
    reported. Only single-line bodies are checked: delimiting a body wrapped over
    several lines needs a real parser, and the one-line form is the one that reads
    naturally, so it is the one that gets written.
    """
    errors = []
    for line_no, line in enumerate(stripped.splitlines(), start=1):
        if "{" in line:
            continue  # a block body or a lambda: `return` is fine there
        match = EXPRESSION_BODY_RE.search(line)
        if not match:
            continue
        if re.search(r"\breturn\b(?!@)", match.group(1)):
            errors.append(
                f"{path}:{line_no}: `return` inside an expression-body function — "
                "Kotlin prohibits it. Use a block body, or `?.let { }`."
            )
    return errors


# `class Foo(a: A, private val b: B)` — capture the parameter list.
CLASS_HEADER_RE = re.compile(
    r"^\s*(?:(?:public|internal|private|abstract|open|sealed|data|value|enum|annotation)\s+)*"
    r"class\s+(\w+)[^(]*\(([^)]*)\)",
    re.MULTILINE,
)

MEMBER_START_RE = re.compile(
    r"^\s*(?:@\w+(?:\([^)]*\))?\s*)*"
    r"(?:(?:public|internal|private|protected|override|open|abstract|suspend|inline|operator)\s+)*"
    r"(fun|val|var)\b"
)

PARAM_NAME_RE = re.compile(r"(\w+)\s*:")


def check_ctor_param_scope(stripped: str, path: str) -> list[str]:
    """
    Warn when a constructor parameter that is not a property is used inside a
    member function.

    Kotlin scopes constructor parameters to property initialisers and init blocks.
    `class Tokens(bundle: Bundle)` lets `bundle` appear in `val x = bundle.y` but
    not in `fun z() = bundle.y`, which fails to compile — and the failure reads as
    "Unresolved reference", pointing at nothing obviously wrong. Declaring the
    parameter `private val` fixes it.

    This is a warning rather than an error because it works by segmenting members
    line by line, and a heuristic that can be wrong must not be able to fail a
    build.
    """
    warnings: list[str] = []
    lines = stripped.splitlines()

    for header in CLASS_HEADER_RE.finditer(stripped):
        class_name = header.group(1)
        ctor_only: set[str] = set()
        for part in header.group(2).split(","):
            part = part.strip()
            if not part or re.search(r"\b(?:val|var)\b", part):
                continue  # a property, so it stays in scope everywhere
            match = PARAM_NAME_RE.search(part)
            if match:
                ctor_only.add(match.group(1))
        if not ctor_only:
            continue

        start_line = stripped[: header.start()].count("\n")
        # Segment the class body: each member begins on its own line in this
        # project's style, which is enough to tell initialisers from functions.
        segment_kind = ""
        segment_lines: list[tuple[int, str]] = []
        own_names: set[str] = set()

        def flush() -> None:
            if segment_kind != "fun" or not ctor_only:
                return
            for line_no, line in segment_lines:
                for name in ctor_only - own_names:
                    if re.search(r"\b%s\b" % re.escape(name), line):
                        warnings.append(
                            f"{path}:{line_no}: '{name}' is a constructor parameter of "
                            f"{class_name}, not a property, so it is out of scope inside "
                            "this function. Declare it `private val`."
                        )
                        return

        for index in range(start_line, len(lines)):
            line = lines[index]
            member = MEMBER_START_RE.match(line)
            if member:
                flush()
                segment_kind = member.group(1)
                segment_lines = []
                own_names = set(PARAM_NAME_RE.findall(line)) if segment_kind == "fun" else set()
                continue
            if segment_kind:
                segment_lines.append((index + 1, line))
                own_names.update(re.findall(r"\b(?:val|var)\s+(\w+)", line))
        flush()

    return warnings


# `$Object.CONSTANT` — an interpolation of an object followed by literal text.
UNBRACED_QUALIFIED_INTERPOLATION_RE = re.compile(r"\$([A-Z]\w*)\.([A-Z][A-Z0-9_]*)")


def check_interpolations(src: str, path: str) -> list[str]:
    """
    Report `"$AppCopy.WEBSITE"` — which is not the constant.

    Kotlin's short interpolation form takes a simple name only. `$Object.NAME`
    parses as `$Object` followed by the literal text `.NAME`, so the string
    becomes the object's `toString()` with the field name appended:
    "com.opudas.paint.core.util.AppCopy@1b6d.PRIVACY_EMAIL" rendered onto a
    button a customer is meant to read.

    This compiles without a warning and there is no type that makes it wrong, so
    neither the compiler nor lint will ever mention it. Braces fix it:
    "${AppCopy.WEBSITE}".

    Run against the original text rather than the comment-stripped copy, because
    the strings are precisely what stripping removes. Comment lines are skipped so
    that documentation quoting the mistake is not reported as the mistake.
    """
    errors = []
    for line_no, line in enumerate(src.splitlines(), start=1):
        if line.lstrip().startswith(("*", "//", "/*")):
            continue
        for match in UNBRACED_QUALIFIED_INTERPOLATION_RE.finditer(line):
            errors.append(
                f"{path}:{line_no}: \"${match.group(1)}.{match.group(2)}\" interpolates the "
                f"object {match.group(1)} and then writes \".{match.group(2)}\" as literal "
                f"text. Use braces: \"${{{match.group(1)}.{match.group(2)}}}\"."
            )
    return errors


def check_balance(stripped: str, path: str) -> list[str]:
    """Braces and parentheses must balance, or the file was truncated."""
    errors = []
    counts = {"{": 0, "(": 0, "[": 0}
    closers = {"}": "{", ")": "(", "]": "["}
    for ch in stripped:
        if ch in counts:
            counts[ch] += 1
        elif ch in closers:
            counts[closers[ch]] -= 1
    for opener, balance in counts.items():
        if balance != 0:
            closer = closers and {"{": "}", "(": ")", "[": "]"}[opener]
            errors.append(
                f"{path}: unbalanced {opener}{closer} — net {balance:+d} "
                "(a truncated write, or a stray brace in prose)"
            )
    return errors


def resource_names(android_dir: str) -> dict[str, set[str]]:
    """Resource type -> declared names, from res/ plus generated values."""
    declared: dict[str, set[str]] = {}
    res = os.path.join(android_dir, "app", "src", "main", "res")

    for path in glob.glob(os.path.join(res, "**", "*"), recursive=True):
        if not os.path.isfile(path):
            continue
        folder = os.path.basename(os.path.dirname(path))
        kind = folder.split("-")[0]  # drawable-hdpi -> drawable
        stem = os.path.splitext(os.path.basename(path))[0]
        if kind in ("drawable", "mipmap", "anim", "animator", "raw", "xml", "font"):
            declared.setdefault(kind, set()).add(stem)
        elif kind == "layout":
            declared.setdefault("layout", set()).add(stem)

    # values/*.xml declare names by attribute, not by filename
    for path in glob.glob(os.path.join(res, "values*", "*.xml")):
        text = open(path, encoding="utf-8").read()
        for kind, name in re.findall(
            r'<(color|string|dimen|bool|integer|style|array|string-array)\s+name="([^"]+)"',
            text,
        ):
            bucket = {
                "color": "color",
                "string": "string",
                "dimen": "dimen",
                "bool": "bool",
                "integer": "integer",
                "style": "style",
                "array": "array",
                "string-array": "array",
            }[kind]
            declared.setdefault(bucket, set()).add(name.replace(".", "_"))

    # BuildConfig fields the app module turns on
    declared.setdefault("string", set())
    return declared


def check_resources(kotlin_files: list[str], android_dir: str) -> list[str]:
    declared = resource_names(android_dir)
    errors = []
    for path in kotlin_files:
        stripped, _ = strip_comments_and_strings(open(path, encoding="utf-8").read())
        for match in re.finditer(r"\bR\.(\w+)\.(\w+)", stripped):
            kind, name = match.group(1), match.group(2)
            if kind not in declared:
                line_no = stripped[: match.start()].count("\n") + 1
                errors.append(
                    f"{path}:{line_no}: R.{kind}.{name} — no {kind} resources are declared at all"
                )
            elif name not in declared[kind]:
                line_no = stripped[: match.start()].count("\n") + 1
                known = ", ".join(sorted(declared[kind])[:6])
                errors.append(
                    f"{path}:{line_no}: R.{kind}.{name} does not exist "
                    f"(declared {kind}: {known}{'…' if len(declared[kind]) > 6 else ''})"
                )
    return errors


def check_assets(kotlin_files: list[str], android_dir: str) -> list[str]:
    """Every `data/*.json` the code asks for must actually be bundled."""
    assets = os.path.join(android_dir, "app", "src", "main", "assets")
    bundled = set()
    for path in glob.glob(os.path.join(assets, "**", "*"), recursive=True):
        if os.path.isfile(path):
            bundled.add(os.path.relpath(path, assets).replace(os.sep, "/"))

    errors = []
    for path in kotlin_files:
        stripped, _ = strip_comments_and_strings(open(path, encoding="utf-8").read())
        for match in re.finditer(r'"((?:data|documents|media)/[\w./-]+)"', stripped):
            relative = match.group(1)
            if relative.startswith("data/") and relative not in bundled:
                line_no = stripped[: match.start()].count("\n") + 1
                errors.append(
                    f"{path}:{line_no}: asset '{relative}' is not bundled "
                    "(run `npm --prefix app run data:android`)"
                )
    return errors


# Names the Android Gradle Plugin generates into the module namespace. They are
# real at compile time and absent from the sources, so treating them as
# undeclared would make this check cry wolf on every screen that loads a drawable
# or reports a version number.
GENERATED_NAMES = frozenset({"R", "BuildConfig", "Manifest", "BR"})


def module_namespace(android_dir: str, fallback: str) -> str:
    """The `namespace` from app/build.gradle.kts, which is where AGP puts them."""
    build = os.path.join(android_dir, "app", "build.gradle.kts")
    try:
        text = open(build, encoding="utf-8").read()
    except OSError:
        return fallback
    match = re.search(r'namespace\s*=\s*"([^"]+)"', text)
    return match.group(1) if match else fallback


def check_internal_imports(
    kotlin_files: list[str],
    android_dir: str,
    unscannable: set[str] | None = None,
) -> list[str]:
    """
    Every import of this project's own packages must name something declared.

    `unscannable` holds packages whose files could not be read reliably: a file
    with an unclosed comment has no visible declarations at all, and reporting
    every import that reaches into it would bury the one real error under a dozen
    consequences of it.
    """
    unscannable = unscannable or set()
    declarations: dict[str, set[str]] = {}
    for path in kotlin_files:
        stripped, _ = strip_comments_and_strings(open(path, encoding="utf-8").read())
        package = package_of(stripped)
        if package:
            declarations.setdefault(package, set()).update(collect_declarations(stripped))

    # The root of this project's own package tree, derived from the sources rather
    # than assumed, and the namespace AGP generates into.
    root_package = min(declarations, key=lambda name: name.count(".")) if declarations else ""
    namespace = module_namespace(android_dir, root_package)

    errors = []
    for path in kotlin_files:
        text = open(path, encoding="utf-8").read()
        stripped, _ = strip_comments_and_strings(text)
        for line_no, qualified in imports_of(stripped):
            if not (qualified.startswith(root_package) or qualified.startswith(namespace)):
                continue
            if qualified.endswith(".*"):
                continue
            package, name = split_import(qualified)
            if not name:
                continue
            if package == namespace and name in GENERATED_NAMES:
                continue  # generated by the build, not declared in a source file
            if package in unscannable:
                continue
            if package not in declarations:
                errors.append(
                    f"{path}:{line_no}: import {qualified} — no such package "
                    f"in the project (known: {len(declarations)} packages)"
                )
            elif name not in declarations.get(package, set()):
                close = sorted(
                    n for n in declarations[package] if n.lower().startswith(name[:3].lower())
                )[:5]
                errors.append(
                    f"{path}:{line_no}: import {qualified} — '{name}' is not declared "
                    f"in package {package}" + (f" (did you mean: {', '.join(close)}?)" if close else "")
                )
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--android-dir", default=None, help="android project root")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    android_dir = args.android_dir or os.path.join(root, "android")
    if not os.path.isdir(android_dir):
        print(f"No Android project at {android_dir}")
        return 0

    kotlin_files = sorted(
        glob.glob(os.path.join(android_dir, "app", "src", "**", "*.kt"), recursive=True)
    )
    if not kotlin_files:
        print(f"No Kotlin sources under {android_dir}")
        return 0

    errors: list[str] = []
    warnings: list[str] = []
    unscannable: set[str] = set()

    for path in kotlin_files:
        text = open(path, encoding="utf-8").read()
        stripped, problems = strip_comments_and_strings(text)
        for line_no, message in problems:
            errors.append(f"{path}:{line_no}: {message}")
        structural = check_balance(stripped, path)
        structural.extend(check_expression_body_returns(stripped, path))
        errors.extend(structural)

        # Interpolations are checked against the original text: stripping strings
        # would remove the very thing being examined.
        errors.extend(check_interpolations(text, path))

        warnings.extend(check_ctor_param_scope(stripped, path))
        if problems or structural:
            # Only a comment or brace failure hides a file's declarations. The
            # other checks find a defect without making anything invisible, so
            # suppressing imports that reach into such a file would hide real
            # errors — and reporting them for a file whose comments merely scanned
            # badly would bury one bug under a dozen consequences of it.
            package = package_of(stripped)
            if package:
                unscannable.add(package)

    errors.extend(check_resources(kotlin_files, android_dir))
    errors.extend(check_assets(kotlin_files, android_dir))
    errors.extend(check_internal_imports(kotlin_files, android_dir, unscannable))

    if unscannable:
        print(
            f"Note: {len(unscannable)} package(s) could not be scanned reliably, so imports "
            "reaching into them were not checked — fix the comment or brace errors first."
        )

    print(f"Checked {len(kotlin_files)} Kotlin files under {os.path.relpath(android_dir, root)}")

    if warnings:
        # Printed, but deliberately not fatal: these come from a heuristic that
        # segments members by line, and a check that can be wrong must not be able
        # to fail a build. Read them; do not trust them blindly.
        print(f"\n{len(warnings)} suspicious pattern(s), not fatal:\n")
        for warning in warnings:
            print("  ? " + warning)

    if errors:
        print(f"\n{len(errors)} problem(s):\n")
        for error in errors:
            print("  - " + error)
        print(
            "\nNone of these need a compiler to find. Most of them stop the build; an "
            "unbraced interpolation does not — it compiles cleanly and renders the "
            "wrong string, which is the worse of the two."
        )
        return 1

    print("Comments, braces, resources, assets and internal imports are consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
