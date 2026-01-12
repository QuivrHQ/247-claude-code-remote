import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * All package.json files that need version updates
 */
export const PACKAGE_FILES = [
  'package.json',
  'packages/cli/package.json',
  'packages/shared/package.json',
  'apps/agent/package.json',
  'apps/web/package.json',
  'apps/cloud-agent/package.cloud.json',
  'apps/provisioning/package.json',
];

/**
 * The CLI index.ts file that contains version string
 */
const CLI_INDEX_PATH = 'packages/cli/src/index.ts';

/**
 * Get current version from the last git tag (preferred) or root package.json
 */
export function getCurrentVersion(): string {
  // Try to get version from last git tag first
  try {
    const tag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf-8',
    }).trim();
    if (tag) {
      // Remove 'v' prefix if present
      return tag.replace(/^v/, '');
    }
  } catch {
    // No tags found, fall back to package.json
  }

  // Fallback to package.json
  const rootPkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  return rootPkg.version;
}

/**
 * Update version in all package.json files
 */
export function updatePackageVersions(newVersion: string): string[] {
  const updatedFiles: string[] = [];

  for (const file of PACKAGE_FILES) {
    try {
      const content = readFileSync(file, 'utf-8');
      const pkg = JSON.parse(content);
      pkg.version = newVersion;

      // Preserve formatting with 2-space indent
      writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      updatedFiles.push(file);
    } catch (error) {
      console.error(`Failed to update ${file}:`, error);
    }
  }

  return updatedFiles;
}

/**
 * Update version in CLI index.ts (.version('x.y.z'))
 */
export function updateCliVersionString(newVersion: string): boolean {
  try {
    let content = readFileSync(CLI_INDEX_PATH, 'utf-8');

    // Replace .version('x.y.z') with new version
    const versionRegex = /\.version\(['"][\d.]+['"]\)/;
    if (versionRegex.test(content)) {
      content = content.replace(versionRegex, `.version('${newVersion}')`);
      writeFileSync(CLI_INDEX_PATH, content, 'utf-8');
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Failed to update CLI version string:`, error);
    return false;
  }
}

/**
 * Get all files that will be modified
 */
export function getFilesToUpdate(): string[] {
  return [...PACKAGE_FILES, CLI_INDEX_PATH, 'CHANGELOG.md'];
}
