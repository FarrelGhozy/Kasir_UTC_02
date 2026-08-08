-- AlterTable
ALTER TABLE "order_payments" ADD COLUMN     "created_by" INTEGER;

-- AlterTable
ALTER TABLE "service_tickets" ADD COLUMN     "warranty_claimed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "special_orders" DROP COLUMN "payment_status",
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'Belum_Lunas';

-- CreateIndex
CREATE UNIQUE INDEX "service_tickets_claim_from_id_key" ON "service_tickets"("claim_from_id");

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

