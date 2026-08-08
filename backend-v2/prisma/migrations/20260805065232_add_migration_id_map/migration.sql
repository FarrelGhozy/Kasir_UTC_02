-- CreateTable
CREATE TABLE "migration_id_map" (
    "entity" VARCHAR(40) NOT NULL,
    "oldId" VARCHAR(40) NOT NULL,
    "newId" INTEGER NOT NULL,

    CONSTRAINT "migration_id_map_pkey" PRIMARY KEY ("entity","oldId")
);

-- CreateIndex
CREATE INDEX "migration_id_map_entity_newId_idx" ON "migration_id_map"("entity", "newId");
