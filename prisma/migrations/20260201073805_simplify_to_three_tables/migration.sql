/*
  Warnings:

  - You are about to drop the column `totalProblems` on the `Assignment` table. All the data in the column will be lost.
  - You are about to drop the `Problem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ProblemResult` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StandingsEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StandingsSnapshot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Problem" DROP CONSTRAINT "Problem_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "ProblemResult" DROP CONSTRAINT "ProblemResult_entryId_fkey";

-- DropForeignKey
ALTER TABLE "ProblemResult" DROP CONSTRAINT "ProblemResult_problemId_fkey";

-- DropForeignKey
ALTER TABLE "StandingsEntry" DROP CONSTRAINT "StandingsEntry_snapshotId_fkey";

-- DropForeignKey
ALTER TABLE "StandingsSnapshot" DROP CONSTRAINT "StandingsSnapshot_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "UserAssignment" DROP CONSTRAINT "UserAssignment_assignmentId_fkey";

-- DropForeignKey
ALTER TABLE "UserAssignment" DROP CONSTRAINT "UserAssignment_userId_fkey";

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "totalProblems";

-- DropTable
DROP TABLE "Problem";

-- DropTable
DROP TABLE "ProblemResult";

-- DropTable
DROP TABLE "StandingsEntry";

-- DropTable
DROP TABLE "StandingsSnapshot";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserAssignment";

-- CreateTable
CREATE TABLE "AssignmentEntry" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "solvedCount" INTEGER NOT NULL,
    "totalTimeMinutes" INTEGER NOT NULL,
    "problems" JSONB NOT NULL,
    "standingsTitle" TEXT,
    "standingsUrl" TEXT,
    "problemNames" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentEntry_assignmentId_idx" ON "AssignmentEntry"("assignmentId");

-- CreateIndex
CREATE INDEX "Rank_assignmentId_idx" ON "Rank"("assignmentId");

-- CreateIndex
CREATE INDEX "Rank_rank_idx" ON "Rank"("rank");

-- CreateIndex
CREATE INDEX "Rank_name_idx" ON "Rank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_assignmentId_name_key" ON "Rank"("assignmentId", "name");

-- AddForeignKey
ALTER TABLE "AssignmentEntry" ADD CONSTRAINT "AssignmentEntry_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
