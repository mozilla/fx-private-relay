#!/usr/bin/env python3
"""BLEnder automerge-dependabot: auto-merge "safe" Dependabot PRs:

  1. Author is dependabot[bot]
  2. All CI checks pass
  3. Update is patch or minor (not major)
  4. Compatibility score >= 80%
  5. No security advisories on the new version

Environment variables:
  REPO      -- GitHub repo, e.g. mozilla/fx-private-relay (required)
  GH_TOKEN  -- GitHub token with contents:write and pull-requests:write (required)
  DRY_RUN   -- Set to "true" to check gates without approving or merging (default: true)
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass, field
from urllib.request import Request, urlopen

import yaml
from github import Auth, Github
from github.PullRequest import PullRequest
from github.Repository import Repository
from packaging.specifiers import InvalidSpecifier, SpecifierSet
from packaging.version import InvalidVersion, Version


class SkipPR(Exception):
    """Raised when a gate fails. Message becomes the skip reason."""


class RetryPR(SkipPR):
    """Score-related skip that may resolve on a future run."""


@dataclass
class DependencyUpdate:
    """Structured metadata from Dependabot's commit message YAML."""

    name: str
    version: str  # new version
    dependency_type: str  # direct:production, direct:development, indirect
    update_type: str  # version-update:semver-major, etc.
    group: str = ""
    old_version: str = ""


@dataclass
class PRMetadata:
    """Parsed metadata for a Dependabot PR."""

    dependencies: list[DependencyUpdate] = field(default_factory=list)
    ecosystem: str = "unknown"
    raw_ecosystem: str = ""  # original ecosystem from branch name
    has_major: bool = False
    old_version: str = ""  # first dependency only, from commit title
    new_version: str = ""  # first dependency only, from YAML


@dataclass
class Config:
    repo_name: str
    token: str
    dry_run: bool


# --- Metadata extraction ---

ECOSYSTEM_MAP = {
    "npm_and_yarn": "npm",
    "pip": "pip",
    "github_actions": "actions",
    "docker": "docker",
    "bundler": "rubygems",
    "cargo": "crates.io",
    "gomod": "go",
    "composer": "packagist",
    "nuget": "nuget",
}

VERSION_FROM_TITLE_RE = re.compile(
    r"[Ff]rom\s+(?P<old_version>\d[\w.\-]*)\s+[Tt]o\s+(?P<new_version>\d[\w.\-]*)"
)
# Group PR commit bodies: "Updates `name` from X to Y"
GROUP_VERSION_RE = re.compile(
    r"Updates\s+`(?P<name>[^`]+)`\s+from\s+(?P<old_version>\d[\w.\-]*)\s+to\s+(?P<new_version>\d[\w.\-]*)"
)


def semver_major(version: str) -> int | None:
    m = re.match(r"^(\d+)", version)
    return int(m.group(1)) if m else None


def semver_minor(version: str) -> int | None:
    m = re.match(r"^\d+\.(\d+)", version)
    return int(m.group(1)) if m else None


def compute_update_type(old: str, new: str) -> str:
    """Infer semver update type from two version strings."""
    old_major = semver_major(old)
    new_major = semver_major(new)
    if old_major is not None and new_major is not None:
        if new_major > old_major:
            return "version-update:semver-major"
        old_minor = semver_minor(old)
        new_minor = semver_minor(new)
        if old_minor is not None and new_minor is not None and new_minor > old_minor:
            return "version-update:semver-minor"
    return "version-update:semver-patch"


