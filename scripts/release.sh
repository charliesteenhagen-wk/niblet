#!/bin/bash
# Release script for Niblet
# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.3.0

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.3.0"
  exit 1
fi

# Remove 'v' prefix if provided
VERSION="${VERSION#v}"

echo "Releasing version $VERSION..."

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: You have uncommitted changes. Please commit or stash them first."
  exit 1
fi

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"
echo "Updated package.json"

# Update tauri.conf.json
node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8'));
  conf.version = '$VERSION';
  fs.writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
"
echo "Updated tauri.conf.json"

# Update Cargo.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
else
  sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
fi
echo "Updated Cargo.toml"

# Commit, tag, and push
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "Release v$VERSION"
git tag "v$VERSION"
git push
git push origin "v$VERSION"

echo ""
echo "Released v$VERSION!"
echo "GitHub Actions will now build and publish the release."
echo "Watch progress at: https://github.com/csteamengine/niblet/actions"
