#!/usr/bin/env python3
"""
rebrand.py — Rebrand RustAcademy → Stellar Foundry (stellar-foundry)

Walks every file in the repository, replaces text based on case-preserved
patterns, renames matching files/folders bottom-up, and prints the git
commands needed to finalize the rebrand.

Usage:
    python3 rebrand.py          # dry-run (--check)
    python3 rebrand.py --apply  # apply changes
"""

import os
import sys
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent

# Directories to skip entirely (not walked)
EXCLUDE_DIRS: set[str] = {
    ".git",
    "node_modules",
    ".turbo",
    "target",          # Rust build artifacts
    "dist",
    ".next",
    "__pycache__",
    ".pytest_cache",
    "coverage",
    ".expo",
    "ios",
    "android",
}

# Specific files to skip (content changes, but still may be renamed)
EXCLUDE_FILES: set[str] = {
    "rebrand.py",
    "pnpm-lock.yaml",
    "package-lock.json",
    "Cargo.lock",
    "yarn.lock",
}

# Binary / non-text extensions (skip content replacement, rename only)
BINARY_EXTENSIONS: set[str] = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".webm", ".ogg", ".wav",
    ".pdf", ".zip", ".tar", ".gz", ".bz2", ".7z",
    ".wasm", ".bin", ".exe", ".dll", ".so", ".dylib",
    ".db", ".sqlite", ".sqlite3",
}

# ---------------------------------------------------------------------------
# Replacement rules
#
# ORDER IS CRITICAL: most-specific first so narrower patterns aren't
# partially consumed by broader ones.
# ---------------------------------------------------------------------------

