'use client';

import { useEffect, useState } from 'react';

interface Problem {
  name: string;
  url: string;
}

interface Assignment {
  name: string;
  url: string;
  status: string;
  problems: Problem[];
}

interface AssignmentDetails {
  title: string;
  url: string;
  stats: Record<string, number>;
  timeInfo: Record<string, string>;
  timeData?: Record<string, any>;
  problems?: Problem[];
}

interface ProblemResult {
  solved: boolean;
  first?: boolean;
  attempted?: boolean;
  attempts: number;
  time: string | null;
}

interface StandingsEntry {
  rank: number;
  name: string;
  solvedCount: number;
  totalTimeMinutes: number;
  problems: ProblemResult[];
}

interface StandingsData {
  title: string;
  url: string;
  problemNames: string[];
  standings: StandingsEntry[];
}

export default function Home() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);
  const [assignmentDetails, setAssignmentDetails] = useState<AssignmentDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedStandings, setSelectedStandings] = useState<string | null>(null);
  const [standingsData, setStandingsData] = useState<StandingsData | null>(null);
  const [loadingStandings, setLoadingStandings] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/home');
      if (!response.ok) {
        throw new Error('Failed to fetch assignments');
      }
      const data = await response.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignmentDetails = async (url: string) => {
    if (selectedAssignment === url && assignmentDetails) {
      // Already loaded, just toggle
      setSelectedAssignment(null);
      setAssignmentDetails(null);
      return;
    }

    try {
      setLoadingDetails(true);
      setSelectedAssignment(url);
      const response = await fetch(`/api/assignment?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch assignment details');
      }
      const data = await response.json();
      setAssignmentDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSelectedAssignment(null);
    } finally {
      setLoadingDetails(false);
    }
  };

  const fetchStandings = async (url: string) => {
    if (selectedStandings === url && standingsData) {
      // Already loaded, just toggle
      setSelectedStandings(null);
      setStandingsData(null);
      return;
    }

    try {
      setLoadingStandings(true);
      setSelectedStandings(url);
      const response = await fetch(`/api/standings?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch standings');
      }
      const data = await response.json();
      setStandingsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSelectedStandings(null);
    } finally {
      setLoadingStandings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading assignments...</div>
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
        <h1 className="text-3xl font-bold mb-8 text-black dark:text-zinc-50">
          CSCE 430 Assignments
        </h1>

        <div className="space-y-4">
          {assignments.map((assignment, index) => (
            <div
              key={index}
              className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6 border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
                    {assignment.name}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <span className={assignment.status.includes('Ended') ? 'text-red-600' : 'text-green-600'}>
                      {assignment.status}
                    </span>
                    <span>{assignment.problems.length} problems</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchAssignmentDetails(assignment.url)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    disabled={loadingDetails}
                  >
                    {loadingDetails && selectedAssignment === assignment.url
                      ? 'Loading...'
                      : selectedAssignment === assignment.url
                      ? 'Hide Details'
                      : 'View Details'}
                  </button>
                  <button
                    onClick={() => fetchStandings(assignment.url)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    disabled={loadingStandings}
                  >
                    {loadingStandings && selectedStandings === assignment.url
                      ? 'Loading...'
                      : selectedStandings === assignment.url
                      ? 'Hide Standings'
                      : 'View Standings'}
                  </button>
                </div>
              </div>

              {assignment.problems.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                    Problems:
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {assignment.problems.map((problem, pIndex) => (
                      <li key={pIndex}>{problem.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedAssignment === assignment.url && assignmentDetails && (
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">
                    Assignment Details
                  </h3>
                  
                  {Object.keys(assignmentDetails.stats).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {Object.entries(assignmentDetails.stats).map(([key, value]) => (
                        <div
                          key={key}
                          className="bg-zinc-100 dark:bg-zinc-800 rounded p-3 text-center"
                        >
                          <div className="text-2xl font-bold text-black dark:text-zinc-50">
                            {value}
                          </div>
                          <div className="text-xs text-zinc-600 dark:text-zinc-400 capitalize">
                            {key}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {assignmentDetails.timeData && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Time Data:
                      </h4>
                      <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {Object.entries(assignmentDetails.timeData).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(assignmentDetails.timeInfo).length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Time Information:
                      </h4>
                      <div className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {Object.entries(assignmentDetails.timeInfo).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span>{value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {assignmentDetails.problems && assignmentDetails.problems.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
                        Problems from Assignment Page:
                      </h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {assignmentDetails.problems.map((problem, pIndex) => (
                          <li key={pIndex}>{problem.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {selectedStandings === assignment.url && standingsData && (
                <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                  <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-4">
                    Standings
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-700">
                      <thead>
                        <tr className="bg-zinc-100 dark:bg-zinc-800">
                          <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                            Rank
                          </th>
                          <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-left text-sm font-semibold text-black dark:text-zinc-50">
                            Group
                          </th>
                          <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-right text-sm font-semibold text-black dark:text-zinc-50">
                            Slv.
                          </th>
                          <th className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-right text-sm font-semibold text-black dark:text-zinc-50">
                            Time
                          </th>
                          {standingsData.problemNames.map((problemName, pIndex) => {
                            const letter = String.fromCharCode(65 + pIndex); // A, B, C, etc.
                            return (
                              <th
                                key={pIndex}
                                title={problemName}
                                className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-center text-sm font-semibold text-black dark:text-zinc-50 cursor-help"
                              >
                                {letter}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {standingsData.standings.map((entry, index) => (
                          <tr
                            key={index}
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                          >
                            <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400">
                              {index + 1}
                            </td>
                            <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-black dark:text-zinc-50">
                              {entry.name}
                            </td>
                            <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-right font-semibold text-black dark:text-zinc-50">
                              {entry.solvedCount}
                            </td>
                            <td className="border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-right font-semibold text-black dark:text-zinc-50">
                              {entry.totalTimeMinutes}
                            </td>
                            {standingsData.problemNames.map((problemName, pIndex) => {
                              const problem = entry.problems[pIndex];
                              return (
                                <td
                                  key={pIndex}
                                  className={`border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-center text-sm ${
                                    problem?.solved
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : 'text-zinc-400 dark:text-zinc-600'
                                  }`}
                                >
                                  {problem?.solved ? (
                                    <div className="flex flex-col items-center">
                                      {problem.first ? (
                                        <span className="font-semibold text-yellow-600 dark:text-yellow-400" title="First to solve">
                                          ⭐
                                        </span>
                                      ) : (
                                        <span className="font-semibold">✓</span>
                                      )}
                                      <span className="text-xs">
                                        {problem.attempts > 0 ? `${problem.attempts}` : ''}
                                      </span>
                                      {problem.time && (
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                          {problem.time}
                                        </span>
                                      )}
                                    </div>
                                  ) : problem?.attempted && problem.attempts > 0 ? (
                                    <div className="flex flex-col items-center">
                                      <span className="font-semibold text-red-600">✗</span>
                                      <span className="text-xs">
                                        {problem.attempts}
                                      </span>
                                    </div>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
