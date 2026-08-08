-- CreateTable
CREATE TABLE "number_sequences" (
    "key" VARCHAR(60) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "number_sequences_pkey" PRIMARY KEY ("key")
);
