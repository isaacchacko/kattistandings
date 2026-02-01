import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shouldPollAssignment, fetchAndSaveStandings } from '@/lib/kattis-fetcher';

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:5',message:'Standings API route GET called',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const { searchParams } = new URL(request.url);
    const assignmentUrl = searchParams.get('url');
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:9',message:'Parsed assignmentUrl',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!assignmentUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Always check if we need to poll and trigger fetch if needed
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:24',message:'Before shouldPollAssignment',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    const needsPolling = await shouldPollAssignment(assignmentUrl);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:26',message:'After shouldPollAssignment',data:{needsPolling},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    console.log(`[Standings API] URL: ${assignmentUrl}, Needs polling: ${needsPolling}`);
    
    if (needsPolling) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:30',message:'Entering needsPolling branch',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      try {
        console.log(`[Standings API] Fetching and saving standings: ${assignmentUrl}`);
        // Fetch and save standings to database - this will create assignment if it doesn't exist
        await fetchAndSaveStandings(assignmentUrl);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:34',message:'After fetchAndSaveStandings',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.log(`[Standings API] Successfully fetched and saved standings: ${assignmentUrl}`);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:37',message:'Error in fetchAndSaveStandings',data:{assignmentUrl,error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        console.error(`[Standings API] Error fetching standings: ${assignmentUrl}`, error);
        // Continue to try to return from database even if fetch failed
      }
    }

    // Get assignment from database (should exist now after fetch)
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:42',message:'Before prisma.assignment.findUnique',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
    const assignment = await prisma.assignment.findUnique({
      where: { url: assignmentUrl },
      include: {
        ranks: {
          orderBy: { rank: 'asc' },
        },
      },
    });

    if (!assignment) {
      // If still not found after fetch attempt, return error
      return NextResponse.json(
        { error: 'Assignment not found and could not be fetched' },
        { status: 404 }
      );
    }

    // If no ranks exist, try fetching one more time (in case fetch failed silently)
    if (assignment.ranks.length === 0) {
      await fetchAndSaveStandings(assignmentUrl);
      // Re-fetch assignment with ranks
      const updatedAssignment = await prisma.assignment.findUnique({
        where: { url: assignmentUrl },
        include: {
          ranks: {
            orderBy: { rank: 'asc' },
          },
        },
      });
      
      if (updatedAssignment && updatedAssignment.ranks.length > 0) {
        const firstRank = updatedAssignment.ranks[0];
        return NextResponse.json({
          title: firstRank.standingsTitle || updatedAssignment.title,
          url: updatedAssignment.url,
          problemNames: firstRank.problemNames,
          standings: updatedAssignment.ranks.map(rank => ({
            rank: rank.rank,
            name: rank.name,
            solvedCount: rank.solvedCount,
            totalTimeMinutes: rank.totalTimeMinutes,
            problems: rank.problems as Array<{
              solved: boolean;
              first?: boolean;
              attempted?: boolean;
              attempts: number;
              time: string | null;
            }>,
          })),
        });
      }
    }

    // Format response from database
    if (assignment.ranks.length > 0) {
      const firstRank = assignment.ranks[0];
      return NextResponse.json({
        title: firstRank.standingsTitle || assignment.title,
        url: assignment.url,
        problemNames: firstRank.problemNames,
        standings: assignment.ranks.map(rank => ({
          rank: rank.rank,
          name: rank.name,
          solvedCount: rank.solvedCount,
          totalTimeMinutes: rank.totalTimeMinutes,
          problems: rank.problems as Array<{
            solved: boolean;
            first?: boolean;
            attempted?: boolean;
            attempts: number;
            time: string | null;
          }>,
        })),
      });
    }

    // Return empty standings if none found
    return NextResponse.json({
      title: assignment.title,
      url: assignment.url,
      problemNames: [],
      standings: [],
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/standings/route.ts:123',message:'Top-level error handler',data:{error:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