def parse_dependabot_yaml(
    commit_message: str,
) -> list[DependencyUpdate]:
    """Extract structured dependency info from Dependabot's commit YAML.
    The YAML block is between --- and ...
    """
    match = re.search(
        r"^---\s*\n(.*?)\n\.\.\.\s*$",
        commit_message,
        re.MULTILINE | re.DOTALL,
    )
    if not match:
        return []

    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return []

    if not isinstance(data, dict):
        return []

    deps = data.get("updated-dependencies", [])
    if not isinstance(deps, list):
        return []

    results: list[DependencyUpdate] = []
    for dep in deps:
        if not isinstance(dep, dict):
            continue
        results.append(
            DependencyUpdate(
                name=dep.get("dependency-name", ""),
                version=dep.get("dependency-version", ""),
                dependency_type=dep.get("dependency-type", ""),
                update_type=dep.get("update-type", ""),
                group=dep.get("dependency-group", ""),
            )
        )
    return results


def extract_metadata(pr: PullRequest) -> PRMetadata:
    """Build PRMetadata from commit YAML and branch name."""
    meta = PRMetadata()

    # Ecosystem from branch name: dependabot/<ecosystem>/<package>
    parts = pr.head.ref.split("/")
    if len(parts) >= 2 and parts[0] == "dependabot":
        meta.raw_ecosystem = parts[1]
        meta.ecosystem = ECOSYSTEM_MAP.get(parts[1], "unknown")

    # Parse YAML from first commit message
    commits = pr.get_commits()
    if commits.totalCount > 0:
        message = commits[0].commit.message
        meta.dependencies = parse_dependabot_yaml(message)

        # Old version from commit title (not in YAML)
        version_match = VERSION_FROM_TITLE_RE.search(message)
        if version_match:
            meta.old_version = version_match.group("old_version")

        # Per-dependency old versions from group PR commit body
        dep_by_name = {d.name: d for d in meta.dependencies}
        for match in GROUP_VERSION_RE.finditer(message):
            name = match.group("name")
            old_ver = match.group("old_version")
            new_ver = match.group("new_version")
            if name in dep_by_name:
                dep_by_name[name].old_version = old_ver
                # Fill version if YAML didn't have it
                if not dep_by_name[name].version:
                    dep_by_name[name].version = new_ver

    # Fill in missing update_type from version comparison
    for dep in meta.dependencies:
        old = dep.old_version or meta.old_version
        if not dep.update_type and dep.version and old:
            dep.update_type = compute_update_type(old, dep.version)

    # Derive new version and major-bump flag
    for dep in meta.dependencies:
        if dep.update_type == "version-update:semver-major":
            meta.has_major = True
        if not meta.new_version and dep.version:
            meta.new_version = dep.version

    return meta


# --- Compatibility badge (no structured API exists) ---

BADGE_URL_RE = re.compile(
    r"(https://dependabot-badges\.githubapp\.com"
    r"/badges/compatibility_score[^\s)\"'>]*)"
)
COMPAT_SCORE_RE = re.compile(r'aria-label="compatibility:\s*(?P<score>\d+)%')
COMPAT_UNKNOWN_RE = re.compile(r'aria-label="compatibility:\s*unknown')


def fetch_badge_svg(url: str) -> str | None:
    if not url.startswith("https://"):
        return None
    try:
        headers = {"User-Agent": "BLEnder-automerge/1.0"}
        req = Request(url, headers=headers)  # noqa: S310
        with urlopen(req, timeout=10) as resp:  # noqa: S310
            result: str = resp.read().decode("utf-8", errors="replace")
            return result
    except Exception:
        return None


# --- Version range checking for advisories ---


def normalize_range(range_str: str) -> str:
    """Normalize advisory version ranges to PEP 440 specifiers.

    GitHub advisories use "= X.Y.Z" (single equals) which is not
    valid PEP 440. Convert to "== X.Y.Z".
    """
    # "= 4.5.0" -> "== 4.5.0", but leave ">= 4.5.0" and "<= 4.5.0" alone
    return re.sub(r"(?<![<>!~])=\s+", "== ", range_str)


