import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper function to parse time string like "20 min" to minutes
function parseTimeToMinutes(timeStr: string | null): number {
  if (!timeStr) return 0;
  
  // Match patterns like "20 min", "1:30", "2:45:30", etc.
  const minMatch = timeStr.match(/(\d+)\s*min/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }
  
  // Match time format like "1:30" (hours:minutes) or "2:45:30" (hours:minutes:seconds)
  const timeMatch = timeStr.match(/(\d+):(\d+)(?::(\d+))?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10) || 0;
    const minutes = parseInt(timeMatch[2], 10) || 0;
    const seconds = parseInt(timeMatch[3], 10) || 0;
    return hours * 60 + minutes + (seconds > 0 ? 1 : 0); // Round up if seconds exist
  }
  
  return 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentUrl = searchParams.get('url');

    if (!assignmentUrl) {
      return NextResponse.json(
        { error: 'Missing url parameter' },
        { status: 400 }
      );
    }

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

    const response = await fetch(fullUrl, {
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
    
    // Extract assignment title
    const title = $('h1').first().text().trim();
    
    // Find the standings table
    const table = $('table.standings-table, table.table2').first();
    
    // Extract problem names from table headers - get from <a title="..."> attributes
    const problemNames: string[] = [];
    table.find('thead th.standings-cell-problem').each((_, el) => {
      const header = $(el);
      const link = header.find('a.col-url');
      if (link.length > 0) {
        const problemName = link.attr('title') || link.text().trim();
        if (problemName) {
          problemNames.push(problemName);
        }
      } else {
        // Fallback: use text content
        const text = header.text().trim();
        if (text && text.length > 0 && text.length < 50) {
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
        if (problemName && problemName.length > 0) {
          problemNames.push(problemName);
        }
      });
    }
    
    // Extract standings data
    const standings: any[] = [];
    table.find('tbody tr').each((_, el) => {
      const row = $(el);
      
      // Get rank (first td with font-bold class or just first td)
      const rankCell = row.find('td.font-bold').first() || row.find('td').first();
      const rank = parseInt(rankCell.text().trim(), 10) || 0;
      
      // Get name/group (standings-cell--expand)
      const nameCell = row.find('td.standings-cell--expand');
      const name = nameCell.find('div').text().trim() || nameCell.text().trim();
      
      // Get solved count (standings-cell-score)
      const solvedCountCell = row.find('td.standings-cell-score');
      const solvedCount = parseInt(solvedCountCell.text().trim(), 10) || 0;
      
      // Get time (standings-cell-time) - this is the total time already calculated
      // But we'll recalculate it from problem data to ensure accuracy
      const timeCell = row.find('td.standings-cell-time');
      const timeFromTable = parseInt(timeCell.text().trim(), 10) || 0;
      
      // Get problem results
      const problems: any[] = [];
      
      row.find('td.standings-cell-problem').each((index, problemEl) => {
        const problemCell = $(problemEl);
        
        // Check if solved first (has .first class)
        const first = problemCell.find('.first').length > 0;
        
        // Check if solved (has .solved or .first class)
        const solved = problemCell.find('.solved, .first').length > 0;
        
        // Check if attempted but not solved (has .attempted class)
        const attempted = problemCell.find('.attempted').length > 0;
        
        // Get attempts - should be present for both solved and attempted problems
        const attemptsText = problemCell.find('.standings-table-result-cell-primary').text().trim();
        const attempts = attemptsText ? parseInt(attemptsText, 10) : 0;
        
        // Get solve time (may be "-" for attempted but unsolved problems)
        const timeText = problemCell.find('.standings-table-result-cell-time').text().trim();
        // Filter out "-" and empty strings - time only exists for solved problems
        const validTimeText = timeText && timeText !== '-' ? timeText : null;
        
        problems.push({
          solved: solved,
          first: first, // Track if problem was solved first
          attempted: attempted, // Track if problem was attempted but not solved
          attempts: attempts, // Show attempts for both solved and attempted-but-not-solved
          time: validTimeText, // Only include valid time strings (not "-"), only exists for solved problems
        });
      });
      
      standings.push({
        rank: rank,
        name: name,
        solvedCount: solvedCount,
        totalTimeMinutes: timeFromTable, // Use time from table (already calculated with penalties)
        problems: problems,
      });
    });
    
    return NextResponse.json({
      title: title,
      url: assignmentUrl,
      problemNames: problemNames,
      standings: standings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
