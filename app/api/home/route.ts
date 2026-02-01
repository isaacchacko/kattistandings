import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';
import { shouldRefreshHomeData } from '@/lib/kattis-fetcher';

export async function GET() {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:5',message:'Home API route GET called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  try {
    // Check if assignments exist in database first
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:9',message:'Checking database for assignments',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    const existingAssignments = await prisma.assignment.findMany({
      include: {
        entries: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If assignments exist in database, check if data is outdated
    if (existingAssignments.length > 0) {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:24',message:'Checking if home data needs refresh',data:{count:existingAssignments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      const needsRefresh = await shouldRefreshHomeData();
      
      // If data is fresh, return cached data
      if (!needsRefresh) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:29',message:'Returning cached assignments from database',data:{count:existingAssignments.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
        return NextResponse.json({
          assignments: existingAssignments.map(assignment => ({
            name: assignment.name,
            url: assignment.url,
            status: assignment.status,
            problems: assignment.entries.map(entry => ({
              name: entry.name,
              url: entry.url,
            })),
          })),
          teachers: [], // Teachers not stored in DB, return empty array
          rawHtmlLength: 0,
        });
      }
      
      // Data is outdated, fetch fresh data and update
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:48',message:'Home data outdated, fetching fresh from Kattis',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
    }

    // No assignments in database or data is outdated - fetch from Kattis
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:52',message:'Fetching from Kattis (first time or outdated)',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
    // #endregion
    const response = await fetch('https://tamu.kattis.com/courses/CSCE430/2026Spring', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Parse Assignments
    const assignments: Array<{
      name: string;
      url: string;
      status: string;
      problems: Array<{ name: string; url: string }>;
    }> = [];
    const assignmentsSection = $('h2:contains("Assignments")').next('ul');
    
    assignmentsSection.find('> li').each((_, el) => {
      const assignmentEl = $(el);
      const assignmentLink = assignmentEl.find('> a').first();
      const assignmentName = assignmentLink.text().trim();
      const assignmentUrl = assignmentLink.attr('href') || '';
      
      // Get status (Ended or Remaining time)
      const statusText = assignmentEl.contents().filter(function() {
        return this.nodeType === 3; // Text node
      }).text().trim();
      
      // Extract problems from the next sibling <ol>
      const problems: Array<{ name: string; url: string }> = [];
      const problemsList = assignmentEl.next('ol');
      if (problemsList.length > 0) {
        problemsList.find('> li').each((_, problemEl) => {
          const problemLink = $(problemEl).find('a');
          problems.push({
            name: problemLink.text().trim(),
            url: problemLink.attr('href') || '',
          });
        });
      }
      
      assignments.push({
        name: assignmentName,
        url: assignmentUrl,
        status: statusText,
        problems: problems,
      });
    });
    
    // Save assignments to database
    console.log(`[Home API] Saving ${assignments.length} assignments to database`);
    for (const assignment of assignments) {
      if (assignment.url) {
        // Determine status
        let status = 'ongoing';
        if (assignment.status.toLowerCase().includes('ended')) {
          status = 'ended';
        }

        try {
          // Upsert assignment (update lastPolledAt to track freshness)
          console.log(`[Home API] Upserting assignment: ${assignment.url}`);
          const dbAssignment = await prisma.assignment.upsert({
            where: { url: assignment.url },
            update: {
              name: assignment.name,
              status,
              lastPolledAt: new Date(), // Update polling timestamp
            },
            create: {
              name: assignment.name,
              url: assignment.url,
              status,
              lastPolledAt: new Date(), // Set polling timestamp on create
            },
          });
          console.log(`[Home API] Assignment upserted with ID: ${dbAssignment.id}`);

          // Save problems
          if (assignment.problems.length > 0) {
            // Delete existing problems
            const deleteResult = await prisma.assignmentEntry.deleteMany({
              where: { assignmentId: dbAssignment.id },
            });
            console.log(`[Home API] Deleted ${deleteResult.count} existing problems`);

            // Create new problems
            const createResult = await prisma.assignmentEntry.createMany({
              data: assignment.problems.map(problem => ({
                assignmentId: dbAssignment.id,
                name: problem.name,
                url: problem.url,
              })),
            });
            console.log(`[Home API] Created ${createResult.count} problems`);
          }
        } catch (error) {
          console.error(`[Home API] Error saving assignment ${assignment.url}:`, error);
        }
      }
    }
    
    // Parse Teachers
    const teachers: any[] = [];
    $('h2:contains("Teachers")').next('table').find('tbody tr').each((_, el) => {
      const row = $(el);
      const nameEl = row.find('td').first();
      const nameLink = nameEl.find('a');
      const name = nameLink.length > 0 ? nameLink.text().trim() : nameEl.text().trim();
      const nameUrl = nameLink.attr('href') || null;
      
      const role = row.find('td').last().text().trim();
      
      teachers.push({
        name: name,
        url: nameUrl,
        role: role,
      });
    });
    
    return NextResponse.json({
      assignments: assignments,
      teachers: teachers,
      rawHtmlLength: html.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
