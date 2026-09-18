-- CreateTable
CREATE TABLE "BankTransferSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "bankName" TEXT NOT NULL,
    "cbu" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderCuit" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferSettings_pkey" PRIMARY KEY ("id")
);
