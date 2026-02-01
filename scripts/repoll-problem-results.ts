/**
 * Script to repoll all ProblemResult records to update solvedTime
 * This will fetch fresh standings for all assignments and update ProblemResult records
 * with solvedTime as integer minutes instead of DateTime
 */

import { prisma } from '../lib/prisma';
import { fetchAndSaveStandings } from '../lib/kattis-fetcher';

async function repollAllProblemResults() {
  console.log('[Repoll ProblemResults] Starting repoll of all ProblemResult records...');
  const startTime = Date.now();
  let assignmentsProcessed = 0;
  let standingsUpdated = 0;
  const errors: Array<{ assignmentUrl: string; error: string }> = [];

  try {
    // Get all assignments from database
    const assignments = await prisma.assignment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[Repoll ProblemResults] Found ${assignments.length} assignments to process...`);

    // For each assignment, fetch fresh standings (which will update ProblemResult records)
    for (const assignment of assignments) {
      try {
        console.log(`[Repoll ProblemResults] Processing assignment: ${assignment.name} (${assignment.url})`);
        assignmentsProcessed++;

        // Fetch fresh standings - this will update ProblemResult records with new solvedTime format
        await fetchAndSaveStandings(assignment.url);
        standingsUpdated++;
        console.log(`[Repoll ProblemResults] ✓ Updated standings for: ${assignment.name}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ assignmentUrl: assignment.url, error: errorMsg });
        console.error(`[Repoll ProblemResults] ✗ Failed to update standings for: ${assignment.name}`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Repoll ProblemResults] Completed in ${duration}s.`);
    console.log(`[Repoll ProblemResults] Processed ${assignmentsProcessed} assignments, updated ${standingsUpdated} standings.`);
    if (errors.length > 0) {
      console.log(`[Repoll ProblemResults] ${errors.length} errors occurred:`);
      errors.forEach(({ assignmentUrl, error }) => {
        console.log(`  - ${assignmentUrl}: ${error}`);
      });
    }

    return {
      assignmentsProcessed,
      standingsUpdated,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Repoll ProblemResults] Fatal error:', error);
    throw new Error(`Repoll failed: ${errorMsg}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  repollAllProblemResults()
    .then((result) => {
      console.log('Repoll completed successfully:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Repoll failed:', error);
      process.exit(1);
    });
}

export { repollAllProblemResults };
