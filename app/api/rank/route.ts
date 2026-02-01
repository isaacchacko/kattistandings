import { NextResponse } from 'next/server';
import { calculateGlobalRankings } from '@/lib/rank-calculator';

export async function GET() {
  try {
    const rankings = await calculateGlobalRankings();
    
    return NextResponse.json({
      rankings,
      totalUsers: rankings.length,
    });
  } catch (error) {
    console.error('[Rank API] Error calculating rankings:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        rankings: [],
      },
      { status: 500 }
    );
  }
}
