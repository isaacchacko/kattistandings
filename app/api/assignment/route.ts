import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { shouldPollAssignment, fetchAndSaveAssignment } from '@/lib/kattis-fetcher';

export async function GET(request: Request) {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:5',message:'API route GET called',data:{url:request.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    const { searchParams } = new URL(request.url);
    const assignmentUrl = searchParams.get('url');
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:9',message:'Parsed assignmentUrl',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    if (!assignmentUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

    // Always check if we need to poll and trigger fetch if needed
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:18',message:'Before shouldPollAssignment',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const needsPolling = await shouldPollAssignment(assignmentUrl);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:20',message:'After shouldPollAssignment',data:{needsPolling},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    console.log(`[Assignment API] URL: ${assignmentUrl}, Needs polling: ${needsPolling}`);
    
    if (needsPolling) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:24',message:'Entering needsPolling branch',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      try {
        console.log(`[Assignment API] Fetching and saving assignment: ${assignmentUrl}`);
        // Fetch and save to database - this will create the assignment if it doesn't exist
        await fetchAndSaveAssignment(assignmentUrl);
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:28',message:'After fetchAndSaveAssignment',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        console.log(`[Assignment API] Successfully fetched and saved assignment: ${assignmentUrl}`);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:31',message:'Error in fetchAndSaveAssignment',data:{assignmentUrl,error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        console.error(`[Assignment API] Error fetching assignment: ${assignmentUrl}`, error);
        // Continue to try to return from database even if fetch failed
      }
    }

    // Get assignment from database (should exist now after fetch)
    const assignment = await prisma.assignment.findUnique({
      where: { url: assignmentUrl },
      include: {
        entries: true,
      },
    });

    if (!assignment) {
      // If still not found after fetch attempt, return error
      return NextResponse.json(
        { error: 'Assignment not found and could not be fetched' },
        { status: 404 }
      );
    }

    // Format response
    return NextResponse.json({
      title: assignment.title,
      url: assignment.url,
      stats: assignment.stats as Record<string, number> | undefined,
      timeInfo: assignment.timeInfo as Record<string, string> | undefined,
      timeData: assignment.timeData as Record<string, any> | undefined,
      problems: assignment.entries.map(entry => ({
        name: entry.name,
        url: entry.url,
      })),
    });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/assignment/route.ts:62',message:'Top-level error handler',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
