import * as cheerio from 'cheerio';
import { prisma } from './prisma';

// Polling interval in milliseconds (5 minutes)
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Check if home page data needs to be refreshed
 */
export async function shouldRefreshHomeData(): Promise<boolean> {
  try {
    const assignments = await prisma.assignment.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      take: 1, // Just check the most recently updated one
    });

    // If no assignments exist, we need to fetch
    if (assignments.length === 0) {
      console.log(`[Poll Check] No assignments found - needs refresh`);
      return true;
    }

    // Check if the most recently updated assignment is older than polling interval
    const mostRecent = assignments[0];
    if (!mostRecent.updatedAt) {
      console.log(`[Poll Check] Assignment has no updatedAt - needs refresh`);
      return true;
    }

    const timeSinceUpdate = Date.now() - mostRecent.updatedAt.getTime();
    const needsRefresh = timeSinceUpdate > POLLING_INTERVAL_MS;
    console.log(`[Poll Check] Home data - Last update: ${mostRecent.updatedAt.toISOString()}, Time since: ${Math.round(timeSinceUpdate / 1000)}s, Needs refresh: ${needsRefresh}`);
    return needsRefresh;
  } catch (error) {
    console.error(`[Poll Check] Error checking home data:`, error);
    // If there's an error, assume we need to refresh
    return true;
  }
}

/**
 * Check if an assignment needs to be polled
 */
export async function shouldPollAssignment(assignmentUrl: string): Promise<boolean> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { url: assignmentUrl },
    });

    // If assignment doesn't exist, we need to poll
    if (!assignment) {
      console.log(`[Poll Check] Assignment not found: ${assignmentUrl} - needs polling`);
      return true;
    }

    // If never polled, we need to poll
    if (!assignment.lastPolledAt) {
      console.log(`[Poll Check] Assignment never polled: ${assignmentUrl} - needs polling`);
      return true;
    }

    // Check if last poll was more than POLLING_INTERVAL_MS ago
    const timeSinceLastPoll = Date.now() - assignment.lastPolledAt.getTime();
    const needsPolling = timeSinceLastPoll > POLLING_INTERVAL_MS;
    console.log(`[Poll Check] Assignment: ${assignmentUrl}, Last polled: ${assignment.lastPolledAt.toISOString()}, Time since: ${Math.round(timeSinceLastPoll / 1000)}s, Needs polling: ${needsPolling}`);
    return needsPolling;
  } catch (error) {
    console.error(`[Poll Check] Error checking assignment ${assignmentUrl}:`, error);
    // If there's an error, assume we need to poll
    return true;
  }
}

/**
 * Fetch assignment data from Kattis and save to database
 */
