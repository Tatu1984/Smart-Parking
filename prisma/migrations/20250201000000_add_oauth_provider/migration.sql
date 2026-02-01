-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'MICROSOFT');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "providerUserId" TEXT;

-- AlterTable - Make passwordHash nullable for OAuth-only users
ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_authProvider_providerUserId_key" ON "users"("authProvider", "providerUserId");
