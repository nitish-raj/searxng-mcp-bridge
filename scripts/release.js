#!/usr/bin/env node

/**
 * This script helps with version management and release preparation.
 * Usage: node scripts/release.js [major|minor|patch]
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory 
// ame
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

  // Update CHANGELOG.md using conventional-changelog
  console.log('Updating CHANGELOG.md using conventional-changelog...');
  try {
    // Ensure conventional-changelog-cli is accessible (npx handles this if installed locally or globally)
    execSync(`npx conventional-changelog -p angular -i CHANGELOG.md -s -t v`, { cwd: rootDir, stdio: 'inherit' });
    console.log('Successfully updated CHANGELOG.md');
  } catch (error) {
    console.error('Failed to update CHANGELOG.md using conventional-changelog:', error.message);
    console.error('Make sure conventional-changelog-cli is installed (npm install --save-dev conventional-changelog-cli)');
    // Optionally exit, or allow proceeding without automatic changelog update
    // process.exit(1);
  }

  // Stage changes (including the updated CHANGELOG.md)
  execSync('git add package.json package-lock.json CHANGELOG.md', { cwd: rootDir, stdio: 'inherit' });
  
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