export async function fetchAndSaveAssignment(assignmentUrl: string): Promise<void> {
  // Construct full URL if it's a relative path
  const fullUrl = assignmentUrl.startsWith('http')
    ? assignmentUrl
    : `https://tamu.kattis.com${assignmentUrl}`;

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch assignment: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  
  // Extract assignment title
  const title = $('h1').first().text().trim();
  
  // Extract stats from strip-grid-item
  const stats: Record<string, number> = {};
  $('.strip-grid-item').each((_, el) => {
    const item = $(el);
    const label = item.find('.text-sm').text().trim().toLowerCase();
    const valueText = item.find('.text-xl').text().trim();
    const value = parseInt(valueText, 10);
    if (label && !isNaN(value)) {
      stats[label] = value;
    }
  });
  
  // Extract time information from data-props
  const timeData: Record<string, any> = {};
  const contestTimeEl = $('#contest_time');
  if (contestTimeEl.length > 0) {
    const dataProps = contestTimeEl.attr('data-props');
    if (dataProps) {
      try {
        const props = JSON.parse(dataProps.replace(/&quot;/g, '"'));
        timeData.has_start = props.has_start;
        timeData.elapsed_seconds = props.elapsed_seconds;
        timeData.total_seconds = props.total_seconds;
      } catch (e) {
        // Ignore parse errors
      }
    }
  }
  
  // Extract time information from visible elements
  const timeInfo: Record<string, string> = {};
  $('.time-elapsed, .time-remaining, .starts-in').each((_, el) => {
    const item = $(el);
    const label = item.find('h4').text().trim();
    const value = item.find('span').text().trim();
    if (label && value) {
      timeInfo[label.toLowerCase().replace(/\s+/g, '_')] = value;
    }
  });
  
  // Extract count_until_end if available
  const endsIn = $('.count_until_end').text().trim();
  if (endsIn) {
    timeInfo['ends_in'] = endsIn;
  }
  
  const startsIn = $('.starts-in span').text().trim();
  if (startsIn) {
    timeInfo['starts_in'] = startsIn;
  }
  
  // Helper function to validate problem names (same as in fetchAndSaveStandings)
  const isValidProblemName = (name: string): boolean => {
    if (!name || name.trim().length === 0) return false;
    // Filter out navigation text and invalid patterns
    const invalidPatterns = [
      /^courses$/i,
      /^jobs$/i,
      /^languages$/i,
      /^info$/i,
      /^help$/i,
      /coursesjobs/i,
      /^rank$/i,
      /^group$/i,
      /^slv$/i,
      /^time$/i,
    ];
    const trimmed = name.trim();
    // Must be reasonable length (between 1 and 100 characters)
    if (trimmed.length < 1 || trimmed.length > 100) return false;
    // Check against invalid patterns
    for (const pattern of invalidPatterns) {
      if (pattern.test(trimmed)) return false;
    }
    return true;
  };

  // NOTE: We do NOT extract problems from the assignment page here
  // Problems are extracted from the home page in fetchAndSaveHomeData()
  // The assignment page often doesn't have a proper problems list, and trying to extract
  // from it can capture navigation links instead of actual problems
  const problems: Array<{ name: string; url: string }> = [];
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:152',message:'Skipping problem extraction from assignment page',data:{assignmentUrl,reason:'Problems are extracted from home page in fetchAndSaveHomeData()'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // Determine status from timeInfo or default
  let status = 'ongoing';
  if (timeInfo['ends_in']?.toLowerCase().includes('ended') || timeInfo['time_remaining']?.toLowerCase().includes('ended')) {
    status = 'ended';
  } else if (timeData.has_start === false) {
    status = 'ongoing';
  }

  // Upsert assignment
  console.log(`[Kattis Fetcher] Upserting assignment: ${assignmentUrl}`);
  const assignment = await prisma.assignment.upsert({
    where: { url: assignmentUrl },
    update: {
      title,
      status,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
      timeInfo: Object.keys(timeInfo).length > 0 ? timeInfo : undefined,
      timeData: Object.keys(timeData).length > 0 ? timeData : undefined,
      lastPolledAt: new Date(),
    },
    create: {
      name: title || assignmentUrl.split('/').pop() || 'Unknown',
      url: assignmentUrl,
      title,
      status,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
      timeInfo: Object.keys(timeInfo).length > 0 ? timeInfo : undefined,
      timeData: Object.keys(timeData).length > 0 ? timeData : undefined,
      lastPolledAt: new Date(),
    },
  });
  console.log(`[Kattis Fetcher] Assignment upserted with ID: ${assignment.id}`);

  // NOTE: We do NOT save problems here - they are saved by fetchAndSaveHomeData()
  // This prevents overwriting valid problems with invalid ones extracted from assignment pages
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:228',message:'Skipping problem save - handled by fetchAndSaveHomeData()',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
}

/**
 * Fetch standings data from Kattis and save to database
 */