REPLACEMENTS: list[tuple[str, str]] = [
    # Title Case (space-separated) — docs, readmes, UI text
    ("Rust Academy",   "Stellar Foundry"),

    # PascalCase with underscore separator
    ("Rust_Academy",   "StellarFoundry"),

    # PascalCase — structs, classes, component names
    ("RustAcademy",    "StellarFoundry"),

    # snake_case — functions, variables, file names
    ("rust_academy",   "stellar_foundry"),

    # UPPER_SNAKE_CASE — constants, env vars
    ("RUSTACADEMY",    "STELLAR_FOUNDRY"),

    # lowercase kebab-case — URLs, packages, folder names, deps
    ("rustacademy",    "stellar-foundry"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def is_text_file(filepath: Path) -> bool:
    """Return False for known binary types; True for likely text."""
    if filepath.suffix.lower() in BINARY_EXTENSIONS:
        return False
    try:
        with open(filepath, "r", encoding="utf-8") as fh:
            chunk = fh.read(2048)
            if "\0" in chunk:
                return False
    except (UnicodeDecodeError, IOError):
        return False
    return True


def should_skip_path(path: Path) -> bool:
    """True if this path (file or dir) should be fully excluded."""
    try:
        rel = path.relative_to(ROOT)
    except ValueError:
        rel = path
    for part in rel.parts:
        if part in EXCLUDE_DIRS:
            return True
    if path.is_file() and path.name in EXCLUDE_FILES:
        return True
    return False


def replace_in_content(text: str) -> str:
    """Apply all replacement rules to a string (file content)."""
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    return text


def replace_in_name(name: str) -> str:
    """Apply all replacement rules to a file/directory name."""
    for old, new in REPLACEMENTS:
        name = name.replace(old, new)
    return name


# ---------------------------------------------------------------------------
# Phase 1 — Content replacement
# ---------------------------------------------------------------------------

def collect_text_files(root: Path) -> list[Path]:
    """Walk the tree and return all text files needing processing."""
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dirpath = Path(dirpath)

        # Prune excluded directories in-place
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fname in filenames:
            fpath = dirpath / fname
            if should_skip_path(fpath):
                continue
            if not is_text_file(fpath):
                continue
            files.append(fpath)
    return files


def apply_content_replacements(files: list[Path], dry_run: bool) -> tuple[int, int]:
    """Replace text in files. Returns (changed_count, error_count)."""
    changed = 0
    errors = 0

    for fpath in sorted(files):
        try:
            original = fpath.read_text(encoding="utf-8")
            updated = replace_in_content(original)
            if updated != original:
                if not dry_run:
                    fpath.write_text(updated, encoding="utf-8")
                changed += 1
                rel = fpath.relative_to(ROOT)
                if dry_run:
                    print(f"  [WOULD MODIFY] {rel}")
                else:
                    print(f"  [MODIFIED] {rel}")
        except Exception as e:
            errors += 1
            print(f"  [ERROR] {fpath}: {e}", file=sys.stderr)

    return changed, errors


# ---------------------------------------------------------------------------
# Phase 2 — File / directory renaming
# ---------------------------------------------------------------------------

def collect_rename_targets(root: Path) -> list[Path]:
    """Collect files and dirs whose names would change, sorted bottom-up."""
    items: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dirpath = Path(dirpath)

        # Prune excluded directories in-place
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for fname in filenames:
            fpath = dirpath / fname
            if should_skip_path(fpath):
                continue
            if replace_in_name(fname) != fname:
                items.append(fpath)

        for dname in dirnames:
            dpath = dirpath / dname
            if replace_in_name(dname) != dname:
                items.append(dpath)

    # Deepest first so parent dirs are renamed after children
    items.sort(key=lambda p: len(p.parts), reverse=True)
    return items


def apply_renames(items: list[Path], dry_run: bool) -> tuple[int, int]:
    """Rename files/dirs bottom-up. Returns (renamed_count, blocked_count)."""
    renamed = 0
    blocked = 0

    for old_path in items:
        new_name = replace_in_name(old_path.name)
        if new_name == old_path.name:
            continue

        new_path = old_path.parent / new_name

        if new_path.exists():
            blocked += 1
            print(f"  [BLOCKED] Target exists: {old_path} → {new_path}",
                  file=sys.stderr)
            continue

        try:
            rel_old = old_path.relative_to(ROOT)
            rel_new = new_path.relative_to(ROOT)
        except ValueError:
            rel_old = str(old_path)
            rel_new = str(new_path)

        if dry_run:
            print(f"  [WOULD RENAME] {rel_old}  →  {rel_new}")
        else:
            old_path.rename(new_path)
            print(f"  [RENAMED] {rel_old}  →  {rel_new}")

        renamed += 1

    return renamed, blocked


# ---------------------------------------------------------------------------
# Phase 3 — Git instructions
# ---------------------------------------------------------------------------

GIT_INSTRUCTIONS = r"""
============================================================
  NEXT STEPS — Run these commands in your terminal:
============================================================

  # 1. Set the new remote origin:
  git remote set-url origin https://github.com/stellar-network-studio/stellar-foundry.git

  # 2. Stage all changes (including renames):
  git add -A

  # 3. Commit the rebranding:
  git commit -m "chore:Stellar Foundry initial commit"

  # 4. Push to the new remote:
  git push -u origin main

============================================================
"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Rebrand RustAcademy → Stellar Foundry (stellar-foundry)"
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="Actually apply changes. Without this flag, runs in dry-run mode."
    )
    parser.add_argument(
        "--yes", action="store_true",
        help="Skip confirmation prompt when using --apply."
    )
    args = parser.parse_args()

    dry_run = not args.apply

    if not dry_run and not args.yes:
        print("⚠️  This will modify files across the entire repository.")
        print(f"   Root: {ROOT}")
        response = input("   Type 'yes' to confirm: ")
        if response.strip().lower() != "yes":
            print("   Aborted.")
            sys.exit(0)
        print()
    mode = "DRY-RUN (--apply to commit changes)" if dry_run else "APPLYING CHANGES"

    print("=" * 60)
    print("  REBRAND: RustAcademy → Stellar Foundry (stellar-foundry)")
    print(f"  Root : {ROOT}")
    print(f"  Mode : {mode}")
    print("=" * 60)
    print()

    # ---- Phase 1: Content ----
    print("Phase 1 — Replacing text in file contents …")
    print("-" * 40)
    files = collect_text_files(ROOT)
    print(f"  Found {len(files)} text files to scan.\n")
    changed, errors = apply_content_replacements(files, dry_run)
    print(f"\n  ✅ Files modified: {changed}")
    if errors:
        print(f"  ⚠️  Errors: {errors}")
    print()

    # ---- Phase 2: Rename ----
    print("Phase 2 — Renaming files & directories …")
    print("-" * 40)
    targets = collect_rename_targets(ROOT)
    print(f"  Found {len(targets)} items to rename.\n")
    renamed, blocked = apply_renames(targets, dry_run)
    if renamed == 0 and len(targets) > 0:
        print("  (All targets already have correct names, or were blocked)")
    print(f"\n  ✅ Items renamed: {renamed}")
    if blocked:
        print(f"  ⚠️  Blocked (target exists): {blocked}")
    print()

    # ---- Phase 3: Git instructions ----
    print(GIT_INSTRUCTIONS)

    summary = "DRY RUN COMPLETE" if dry_run else "REBRAND COMPLETE"
    rename_msg = f"{renamed} items renamed"
    if dry_run:
        rename_msg = f"{renamed + blocked} items would be renamed"
    print(f"  {summary} — {changed} files changed, {rename_msg}")
    print("=" * 60)


if __name__ == "__main__":
    main()
