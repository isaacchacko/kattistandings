'use client';

import React, { useEffect, useState } from 'react';

interface UserRanking {
  name: string;
  rank: number;
  totalScore: number;
  baseProblemsSolved: number;
  upsolveBonus: number;
  problemsNotDone: string[];
  problemsNotDoneCount: number;
  upsolvedProblems?: Array<{ assignmentName: string; assignmentUrl: string; problemName: string }>;
}

interface RankData {
  rankings: UserRanking[];
  totalUsers: number;
}

export default function RankPage() {
  const [rankings, setRankings] = useState<UserRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedUpsolves, setExpandedUpsolves] = useState<string | null>(null);
  const [linkedinUrls, setLinkedinUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRankings();
    fetchLinkedInUrls();
  }, []);

  const fetchLinkedInUrls = async () => {
    try {
      const response = await fetch('/linkedin_urls.json');
      if (response.ok) {
        const data = await response.json();
        setLinkedinUrls(data);
      }
    } catch (err) {
      // Silently fail - LinkedIn URLs are optional
      console.warn('Failed to load LinkedIn URLs:', err);
    }
  };

  const fetchRankings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/rank');
      if (!response.ok) {
        throw new Error('Failed to fetch rankings');
      }
      const data: RankData = await response.json();
      setRankings(data.rankings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRepoll = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const response = await fetch('/api/repoll', { method: 'POST' });
      if (!response.ok) {
        throw new Error('Failed to refresh data');
      }
      const result = await response.json();
      console.log('Repoll result:', result);
      
      // Refresh rankings after repoll
      await fetchRankings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading rankings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50">
            Global Rankings
          </h1>
          <button
            onClick={handleRepoll}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-left text-sm font-semibold text-black dark:text-zinc-50">
                    Rank
                  </th>
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-left text-sm font-semibold text-black dark:text-zinc-50">
                    Name
                  </th>
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-right text-sm font-semibold text-black dark:text-zinc-50">
                    Total Score
                  </th>
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-right text-sm font-semibold text-black dark:text-zinc-50">
                    Problems Solved
                  </th>
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-right text-sm font-semibold text-black dark:text-zinc-50">
                    Upsolve Bonus
                  </th>
                  <th className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-right text-sm font-semibold text-black dark:text-zinc-50">
                    Upsolved Problems
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-black dark:text-zinc-50">
                    Problems Not Done
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((user, index) => (
                  <React.Fragment key={user.name}>
                    <tr
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700 ${
                        index % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/50 dark:bg-zinc-800/30'
                      }`}
                    >
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-semibold text-black dark:text-zinc-50">
                        {user.rank}
                      </td>
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm font-medium text-black dark:text-zinc-50">
                        {linkedinUrls[user.name] && linkedinUrls[user.name].trim() ? (
                          <a
                            href={linkedinUrls[user.name]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                          >
                            <svg
                              className="w-4 h-4 text-blue-600 dark:text-blue-400"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                            </svg>
                            <span>{user.name}</span>
                          </a>
                        ) : (
                          <span>{user.name}</span>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-right font-semibold text-black dark:text-zinc-50">
                        {user.totalScore.toFixed(1)}
                      </td>
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-right text-zinc-600 dark:text-zinc-400">
                        {user.baseProblemsSolved}
                      </td>
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-right text-zinc-600 dark:text-zinc-400">
                        {user.upsolveBonus > 0 ? `+${user.upsolveBonus.toFixed(1)}` : '0.0'}
                      </td>
                      <td className="border-r border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-right">
                        {user.upsolvedProblems && user.upsolvedProblems.length > 0 ? (
                          <button
                            onClick={() => setExpandedUpsolves(expandedUpsolves === user.name ? null : user.name)}
                            className="text-green-600 dark:text-green-400 hover:underline"
                          >
                            {user.upsolvedProblems.length} {expandedUpsolves === user.name ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {user.problemsNotDoneCount > 0 ? (
                          <button
                            onClick={() => setExpandedUser(expandedUser === user.name ? null : user.name)}
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {user.problemsNotDoneCount} {expandedUser === user.name ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">0</span>
                        )}
                      </td>
                    </tr>
                    {expandedUpsolves === user.name && user.upsolvedProblems && user.upsolvedProblems.length > 0 && (
                      <tr className="bg-green-50 dark:bg-green-900/20">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="font-semibold mb-2 text-green-700 dark:text-green-400">Upsolved Problems:</div>
                            <div className="space-y-2">
                              {Object.entries(
                                user.upsolvedProblems.reduce((acc, item) => {
                                  if (!acc[item.assignmentName]) {
                                    acc[item.assignmentName] = { url: item.assignmentUrl, problems: [] };
                                  }
                                  acc[item.assignmentName].problems.push(item.problemName);
                                  return acc;
                                }, {} as Record<string, { url: string; problems: string[] }>)
                              ).map(([assignmentName, data]) => {
                                let fullUrl = data.url.startsWith('http') 
                                  ? data.url 
                                  : `https://tamu.kattis.com${data.url}`;
                                // Ensure it links to the standings page
                                if (!fullUrl.endsWith('/standings')) {
                                  fullUrl = fullUrl.endsWith('/') 
                                    ? `${fullUrl}standings` 
                                    : `${fullUrl}/standings`;
                                }
                                return (
                                  <div key={assignmentName} className="mb-3">
                                    <a
                                      href={fullUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-medium text-green-800 dark:text-green-300 mb-1 hover:underline cursor-pointer"
                                    >
                                      {assignmentName} ↗
                                    </a>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                      {data.problems.map((problem, idx) => (
                                        <span
                                          key={idx}
                                          className="px-2 py-1 bg-green-200 dark:bg-green-800 rounded text-xs"
                                        >
                                          {problem}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedUser === user.name && user.problemsNotDone.length > 0 && (
                      <tr className="bg-zinc-100 dark:bg-zinc-800/50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <div className="font-semibold mb-2">Problems Not Done:</div>
                            <div className="flex flex-wrap gap-2">
                              {user.problemsNotDone.map((problem, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 rounded text-xs"
                                >
                                  {problem}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {rankings.length === 0 && (
          <div className="text-center py-8 text-zinc-600 dark:text-zinc-400">
            No rankings available. Try refreshing the data.
          </div>
        )}
      </div>
    </div>
  );
}
