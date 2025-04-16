#!/usr/bin/env node

/**
 * This script helps with version management and release preparation.
 * Usage: node scripts/release.js [major|minor|patch]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

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

  console.log(`Bumping ${bumpType} version...`);
  execSync(`npm version ${bumpType} --no-git-tag-version`, { stdio: 'inherit' });

  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const newVersion = packageJson.version;
  console.log(`New version: ${newVersion}`);

  // Update CHANGELOG.md using conventional-changelog and insert correctly
  console.log('Generating changelog content using conventional-changelog...');
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  let newChangelogContent = '';
  try {
    // Generate only the latest release content to stdout
    // Use -r 1 to generate only the latest tag's content
    newChangelogContent = execSync(`npx conventional-changelog -p angular -r 1 -t v`, { cwd: rootDir, encoding: 'utf8' });
    console.log('Successfully generated changelog content.');
  } catch (error) {
    console.error('Failed to generate changelog content using conventional-changelog:', error.message);
    console.error('Make sure conventional-changelog-cli is installed (npm install --save-dev conventional-changelog-cli)');
    // Exit if generation fails
    process.exit(1);
  }

  let existingChangelog = fs.readFileSync(changelogPath, 'utf8');
  
  // Find the insertion point after the '## [Unreleased]' header
  const unreleasedHeader = '## [Unreleased]';
  const insertionPointIndex = existingChangelog.indexOf(unreleasedHeader);
  
  if (insertionPointIndex === -1) {
    console.error('Could not find "## [Unreleased]" section header in CHANGELOG.md');
    process.exit(1);
  }
  
  const endOfUnreleasedHeaderLine = existingChangelog.indexOf('\n', insertionPointIndex) + 1;

  // Insert the generated content after the '[Unreleased]' header line
  const updatedChangelog =
    existingChangelog.substring(0, endOfUnreleasedHeaderLine) +
    '\n' +
    newChangelogContent.trim() + '\n' +
    existingChangelog.substring(endOfUnreleasedHeaderLine);

  fs.writeFileSync(changelogPath, updatedChangelog);
  console.log('Updated CHANGELOG.md with new release section.');

  execSync('git add package.json package-lock.json CHANGELOG.md', { cwd: rootDir, stdio: 'inherit' });
  
  execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
  
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