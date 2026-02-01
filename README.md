# Kattis Standings Tracker

A Next.js application that tracks and displays competitive programming standings from Kattis, with support for global rankings, upsolve tracking, and detailed problem statistics.

## Overview

This application scrapes data from Kattis (specifically `tamu.kattis.com`) to track student performance across multiple assignments. It maintains a database of assignments, problems, user rankings, and individual problem results, then calculates global rankings with a custom scoring system that includes upsolve bonuses.

## Database Schema & Relationships

The application uses Prisma ORM with PostgreSQL. The database consists of four main models:

### 1. Assignment
Represents a competitive programming assignment/contest on Kattis.

- **Fields:**
  - `id`: Unique identifier (UUID)
  - `name`: Assignment name (e.g., "CSCE 430 Spring 2026 - Lab 01")
  - `url`: Unique Kattis URL for the assignment
  - `status`: "ongoing", "ended", or "locked"
  - `stats`: JSON object with statistics (students, problems, etc.)
  - `timeData`: JSON object with timing information
  - `lastPolledAt`: Timestamp of last data fetch

- **Relationships:**
  - Has many `AssignmentEntry` (problems in the assignment)
  - Has many `Rank` (user rankings for this assignment)
  - Has many `ProblemResult` (individual problem solutions)

### 2. AssignmentEntry
Represents a single problem within an assignment.

- **Fields:**
  - `id`: Unique identifier
  - `assignmentId`: Foreign key to Assignment
  - `name`: Problem name
  - `url`: Problem URL

- **Relationships:**
  - Belongs to one `Assignment`

### 3. Rank
Represents a user's ranking within a specific assignment.

- **Fields:**
  - `id`: Unique identifier
  - `assignmentId`: Foreign key to Assignment
  - `name`: User name (e.g., "John Doe")
  - `rank`: User's rank in this assignment (1, 2, 3, ...)
  - `solvedCount`: Number of problems solved
  - `totalTimeMinutes`: Total time taken (in minutes)
  - `problems`: JSON array of problem results from standings page
  - `problemNames`: Array of problem names in order

- **Relationships:**
  - Belongs to one `Assignment`
  - Has many `ProblemResult` (via `rankId`)

- **Constraints:**
  - Unique constraint on `(assignmentId, name)` - one rank entry per user per assignment

### 4. ProblemResult
Represents a user's result for a specific problem in a specific assignment.

