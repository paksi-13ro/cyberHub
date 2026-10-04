/*
  Warnings:

  - Added the required column `groupId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ChatMessage_createdAt_idx";

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "groupId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "ChatGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatGroup_name_key" ON "ChatGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ChatGroup_slug_key" ON "ChatGroup"("slug");

-- CreateIndex
CREATE INDEX "ChatMessage_groupId_createdAt_idx" ON "ChatMessage"("groupId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ChatGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
