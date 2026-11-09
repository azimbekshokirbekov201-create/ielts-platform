CREATE TABLE "Account" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "email" TEXT NOT NULL,
 "passwordHash" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");
CREATE TABLE "Session" (
 "tokenHash" TEXT NOT NULL PRIMARY KEY,
 "accountId" TEXT NOT NULL,
 "expiresAt" DATETIME NOT NULL,
 FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Session_accountId_idx" ON "Session"("accountId");
CREATE TABLE "Entity" (
 "id" TEXT NOT NULL,
 "kind" TEXT NOT NULL,
 "data" JSONB NOT NULL,
 PRIMARY KEY ("kind", "id")
);
CREATE INDEX "Entity_kind_idx" ON "Entity"("kind");
CREATE TABLE "RateLimit" ("key" TEXT NOT NULL PRIMARY KEY, "start" DATETIME NOT NULL, "hits" INTEGER NOT NULL);
