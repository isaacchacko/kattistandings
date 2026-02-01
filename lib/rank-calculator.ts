import { prisma } from './prisma';

export interface UserRanking {
  name: string;
  rank: number;
  totalScore: number; // base + upsolve bonus
  baseProblemsSolved: number;
  upsolveBonus: number; // 0.5 per problem
  problemsNotDone: string[]; // List of problem names not solved
  problemsNotDoneCount: number;
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
 * Calculate global rankings for all users
 */
export async function calculateGlobalRankings(): Promise<UserRanking[]> {
  // Get all assignments
  const allAssignments = await prisma.assignment.findMany({
    include: {
      entries: true,
      ranks: {
        include: {
          assignment: true,
        },
      },
    },
  });

  // Separate non-upsolve and upsolve assignments
  const nonUpsolveAssignments = allAssignments.filter(
    assignment => !assignment.name.toLowerCase().includes('upsolve')
  );
  
  const upsolveAssignments = allAssignments.filter(
    assignment => assignment.name.toLowerCase().includes('upsolve')
  );
  
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

  // Calculate rankings for each user
  const userRankings: Map<string, UserRanking> = new Map();

  for (const userName of uniqueUserNames) {
    let baseProblemsSolved = 0;
    const problemsNotDone = new Set<string>(); // Stores normalized names
    const allSolvedProblems = new Set<string>(); // Track all problems solved across all assignments (normalized)
    const problemNameMap = new Map<string, string>(); // Map normalized -> original name for display
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
    for (const upsolveAssignment of upsolveAssignments) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:132',message:'Processing upsolve assignment',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveAssignmentId:upsolveAssignment.id,ranksCount:upsolveAssignment.ranks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      // Find matching original assignment
      const originalAssignment = findOriginalAssignment(
        upsolveAssignment.name,
        nonUpsolveAssignments.map(a => ({ id: a.id, name: a.name, url: a.url }))
      );
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:139',message:'After findOriginalAssignment',data:{userName,upsolveName:upsolveAssignment.name,originalFound:!!originalAssignment,originalName:originalAssignment?.name,originalId:originalAssignment?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
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

      // Get user's rank in original assignment
      const originalRank = await prisma.rank.findUnique({
        where: {
          assignmentId_name: {
            assignmentId: originalAssignment.id,
            name: userName,
          },
        },
      });
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:155',message:'After originalRank lookup',data:{userName,originalAssignmentId:originalAssignment.id,originalRankFound:!!originalRank,originalProblemNamesCount:originalRank?.problemNames?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion

      // Get user's rank in upsolve assignment
      const upsolveRank = upsolveAssignment.ranks.find(r => r.name === userName);
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:158',message:'After upsolveRank lookup',data:{userName,upsolveAssignmentId:upsolveAssignment.id,upsolveRankFound:!!upsolveRank,upsolveProblemNamesCount:upsolveRank?.problemNames?.length||0,upsolveProblemsCount:upsolveRank?(upsolveRank.problems as unknown as ProblemResult[]).length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion

      if (upsolveRank) {
        const upsolveProblems = upsolveRank.problems as unknown as ProblemResult[];
        const upsolveProblemNames = upsolveRank.problemNames || [];
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:160',message:'Upsolve rank found',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveProblemsCount:upsolveProblems.length,upsolveProblemNamesCount:upsolveProblemNames.length,upsolveProblemNames:upsolveProblemNames.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        console.log(`[Rank Calc] ${userName}: Found upsolve rank with ${upsolveProblems.length} problems, ${upsolveProblemNames.length} problem names`);
        
        // Track problems solved in upsolve (for "not done" calculation)
        upsolveProblemNames.forEach((problemName, index) => {
          if (upsolveProblems[index]?.solved === true && problemName) {
            // Normalize problem name for consistent matching
            allSolvedProblems.add(problemName.trim().toLowerCase());
          }
        });
        
        // If user didn't participate in original assignment, all solved problems in upsolve count
        if (!originalRank) {
          const solvedCount = upsolveProblems.filter(p => p.solved).length;
          upsolveBonus += solvedCount * 0.5;
          console.log(`[Rank Calc] ${userName}: No original rank, adding ${solvedCount * 0.5} upsolve bonus`);
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:177',message:'No original rank - all upsolves count',data:{userName,upsolveAssignmentName:upsolveAssignment.name,solvedCount,upsolveBonusAdded:solvedCount*0.5},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          // Track all solved problems as upsolves
          upsolveProblemNames.forEach((problemName, index) => {
            if (upsolveProblems[index]?.solved === true && problemName) {
              upsolvedProblems.push({ assignmentName: upsolveAssignment.name, assignmentUrl: upsolveAssignment.url, problemName });
            }
          });
        } else {
          // User participated in original - check which problems were solved
          const originalProblems = originalRank.problems as unknown as ProblemResult[];
          const originalProblemNames = originalRank.problemNames || [];
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:190',message:'Original rank found - comparing problems',data:{userName,upsolveAssignmentName:upsolveAssignment.name,originalProblemNamesCount:originalProblemNames.length,originalProblemNames:originalProblemNames.slice(0,10),upsolveProblemNamesCount:upsolveProblemNames.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          // Create a map of problem names (normalized) to solved status in original assignment
          const originalSolvedProblems = new Set<string>();
          const originalSolvedProblemsNormalized = new Map<string, string>(); // normalized -> original
          originalProblemNames.forEach((problemName, index) => {
            if (problemName && originalProblems[index]?.solved === true) {
              originalSolvedProblems.add(problemName);
              originalSolvedProblemsNormalized.set(problemName.trim().toLowerCase(), problemName);
            }
          });
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:199',message:'Original solved problems map',data:{userName,originalSolvedCount:originalSolvedProblems.size,originalSolvedProblems:Array.from(originalSolvedProblems).slice(0,10),normalizedMapSize:originalSolvedProblemsNormalized.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion

          // Find problems solved in upsolve but not in original
          let upsolveBonusForThisAssignment = 0;
          upsolveProblemNames.forEach((problemName, index) => {
            if (problemName && upsolveProblems[index]?.solved === true) {
              // Normalize problem name for comparison (trim whitespace, case-insensitive)
              const normalizedName = problemName.trim().toLowerCase();
              
              // Check if this problem was NOT solved in the original assignment
              // Try exact match first, then normalized match
              let solvedInOriginal = originalSolvedProblems.has(problemName);
              if (!solvedInOriginal) {
                // Try normalized match
                solvedInOriginal = originalSolvedProblemsNormalized.has(normalizedName);
              }
              // #region agent log
              fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:210',message:'Problem matching check',data:{userName,problemName,normalizedName,solvedInOriginal,exactMatch:originalSolvedProblems.has(problemName),normalizedMatch:originalSolvedProblemsNormalized.has(normalizedName)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
              // #endregion
              
              if (!solvedInOriginal) {
                // Solved in upsolve but not in original - add 0.5 points
                upsolveBonus += 0.5;
                upsolveBonusForThisAssignment += 0.5;
                upsolvedProblems.push({ assignmentName: upsolveAssignment.name, assignmentUrl: upsolveAssignment.url, problemName });
                console.log(`[Rank Calc] ${userName}: +0.5 for "${problemName}" in upsolve "${upsolveAssignment.name}" (not solved in original)`);
              } else {
                console.log(`[Rank Calc] ${userName}: Skipping "${problemName}" - already solved in original`);
              }
            }
          });
          if (upsolveBonusForThisAssignment > 0) {
            console.log(`[Rank Calc] ${userName}: Total upsolve bonus for "${upsolveAssignment.name}": ${upsolveBonusForThisAssignment}`);
          }
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:225',message:'Upsolve bonus calculated for assignment',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveBonusForThisAssignment,totalUpsolveBonus:upsolveBonus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
        }
      } else {
        console.log(`[Rank Calc] ${userName}: No upsolve rank found for "${upsolveAssignment.name}"`);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:230',message:'No upsolve rank found',data:{userName,upsolveAssignmentName:upsolveAssignment.name,upsolveAssignmentId:upsolveAssignment.id,availableRanks:upsolveAssignment.ranks.map(r=>r.name).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
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
    
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:350',message:'After final filter',data:{userName,finalCount:finalProblemsNotDone.length,problemsNotDoneSize:problemsNotDone.size,allSolvedProblemsSize:allSolvedProblems.size,finalProblemsSample:finalProblemsNotDone.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    console.log(`[Rank Calc] ${userName}: Final problemsNotDone count: ${finalProblemsNotDone.length}`);

    const totalScore = baseProblemsSolved + upsolveBonus;

    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/rank-calculator.ts:243',message:'Final user ranking',data:{userName,totalScore,baseProblemsSolved,upsolveBonus,upsolvedProblemsCount:upsolvedProblems.length,upsolvedProblems:upsolvedProblems.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'ALL'})}).catch(()=>{});
    // #endregion
    userRankings.set(userName, {
      name: userName,
      rank: 0, // Will be assigned after sorting
      totalScore,
      baseProblemsSolved,
      upsolveBonus,
      problemsNotDone: finalProblemsNotDone,
      problemsNotDoneCount: finalProblemsNotDone.length,
      upsolvedProblems,
    });
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
