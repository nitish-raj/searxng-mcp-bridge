#!/usr/bin/env node

/**
 * This script helps with version management and release preparation.
 * Usage: node scripts/release.js [major|minor|patch]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Determine version bump type
const bumpType = process.argv[2] || 'patch';
if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Invalid version bump type. Use: major, minor, or patch');
  process.exit(1);
}

try {
  // Ensure working directory is clean
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim() !== '') {
      console.error('Working directory is not clean. Commit or stash changes first.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to check git status:', error.message);
    process.exit(1);
  }

  // Bump version in package.json
  console.log(`Bumping ${bumpType} version...`);
  execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });

  // Read the new version
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const newVersion = packageJson.version;
  console.log(`New version: ${newVersion}`);

  // Update CHANGELOG.md
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Find the [Unreleased] section and extract its content
  const unreleasedHeader = '## [Unreleased]';
  const unreleasedHeaderIndex = changelog.indexOf(unreleasedHeader);
  if (unreleasedHeaderIndex === -1) {
    console.error('Could not find "## [Unreleased]" section in CHANGELOG.md');
    process.exit(1);
  }

  // Find the start of the next release section (or end of file) to determine the end of the unreleased content
  const nextReleaseHeaderIndex = changelog.indexOf('\n## [', unreleasedHeaderIndex + unreleasedHeader.length);
  const endOfUnreleasedSection = nextReleaseHeaderIndex === -1 ? changelog.length : nextReleaseHeaderIndex;

  // Extract the content under [Unreleased]
  const unreleasedContent = changelog.substring(unreleasedHeaderIndex + unreleasedHeader.length, endOfUnreleasedSection).trim();

  // Prepare the new version section with the extracted content
  const newVersionSection = `## [${newVersion}] - ${today}\n\n${unreleasedContent}`;

  // Prepare the new empty [Unreleased] section template
  const newUnreleasedSectionTemplate = `## [Unreleased]\n\n### Added\n\n### Changed\n\n### Fixed`;

  // Replace the old [Unreleased] section and its content with the new template followed by the new version section
  changelog = changelog.substring(0, unreleasedHeaderIndex) +
              newUnreleasedSectionTemplate + '\n\n' +
              newVersionSection +
              changelog.substring(endOfUnreleasedSection);
  
  fs.writeFileSync(changelogPath, changelog);
  console.log('Updated CHANGELOG.md');

  // Stage changes
  execSync('git add package.json package-lock.json CHANGELOG.md', { stdio: 'inherit' });
  
  // Commit changes
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
  
  // Create tag
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });
  
  console.log(`\nVersion ${newVersion} prepared!`);
  console.log('\nNext steps:');
  console.log('1. Review the changes');
  console.log('2. Push the commit: git push');
  console.log('3. Push the tag: git push --tags');
  console.log('4. Create a release on GitHub with tag v' + newVersion);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}