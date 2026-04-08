-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "transcriptSourceId" TEXT;

-- AddForeignKey
ALTER TABLE "Flashcard"
ADD CONSTRAINT "Flashcard_transcriptSourceId_fkey"
FOREIGN KEY ("transcriptSourceId") REFERENCES "TranscriptSource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
