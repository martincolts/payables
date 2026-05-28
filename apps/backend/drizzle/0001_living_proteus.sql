ALTER TYPE "public"."activity_action" ADD VALUE 'bill_paid' BEFORE 'vendor_created';--> statement-breakpoint
ALTER TYPE "public"."activity_action" ADD VALUE 'bill_payment_failed' BEFORE 'vendor_created';--> statement-breakpoint
ALTER TYPE "public"."bill_status" ADD VALUE 'payment_failed';