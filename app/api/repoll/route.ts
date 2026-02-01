import { NextResponse } from 'next/server';
import { repollAllData } from '@/lib/kattis-fetcher';

export async function POST() {
  try {
    console.log('[Repoll API] Repoll request received');
    const result = await repollAllData();
    
    return NextResponse.json({
      success: true,
      ...result,
      message: `Repoll completed. Processed ${result.assignmentsProcessed} assignments, updated ${result.assignmentsUpdated} assignment details and ${result.standingsUpdated} standings.`,
    });
  } catch (error) {
    console.error('[Repoll API] Error during repoll:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also allow GET for convenience
export async function GET() {
  return POST();
}
