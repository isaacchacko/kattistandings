import { prisma } from './prisma';

export interface UserRanking {
  name: string;
  rank: number;
  totalScore: number; // base + upsolve bonus
  baseProblemsSolved: number;
  upsolveBonus: number; // 0.5 per problem
  problemsNotDone: string[]; // List of problem names not solved (deprecated - use problemsNotDoneByAssignment)
  problemsNotDoneCount: number;
  problemsNotDoneByAssignment: Array<{ assignmentName: string; assignmentUrl: string; problems: string[] }>; // Problems not done grouped by assignment
  upsolvedProblems: Array<{ assignmentName: string; assignmentUrl: string; problemName: string }>; // List of upsolved problems
}

interface ProblemResult {
  solved: boolean;
  first?: boolean;
  attempted?: boolean;
  attempts: number;
  time: string | null;
}

/**
 * Find the original assignment for an upsolve assignment by name pattern
 */
function findOriginalAssignment(
  upsolveName: string,
  assignments: Array<{ id: string; name: string; url: string }>
): { id: string; name: string; url: string } | null {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:24',message:'findOriginalAssignment entry',data:{upsolveName,assignmentsCount:assignments.length,assignmentNames:assignments.map(a=>a.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  // Remove "UPSOLVE" or "upsolve" from the name, and normalize whitespace
  let baseName = upsolveName.replace(/\s*(UPSOLVE|upsolve)\s*/gi, '').trim();
  // Normalize multiple spaces and fix spacing around dashes
  baseName = baseName.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:30',message:'After baseName extraction',data:{baseName,upsolveName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // Try exact match first (normalize both for comparison)
  let match = assignments.find(a => {
    const normalized = a.name.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
    return normalized.toLowerCase() === baseName.toLowerCase();
  });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:35',message:'After exact match',data:{found:!!match,matchName:match?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  // If no exact match, try partial match with normalized names
  if (!match) {
    match = assignments.find(a => {
      const normalized = a.name.replace(/\s+/g, ' ').replace(/\s*-\s*/g, ' - ').trim();
      return normalized.toLowerCase().includes(baseName.toLowerCase()) ||
             baseName.toLowerCase().includes(normalized.toLowerCase());
    });
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:42',message:'After partial match',data:{found:!!match,matchName:match?.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  }
  
  return match || null;
}

/**
 * Check if all assignments are fresh enough (polled within last 5 minutes)
 */
async function areAllAssignmentsFresh(): Promise<boolean> {
  const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  const cutoffTime = new Date(Date.now() - POLLING_INTERVAL_MS);
  
  const staleAssignments = await prisma.assignment.findFirst({
    where: {
      OR: [
        { lastPolledAt: null },
        { lastPolledAt: { lt: cutoffTime } },
      ],
    },
  });
  
  return !staleAssignments;
}

/**
 * Calculate global rankings for all users
 */
export async function calculateGlobalRankings(): Promise<UserRanking[]> {
  // Check if assignments are fresh - if not, don't poll but use existing data
  const assignmentsFresh = await areAllAssignmentsFresh();
  if (!assignmentsFresh) {
    console.log('[Rank Calc] Some assignments are stale, but using existing data for speed');
  }
  
  // Get all assignments
  const allAssignments = await prisma.assignment.findMany({
    include: {
      entries: true,
      problemResults: true, // Include problem results for faster access
      ranks: {
        include: {
          assignment: true,
        },
      },
    },
  });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:105',message:'All assignments loaded with problemResults',data:{totalAssignments:allAssignments.length,assignmentsWithProblemResults:allAssignments.filter(a=>a.problemResults&&a.problemResults.length>0).length,totalProblemResults:allAssignments.reduce((sum,a)=>sum+(a.problemResults?.length||0),0),sampleProblemResults:allAssignments.find(a=>a.problemResults&&a.problemResults.length>0)?.problemResults.slice(0,3).map(pr=>({name:pr.name,problemName:pr.problemName,isUpsolve:pr.isUpsolve,hasSolvedTime:pr.solvedTime!==null}))||[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion

  // Separate non-upsolve and upsolve assignments
  const nonUpsolveAssignments = allAssignments.filter(
    assignment => !assignment.name.toLowerCase().includes('upsolve')
  );
  
  const upsolveAssignments = allAssignments.filter(
    assignment => assignment.name.toLowerCase().includes('upsolve')
  );
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:114',message:'Upsolve assignments loaded',data:{upsolveCount:upsolveAssignments.length,upsolveAssignments:upsolveAssignments.map(a=>({name:a.name,id:a.id,problemResultsCount:a.problemResults?.length||0,problemResultsSample:a.problemResults?.slice(0,3).map(pr=>({name:pr.name,problemName:pr.problemName,isUpsolve:pr.isUpsolve}))||[]}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  
  // Debug: Check if assignments have entries
  console.log(`[Rank Calc] Total assignments: ${allAssignments.length}, Non-upsolve: ${nonUpsolveAssignments.length}, Upsolve: ${upsolveAssignments.length}`);
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:89',message:'Assignment entries check',data:{totalAssignments:allAssignments.length,nonUpsolveCount:nonUpsolveAssignments.length,assignmentsWithEntries:nonUpsolveAssignments.map(a=>({name:a.name,entriesCount:a.entries.length,entryNames:a.entries.slice(0,3).map(e=>e.name)}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  nonUpsolveAssignments.forEach(assignment => {
    console.log(`[Rank Calc] Assignment "${assignment.name}": ${assignment.entries.length} entries`);
  });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:70',message:'Assignment separation',data:{totalAssignments:allAssignments.length,nonUpsolveCount:nonUpsolveAssignments.length,upsolveCount:upsolveAssignments.length,upsolveNames:upsolveAssignments.map(a=>a.name),nonUpsolveNames:nonUpsolveAssignments.map(a=>a.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  // Get all unique user names (excluding "Hidden User")
  const allRanks = await prisma.rank.findMany({
    include: {
      assignment: true,
    },
  });

  const uniqueUserNames = new Set<string>();
  allRanks.forEach(rank => {
    if (rank.name.toLowerCase() !== 'hidden user') {
      uniqueUserNames.add(rank.name);
    }
  });

  // Pre-fetch ALL problem results for all users and assignments in bulk
  // This avoids making 1000+ queries inside loops
  const allProblemResults = await prisma.problemResult.findMany({
    where: {
      name: {
        in: Array.from(uniqueUserNames),
      },
    },
  });

  // Cache problem results by (userName, assignmentId, isUpsolve) for fast lookup
  // Key format: `${userName}|${assignmentId}|${isUpsolve}`
  const problemResultCache = new Map<string, typeof allProblemResults>();
  allProblemResults.forEach(pr => {
    const key = `${pr.name}|${pr.assignmentId}|${pr.isUpsolve}`;
    if (!problemResultCache.has(key)) {
      problemResultCache.set(key, []);
    }
    problemResultCache.get(key)!.push(pr);
  });

  // Helper function to get cached problem results
  const getCachedProblemResults = (
    userName: string,
    assignmentId: string,
    isUpsolve: boolean
  ): typeof allProblemResults => {
    const key = `${userName}|${assignmentId}|${isUpsolve}`;
    return problemResultCache.get(key) || [];
  };

  // Calculate rankings for each user
  const userRankings: Map<string, UserRanking> = new Map();

  for (const userName of uniqueUserNames) {
    let baseProblemsSolved = 0;
    const problemsNotDone = new Set<string>(); // Stores normalized names
    const allSolvedProblems = new Set<string>(); // Track all problems solved across all assignments (normalized)
    const problemNameMap = new Map<string, string>(); // Map normalized -> original name for display
    const problemsByAssignment = new Map<string, { assignmentName: string; assignmentUrl: string; problems: Set<string> }>(); // Track problems by assignment
    let upsolveBonus = 0;
    const upsolvedProblems: Array<{ assignmentName: string; assignmentUrl: string; problemName: string }> = []; // Track all upsolved problems
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:89',message:'Processing user',data:{userName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    // First pass: Process non-upsolve assignments to get base score and track solved problems
    let totalProblemsInAssignments = 0;
    for (const assignment of nonUpsolveAssignments) {
      // Find user's rank entry for this assignment
      const userRank = assignment.ranks.find(r => r.name === userName);
      
      if (userRank) {
        const problems = userRank.problems as unknown as ProblemResult[];
        const problemNames = userRank.problemNames || [];
        
        // Count solved problems and track them
        problems.forEach((problem, index) => {
          const problemName = problemNames[index];
          if (problemName) {
            if (problem.solved) {
              baseProblemsSolved++;
              // Normalize problem name for consistent matching
              const normalized = problemName.trim().toLowerCase();
              allSolvedProblems.add(normalized);
              // #region agent log
              fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:143',message:'Tracking solved problem',data:{userName,assignmentName:assignment.name,problemName,normalized,allSolvedProblemsSize:allSolvedProblems.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
              // #endregion
            }
          }
        });
      }
      
      // Track all problems in this assignment (for "not done" calculation)
      // Only add valid problem names (filter out invalid ones like navigation text)
      const assignmentProblemsCount = assignment.entries.length;
      totalProblemsInAssignments += assignmentProblemsCount;
      
      if (assignmentProblemsCount === 0) {
        console.log(`[Rank Calc] ${userName}: WARNING - Assignment "${assignment.name}" has 0 entries!`);
      }
      
      let validProblemsAdded = 0;
      let filteredOutCount = 0;
      
      // Initialize assignment entry in problemsByAssignment if not exists
      if (!problemsByAssignment.has(assignment.id)) {
        problemsByAssignment.set(assignment.id, {
          assignmentName: assignment.name,
          assignmentUrl: assignment.url,
          problems: new Set<string>(),
        });
      }
      const assignmentProblems = problemsByAssignment.get(assignment.id)!;
      
      assignment.entries.forEach(entry => {
        const problemName = entry.name.trim();
        // Filter out invalid problem names
        const isValid = problemName && 
            problemName.length > 0 && 
            problemName.length <= 100 &&
            !/^(courses|jobs|languages|info|help|rank|group|slv|time)$/i.test(problemName) &&
            !/coursesjobs/i.test(problemName);
        
        if (!isValid) {
          filteredOutCount++;
        } else {
          // Normalize problem name for consistent matching
          const normalized = problemName.toLowerCase();
          const wasNew = !problemsNotDone.has(normalized);
          problemsNotDone.add(normalized);
          assignmentProblems.problems.add(problemName); // Store original name for this assignment
          if (wasNew) {
            validProblemsAdded++;
          }
          // Store mapping for display (keep first occurrence if duplicate)
          if (!problemNameMap.has(normalized)) {
            problemNameMap.set(normalized, problemName);
          }
        }
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:159',message:'Processing assignment entries',data:{userName,assignmentName:assignment.name,entriesCount:assignment.entries.length,validProblemsAdded,filteredOutCount,problemsNotDoneSize:problemsNotDone.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (validProblemsAdded > 0) {
        console.log(`[Rank Calc] ${userName}: Added ${validProblemsAdded} problems from assignment "${assignment.name}"`);
      }
    }
    
    console.log(`[Rank Calc] ${userName}: Total problems in non-upsolve assignments: ${totalProblemsInAssignments}, problemsNotDone after adding: ${problemsNotDone.size}`);

    // Second pass: Process upsolve assignments to calculate bonus and track solved problems
    // Use ProblemResult table for faster access
    for (const upsolveAssignment of upsolveAssignments) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:132',message:'Processing upsolve assignment',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveAssignmentId:upsolveAssignment.id,ranksCount:upsolveAssignment.ranks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Find matching original assignment
      const originalAssignment = findOriginalAssignment(
        upsolveAssignment.name,
        nonUpsolveAssignments.map(a => ({ id: a.id, name: a.name, url: a.url }))
      );
      
      // Get user's upsolve problem results from cache (pre-fetched in bulk)
      const userUpsolveResults = getCachedProblemResults(
        userName,
        upsolveAssignment.id,
        true
      );
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:263',message:'Querying upsolve problem results from DB',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveAssignmentId:upsolveAssignment.id,userUpsolveResultsCount:userUpsolveResults.length,userUpsolveResultsSample:userUpsolveResults.slice(0,5).map(pr=>({problemName:pr.problemName,isUpsolve:pr.isUpsolve,hasSolvedTime:pr.solvedTime!==null,solvedTime:pr.solvedTime})),resultsWithSolvedTime:userUpsolveResults.filter(pr=>pr.solvedTime!==null).length,resultsWithoutSolvedTime:userUpsolveResults.filter(pr=>pr.solvedTime===null).length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:259',message:'After findOriginalAssignment',data:{userName,upsolveName:upsolveAssignment.name,originalFound:!!originalAssignment,originalName:originalAssignment?.name,originalId:originalAssignment?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (!originalAssignment) {
        // No matching original assignment, skip this upsolve
        console.log(`[Rank Calc] ${userName}: No original assignment found for upsolve "${upsolveAssignment.name}"`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:142',message:'No original assignment found',data:{userName,upsolveName:upsolveAssignment.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        continue;
      }
      
      console.log(`[Rank Calc] ${userName}: Processing upsolve "${upsolveAssignment.name}" -> original "${originalAssignment.name}"`);

      // Get user's problem results from original assignment (from cache)
      const userOriginalResults = getCachedProblemResults(
        userName,
        originalAssignment.id,
        false
      );
      
      // Track problems solved in upsolve (for "not done" calculation)
      // Note: ProblemResult records are only created when problem.solved is true,
      // so if a ProblemResult exists, the problem was solved (regardless of solvedTime)
      userUpsolveResults.forEach(pr => {
        const normalized = pr.problemName.trim().toLowerCase();
        allSolvedProblems.add(normalized);
      });
      
      // If user didn't participate in original assignment, all solved problems in upsolve count
      // Note: All userUpsolveResults represent solved problems (ProblemResult only created when solved)
      if (userOriginalResults.length === 0) {
        const solvedCount = userUpsolveResults.length; // All ProblemResult records represent solved problems
        upsolveBonus += solvedCount * 0.5;
        console.log(`[Rank Calc] ${userName}: No original results, adding ${solvedCount * 0.5} upsolve bonus`);
        // Track all solved problems as upsolves
        userUpsolveResults.forEach(pr => {
          upsolvedProblems.push({ assignmentName: upsolveAssignment.name, assignmentUrl: upsolveAssignment.url, problemName: pr.problemName });
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:298',message:'Adding upsolved problem (no original)',data:{userName,problemName:pr.problemName,assignmentName:upsolveAssignment.name,upsolvedProblemsCount:upsolvedProblems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
        });
      } else {
        // User participated in original - check which problems were solved
        // Create a map of problem names (normalized) to solved status in original assignment
        // Note: ProblemResult records are only created when problem.solved is true
        const originalSolvedProblemsNormalized = new Set<string>();
        userOriginalResults.forEach(pr => {
          originalSolvedProblemsNormalized.add(pr.problemName.trim().toLowerCase());
        });

        // Find problems solved in upsolve but not in original
        let upsolveBonusForThisAssignment = 0;
        // Note: All userUpsolveResults represent solved problems (ProblemResult only created when solved)
        userUpsolveResults.forEach(pr => {
          // Normalize problem name for comparison
          const normalizedName = pr.problemName.trim().toLowerCase();
          
          // Check if this problem was NOT solved in the original assignment
          const solvedInOriginal = originalSolvedProblemsNormalized.has(normalizedName);
          
          if (!solvedInOriginal) {
            // Solved in upsolve but not in original - add 0.5 points
            upsolveBonus += 0.5;
            upsolveBonusForThisAssignment += 0.5;
            upsolvedProblems.push({ assignmentName: upsolveAssignment.name, assignmentUrl: upsolveAssignment.url, problemName: pr.problemName });
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:325',message:'Adding upsolved problem (with original)',data:{userName,problemName:pr.problemName,assignmentName:upsolveAssignment.name,upsolvedProblemsCount:upsolvedProblems.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
            // #endregion
            console.log(`[Rank Calc] ${userName}: +0.5 for "${pr.problemName}" in upsolve "${upsolveAssignment.name}" (not solved in original)`);
          } else {
            console.log(`[Rank Calc] ${userName}: Skipping "${pr.problemName}" - already solved in original`);
          }
        });
        if (upsolveBonusForThisAssignment > 0) {
          console.log(`[Rank Calc] ${userName}: Total upsolve bonus for "${upsolveAssignment.name}": ${upsolveBonusForThisAssignment}`);
        }
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:225',message:'Upsolve bonus calculated for assignment',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveBonusForThisAssignment,totalUpsolveBonus:upsolveBonus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    }

    // Debug logging
    console.log(`[Rank Calc] ${userName}: problemsNotDone size: ${problemsNotDone.size}, allSolvedProblems size: ${allSolvedProblems.size}`);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:328',message:'Before final filter',data:{userName,problemsNotDoneSize:problemsNotDone.size,allSolvedProblemsSize:allSolvedProblems.size,problemsNotDoneSample:Array.from(problemsNotDone).slice(0,10),allSolvedProblemsSample:Array.from(allSolvedProblems).slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (problemsNotDone.size > 0) {
      console.log(`[Rank Calc] ${userName}: Sample problemsNotDone:`, Array.from(problemsNotDone).slice(0, 5));
    }
    if (allSolvedProblems.size > 0) {
      console.log(`[Rank Calc] ${userName}: Sample allSolvedProblems:`, Array.from(allSolvedProblems).slice(0, 5));
    }

    // Remove solved problems from "not done" list
    // Both sets already contain normalized names, so we can directly check
    const finalProblemsNotDoneNormalized = Array.from(problemsNotDone).filter(
      (problemName) => {
        const isSolved = allSolvedProblems.has(problemName);
        // #region agent log
        if (problemsNotDone.size <= 20) { // Only log for small sets to avoid spam
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:339',message:'Filtering problem',data:{userName,problemName,isSolved},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        }
        // #endregion
        return !isSolved;
      }
    );
    // Map back to original names for display
    const finalProblemsNotDone = finalProblemsNotDoneNormalized.map(
      (normalized) => problemNameMap.get(normalized) || normalized
    );
    
    // Build problemsNotDoneByAssignment: filter each assignment's problems by what's not solved
    const problemsNotDoneByAssignment: Array<{ assignmentName: string; assignmentUrl: string; problems: string[] }> = [];
    problemsByAssignment.forEach((assignmentData, assignmentId) => {
      const unsolvedProblems = Array.from(assignmentData.problems).filter(problemName => {
        const normalized = problemName.toLowerCase();
        return !allSolvedProblems.has(normalized);
      });
      
      if (unsolvedProblems.length > 0) {
        problemsNotDoneByAssignment.push({
          assignmentName: assignmentData.assignmentName,
          assignmentUrl: assignmentData.assignmentUrl,
          problems: unsolvedProblems,
        });
      }
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:350',message:'After final filter',data:{userName,finalCount:finalProblemsNotDone.length,problemsNotDoneSize:problemsNotDone.size,allSolvedProblemsSize:allSolvedProblems.size,finalProblemsSample:finalProblemsNotDone.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log(`[Rank Calc] ${userName}: Final problemsNotDone count: ${finalProblemsNotDone.length}`);

    const totalScore = baseProblemsSolved + upsolveBonus;

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:391',message:'Final user ranking before setting',data:{userName,totalScore,baseProblemsSolved,upsolveBonus,upsolvedProblemsCount:upsolvedProblems.length,upsolvedProblems:upsolvedProblems.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const userRanking = {
      name: userName,
      rank: 0, // Will be assigned after sorting
      totalScore,
      baseProblemsSolved,
      upsolveBonus,
      problemsNotDone: finalProblemsNotDone, // Keep for backward compatibility
      problemsNotDoneCount: finalProblemsNotDone.length,
      problemsNotDoneByAssignment,
      upsolvedProblems,
    };
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:403',message:'Final user ranking after setting',data:{userName,userRankingUpsolvedProblemsCount:userRanking.upsolvedProblems.length,userRankingUpsolvedProblems:userRanking.upsolvedProblems.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    userRankings.set(userName, userRanking);
  }

  // Convert to array and sort by total score (descending)
  const rankings = Array.from(userRankings.values()).sort((a, b) => {
    // Primary sort: total score (descending)
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    // Secondary sort: base problems solved (descending)
    if (b.baseProblemsSolved !== a.baseProblemsSolved) {
      return b.baseProblemsSolved - a.baseProblemsSolved;
    }
    // Tertiary sort: name (ascending) for consistency
    return a.name.localeCompare(b.name);
  });

  // Assign ranks (same rank for ties)
  let currentRank = 1;
  for (let i = 0; i < rankings.length; i++) {
    if (i > 0 && rankings[i].totalScore !== rankings[i - 1].totalScore) {
      currentRank = i + 1;
    }
    rankings[i].rank = currentRank;
  }

  return rankings;
}
