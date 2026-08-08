-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'teknisi', 'kasir');

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('Sparepart', 'Accessory', 'Software', 'Service', 'Other');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('Queue', 'Diagnosing', 'In_Progress', 'Waiting_Part', 'Completed', 'Ready_For_Pickup', 'Picked_Up', 'Cancelled');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'Transfer', 'QRIS', 'Card');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('Pending', 'Searching', 'Ordered', 'Arrived', 'Picked_Up', 'Cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Belum_Lunas', 'Lunas');

-- CreateEnum
CREATE TYPE "Day" AS ENUM ('senin', 'selasa', 'rabu', 'kamis', 'jumat');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'kasir',
    "phone" VARCHAR(20) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "jabatan" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "ItemCategory" NOT NULL DEFAULT 'Other',
    "purchase_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "selling_price" DECIMAL(14,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock_alert" INTEGER NOT NULL DEFAULT 5,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "is_wa_valid" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "type" VARCHAR(30),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_tickets" (
    "id" SERIAL NOT NULL,
    "ticket_number" VARCHAR(30) NOT NULL,
    "customer_id" INTEGER,
    "device" JSONB NOT NULL DEFAULT '{}',
    "technician_name" VARCHAR(100),
    "technician_id" INTEGER,
    "status" "ServiceStatus" NOT NULL DEFAULT 'Queue',
    "service_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "payment_proof" TEXT,
    "total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "warranty_expires_at" TIMESTAMPTZ(6),
    "claim_from_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosed_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_ticket_parts" (
    "id" SERIAL NOT NULL,
    "service_ticket_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "name" VARCHAR(200),
    "qty" INTEGER NOT NULL,
    "price_at_time" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "service_ticket_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_logs" (
    "id" SERIAL NOT NULL,
    "service_ticket_id" INTEGER NOT NULL,
    "from_status" VARCHAR(20),
    "to_status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "service_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "invoice_no" VARCHAR(30) NOT NULL,
    "cashier_id" INTEGER NOT NULL,
    "grand_total" DECIMAL(14,2) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL,
    "change" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "item_id" INTEGER,
    "name" VARCHAR(200) NOT NULL,
    "qty" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_orders" (
    "id" SERIAL NOT NULL,
    "order_number" VARCHAR(30) NOT NULL,
    "customer_id" INTEGER,
    "item_name" VARCHAR(255) NOT NULL,
    "item_description" TEXT,
    "estimated_price" DECIMAL(14,2) NOT NULL,
    "down_payment" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'Pending',
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'Belum_Lunas',
    "handled_by_id" INTEGER,
    "handled_by_name" VARCHAR(100),
    "photo" TEXT,
    "service_ticket_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ordered_at" TIMESTAMPTZ(6),
    "arrived_at" TIMESTAMPTZ(6),
    "picked_up_at" TIMESTAMPTZ(6),

    CONSTRAINT "special_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duty_schedules" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "day" "Day" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duty_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_audit" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "ref_type" VARCHAR(30),
    "ref_id" INTEGER,
    "created_by" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" SERIAL NOT NULL,
    "level" "LogLevel" NOT NULL,
    "source" VARCHAR(50),
    "message" TEXT NOT NULL,
    "details" JSONB,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "items_sku_key" ON "items"("sku");

-- CreateIndex
CREATE INDEX "items_category_idx" ON "items"("category");

-- CreateIndex
CREATE INDEX "items_is_active_idx" ON "items"("is_active");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "service_tickets_ticket_number_key" ON "service_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "service_tickets_status_idx" ON "service_tickets"("status");

-- CreateIndex
CREATE INDEX "service_tickets_technician_id_idx" ON "service_tickets"("technician_id");

-- CreateIndex
CREATE INDEX "service_ticket_parts_service_ticket_id_idx" ON "service_ticket_parts"("service_ticket_id");

-- CreateIndex
CREATE INDEX "service_logs_service_ticket_id_idx" ON "service_logs"("service_ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoice_no_key" ON "transactions"("invoice_no");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "transactions_cashier_id_idx" ON "transactions"("cashier_id");

-- CreateIndex
CREATE INDEX "transaction_items_transaction_id_idx" ON "transaction_items"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "special_orders_order_number_key" ON "special_orders"("order_number");

-- CreateIndex
CREATE INDEX "special_orders_status_idx" ON "special_orders"("status");

-- CreateIndex
CREATE INDEX "order_payments_order_id_idx" ON "order_payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "duty_schedules_user_id_day_key" ON "duty_schedules"("user_id", "day");

-- CreateIndex
CREATE INDEX "stock_audit_item_id_idx" ON "stock_audit"("item_id");

-- CreateIndex
CREATE INDEX "system_logs_timestamp_idx" ON "system_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_claim_from_id_fkey" FOREIGN KEY ("claim_from_id") REFERENCES "service_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_ticket_parts" ADD CONSTRAINT "service_ticket_parts_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_ticket_parts" ADD CONSTRAINT "service_ticket_parts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_logs" ADD CONSTRAINT "service_logs_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_orders" ADD CONSTRAINT "special_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "special_orders" ADD CONSTRAINT "special_orders_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "special_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duty_schedules" ADD CONSTRAINT "duty_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit" ADD CONSTRAINT "stock_audit_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit" ADD CONSTRAINT "stock_audit_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
