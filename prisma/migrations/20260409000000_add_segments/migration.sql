-- AlterTable: add timed subtitle segments cache to TranscriptSource
ALTER TABLE "TranscriptSource" ADD COLUMN "segments" JSONB;
