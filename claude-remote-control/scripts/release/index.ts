#!/usr/bin/env tsx
import { parseArgs } from 'util';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

import {
  getLastTag,
  getCommitsSince,
  hasUncommittedChanges,
  getCurrentBranch,
  canPushToRemote,
  stageFiles,
  createCommit,
  createTag,
  pushToRemote,
} from './git.js';

import {
  parseConventionalCommit,
  calculateBump,
  incrementVersion,
  isValidVersion,
  ConventionalCommit,
  BumpType,
} from './version.js';

import { generateChangelogEntry, updateChangelog } from './changelog.js';

import {
  getCurrentVersion,
  updatePackageVersions,
  updateCliVersionString,
  getFilesToUpdate,
} from './package-updater.js';

// Parse CLI arguments
const { values: options } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'skip-tests': { type: 'boolean', default: false },
    'no-push': { type: 'boolean', default: false },
    'no-changelog': { type: 'boolean', default: false },
    'force-version': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: false,
});

if (options.help) {
  console.log(`
${chalk.bold('247 Release')} - Automatic semantic versioning

${chalk.bold('Usage:')}
  pnpm release [options]

${chalk.bold('Options:')}
  --dry-run          Show what would happen without making changes
  --skip-tests       Skip running tests before release
  --no-push          Do not push to remote after release
  --no-changelog     Do not generate/update CHANGELOG.md
  --force-version    Force a specific version (e.g., 1.0.0)
  -h, --help         Show this help message

${chalk.bold('Version Bumping:')}
  feat:              Minor bump (0.1.0 -> 0.2.0)
  fix/perf/refactor: Patch bump (0.1.0 -> 0.1.1)
  BREAKING CHANGE:   Major bump (0.1.0 -> 1.0.0)
`);
  process.exit(0);
}

