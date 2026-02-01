import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET() {
  try {
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
    const assignments: any[] = [];
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
      const problems: any[] = [];
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
