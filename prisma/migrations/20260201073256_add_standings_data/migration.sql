-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "stats" JSONB,
ADD COLUMN     "timeData" JSONB,
ADD COLUMN     "timeInfo" JSONB;

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingsSnapshot" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "problemNames" TEXT[],
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StandingsEntry" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "solvedCount" INTEGER NOT NULL,
    "totalTimeMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StandingsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemResult" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "problemId" TEXT,
    "problemIndex" INTEGER NOT NULL,
    "solved" BOOLEAN NOT NULL,
    "first" BOOLEAN NOT NULL DEFAULT false,
    "attempted" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "time" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Problem_assignmentId_idx" ON "Problem"("assignmentId");

-- CreateIndex
CREATE INDEX "Problem_url_idx" ON "Problem"("url");

-- CreateIndex
CREATE INDEX "StandingsSnapshot_assignmentId_idx" ON "StandingsSnapshot"("assignmentId");

-- CreateIndex
CREATE INDEX "StandingsSnapshot_snapshotDate_idx" ON "StandingsSnapshot"("snapshotDate");

-- CreateIndex
CREATE INDEX "StandingsEntry_snapshotId_idx" ON "StandingsEntry"("snapshotId");

-- CreateIndex
CREATE INDEX "StandingsEntry_rank_idx" ON "StandingsEntry"("rank");

-- CreateIndex
CREATE INDEX "StandingsEntry_name_idx" ON "StandingsEntry"("name");

-- CreateIndex
CREATE INDEX "ProblemResult_entryId_idx" ON "ProblemResult"("entryId");

-- CreateIndex
CREATE INDEX "ProblemResult_problemId_idx" ON "ProblemResult"("problemId");

-- AddForeignKey
ALTER TABLE "Problem" ADD CONSTRAINT "Problem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingsSnapshot" ADD CONSTRAINT "StandingsSnapshot_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StandingsEntry" ADD CONSTRAINT "StandingsEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "StandingsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemResult" ADD CONSTRAINT "ProblemResult_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "StandingsEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemResult" ADD CONSTRAINT "ProblemResult_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