def version_in_range(version_str: str, range_str: str) -> bool:
    """Check if a version falls within a vulnerability range.

    Returns True if the version IS vulnerable (in range), or if
    parsing fails (safe default: assume vulnerable).
    """
    try:
        ver = Version(version_str)
        spec = SpecifierSet(normalize_range(range_str))
        return ver in spec
    except (InvalidVersion, InvalidSpecifier):
        return True


# --- Safety gates ---
# Each gate raises SkipPR on failure.


def gate_author(pr: PullRequest) -> None:
    """Gate 1: Author must be dependabot[bot]."""
    if pr.user.login != "dependabot[bot]":
        raise SkipPR(f"author is {pr.user.login}, not dependabot[bot]")


def gate_ci(repo: Repository, sha: str) -> None:
    """Gate 2: All CI checks must pass."""
    commit = repo.get_commit(sha)

    failing = 0
    pending = 0
    for check in commit.get_check_runs():
        if check.status != "completed":
            pending += 1
        elif check.conclusion not in (
            "success",
            "skipped",
            "neutral",
        ):
            failing += 1

    combined_status = commit.get_combined_status()
    for status in combined_status.statuses:
        if status.state in ("failure", "error"):
            failing += 1
        elif status.state == "pending":
            pending += 1

    if failing > 0:
        raise SkipPR(f"CI has {failing} failure(s)")
    if pending > 0:
        raise SkipPR(f"CI has {pending} pending check(s)")

    print("  CI: all checks passed")


def gate_versions(meta: PRMetadata) -> None:
    """Gate 3: No major version bumps."""
    if not meta.dependencies:
        print("  Versions: no metadata found, treating as patch/minor")
        return

    if meta.has_major:
        for dep in meta.dependencies:
            if dep.update_type == "version-update:semver-major":
                raise SkipPR(f"major version bump on {dep.name}")
        raise SkipPR("major version bump detected")

    if len(meta.dependencies) == 1:
        dep = meta.dependencies[0]
        label = meta.old_version or "?"
        print(f"  Versions: {label} -> {dep.version} (patch/minor)")
    else:
        print(
            f"  Versions: group update, "
            f"{len(meta.dependencies)} dependencies (no major bumps)"
        )


def build_badge_url(dep: DependencyUpdate, raw_ecosystem: str) -> str | None:
    """Construct a compatibility badge URL for a single dependency."""
    old = dep.old_version
    new = dep.version
    if not (dep.name and old and new and raw_ecosystem):
        return None
    return (
        "https://dependabot-badges.githubapp.com/badges/compatibility_score"
        f"?dependency-name={dep.name}"
        f"&package-manager={raw_ecosystem}"
        f"&previous-version={old}"
        f"&new-version={new}"
    )


def _is_patch_or_minor(old_version: str, new_version: str) -> bool:
    """Return True if the bump is patch or minor (not major)."""
    old_major = semver_major(old_version)
    new_major = semver_major(new_version)
    if old_major is not None and new_major is not None and new_major > old_major:
        return False
    return True


def _check_badge_svg(
    badge_svg: str, old_version: str, new_version: str, label: str
) -> int | None:
    """Parse a badge SVG and return score, None for unknown-ok, or raise."""
    if COMPAT_UNKNOWN_RE.search(badge_svg):
        if old_version and new_version and _is_patch_or_minor(old_version, new_version):
            print(f"  Compatibility: unknown ({label} patch/minor bump, proceeding)")
            return None
        raise RetryPR("compatibility score is unknown")

    score_match = COMPAT_SCORE_RE.search(badge_svg)
    if not score_match:
        raise RetryPR("could not parse compatibility score from badge")

    score = int(score_match.group("score"))
    if score < 80:
        raise RetryPR(f"compatibility score {score}% < 80%")

    return score


