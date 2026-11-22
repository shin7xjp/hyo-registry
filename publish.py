
#!/usr/bin/env python3

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tarfile
import tempfile

from pathlib import Path
from urllib.parse import quote


REPOSITORY = "shin7xjp/hyo-registry"
REGISTRY_FILE = "index.json"

SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$"
)


def execute(command, check=True, capture=False):
    return subprocess.run(
        command,
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None
    )


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)

    return digest.hexdigest()


def load_registry(path):
    if not path.exists():
        return {
            "registryVersion": 1,
            "packages": {}
        }

    with path.open("r", encoding="utf-8") as file:
        registry = json.load(file)

    if registry.get("registryVersion") != 1:
        raise ValueError("Unsupported registry version")

    if not isinstance(registry.get("packages"), dict):
        raise ValueError("Invalid registry packages object")

    return registry


def discover_packages(source):
    if not source.is_dir():
        raise ValueError(f"Package directory not found: {source}")

    packages = []

    for directory in sorted(source.iterdir()):
        if not directory.is_dir():
            continue

        manifest_path = directory / "package.json"

        if not manifest_path.is_file():
            print(f"Skipping {directory.name}: package.json missing")
            continue

        with manifest_path.open("r", encoding="utf-8") as file:
            manifest = json.load(file)

        name = manifest.get("name")
        version = manifest.get("version")
        entrypoint = manifest.get("entrypoint")

        if not isinstance(name, str) or not name:
            raise ValueError(f"Invalid package name: {directory}")

        if name != directory.name:
            raise ValueError(
                f"Directory {directory.name} does not match package name {name}"
            )

        if not isinstance(version, str) or not SEMVER.fullmatch(version):
            raise ValueError(f"Invalid version for {name}: {version}")

        if not isinstance(entrypoint, str) or not entrypoint:
            raise ValueError(f"Missing entrypoint for {name}")

        entrypoint_path = (directory / entrypoint).resolve()

        if not entrypoint_path.is_relative_to(directory.resolve()):
            raise ValueError(f"Invalid entrypoint path for {name}")

        if not entrypoint_path.is_file():
            raise ValueError(
                f"Entrypoint {entrypoint} does not exist in {name}"
            )

        dependencies = manifest.get("dependencies", {})
        permissions = manifest.get("permissions", [])

        if not isinstance(dependencies, dict):
            raise ValueError(f"Invalid dependencies in {name}")

        if not isinstance(permissions, list):
            raise ValueError(f"Invalid permissions in {name}")

        packages.append({
            "directory": directory,
            "manifest": manifest,
            "name": name,
            "version": version
        })

    if not packages:
        raise ValueError("No valid packages found")

    return packages


def create_archive(package, output_directory):
    name = package["name"]
    version = package["version"]

    filename = f"{name}-{version}.tar.gz"
    archive_path = output_directory / filename

    with tarfile.open(archive_path, "w:gz") as archive:
        archive.add(
            package["directory"],
            arcname=name,
            recursive=True
        )

    return archive_path


def release_exists(tag):
    result = execute(
        [
            "gh", "release", "view", tag,
            "--repo", REPOSITORY,
            "--json", "assets",
            "--jq", ".assets[].name"
        ],
        check=False,
        capture=True
    )

    if result.returncode != 0:
        return False

    return result.stdout.splitlines()


def publish_release(package, archive, checksum, temp_directory):
    name = package["name"]
    version = package["version"]

    tag = f"{name}-v{version}"

    existing_assets = release_exists(tag)

    if existing_assets is not False:
        if archive.name not in existing_assets:
            raise RuntimeError(
                f"Release {tag} exists but its package archive is missing"
            )

        download_dir = temp_directory / f"verify-{name}"
        download_dir.mkdir()

        execute([
            "gh", "release", "download", tag,
            "--repo", REPOSITORY,
            "--pattern", archive.name,
            "--dir", str(download_dir)
        ])

        existing_archive = download_dir / archive.name

        if sha256_file(existing_archive) != checksum:
            raise RuntimeError(
                f"Release {tag} already exists with different contents. "
                "Publish a new package version instead."
            )

        print(f"Already published and verified: {tag}")
        return tag

    execute([
        "gh", "release", "create", tag,
        str(archive),
        "--repo", REPOSITORY,
        "--title", f"{name} {version}",
        "--notes", f"Release of {name} version {version}."
    ])

    print(f"Published: {tag}")

    return tag


def update_registry(registry, package, archive, checksum, tag):
    name = package["name"]
    version = package["version"]
    manifest = package["manifest"]

    url = (
        f"https://github.com/{REPOSITORY}/releases/download/"
        f"{quote(tag, safe='')}/{quote(archive.name, safe='')}"
    )

    package_data = registry["packages"].setdefault(
        name,
        {
            "description": manifest.get("description", ""),
            "versions": {}
        }
    )

    package_data["description"] = manifest.get("description", "")

    package_data["versions"][version] = {
        "url": url,
        "sha256": checksum,
        "entrypoint": manifest["entrypoint"],
        "dependencies": manifest.get("dependencies", {}),
        "permissions": manifest.get("permissions", [])
    }


def main():
    parser = argparse.ArgumentParser(
        description="Publish Hyo packages to the official registry."
    )

    parser.add_argument(
        "packages",
        help="Directory containing Hyo package directories"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and preview without publishing"
    )

    args = parser.parse_args()

    source = Path(args.packages).resolve()

    root = Path(
        execute(
            ["git", "rev-parse", "--show-toplevel"],
            capture=True
        ).stdout.strip()
    )

    registry_path = root / REGISTRY_FILE

    packages = discover_packages(source)
    registry = load_registry(registry_path)

    with tempfile.TemporaryDirectory(prefix="hyo-publish-") as temporary:
        temp_directory = Path(temporary)

        prepared = []

        for package in packages:
            archive = create_archive(package, temp_directory)
            checksum = sha256_file(archive)

            prepared.append((package, archive, checksum))

            print(
                f"{package['name']}@{package['version']} "
                f"SHA256={checksum}"
            )

        if args.dry_run:
            print("\nDry run complete. Nothing was published.")
            return

        execute(["gh", "auth", "status"])

        for package, archive, checksum in prepared:
            tag = publish_release(
                package,
                archive,
                checksum,
                temp_directory
            )

            update_registry(
                registry,
                package,
                archive,
                checksum,
                tag
            )

    with registry_path.open("w", encoding="utf-8") as file:
        json.dump(
            registry,
            file,
            indent=2,
            ensure_ascii=False
        )
        file.write("\n")

    execute(["git", "add", REGISTRY_FILE])

    result = execute(
        [
            "git", "diff", "--cached",
            "--quiet", "--", REGISTRY_FILE
        ],
        check=False
    )

    if result.returncode == 0:
        print("\nRegistry is already up to date.")
        return

    execute([
        "git", "commit", "--only",
        REGISTRY_FILE,
        "-m", "chore(registry): publish package updates"
    ])

    execute(["git", "push", "origin", "HEAD"])

    print("\nHyo registry successfully updated!")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"\nERROR: {error}", file=sys.stderr)
        sys.exit(1)
