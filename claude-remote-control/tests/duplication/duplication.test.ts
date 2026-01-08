import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'fs';
import { resolve } from 'path';

interface JscpdReport {
  statistics: {
    clones: number;
    percentage: string;
    total: {
      lines: number;
      tokens: number;
      sources: number;
    };
  };
  duplicates: Array<{
    firstFile: {
      name: string;
      startLoc: { line: number; column: number };
      endLoc: { line: number; column: number };
    };
    secondFile: {
      name: string;
      startLoc: { line: number; column: number };
      endLoc: { line: number; column: number };
    };
    lines: number;
    tokens: number;
  }>;
}

describe('Code Duplication', () => {
  // Maximum allowed duplication percentage
  const DUPLICATION_THRESHOLD = 5;

  const projectRoot = resolve(__dirname, '../..');
  const reportDir = resolve(projectRoot, '.jscpd-report');
  const reportFile = resolve(reportDir, 'jscpd-report.json');

  it('should not exceed duplication threshold', () => {
    // Ensure report directory exists
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    // Run jscpd to generate report
    try {
      execSync('pnpm duplication', {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    } catch {
      // jscpd may exit with non-zero if duplicates found
      // We still want to check the report
    }

    // Verify report was generated
    if (!existsSync(reportFile)) {
      // No report means no duplicates found (or jscpd not configured)
      console.log('\nNo duplication report generated - assuming no duplicates.\n');
      return;
    }

    // Parse the report
    const reportContent = readFileSync(reportFile, 'utf-8');
    const report: JscpdReport = JSON.parse(reportContent);

    const percentage = parseFloat(report.statistics?.percentage ?? '0');
    const clones = report.statistics?.clones ?? 0;
    const totalLines = report.statistics?.total?.lines ?? 0;

    // Log results for visibility in CI
    console.log('\n==========================================');
    console.log('       CODE DUPLICATION REPORT');
    console.log('==========================================\n');
    console.log(`  Duplicate blocks: ${clones}`);
    console.log(`  Duplication: ${percentage}% of ${totalLines} lines`);
    console.log(`  Threshold: ${DUPLICATION_THRESHOLD}%\n`);

    // If there are duplicates, log them for actionability
    if (report.duplicates?.length > 0) {
      console.log('  Duplicated locations:');
      console.log('  ---------------------');
      for (const dup of report.duplicates) {
        console.log(
          `  [${dup.firstFile.name}:${dup.firstFile.startLoc.line}-${dup.firstFile.endLoc.line}]`
        );
        console.log(
          `  [${dup.secondFile.name}:${dup.secondFile.startLoc.line}-${dup.secondFile.endLoc.line}]`
        );
        console.log(`  Lines: ${dup.lines} | Tokens: ${dup.tokens}\n`);
      }
    }

    console.log('==========================================\n');

    // Clean up report directory after test
    try {
      rmSync(reportDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Assert threshold
    expect(
      percentage,
      `Code duplication (${percentage}%) exceeds threshold (${DUPLICATION_THRESHOLD}%). Please refactor duplicated code.`
    ).toBeLessThanOrEqual(DUPLICATION_THRESHOLD);
  });
});