def gate_compatibility(pr: PullRequest, meta: PRMetadata) -> int | None:
    """Gate 4: Compatibility score >= 80%."""
    # Try badge URL from PR body (single-dep PRs)
    body = pr.body or ""
    badge_match = BADGE_URL_RE.search(body)

    if badge_match:
        badge_svg = fetch_badge_svg(badge_match.group(1))
        if not badge_svg:
            raise RetryPR("could not fetch compatibility badge")
        score = _check_badge_svg(badge_svg, meta.old_version, meta.new_version, "")
        if score is not None:
            print(f"  Compatibility: {score}%")
        return score

    # No badge in body -- try per-dep badge URLs (group PRs)
    deps_with_old = [d for d in meta.dependencies if d.old_version and d.version]
    if not deps_with_old:
        raise RetryPR("no compatibility badge found in PR body")

    min_score: int | None = None
    all_unknown = True

    for dep in deps_with_old:
        url = build_badge_url(dep, meta.raw_ecosystem)
        if not url:
            continue
        badge_svg = fetch_badge_svg(url)
        if not badge_svg:
            raise RetryPR(f"could not fetch compatibility badge for {dep.name}")

        old = dep.old_version
        new = dep.version

        if COMPAT_UNKNOWN_RE.search(badge_svg):
            if old and new and _is_patch_or_minor(old, new):
                print(
                    f"  Compatibility ({dep.name}): "
                    f"unknown (patch/minor bump, proceeding)"
                )
                continue
            raise RetryPR(f"compatibility score is unknown for {dep.name}")

        all_unknown = False
        score_match = COMPAT_SCORE_RE.search(badge_svg)
        if not score_match:
            raise RetryPR(f"could not parse compatibility score for {dep.name}")

        score = int(score_match.group("score"))
        print(f"  Compatibility ({dep.name}): {score}%")
        if score < 80:
            raise RetryPR(f"compatibility score {score}% < 80% for {dep.name}")
        if min_score is None or score < min_score:
            min_score = score

    if all_unknown:
        print("  Compatibility: all unknown (patch/minor bumps, proceeding)")
        return None

    if min_score is not None:
        print(f"  Compatibility (group min): {min_score}%")
    return min_score


def gate_advisories(gh: Github, meta: PRMetadata) -> None:
    """Gate 5: No security advisories affecting the new version."""
    if meta.ecosystem in ("unknown", "actions"):
        print("  Advisories: skipped check (unknown ecosystem or actions)")
        return

    deps_to_check = [d for d in meta.dependencies if d.name and d.version]
    if not deps_to_check:
        print("  Advisories: skipped check (no dependency metadata)")
        return

    for dep in deps_to_check:
        print(
            f"  Advisories: checking {dep.name}@{dep.version} "
            f"(ecosystem={meta.ecosystem})"
        )
        advisories = list(
            gh.get_global_advisories(
                ecosystem=meta.ecosystem,
                affects=dep.name,
                type="reviewed",
            )
        )
        print(
            f"  Advisories: found {len(advisories)} total advisory(ies) for {dep.name}"
        )

        # Filter to advisories where the NEW version is in a vulnerable range.
        # An advisory can span multiple packages (e.g. cryptography + openssl-src),
        # so filter to vulnerabilities for this specific package.
        affecting = []
        for a in advisories:
            for v in a.vulnerabilities:
                if not v.vulnerable_version_range:
                    continue
                if v.package.name != dep.name:
                    continue
                in_range = version_in_range(dep.version, v.vulnerable_version_range)
                print(
                    f"    {a.ghsa_id}: range {v.vulnerable_version_range!r} "
                    f"-> {dep.version} in range: {in_range}"
                )
                if in_range:
                    affecting.append(a.ghsa_id)

        if affecting:
            raise SkipPR(
                f"{len(affecting)} security advisory(ies) affect "
                f"{dep.name}@{dep.version}: {', '.join(affecting)}"
            )

    names = ", ".join(d.name for d in deps_to_check)
    print(f"  Advisories: none found affecting {names}")


# --- Merge action ---