export async function fetchAndSaveStandings(assignmentUrl: string): Promise<void> {
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:186',message:'fetchAndSaveStandings entry',data:{assignmentUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'})}).catch(()=>{});
  // #endregion
  // Construct full URL - append /standings if not already present
  let fullUrl: string;
  if (assignmentUrl.startsWith('http')) {
    fullUrl = assignmentUrl.endsWith('/standings') 
      ? assignmentUrl 
      : `${assignmentUrl}/standings`;
  } else {
    const baseUrl = assignmentUrl.endsWith('/standings')
      ? assignmentUrl
      : `${assignmentUrl}/standings`;
    fullUrl = `https://tamu.kattis.com${baseUrl}`;
  }
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:198',message:'Before fetch standings',data:{fullUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'})}).catch(()=>{});
  // #endregion

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:207',message:'Standings fetch failed',data:{status:response.status,statusText:response.statusText,fullUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    throw new Error(`Failed to fetch standings: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:212',message:'After fetch HTML',data:{htmlLength:html.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'J'})}).catch(()=>{});
  // #endregion
  const $ = cheerio.load(html);
  
  // Extract assignment title
  const title = $('h1').first().text().trim();
  
  // Find the standings table
  const table = $('table.standings-table, table.table2').first();
  
  // Extract problem names from table headers
  const problemNames: string[] = [];
  
  // Helper function to validate problem names
  const isValidProblemName = (name: string): boolean => {
    if (!name || name.trim().length === 0) return false;
    // Filter out navigation text and invalid patterns
    const invalidPatterns = [
      /^courses$/i,
      /^jobs$/i,
      /^languages$/i,
      /^info$/i,
      /^help$/i,
      /coursesjobs/i,
      /^rank$/i,
      /^group$/i,
      /^slv$/i,
      /^time$/i,
    ];
    const trimmed = name.trim();
    // Must be reasonable length (between 1 and 100 characters)
    if (trimmed.length < 1 || trimmed.length > 100) return false;
    // Check against invalid patterns
    for (const pattern of invalidPatterns) {
      if (pattern.test(trimmed)) return false;
    }
    return true;
  };
  
  table.find('thead th.standings-cell-problem').each((_, el) => {
    const header = $(el);
    const link = header.find('a.col-url');
    if (link.length > 0) {
      const problemName = link.attr('title') || link.text().trim();
      if (problemName && isValidProblemName(problemName)) {
        problemNames.push(problemName);
      }
    } else {
      const text = header.text().trim();
      if (text && isValidProblemName(text)) {
        problemNames.push(text);
      }
    }
  });
  
  // If no problem names found, try alternative method
  if (problemNames.length === 0) {
    table.find('thead th[data-name^="problem"]').each((_, el) => {
      const header = $(el);
      const link = header.find('a');
      const problemName = link.attr('title') || link.text().trim();
      if (problemName && isValidProblemName(problemName)) {
        problemNames.push(problemName);
      }
    });
  }
  
  // Extract standings data
  const standings: Array<{
    rank: number;
    name: string;
    solvedCount: number;
    totalTimeMinutes: number;
    problems: Array<{
      solved: boolean;
      first?: boolean;
      attempted?: boolean;
      attempts: number;
      time: string | null;
    }>;
  }> = [];

  table.find('tbody tr').each((_, el) => {
    const row = $(el);
    
    const rankCell = row.find('td.font-bold').first() || row.find('td').first();
    const rank = parseInt(rankCell.text().trim(), 10) || 0;
    
    const nameCell = row.find('td.standings-cell--expand');
    const name = nameCell.find('div').text().trim() || nameCell.text().trim();
    
    const solvedCountCell = row.find('td.standings-cell-score');
    const solvedCount = parseInt(solvedCountCell.text().trim(), 10) || 0;
    
    const timeCell = row.find('td.standings-cell-time');
    const timeFromTable = parseInt(timeCell.text().trim(), 10) || 0;
    
    const problems: Array<{
      solved: boolean;
      first?: boolean;
      attempted?: boolean;
      attempts: number;
      time: string | null;
    }> = [];
    
    row.find('td.standings-cell-problem').each((index, problemEl) => {
      const problemCell = $(problemEl);
      
      const first = problemCell.find('.first').length > 0;
      const solved = problemCell.find('.solved, .first').length > 0;
      const attempted = problemCell.find('.attempted').length > 0;
      const attemptsText = problemCell.find('.standings-table-result-cell-primary').text().trim();
      const attempts = attemptsText ? parseInt(attemptsText, 10) : 0;
      const timeText = problemCell.find('.standings-table-result-cell-time').text().trim();
      const validTimeText = timeText && timeText !== '-' ? timeText : null;
      
      problems.push({
        solved,
        first,
        attempted,
        attempts,
        time: validTimeText,
      });
    });
    
    standings.push({
      rank,
      name,
      solvedCount,
      totalTimeMinutes: timeFromTable,
      problems,
    });
  });

  // Get or create assignment
  let assignment = await prisma.assignment.findUnique({
    where: { url: assignmentUrl },
  });

  if (!assignment) {
    // Create assignment if it doesn't exist
    assignment = await prisma.assignment.create({
      data: {
        name: title || assignmentUrl.split('/').pop() || 'Unknown',
        url: assignmentUrl,
        title,
        status: 'ongoing',
        lastPolledAt: new Date(),
      },
    });
  } else {
    // Update lastPolledAt
    await prisma.assignment.update({
      where: { id: assignment.id },
      data: { lastPolledAt: new Date() },
    });
  }

  // Delete existing ranks for this assignment
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:340',message:'Before deleteMany ranks',data:{assignmentId:assignment.id,standingsCount:standings.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'L'})}).catch(()=>{});
  // #endregion
  console.log(`[Kattis Fetcher] Deleting existing ranks for assignment: ${assignment.id}`);
  const deleteResult = await prisma.rank.deleteMany({
    where: { assignmentId: assignment.id },
  });
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:345',message:'After deleteMany ranks',data:{deletedCount:deleteResult.count},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'L'})}).catch(()=>{});
  // #endregion
  console.log(`[Kattis Fetcher] Deleted ${deleteResult.count} existing ranks`);

  // Use upsert for each rank to handle duplicates and ensure atomic updates
  // #region agent log
  fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:349',message:'Before upsert ranks',data:{standingsCount:standings.length,firstEntry:standings[0]?{rank:standings[0].rank,name:standings[0].name}:null},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'L'})}).catch(()=>{});
  // #endregion
  console.log(`[Kattis Fetcher] Upserting ${standings.length} rank entries`);
  try {
    // Use Promise.all to upsert all ranks in parallel
    // Note: Prisma uses the unique constraint name for composite keys
    const upsertPromises = standings.map(entry =>
      prisma.rank.upsert({
        where: {
          assignmentId_name: {
            assignmentId: assignment.id,
            name: entry.name,
          },
        },
        update: {
          rank: entry.rank,
          solvedCount: entry.solvedCount,
          totalTimeMinutes: entry.totalTimeMinutes,
          problems: entry.problems,
          standingsTitle: title,
          standingsUrl: fullUrl,
          problemNames,
        },
        create: {
          assignmentId: assignment.id,
          rank: entry.rank,
          name: entry.name,
          solvedCount: entry.solvedCount,
          totalTimeMinutes: entry.totalTimeMinutes,
          problems: entry.problems,
          standingsTitle: title,
          standingsUrl: fullUrl,
          problemNames,
        },
      })
    );
    await Promise.all(upsertPromises);
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:380',message:'After upsert ranks',data:{upsertedCount:standings.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    console.log(`[Kattis Fetcher] Upserted ${standings.length} rank entries`);
  } catch (upsertError) {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:383',message:'Error in upsert ranks',data:{error:upsertError instanceof Error?upsertError.message:String(upsertError),stack:upsertError instanceof Error?upsertError.stack:undefined,standingsCount:standings.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run3',hypothesisId:'L'})}).catch(()=>{});
    // #endregion
    throw upsertError;
  }
}

