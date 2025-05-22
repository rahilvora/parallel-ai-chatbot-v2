ALTER TABLE "FileEmbedding" DROP CONSTRAINT "FileEmbedding_chatId_Chat_id_fk";
--> statement-breakpoint
ALTER TABLE "FileEmbedding" ALTER COLUMN "fileType" SET DATA TYPE varchar(32);--> statement-breakpoint
ALTER TABLE "FileEmbedding" ADD COLUMN "chunkIndex" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "FileEmbedding" ADD COLUMN "rowIndex" integer;--> statement-breakpoint
ALTER TABLE "FileEmbedding" ADD COLUMN "colName" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FileEmbedding" ADD CONSTRAINT "FileEmbedding_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