- **Fields:**
  - `id`: Unique identifier
  - `name`: User name
  - `assignmentId`: Foreign key to Assignment
  - `problemName`: Name of the problem
  - `isUpsolve`: Boolean indicating if this is from an upsolve assignment
  - `attempts`: Number of attempts before solving (0 if not solved)
  - `solvedTime`: Integer minutes into competition when solved (null if not solved)
  - `rankId`: Optional foreign key to Rank (links to the user's rank entry)

- **Relationships:**
  - Belongs to one `Assignment`
  - Optionally belongs to one `Rank` (via `rankId`)

- **Constraints:**
  - Unique constraint on `(name, assignmentId, problemName)` - one result per user per problem per assignment

## Scoring System

The global ranking system uses a two-part scoring mechanism:

### Base Score (baseProblemsSolved)
- **1 point per problem solved** in non-upsolve assignments
- Only problems from assignments that do NOT have "upsolve" or "UPSOLVE" in their name count toward base score
- Problems are considered "solved" if a `ProblemResult` record exists for that user/problem/assignment combination (regardless of `solvedTime` value)

### Upsolve Bonus (upsolveBonus)
- **0.5 points per problem** solved in an upsolve assignment that was NOT solved in the original assignment
- Upsolve assignments are identified by having "upsolve" or "UPSOLVE" in the assignment name
- The system matches upsolve assignments to their original assignments by:
  1. Removing "UPSOLVE"/"upsolve" from the upsolve assignment name
  2. Normalizing whitespace and dashes
  3. Finding the matching original assignment by name (exact or partial match)

**Upsolve Bonus Calculation:**
- If a user did NOT participate in the original assignment: All problems solved in the upsolve count (0.5 points each)
- If a user DID participate in the original assignment: Only problems solved in upsolve but NOT in the original count (0.5 points each)
- Problem name matching is case-insensitive and normalized (trimmed, lowercased)

### Total Score
```
totalScore = baseProblemsSolved + upsolveBonus
```

### Ranking Logic
Users are ranked by:
1. **Primary:** Total score (descending)
2. **Secondary:** Base problems solved (descending)
3. **Tertiary:** Name (ascending, for consistency)

Users with the same total score receive the same rank (ties are allowed).

## Data Flow

### 1. Data Fetching (`lib/kattis-fetcher.ts`)

The application scrapes data from Kattis in three stages:

#### Stage 1: Home Page (`fetchAndSaveHomeData`)
- Fetches the main assignments list page
- Extracts all assignment names and URLs
- Creates/updates `Assignment` records
- Creates/updates `AssignmentEntry` records for each problem in each assignment
- Only runs if no assignments exist or data is older than 5 minutes

#### Stage 2: Assignment Details (`fetchAndSaveAssignment`)
- Fetches detailed information for a specific assignment
- Updates assignment metadata (status, stats, timeData)
- Does NOT extract problems (relies on home page data to avoid capturing navigation links)

#### Stage 3: Standings (`fetchAndSaveStandings`)
- Fetches the standings page for a specific assignment
- Creates/updates `Rank` records for each user in the standings
- Creates/updates `ProblemResult` records for each solved problem
- Sets `isUpsolve` flag based on assignment name
- Calculates `solvedTime` as integer minutes from the problem's time string (format: "MM:SS" or "H:MM:SS")

### 2. Ranking Calculation (`lib/rank-calculator.ts`)

The `calculateGlobalRankings()` function:

1. **Fetches all assignments** from the database (with related data)
2. **Separates assignments** into:
   - Non-upsolve assignments (base score)
   - Upsolve assignments (bonus calculation)
3. **For each user:**
   - Processes non-upsolve assignments to calculate base score
   - Tracks all problems in non-upsolve assignments (for "problems not done")
   - Processes upsolve assignments to calculate bonus
   - Matches upsolve assignments to their originals
   - Calculates which upsolve problems were not solved in originals
4. **Calculates "problems not done"** by:
   - Collecting all problems from non-upsolve assignments
   - Subtracting all problems the user has solved (across all assignments)
   - Grouping by assignment for display
5. **Sorts and ranks** users by total score

### 3. API Endpoints

- **`/api/home`**: Returns list of assignments (fetches fresh if needed)
- **`/api/assignment?url=...`**: Returns assignment details
- **`/api/standings?url=...`**: Returns standings for an assignment (fetches fresh if needed)
- **`/api/rank`**: Returns global rankings (calculated from database)
- **`/api/repoll`**: Triggers a full repoll of all data

### 4. Frontend Pages

- **`/`**: Main page showing assignments list
- **`/rank`**: Global rankings page with:
  - Sortable table of users
  - Expandable "Problems Not Done" section (grouped by assignment with links)
  - Expandable "Upsolved Problems" section
  - Refresh data button

## Key Files

- **`lib/kattis-fetcher.ts`**: Core data fetching and scraping logic
- **`lib/rank-calculator.ts`**: Global ranking calculation logic
- **`lib/prisma.ts`**: Prisma client setup
- **`prisma/schema.prisma`**: Database schema definition
- **`app/api/*/route.ts`**: Next.js API route handlers
- **`app/rank/page.tsx`**: Frontend rankings page
- **`scripts/repoll-problem-results.ts`**: Script to repoll all ProblemResult records

## Important Notes for AI Assistants

### Problem Name Normalization
- Problem names are normalized (trimmed, lowercased) for consistent matching
- This is critical for matching problems between original and upsolve assignments
- Always use normalized names when comparing problems

### Solved Time
- `solvedTime` is stored as an **integer** (minutes into competition), NOT a DateTime
- `null` means the problem was not solved
- The existence of a `ProblemResult` record indicates the problem was solved, regardless of `solvedTime` value
- This is important: don't filter by `solvedTime !== null` when checking if a problem was solved

### Upsolve Matching
- Upsolve assignments are matched to originals by name pattern matching
- The `findOriginalAssignment()` function handles this matching
- If no original is found, the upsolve assignment is skipped (no bonus calculated)

### Data Freshness
- Assignments are considered "fresh" if polled within the last 5 minutes
- The rank calculator uses existing data even if stale (for speed)
- Use `/api/repoll` to force a full refresh

### ProblemResult Creation
- `ProblemResult` records are **only created** when `problem.solved === true` in the standings
- This means if a `ProblemResult` exists, the problem was solved
- Don't rely on `solvedTime` to determine if a problem was solved - check for record existence

## Development

### Setup
```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

### Database Migrations
```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

### Repolling Data
```bash
# Repoll all ProblemResult records (updates solvedTime)
npx tsx scripts/repoll-problem-results.ts

# Full repoll (via API)
curl -X POST http://localhost:3000/api/repoll
```

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (required)
