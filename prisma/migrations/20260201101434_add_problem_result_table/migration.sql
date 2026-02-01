-- CreateTable
CREATE TABLE "ProblemResult" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "problemName" TEXT NOT NULL,
    "isUpsolve" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solvedTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rankId" TEXT,

    CONSTRAINT "ProblemResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemResult_name_idx" ON "ProblemResult"("name");

-- CreateIndex
CREATE INDEX "ProblemResult_assignmentId_idx" ON "ProblemResult"("assignmentId");

-- CreateIndex
CREATE INDEX "ProblemResult_problemName_idx" ON "ProblemResult"("problemName");

-- CreateIndex
CREATE INDEX "ProblemResult_isUpsolve_idx" ON "ProblemResult"("isUpsolve");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemResult_name_assignmentId_problemName_key" ON "ProblemResult"("name", "assignmentId", "problemName");

-- AddForeignKey
ALTER TABLE "ProblemResult" ADD CONSTRAINT "ProblemResult_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemResult" ADD CONSTRAINT "ProblemResult_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
