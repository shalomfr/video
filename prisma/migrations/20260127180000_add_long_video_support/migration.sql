-- CreateEnum
CREATE TYPE "VideoType" AS ENUM ('SHORT', 'LONG');

-- AlterTable: Add long video fields to videos table
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "videoType" "VideoType" NOT NULL DEFAULT 'SHORT';
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "pipelineStage" TEXT;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "scriptData" JSONB;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "totalScenes" INTEGER;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "completedScenes" INTEGER;

-- CreateTable: scenes for long videos
CREATE TABLE IF NOT EXISTS "scenes" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "runwayTaskId" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'PENDING',
    "videoUrl" TEXT,
    "duration" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "sceneDescription" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "referenceImages" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "scenes_videoId_sceneNumber_key" ON "scenes"("videoId", "sceneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scenes_videoId_idx" ON "scenes"("videoId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'scenes_videoId_fkey'
    ) THEN
        ALTER TABLE "scenes" ADD CONSTRAINT "scenes_videoId_fkey" 
        FOREIGN KEY ("videoId") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