async function main() {
  console.log(chalk.bold('\n247 Release\n'));

  // === Pre-flight checks ===
  const preflight = ora('Running pre-flight checks...').start();

  // Check for uncommitted changes
  const hasUncommitted = hasUncommittedChanges();
  if (hasUncommitted && !options['dry-run']) {
    preflight.fail('You have uncommitted changes. Please commit or stash them first.');
    process.exit(1);
  }

  // Check branch - releases MUST be done from main
  const branch = getCurrentBranch();
  if (branch !== 'main' && branch !== 'master') {
    preflight.fail(`Releases must be done from 'main' branch. Current branch: '${branch}'`);
    process.exit(1);
  }

  if (hasUncommitted) {
    preflight.warn('Pre-flight: uncommitted changes');
  } else {
    preflight.succeed('Pre-flight checks passed');
  }

  // Check remote
  if (!options['no-push'] && !canPushToRemote()) {
    console.log(chalk.yellow('  Warning: Cannot reach git remote. --no-push will be enforced.'));
    options['no-push'] = true;
  }

  // === Run tests ===
  if (!options['skip-tests']) {
    const testSpinner = ora('Running tests...').start();
    try {
      execSync('pnpm test', { stdio: 'pipe', encoding: 'utf-8' });
      testSpinner.succeed('Tests passed');
    } catch (_error) {
      testSpinner.fail('Tests failed. Fix them before releasing.');
      if (!options['dry-run']) {
        process.exit(1);
      }
      console.log(chalk.yellow('  (Continuing anyway because --dry-run is enabled)'));
    }
  } else {
    console.log(chalk.dim('  Skipping tests (--skip-tests)'));
  }

  // === Analyze commits ===
  console.log();
  const lastTag = getLastTag();
  console.log(
    chalk.dim(
      `Analyzing commits since ${lastTag ? chalk.cyan(lastTag) : chalk.yellow('beginning')}...`
    )
  );
  console.log();

  const rawCommits = getCommitsSince(lastTag);
  const commits: ConventionalCommit[] = [];
  const skippedCommits: string[] = [];

  for (const raw of rawCommits) {
    const parsed = parseConventionalCommit(raw.hash, raw.subject, raw.body);
    if (parsed) {
      commits.push(parsed);
    } else {
      skippedCommits.push(raw.subject);
    }
  }

  if (commits.length === 0 && !options['force-version']) {
    console.log(chalk.yellow('No releasable commits found since last tag.'));
    if (skippedCommits.length > 0) {
      console.log(chalk.dim(`\n  Skipped ${skippedCommits.length} non-conventional commits:`));
      for (const msg of skippedCommits.slice(0, 5)) {
        console.log(chalk.dim(`    - ${msg}`));
      }
      if (skippedCommits.length > 5) {
        console.log(chalk.dim(`    ... and ${skippedCommits.length - 5} more`));
      }
    }
    console.log(chalk.dim('\n  Use --force-version to release anyway.\n'));
    process.exit(0);
  }

  // Display found commits
  if (commits.length > 0) {
    console.log(`Found ${chalk.bold(commits.length)} commits:\n`);
    for (const commit of commits) {
      const scope = commit.scope ? chalk.dim(`(${commit.scope})`) : '';
      const breaking = commit.breaking ? chalk.red(' BREAKING') : '';
      console.log(`  ${chalk.cyan(commit.type)}${scope}: ${commit.subject}${breaking}`);
    }

    if (skippedCommits.length > 0) {
      console.log(chalk.dim(`\n  (Skipped ${skippedCommits.length} non-conventional commits)`));
    }
  } else {
    console.log(chalk.dim('No commits to include in changelog.'));
  }

  // === Calculate version ===
  const currentVersion = getCurrentVersion();
  let newVersion: string;
  let bump: BumpType;

  if (options['force-version']) {
    if (!isValidVersion(options['force-version'])) {
      console.log(chalk.red(`\nInvalid version format: ${options['force-version']}`));
      console.log(chalk.dim('  Expected format: X.Y.Z (e.g., 1.2.3)'));
      process.exit(1);
    }
    newVersion = options['force-version'];
    bump = 'patch'; // Just for display
    console.log(chalk.yellow(`\n  Using forced version: ${newVersion}`));
  } else {
    bump = calculateBump(commits);
    newVersion = incrementVersion(currentVersion, bump);
  }

  console.log();
  console.log(
    `Version bump: ${chalk.dim(currentVersion)} ${chalk.bold('->')} ${chalk.green(newVersion)} ${chalk.dim(`(${bump})`)}`
  );
  console.log();

  // === Dry run exit ===
  if (options['dry-run']) {
    console.log(chalk.yellow('Dry run mode - no changes made.\n'));
    console.log(chalk.dim('Files that would be updated:'));
    for (const file of getFilesToUpdate()) {
      console.log(chalk.dim(`  - ${file}`));
    }
    console.log();
    process.exit(0);
  }

  // === Update files ===
  const updateSpinner = ora('Updating package.json files...').start();
  const updatedPkgs = updatePackageVersions(newVersion);
  updateSpinner.succeed(`Updated ${updatedPkgs.length} package.json files`);

  const cliSpinner = ora('Updating CLI version string...').start();
  const cliUpdated = updateCliVersionString(newVersion);
  if (cliUpdated) {
    cliSpinner.succeed('Updated CLI version string');
  } else {
    cliSpinner.warn('Could not update CLI version string');
  }

  // === Generate changelog ===
  if (!options['no-changelog']) {
    const changelogSpinner = ora('Updating CHANGELOG.md...').start();
    const entry = generateChangelogEntry(newVersion, commits);
    updateChangelog(entry);
    changelogSpinner.succeed('CHANGELOG.md updated');
  }

  // === Git operations ===
  const filesToStage = [...updatedPkgs, 'packages/cli/src/index.ts'];
  if (!options['no-changelog']) {
    filesToStage.push('CHANGELOG.md');
  }

  const stageSpinner = ora('Staging files...').start();
  stageFiles(filesToStage);
  stageSpinner.succeed('Files staged');

  const commitSpinner = ora('Creating commit...').start();
  createCommit(`chore(release): v${newVersion}`);
  commitSpinner.succeed(`Git commit: chore(release): v${newVersion}`);

  const tagSpinner = ora('Creating tag...').start();
  createTag(newVersion);
  tagSpinner.succeed(`Git tag: v${newVersion}`);

  // === Push ===
  if (!options['no-push']) {
    const pushSpinner = ora('Pushing to remote...').start();
    try {
      pushToRemote();
      pushSpinner.succeed('Pushed to remote');
    } catch (_error) {
      pushSpinner.fail('Failed to push to remote');
      console.log(
        chalk.yellow('  Tag created locally. Push manually with: git push && git push --tags')
      );
    }
  } else {
    console.log(chalk.dim('  Skipping push (--no-push)'));
  }

  // === Done ===
  console.log();
  console.log(chalk.green(`Release v${newVersion} complete!`));
  console.log();
}

main().catch((error) => {
  console.error(chalk.red('Release failed:'), error.message);
  process.exit(1);
});
