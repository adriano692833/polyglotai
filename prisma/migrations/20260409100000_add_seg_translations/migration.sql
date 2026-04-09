-- Add cached Polish translations for transcript segments (background pre-generated)
ALTER TABLE "TranscriptSource" ADD COLUMN "segTranslations" JSONB;