def approve_and_merge(pr: PullRequest, compat_score: int | None) -> None:
    """Approve the PR and tell Dependabot to merge it."""
    compat_display = f"{compat_score}%" if compat_score is not None else "unknown"
    pr.create_review(
        event="APPROVE",
        body=(
            "BLEnder auto-merge: all safety gates passed "
            f"(CI green, patch/minor, compat {compat_display}, "
            "no advisories)."
        ),
    )
    pr.create_issue_comment("@dependabot merge")


# --- Main ---


def load_config() -> Config:
    repo = os.environ.get("REPO", "")
    token = os.environ.get("GH_TOKEN", "")
    dry_run = os.environ.get("DRY_RUN", "true").lower() in (
        "true",
        "1",
        "yes",
    )

    if not repo:
        print("Error: REPO is required.")
        sys.exit(1)
    if not token:
        print("Error: GH_TOKEN is required.")
        sys.exit(1)

    return Config(repo_name=repo, token=token, dry_run=dry_run)


def process_pr(
    config: Config,
    gh: Github,
    repo: Repository,
    pr: PullRequest,
) -> bool:
    """Run all gates on a PR. Returns True if merged/would-merge."""
    print(f"\n--- PR #{pr.number}: {pr.title} ---")

    gate_author(pr)

    meta = extract_metadata(pr)

    gate_versions(meta)
    compat_score = gate_compatibility(pr, meta)
    gate_ci(repo, pr.head.sha)
    gate_advisories(gh, meta)

    if config.dry_run:
        print("  All gates passed. DRY_RUN=true -- would approve and merge.")
    else:
        print("  All gates passed. Approving and merging...")
        approve_and_merge(pr, compat_score)
        print("  Queued for auto-merge.")

    return True


def main() -> None:
    config = load_config()
    print(
        f"BLEnder automerge-dependabot: "
        f"repo={config.repo_name} dry_run={config.dry_run}"
    )

    gh = Github(auth=Auth.Token(config.token))
    repo = gh.get_repo(config.repo_name)

    print(f"Fetching open Dependabot PRs for {config.repo_name}...")
    all_prs = repo.get_pulls(state="open")
    prs = [pr for pr in all_prs if pr.user.login == "dependabot[bot]"]

    print(f"Found {len(prs)} open Dependabot PRs.")
    if not prs:
        print("Nothing to do.")
        return

    merged = 0
    skipped = 0
    skip_reasons: list[str] = []
    retry_comment = "BLEnder: skipped ({reason}). Will retry on next scheduled run."

    for pr in prs:
        try:
            if process_pr(config, gh, repo, pr):
                merged += 1
        except SkipPR as e:
            is_retry = isinstance(e, RetryPR)
            tag = "[retry] " if is_retry else ""
            print(f"  SKIP: {tag}{e}")
            skipped += 1
            parts = pr.head.ref.split("/")
            pkg = "/".join(parts[2:]) if len(parts) > 2 else pr.head.ref
            skip_reasons.append(f"#{pr.number} ({pkg}): {tag}{e}")

            if is_retry:
                comment_body = retry_comment.format(reason=e)
                if config.dry_run:
                    print(f"  DRY_RUN: would comment: {comment_body}")
                else:
                    # Avoid duplicate retry comments
                    already_commented = any(
                        c.body.startswith("BLEnder: skipped")
                        for c in pr.get_issue_comments()
                        if c.user.login == "github-actions[bot]"
                        or c.user.login == gh.get_user().login
                    )
                    if not already_commented:
                        pr.create_issue_comment(comment_body)
                        print(f"  Posted retry comment on PR #{pr.number}")
                    else:
                        print(f"  Retry comment already exists on PR #{pr.number}")

    # Summary
    print("\n=== Summary ===")
    label = "Would merge" if config.dry_run else "Merged"
    print(f"{label}: {merged}")
    print(f"Skipped: {skipped}")
    if skip_reasons:
        print("\nSkip reasons:")
        for reason in skip_reasons:
            print(f"  - {reason}")


if __name__ == "__main__":
    main()