/**
 * Fetch and save home page data (assignments list) from Kattis
 */
export async function fetchAndSaveHomeData(): Promise<void> {
  const response = await fetch('https://tamu.kattis.com/courses/CSCE430/2026Spring', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch home page: ${response.status} ${response.statusText}`);
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
    
    // Helper function to validate problem names (same as in fetchAndSaveStandings)
    const isValidProblemName = (name: string): boolean => {
      if (!name || name.trim().length === 0) return false;
      // Filter out navigation text and invalid patterns
      const invalidPatterns = [
        /^courses$/i,
        /^jobs$/i,
        /^languages$/i,
        /^info$/i,
        /^help$/i,
        /coursesjobs/i,
        /^rank$/i,
        /^group$/i,
        /^slv$/i,
        /^time$/i,
      ];
      const trimmed = name.trim();
      // Must be reasonable length (between 1 and 100 characters)
      if (trimmed.length < 1 || trimmed.length > 100) return false;
      // Check against invalid patterns
      for (const pattern of invalidPatterns) {
        if (pattern.test(trimmed)) return false;
      }
      return true;
    };

    // Extract problems from the next sibling <ol>
    const problems: Array<{ name: string; url: string }> = [];
    const problemsList = assignmentEl.next('ol');
    if (problemsList.length > 0) {
      problemsList.find('> li').each((_, problemEl) => {
        const problemLink = $(problemEl).find('a');
        const problemName = problemLink.text().trim();
        const problemUrl = problemLink.attr('href') || '';
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:573',message:'Extracting problem from home page',data:{assignmentName,problemName,problemUrl,isValid:problemName && problemUrl && isValidProblemName(problemName)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // Only add if it's a valid problem name and URL
        if (problemName && problemUrl && isValidProblemName(problemName)) {
          problems.push({
            name: problemName,
            url: problemUrl,
          });
        }
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
  console.log(`[Repoll] Saving ${assignments.length} assignments to database`);
  for (const assignment of assignments) {
    if (assignment.url) {
      // Determine status
      let status = 'ongoing';
      if (assignment.status.toLowerCase().includes('ended')) {
        status = 'ended';
      }

      try {
        // Upsert assignment (update lastPolledAt to track freshness)
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

        // Save problems
        if (assignment.problems.length > 0) {
          // Delete existing problems
          await prisma.assignmentEntry.deleteMany({
            where: { assignmentId: dbAssignment.id },
          });

          // Create new problems
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/6009d8cc-1a1c-4e6b-a6b9-d1cb003052c3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/kattis-fetcher.ts:630',message:'Saving problems to database',data:{assignmentName:assignment.name,assignmentUrl:assignment.url,problemsCount:assignment.problems.length,problemNames:assignment.problems.map(p=>p.name)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          await prisma.assignmentEntry.createMany({
            data: assignment.problems.map(problem => ({
              assignmentId: dbAssignment.id,
              name: problem.name,
              url: problem.url,
            })),
          });
        }
      } catch (error) {
        console.error(`[Repoll] Error saving assignment ${assignment.url}:`, error);
        // Continue with other assignments even if one fails
      }
    }
  }
}

/**
 * Repoll all data to ensure database is completely fresh
 * This function:
 * 1. Fetches fresh home page data (all assignments)
 * 2. For each assignment, fetches fresh assignment details
 * 3. For each assignment, fetches fresh standings data
 */
export async function repollAllData(): Promise<{
  assignmentsProcessed: number;
  assignmentsUpdated: number;
  standingsUpdated: number;
  errors: Array<{ assignmentUrl: string; error: string }>;
}> {
  console.log('[Repoll] Starting full data repoll...');
  const startTime = Date.now();
  const errors: Array<{ assignmentUrl: string; error: string }> = [];
  let assignmentsUpdated = 0;
  let standingsUpdated = 0;

  try {
    // Step 1: Fetch and save home page data (all assignments)
    console.log('[Repoll] Step 1: Fetching home page data...');
    await fetchAndSaveHomeData();

    // Step 2: Get all assignments from database
    const assignments = await prisma.assignment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[Repoll] Step 2: Processing ${assignments.length} assignments...`);

    // Step 3: For each assignment, fetch fresh assignment details and standings
    for (const assignment of assignments) {
      try {
        console.log(`[Repoll] Processing assignment: ${assignment.url}`);

        // Fetch fresh assignment details
        try {
          await fetchAndSaveAssignment(assignment.url);
          assignmentsUpdated++;
          console.log(`[Repoll] ✓ Updated assignment details: ${assignment.url}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ assignmentUrl: assignment.url, error: `Assignment details: ${errorMsg}` });
          console.error(`[Repoll] ✗ Failed to update assignment details: ${assignment.url}`, error);
        }

        // Fetch fresh standings
        try {
          await fetchAndSaveStandings(assignment.url);
          standingsUpdated++;
          console.log(`[Repoll] ✓ Updated standings: ${assignment.url}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push({ assignmentUrl: assignment.url, error: `Standings: ${errorMsg}` });
          console.error(`[Repoll] ✗ Failed to update standings: ${assignment.url}`, error);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ assignmentUrl: assignment.url, error: `General: ${errorMsg}` });
        console.error(`[Repoll] ✗ Error processing assignment: ${assignment.url}`, error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Repoll] Completed in ${duration}s. Updated ${assignmentsUpdated} assignments, ${standingsUpdated} standings. ${errors.length} errors.`);

    return {
      assignmentsProcessed: assignments.length,
      assignmentsUpdated,
      standingsUpdated,
      errors,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Repoll] Fatal error during repoll:', error);
    throw new Error(`Repoll failed: ${errorMsg}`);
  }
}
