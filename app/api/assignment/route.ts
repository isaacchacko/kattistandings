import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

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
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
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
    
    // Extract problems list if available on this page
    const problems: any[] = [];
    $('ol > li, ul > li').each((_, el) => {
      const problemLink = $(el).find('a');
      if (problemLink.length > 0) {
        const problemName = problemLink.text().trim();
        const problemUrl = problemLink.attr('href') || '';
        if (problemName && problemUrl) {
          problems.push({
            name: problemName,
            url: problemUrl,
          });
        }
      }
    });
    
    return NextResponse.json({
      title: title,
      url: assignmentUrl,
      stats: stats,
      timeInfo: timeInfo,
      timeData: Object.keys(timeData).length > 0 ? timeData : undefined,
      problems: problems.length > 0 ? problems : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
