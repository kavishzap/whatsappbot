CREATE TYPE "public"."credit_note_status" AS ENUM (
    'issued',
    'applied',
    'cancelled',
    'draft',
    'posted'
);
CREATE TYPE "public"."delivery_note_status" AS ENUM (
    'new',
    'delivered_to_driver',
    'completed'
);
CREATE TYPE "public"."driver_settlement_status" AS ENUM (
    'pending',
    'settled',
    'due'
);
CREATE TYPE "public"."invoice_item_input" AS (
	"item" "text",
	"description" "text",
	"quantity" numeric,
	"unit_price" numeric,
	"tax_percent" numeric
);
CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'unpaid',
    'paid',
    'void',
    'cancelled'
);
CREATE TYPE "public"."location_type" AS ENUM (
    'warehouse',
    'store',
    'driver_location'
);
CREATE TYPE "public"."purchase_invoice_status" AS ENUM (
    'unpaid',
    'partially_paid',
    'paid',
    'overdue',
    'cancelled'
);
CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'active',
    'expired'
);
CREATE TYPE "public"."quotation_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'cancelled',
    'active'
);
CREATE TYPE "public"."sales_order_fulfillment_status" AS ENUM (
    'new',
    'delivered to driver',
    'delivered to customer',
    'cancelled',
    'rescheduled',
    'delivery note created',
    'completed',
    'pending',
    'upselling'
);
CREATE TYPE "public"."sales_order_payment_status" AS ENUM (
    'unpaid',
    'partial paid',
    'paid'
);
CREATE TYPE "public"."sales_order_status" AS ENUM (
    'active',
    'expired'
);
CREATE TYPE "public"."subscription_plan" AS ENUM (
    'monthly_100',
    'yearly_1000'
);
CREATE TYPE "public"."system_role" AS ENUM (
    'admin',
    'owner',
    'member'
);
CREATE TYPE "public"."whatsapp_message_status" AS ENUM (
    'called',
    'message_sent',
    'call_later',
    'rejected',
    'complete'
);
CREATE TYPE "public"."worker_kind" AS ENUM (
    'individual',
    'contractor'
);
CREATE TYPE "public"."worker_profile_status" AS ENUM (
    'pending',
    'active',
    'inactive',
    'rejected'
);
