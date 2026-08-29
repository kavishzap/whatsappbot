


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."credit_note_status" AS ENUM (
    'issued',
    'applied',
    'cancelled',
    'draft',
    'posted'
);


ALTER TYPE "public"."credit_note_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_note_status" AS ENUM (
    'new',
    'delivered_to_driver',
    'completed'
);


ALTER TYPE "public"."delivery_note_status" OWNER TO "postgres";


CREATE TYPE "public"."driver_settlement_status" AS ENUM (
    'pending',
    'settled',
    'due'
);


ALTER TYPE "public"."driver_settlement_status" OWNER TO "postgres";


CREATE TYPE "public"."invoice_item_input" AS (
	"item" "text",
	"description" "text",
	"quantity" numeric,
	"unit_price" numeric,
	"tax_percent" numeric
);


ALTER TYPE "public"."invoice_item_input" OWNER TO "postgres";


CREATE TYPE "public"."invoice_status" AS ENUM (
    'draft',
    'sent',
    'viewed',
    'unpaid',
    'paid',
    'void',
    'cancelled'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."location_type" AS ENUM (
    'warehouse',
    'store',
    'driver_location'
);


ALTER TYPE "public"."location_type" OWNER TO "postgres";


CREATE TYPE "public"."purchase_invoice_status" AS ENUM (
    'unpaid',
    'partially_paid',
    'paid',
    'overdue',
    'cancelled'
);


ALTER TYPE "public"."purchase_invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."purchase_order_status" AS ENUM (
    'active',
    'expired'
);


ALTER TYPE "public"."purchase_order_status" OWNER TO "postgres";


CREATE TYPE "public"."quotation_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'cancelled',
    'active'
);


ALTER TYPE "public"."quotation_status" OWNER TO "postgres";


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


ALTER TYPE "public"."sales_order_fulfillment_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."sales_order_fulfillment_status" IS 'Where the order sits in fulfilment (new → driver → customer, etc.).';



CREATE TYPE "public"."sales_order_payment_status" AS ENUM (
    'unpaid',
    'partial paid',
    'paid'
);


ALTER TYPE "public"."sales_order_payment_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."sales_order_payment_status" IS 'Payment progress for the sales order.';



CREATE TYPE "public"."sales_order_status" AS ENUM (
    'active',
    'expired'
);


ALTER TYPE "public"."sales_order_status" OWNER TO "postgres";


CREATE TYPE "public"."subscription_plan" AS ENUM (
    'monthly_100',
    'yearly_1000'
);


ALTER TYPE "public"."subscription_plan" OWNER TO "postgres";


CREATE TYPE "public"."system_role" AS ENUM (
    'admin',
    'owner',
    'member'
);


ALTER TYPE "public"."system_role" OWNER TO "postgres";


CREATE TYPE "public"."whatsapp_message_status" AS ENUM (
    'called',
    'message_sent',
    'call_later',
    'rejected',
    'complete'
);


ALTER TYPE "public"."whatsapp_message_status" OWNER TO "postgres";


CREATE TYPE "public"."worker_kind" AS ENUM (
    'individual',
    'contractor'
);


ALTER TYPE "public"."worker_kind" OWNER TO "postgres";


CREATE TYPE "public"."worker_profile_status" AS ENUM (
    'pending',
    'active',
    'inactive',
    'rejected'
);


ALTER TYPE "public"."worker_profile_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.is_active = true
  );
$$;


ALTER FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %', p_company_id;
  END IF;

  UPDATE public.sales_orders
  SET fulfillment_status = p_fulfillment_status,
      updated_at = now()
  WHERE id = p_sales_order_id
    AND company_id = p_company_id;
END;
$$;


ALTER FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_company_member"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.user_is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this company'
      USING ERRCODE = '42501';
  END IF;
END;
$$;


ALTER FUNCTION "public"."assert_company_member"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
  v_inserted_count integer := 0;
begin
  select *
  into v_delivery
  from public.deliveries
  where id = p_delivery_id;

  if not found then
    raise exception 'Delivery note not found.';
  end if;

  if v_delivery.delivery_date is null then
    raise exception 'Delivery note has no delivery date.';
  end if;

  if v_delivery.driver_user_id is null then
    raise exception 'Delivery note has no driver assigned.';
  end if;

  insert into public.delivery_sales_orders (
    delivery_id,
    sales_order_id
  )
  select distinct
    v_delivery.id,
    so.id
  from public.sales_orders so
  join public.zone_cities zc
    on zc.city_id = so.city_id
  join public.zones z
    on z.id = zc.zone_id
  where so.company_id = v_delivery.company_id
    and so.delivery_date = v_delivery.delivery_date
    and so.fulfillment_status::text = 'new'
    and z.company_id = v_delivery.company_id
    and z.driver_user_id = v_delivery.driver_user_id
    and z.is_active = true
    and not exists (
      select 1
      from public.delivery_sales_orders dso
      where dso.sales_order_id = so.id
    )
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;

  return v_inserted_count;
end;
$$;


ALTER FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_so public.sales_orders%ROWTYPE;
  v_delivery_id uuid;
  v_existing_delivery_id uuid;
  v_existing_delivery_status text;
  v_delivery_date date;
  v_driver_location_id uuid;
BEGIN
  SELECT *
  INTO v_so
  FROM public.sales_orders
  WHERE id = p_sales_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only upselling sales orders
  IF v_so.fulfillment_status::text <> 'upselling' THEN
    RETURN;
  END IF;

  v_delivery_date := COALESCE(v_so.delivery_date, CURRENT_DATE);

  -- Lock per company + driver + delivery date
  PERFORM pg_advisory_xact_lock(
    hashtext(v_so.company_id::text || ':' || v_so.user_id::text || ':' || v_delivery_date::text)
  );

  -- Check if this upselling order already has an active delivery link
  SELECT
    d.id,
    d.status::text
  INTO
    v_existing_delivery_id,
    v_existing_delivery_status
  FROM public.delivery_sales_orders dso
  JOIN public.deliveries d
    ON d.id = dso.delivery_id
  WHERE dso.sales_order_id = v_so.id
    AND dso.is_active = true
  ORDER BY dso.created_at DESC
  LIMIT 1;

  -- If already linked to a non-completed delivery note, keep it
  IF v_existing_delivery_id IS NOT NULL
     AND v_existing_delivery_status <> 'completed' THEN

    UPDATE public.sales_orders
    SET
      active_driver_delivery_id = v_existing_delivery_id,
      updated_at = now()
    WHERE id = v_so.id
      AND active_driver_delivery_id IS DISTINCT FROM v_existing_delivery_id;

    RETURN;
  END IF;

  -- If active link points to a completed delivery note, deactivate that link
  IF v_existing_delivery_id IS NOT NULL
     AND v_existing_delivery_status = 'completed' THEN

    UPDATE public.delivery_sales_orders
    SET
      is_active = false,
      deactivated_at = now(),
      deactivation_reason = 'Upselling moved to new active delivery note because previous delivery note was completed'
    WHERE sales_order_id = v_so.id
      AND is_active = true;
  END IF;

  -- Find existing non-completed delivery note for same driver and date
  SELECT d.id
  INTO v_delivery_id
  FROM public.deliveries d
  WHERE d.company_id = v_so.company_id
    AND d.driver_user_id = v_so.user_id
    AND d.delivery_date = v_delivery_date
    AND d.status::text <> 'completed'
  ORDER BY d.created_at DESC
  LIMIT 1;

  -- Resolve driver location if we need to create new delivery note
  IF v_delivery_id IS NULL THEN
    SELECT ld.location_id
    INTO v_driver_location_id
    FROM public.location_drivers ld
    JOIN public.locations l
      ON l.id = ld.location_id
    WHERE ld.company_id = v_so.company_id
      AND ld.driver_user_id = v_so.user_id
      AND ld.is_active = true
      AND l.is_active = true
      AND l.location_type::text = 'driver_location'
    ORDER BY ld.is_primary DESC, ld.created_at DESC
    LIMIT 1;
  END IF;

  IF v_delivery_id IS NULL AND v_driver_location_id IS NULL THEN
    SELECT l.id
    INTO v_driver_location_id
    FROM public.locations l
    WHERE l.company_id = v_so.company_id
      AND l.user_id = v_so.user_id
      AND l.is_active = true
      AND l.location_type::text = 'driver_location'
    ORDER BY l.is_default DESC, l.created_at DESC
    LIMIT 1;
  END IF;

  -- Create new delivery note only if no non-completed one exists
  IF v_delivery_id IS NULL THEN
    INSERT INTO public.deliveries (
      company_id,
      driver_user_id,
      created_by,
      notes,
      status,
      driver_status,
      delivery_date,
      from_location_id,
      location_id
    )
    VALUES (
      v_so.company_id,
      v_so.user_id,
      v_so.user_id,
      'Auto-created for upselling sales order ' || v_so.number,
      'new',
      true,
      v_delivery_date,
      v_driver_location_id,
      v_driver_location_id
    )
    RETURNING id INTO v_delivery_id;
  END IF;

  -- Safety: avoid duplicate active link without using a unique index
  IF NOT EXISTS (
    SELECT 1
    FROM public.delivery_sales_orders dso
    WHERE dso.sales_order_id = v_so.id
      AND dso.delivery_id = v_delivery_id
      AND dso.is_active = true
  ) THEN
    INSERT INTO public.delivery_sales_orders (
      delivery_id,
      sales_order_id,
      is_active
    )
    VALUES (
      v_delivery_id,
      v_so.id,
      true
    );
  END IF;

  UPDATE public.sales_orders
  SET
    active_driver_delivery_id = v_delivery_id,
    updated_at = now()
  WHERE id = v_so.id
    AND active_driver_delivery_id IS DISTINCT FROM v_delivery_id;
END;
$$;


ALTER FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."company_member_company_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.id
  FROM public.companies c
  WHERE c.owner_user_id = auth.uid()
    AND c.is_active = true
  UNION
  SELECT cu.company_id
  FROM public.company_users cu
  WHERE cu.user_id = auth.uid()
    AND cu.is_active = true;
$$;


ALTER FUNCTION "public"."company_member_company_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;


ALTER FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") IS 'Orders with no bill-to or linked customer address (sales orders list filter).';



CREATE OR REPLACE FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND so.city_id IS NULL
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'city'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;


ALTER FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") IS 'Orders with no city and no bill-to/customer address (sales orders list filter).';



CREATE OR REPLACE FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT count(*)::bigint
  FROM public.sales_orders so
  WHERE so.company_id = p_company_id
    AND so.city_id IS NULL
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'city'), ''), '') = '';
$$;


ALTER FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") IS 'Orders with no city_id and no bill-to city (sales orders list filter).';



CREATE OR REPLACE FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_billing_contact_name" "text" DEFAULT NULL::"text", "p_billing_contact_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_company_id uuid;
  v_owner_role_id uuid;
BEGIN
  -- 1. Validate plan exists
  IF NOT EXISTS (
    SELECT 1 FROM public.plans WHERE id = p_plan_id
  ) THEN
    RAISE EXCEPTION 'Invalid plan_id';
  END IF;

  -- 2. Create company
  INSERT INTO public.companies (
    owner_user_id,
    name,
    email,
    phone,
    plan_id,
    billing_contact_name,
    billing_contact_email
  )
  VALUES (
    p_owner_user_id,
    p_name,
    p_email,
    p_phone,
    p_plan_id,
    p_billing_contact_name,
    p_billing_contact_email
  )
  RETURNING id INTO v_company_id;

  -- 3. Create Owner role only
  INSERT INTO public.company_roles (
    company_id,
    name,
    is_system
  )
  VALUES (
    v_company_id,
    'Owner',
    true
  )
  RETURNING id INTO v_owner_role_id;

  -- 4. Assign ALL plan features to Owner
  INSERT INTO public.role_features (role_id, feature_id)
  SELECT v_owner_role_id, pf.feature_id
  FROM public.plan_features pf
  WHERE pf.plan_id = p_plan_id;

  -- 5. Add owner to company_users
  INSERT INTO public.company_users (
    company_id,
    user_id,
    role_id,
    is_owner
  )
  VALUES (
    v_company_id,
    p_owner_user_id,
    v_owner_role_id,
    true
  );

  RETURN v_company_id;
END;
$$;


ALTER FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text", "p_phone" "text", "p_billing_contact_name" "text", "p_billing_contact_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_credit_note"("p_credit_note" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid := (p_credit_note->>'company_id')::uuid;
  v_prefix text := 'CN';
  v_padding int := 4;
  v_next int := 1;
  v_number text;
  v_cn_id uuid;
  v_subtotal numeric(14, 2) := 0;
  v_tax_total numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_total numeric(14, 2) := 0;
  v_item jsonb;
  v_line_sub numeric(14, 2);
  v_line_tax numeric(14, 2);
  v_line_total numeric(14, 2);
  v_sort int := 0;
  v_from jsonb;
  v_bill jsonb;
  v_status public.credit_note_status;
  v_insert_status public.credit_note_status;
  v_wants_post boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(p_credit_note->>'related_invoice_id', '') IS NULL THEN
    RAISE EXCEPTION 'related_invoice_id is required';
  END IF;

  IF NULLIF(p_credit_note->>'customer_id', '') IS NULL THEN
    RAISE EXCEPTION 'customer_id is required';
  END IF;

  v_status := COALESCE(
    (p_credit_note->>'status')::public.credit_note_status,
    'draft'::public.credit_note_status
  );

  IF v_status NOT IN ('draft'::public.credit_note_status, 'posted'::public.credit_note_status) THEN
    v_status := 'draft'::public.credit_note_status;
  END IF;

  v_wants_post := v_status = 'posted'::public.credit_note_status;
  v_insert_status := CASE
    WHEN v_wants_post THEN 'draft'::public.credit_note_status
    ELSE v_status
  END;

  SELECT
    COALESCE(us.credit_note_prefix, 'CN'),
    COALESCE(us.credit_note_number_padding, 4),
    COALESCE(us.credit_note_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id
  LIMIT 1;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  SELECT jsonb_build_object(
    'type', 'company',
    'company_name', c.name,
    'email', c.email,
    'phone', c.phone,
    'address_line_1', c.address_line_1,
    'address_line_2', c.address_line_2,
    'city', c.city,
    'country', c.country,
    'registration_id', c.brn,
    'vat_number', c.vat_number
  )
  INTO v_from
  FROM public.companies c
  WHERE c.id = v_company_id;

  SELECT jsonb_build_object(
    'type', cu.type,
    'company_name', cu.company_name,
    'contact_name', cu.contact_name,
    'full_name', cu.full_name,
    'email', cu.email,
    'phone', cu.phone,
    'street', cu.street,
    'city', cu.city,
    'postal', cu.postal,
    'country', cu.country,
    'address_line_1', cu.address_line_1,
    'address_line_2', cu.address_line_2
  )
  INTO v_bill
  FROM public.customers cu
  WHERE cu.id = (p_credit_note->>'customer_id')::uuid;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line_sub := COALESCE((v_item->>'quantity')::numeric, 0)
      * COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_tax := v_line_sub * COALESCE((v_item->>'tax_percent')::numeric, 0) / 100;
    v_subtotal := v_subtotal + v_line_sub;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  IF COALESCE(p_credit_note->>'discount_type', 'value') = 'percent' THEN
    v_discount := v_subtotal * COALESCE((p_credit_note->>'discount_amount')::numeric, 0) / 100;
  ELSE
    v_discount := COALESCE((p_credit_note->>'discount_amount')::numeric, 0);
  END IF;

  v_total := GREATEST(0, v_subtotal + v_tax_total - v_discount);

  INSERT INTO public.credit_notes (
    number, company_id, user_id, customer_id, related_invoice_id,
    issue_date, status, currency, credit_type,
    subtotal, tax_total, total,
    discount_type, discount_amount,
    reason, notes, terms,
    from_snapshot, bill_to_snapshot, client_snapshot
  )
  VALUES (
    v_number,
    v_company_id,
    v_user_id,
    (p_credit_note->>'customer_id')::uuid,
    (p_credit_note->>'related_invoice_id')::uuid,
    COALESCE((p_credit_note->>'issue_date')::date, CURRENT_DATE),
    v_insert_status,
    COALESCE(p_credit_note->>'currency', 'MUR'),
    COALESCE(p_credit_note->>'credit_type', 'partial'),
    v_subtotal, v_tax_total, v_total,
    COALESCE(p_credit_note->>'discount_type', 'value'),
    COALESCE((p_credit_note->>'discount_amount')::numeric, 0),
    NULLIF(p_credit_note->>'reason', ''),
    NULLIF(p_credit_note->>'notes', ''),
    NULLIF(p_credit_note->>'terms', ''),
    v_from,
    v_bill,
    NULL
  )
  RETURNING id INTO v_cn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_sort := v_sort + 1;
    v_line_sub := COALESCE((v_item->>'quantity')::numeric, 0)
      * COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_tax := v_line_sub * COALESCE((v_item->>'tax_percent')::numeric, 0) / 100;
    v_line_total := v_line_sub + v_line_tax;

    INSERT INTO public.credit_note_items (
      credit_note_id, company_id, product_id, invoice_item_id,
      item, description, quantity, unit_price, tax_percent,
      line_subtotal, line_tax, line_total, sort_order
    )
    VALUES (
      v_cn_id,
      v_company_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      NULLIF(v_item->>'invoice_item_id', '')::uuid,
      COALESCE(v_item->>'item', 'Item'),
      NULLIF(v_item->>'description', ''),
      COALESCE((v_item->>'quantity')::numeric, 1),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'tax_percent')::numeric, 0),
      v_line_sub, v_line_tax, v_line_total, v_sort
    );
  END LOOP;

  UPDATE public.user_settings
  SET credit_note_next_number = v_next + 1, updated_at = now()
  WHERE user_id = v_user_id;

  IF v_wants_post THEN
    PERFORM public.post_credit_note(v_cn_id);
  END IF;

  RETURN v_cn_id;
END;
$$;


ALTER FUNCTION "public"."create_credit_note"("p_credit_note" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  uid          uuid := auth.uid();
  pref_row     public.preferences%rowtype;
  new_number   text;
  bill_to_sn   jsonb;
  from_sn      jsonb;
  tries        int := 0;
  invoice_id   uuid;  -- <— return value
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- lock/create preferences
  select * into pref_row
  from public.preferences
  where user_id = uid
  for update;

  if not found then
    insert into public.preferences (user_id) values (uid)
    returning * into pref_row;
  end if;

  -- FROM snapshot
  begin
    select jsonb_build_object(
             'type', case when prof.company_name is not null then 'company' else 'individual' end,
             'company_name', prof.company_name,
             'full_name', prof.full_name,
             'email', prof.email,
             'phone', prof.phone,
             'street', prof.street,
             'city', prof.city,
             'postal', prof.postal,
             'country', prof.country,
             'logo_url', prof.logo_url
           )
    into from_sn
    from public.profiles prof
    where prof.user_id = uid;
  exception when undefined_column then
    select jsonb_build_object(
             'type', case when prof.company_name is not null then 'company' else 'individual' end,
             'company_name', prof.company_name,
             'full_name', prof.full_name,
             'email', prof.email,
             'phone', prof.phone,
             'street', prof.street,
             'city', prof.city,
             'postal', prof.postal,
             'country', prof.country,
             'logo_url', prof.logo_url
           )
    into from_sn
    from public.profiles prof
    where prof.id = uid;
  end;
  if from_sn is null then
    from_sn := jsonb_build_object('type','individual');
  end if;

  -- BILL-TO snapshot
  if nullif(p_invoice->>'customer_id','') is not null then
    select jsonb_build_object(
             'type', c.type,
             'company_name', c.company_name,
             'contact_name', c.contact_name,
             'full_name', c.full_name,
             'email', c.email,
             'phone', c.phone,
             'street', c.street,
             'city', c.city,
             'postal', c.postal,
             'country', c.country
           )
    into bill_to_sn
    from public.customers c
    where c.id = (p_invoice->>'customer_id')::uuid
      and c.user_id = uid;
  else
    bill_to_sn := coalesce(p_invoice->'client_snapshot', '{}'::jsonb);
  end if;

  if bill_to_sn is null or bill_to_sn = '{}'::jsonb then
    raise exception 'bill_to snapshot missing';
  end if;

  -- retry loop for unique(number) races
  <<retry>>
  loop
    tries := tries + 1;

    new_number := pref_row.number_prefix || '-' ||
                  lpad(pref_row.next_number::text, pref_row.number_padding, '0');

    begin
      insert into public.invoices (
        user_id, customer_id, number, issue_date, due_date, status, currency,
        from_snapshot, bill_to_snapshot,
        discount_type, discount_amount, shipping_amount, notes, terms
      ) values (
        uid,
        nullif(p_invoice->>'customer_id','')::uuid,
        new_number,
        (p_invoice->>'issue_date')::date,
        (p_invoice->>'due_date')::date,
        (p_invoice->>'status')::public.invoice_status,
        (p_invoice->>'currency'),
        from_sn, bill_to_sn,
        (p_invoice->>'discount_type'),
        coalesce((p_invoice->>'discount_amount')::numeric,0),
        coalesce((p_invoice->>'shipping_amount')::numeric,0),
        nullif(p_invoice->>'notes',''),
        nullif(p_invoice->>'terms','')
      )
      returning id into invoice_id;

      insert into public.invoice_items (invoice_id, item, description, quantity, unit_price, tax_percent)
      select
        invoice_id,
        (it->>'item'),
        nullif(it->>'description',''),
        coalesce((it->>'quantity')::numeric,0),
        coalesce((it->>'unit_price')::numeric,0),
        coalesce((it->>'tax_percent')::numeric,0)
      from jsonb_array_elements(p_items) as it;

      update public.preferences
      set next_number = pref_row.next_number + 1,
          updated_at  = now()
      where id = pref_row.id;

      return invoice_id;  -- <— ACTUAL RETURN
    exception when unique_violation then
      if tries >= 5 then
        raise;
      end if;

      update public.preferences
      set next_number = next_number + 1,
          updated_at  = now()
      where id = pref_row.id
      returning * into pref_row;

      continue retry;
    end;
  end loop;
end;
$$;


ALTER FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice"("p_customer_id" "uuid", "p_issue_date" "date", "p_due_date" "date", "p_items" "public"."invoice_item_input"[], "p_discount_type" "text", "p_discount_amount" numeric, "p_shipping_amount" numeric, "p_notes" "text", "p_terms" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_settings record;
  v_profile record;
  v_customer record;

  v_number text;
  v_currency text;

  v_subtotal numeric(12,2) := 0;
  v_tax_total numeric(12,2) := 0;
  v_total numeric(12,2) := 0;

  v_invoice_id uuid;
  v_pad int;
  v_prefix text;
  v_next int;
  v_from_snapshot jsonb;
  v_bill_to_snapshot jsonb;
  v_discount_type text := nullif(p_discount_type, '');
  v_discount_amount numeric := coalesce(p_discount_amount, 0);
  v_shipping_amount numeric := coalesce(p_shipping_amount, 0);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock user_settings row
  select us.* into v_settings
  from public.user_settings us
  where us.user_id = v_user_id
  for update;

  if not found then
    raise exception 'user_settings not found for user %', v_user_id;
  end if;

  v_currency := v_settings.currency;
  v_pad := v_settings.number_padding;
  v_prefix := v_settings.number_prefix;
  v_next := v_settings.next_number;

  v_number := format('%s-%s',
    v_prefix,
    lpad(v_next::text, v_pad, '0')
  );

  -- Fetch profile snapshot
  select p.* into v_profile
  from public.profiles p
  where p.id = v_user_id;

  if not found then
    raise exception 'profile not found for user %', v_user_id;
  end if;

  -- Fetch customer snapshot
  select c.* into v_customer
  from public.customers c
  where c.id = p_customer_id
    and c.user_id = v_user_id;

  if not found then
    raise exception 'customer not found or not owned by user';
  end if;

  -- Build snapshots
  v_from_snapshot := jsonb_build_object(
    'accountType', v_profile.account_type,
    'companyName', v_profile.company_name,
    'fullName', v_profile.full_name,
    'registrationId', v_profile.registration_id,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'street', v_profile.street,
    'city', v_profile.city,
    'postal', v_profile.postal,
    'country', v_profile.country,
    'logoUrl', v_profile.logo_url
  );

  v_bill_to_snapshot := jsonb_build_object(
    'type', v_customer.type,
    'companyName', v_customer.company_name,
    'contactName', v_customer.contact_name,
    'fullName', v_customer.full_name,
    'email', v_customer.email,
    'phone', v_customer.phone,
    'street', v_customer.street,
    'city', v_customer.city,
    'postal', v_customer.postal,
    'country', v_customer.country
  );

  -- Insert invoice shell
  insert into public.invoices (
    user_id, customer_id, number,
    issue_date, due_date, status,
    currency, from_snapshot, bill_to_snapshot,
    discount_type, discount_amount, shipping_amount,
    notes, terms
  ) values (
    v_user_id, p_customer_id, v_number,
    p_issue_date, p_due_date, 'draft',
    v_currency, v_from_snapshot, v_bill_to_snapshot,
    v_discount_type, v_discount_amount, v_shipping_amount,
    p_notes, p_terms
  )
  returning id into v_invoice_id;

  -- Insert items + accumulate totals
  if p_items is not null then
    for i in array_lower(p_items,1)..array_upper(p_items,1) loop
      declare
        it public.invoice_item_input := p_items[i];
        l_sub numeric(12,2);
        l_tax numeric(12,2);
        l_total numeric(12,2);
      begin
        l_sub := round(coalesce(it.quantity,0) * coalesce(it.unit_price,0), 2);
        l_tax := round(l_sub * coalesce(it.tax_percent,0) / 100.0, 2);
        l_total := l_sub + l_tax;

        insert into public.invoice_items (
          invoice_id, item, description, quantity, unit_price, tax_percent,
          line_subtotal, line_tax, line_total
        ) values (
          v_invoice_id, it.item, it.description, coalesce(it.quantity,0), coalesce(it.unit_price,0), coalesce(it.tax_percent,0),
          l_sub, l_tax, l_total
        );

        v_subtotal := v_subtotal + l_sub;
        v_tax_total := v_tax_total + l_tax;
      end;
    end loop;
  end if;

  -- Apply discount
  if v_discount_type = 'percent' then
    v_total := v_subtotal + v_tax_total - round(v_subtotal * v_discount_amount / 100.0, 2);
  elsif v_discount_type = 'value' then
    v_total := v_subtotal + v_tax_total - v_discount_amount;
  else
    v_total := v_subtotal + v_tax_total;
  end if;

  -- Shipping
  v_total := v_total + v_shipping_amount;

  -- Update invoice totals
  update public.invoices
  set
    subtotal = round(v_subtotal, 2),
    tax_total = round(v_tax_total, 2),
    total = round(v_total, 2)
  where id = v_invoice_id;

  -- Bump next_number
  update public.user_settings
  set next_number = next_number + 1,
      updated_at = now()
  where user_id = v_user_id;

  return v_invoice_id;
end;
$$;


ALTER FUNCTION "public"."create_invoice"("p_customer_id" "uuid", "p_issue_date" "date", "p_due_date" "date", "p_items" "public"."invoice_item_input"[], "p_discount_type" "text", "p_discount_amount" numeric, "p_shipping_amount" numeric, "p_notes" "text", "p_terms" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invoice_from_paid_sales_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.payment_status::text <> 'paid' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  PERFORM public.generate_invoice_from_paid_sales_order(NEW.id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_invoice_from_paid_sales_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_prefix text;
  v_padding int;
  v_next int;
  v_number text;
  it jsonb;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_line numeric;
  v_line_tax numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_disc_type text;
  v_disc_amt numeric;
  v_ship numeric;
  v_status public.purchase_invoice_status;
  v_row_idx integer := 0;
  v_sort integer;
  v_supplier_id uuid;
  v_supplier_owner uuid;
  v_rowcount integer;
  v_amount_paid numeric;
  v_amount_due numeric;
  v_due_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_supplier_id := NULLIF(btrim(COALESCE(p_invoice->>'supplier_id', '')), '')::uuid;
  IF v_supplier_id IS NOT NULL THEN
    SELECT s.user_id INTO v_supplier_owner FROM public.suppliers s WHERE s.id = v_supplier_id;
    IF v_supplier_owner IS NULL THEN
      RAISE EXCEPTION 'Supplier not found';
    END IF;
    IF v_supplier_owner <> v_user_id THEN
      RAISE EXCEPTION 'Supplier does not belong to this user';
    END IF;
  END IF;

  SELECT
    COALESCE(us.purchase_invoice_prefix, 'PINV'),
    COALESCE(us.purchase_invoice_number_padding, 4),
    COALESCE(us.purchase_invoice_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id;

  IF NOT FOUND THEN
    v_prefix := 'PINV';
    v_padding := 4;
    v_next := 1;
  END IF;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_subtotal := v_subtotal + v_line;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  v_disc_type := p_invoice->>'discount_type';
  v_disc_amt := COALESCE((p_invoice->>'discount_amount')::numeric, 0);
  IF v_disc_type = 'percent' THEN
    v_discount := (v_subtotal * v_disc_amt) / 100.0;
  ELSE
    v_discount := v_disc_amt;
  END IF;

  v_ship := COALESCE((p_invoice->>'shipping_amount')::numeric, 0);
  v_total := v_subtotal + v_tax_total - v_discount + v_ship;

  v_amount_paid := COALESCE((p_invoice->>'amount_paid')::numeric, 0);
  IF v_amount_paid < 0 THEN v_amount_paid := 0; END IF;
  IF v_amount_paid > v_total THEN v_amount_paid := v_total; END IF;

  v_amount_due := COALESCE(NULLIF(p_invoice->>'amount_due', '')::numeric, GREATEST(0, v_total - v_amount_paid));

  v_due_date := COALESCE((p_invoice->>'due_date')::date, CURRENT_DATE + 14);

  v_status := COALESCE(
    NULLIF(p_invoice->>'status', '')::public.purchase_invoice_status,
    'unpaid'::public.purchase_invoice_status
  );

  INSERT INTO public.purchase_invoices (
    user_id,
    supplier_id,
    number,
    issue_date,
    due_date,
    status,
    currency,
    from_snapshot,
    bill_to_snapshot,
    client_snapshot,
    subtotal,
    tax_total,
    discount_type,
    discount_amount,
    shipping_amount,
    total,
    notes,
    terms,
    payment_method,
    amount_paid,
    amount_due,
    created_from_purchase_order_id
  ) VALUES (
    v_user_id,
    v_supplier_id,
    v_number,
    COALESCE((p_invoice->>'issue_date')::date, CURRENT_DATE),
    v_due_date,
    v_status,
    COALESCE(p_invoice->>'currency', 'MUR'),
    COALESCE(p_invoice->'from_snapshot', '{}'::jsonb),
    COALESCE(p_invoice->'bill_to_snapshot', '{}'::jsonb),
    p_invoice->'client_snapshot',
    v_subtotal,
    v_tax_total,
    NULLIF(p_invoice->>'discount_type', ''),
    COALESCE((p_invoice->>'discount_amount')::numeric, 0),
    v_ship,
    v_total,
    NULLIF(p_invoice->>'notes', ''),
    NULLIF(p_invoice->>'terms', ''),
    NULLIF(p_invoice->>'payment_method', ''),
    v_amount_paid,
    v_amount_due,
    NULLIF(btrim(COALESCE(p_invoice->>'created_from_purchase_order_id', '')), '')::uuid
  )
  RETURNING id INTO v_id;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_sort := COALESCE(
      CASE
        WHEN (it->>'sort_order') IS NOT NULL AND btrim(it->>'sort_order') <> ''
        THEN (it->>'sort_order')::integer
        ELSE NULL
      END,
      v_row_idx
    );
    INSERT INTO public.purchase_invoice_items (
      purchase_invoice_id,
      item,
      description,
      quantity,
      unit_price,
      tax_percent,
      line_subtotal,
      line_tax,
      line_total,
      sort_order
    ) VALUES (
      v_id,
      COALESCE(it->>'item', ''),
      NULLIF(it->>'description', ''),
      COALESCE((it->>'quantity')::numeric, 0),
      COALESCE((it->>'unit_price')::numeric, 0),
      COALESCE((it->>'tax_percent')::numeric, 0),
      v_line,
      v_line_tax,
      v_line + v_line_tax,
      v_sort
    );
    v_row_idx := v_row_idx + 1;
  END LOOP;

  UPDATE public.user_settings
  SET
    purchase_invoice_prefix = COALESCE(purchase_invoice_prefix, v_prefix),
    purchase_invoice_number_padding = COALESCE(purchase_invoice_number_padding, v_padding),
    purchase_invoice_next_number = v_next + 1
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RAISE EXCEPTION 'No user_settings row for this user. Save Company Settings / preferences once, then try again.';
  END IF;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") IS 'Creates a purchase invoice with next PINV- style number, line items, totals; optional supplier_id; amount_paid/amount_due for AP.';



CREATE OR REPLACE FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_purchase_order_id uuid;
  v_prefix text;
  v_padding int;
  v_next int;
  v_number text;
  it jsonb;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_line numeric;
  v_line_tax numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_disc_type text;
  v_disc_amt numeric;
  v_ship numeric;
  v_status public.purchase_order_status;
  v_row_idx integer := 0;
  v_sort integer;
  v_supplier_id uuid;
  v_supplier_owner uuid;
  v_rowcount integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_supplier_id := NULLIF(btrim(COALESCE(p_purchase_order->>'supplier_id', '')), '')::uuid;
  IF v_supplier_id IS NOT NULL THEN
    SELECT s.user_id INTO v_supplier_owner FROM public.suppliers s WHERE s.id = v_supplier_id;
    IF v_supplier_owner IS NULL THEN
      RAISE EXCEPTION 'Supplier not found';
    END IF;
    IF v_supplier_owner <> v_user_id THEN
      RAISE EXCEPTION 'Supplier does not belong to this user';
    END IF;
  END IF;

  SELECT
    COALESCE(us.purchase_order_prefix, 'PO'),
    COALESCE(us.purchase_order_number_padding, 4),
    COALESCE(us.purchase_order_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id;

  IF NOT FOUND THEN
    v_prefix := 'PO';
    v_padding := 4;
    v_next := 1;
  END IF;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_subtotal := v_subtotal + v_line;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  v_disc_type := p_purchase_order->>'discount_type';
  v_disc_amt := COALESCE((p_purchase_order->>'discount_amount')::numeric, 0);
  IF v_disc_type = 'percent' THEN
    v_discount := (v_subtotal * v_disc_amt) / 100.0;
  ELSE
    v_discount := v_disc_amt;
  END IF;

  v_ship := COALESCE((p_purchase_order->>'shipping_amount')::numeric, 0);
  v_total := v_subtotal + v_tax_total - v_discount + v_ship;

  v_status := COALESCE((p_purchase_order->>'status')::public.purchase_order_status, 'active');

  INSERT INTO public.purchase_orders (
    user_id,
    supplier_id,
    number,
    issue_date,
    valid_until,
    status,
    currency,
    from_snapshot,
    bill_to_snapshot,
    client_snapshot,
    subtotal,
    tax_total,
    discount_type,
    discount_amount,
    shipping_amount,
    total,
    notes,
    terms
  ) VALUES (
    v_user_id,
    v_supplier_id,
    v_number,
    COALESCE((p_purchase_order->>'issue_date')::date, CURRENT_DATE),
    COALESCE((p_purchase_order->>'valid_until')::date, CURRENT_DATE + 14),
    v_status,
    COALESCE(p_purchase_order->>'currency', 'MUR'),
    COALESCE(p_purchase_order->'from_snapshot', '{}'::jsonb),
    COALESCE(p_purchase_order->'bill_to_snapshot', '{}'::jsonb),
    p_purchase_order->'client_snapshot',
    v_subtotal,
    v_tax_total,
    NULLIF(p_purchase_order->>'discount_type', ''),
    COALESCE((p_purchase_order->>'discount_amount')::numeric, 0),
    v_ship,
    v_total,
    NULLIF(p_purchase_order->>'notes', ''),
    NULLIF(p_purchase_order->>'terms', '')
  )
  RETURNING id INTO v_purchase_order_id;

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_sort := COALESCE(
      CASE
        WHEN (it->>'sort_order') IS NOT NULL AND btrim(it->>'sort_order') <> ''
        THEN (it->>'sort_order')::integer
        ELSE NULL
      END,
      v_row_idx
    );
    INSERT INTO public.purchase_order_items (
      purchase_order_id,
      item,
      description,
      quantity,
      unit_price,
      tax_percent,
      line_subtotal,
      line_tax,
      line_total,
      sort_order
    ) VALUES (
      v_purchase_order_id,
      COALESCE(it->>'item', ''),
      NULLIF(it->>'description', ''),
      COALESCE((it->>'quantity')::numeric, 0),
      COALESCE((it->>'unit_price')::numeric, 0),
      COALESCE((it->>'tax_percent')::numeric, 0),
      v_line,
      v_line_tax,
      v_line + v_line_tax,
      v_sort
    );
    v_row_idx := v_row_idx + 1;
  END LOOP;

  UPDATE public.user_settings
  SET
    purchase_order_prefix = COALESCE(purchase_order_prefix, v_prefix),
    purchase_order_number_padding = COALESCE(purchase_order_number_padding, v_padding),
    purchase_order_next_number = v_next + 1
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RAISE EXCEPTION 'No user_settings row for this user. Save Company Settings / preferences once, then try again.';
  END IF;

  RETURN v_purchase_order_id;
END;
$$;


ALTER FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") IS 'Creates a purchase order with next PO- style number, line items, totals; optional supplier_id must reference own supplier.';



CREATE OR REPLACE FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quotation_id uuid;
  v_prefix text;
  v_padding int;
  v_next int;
  v_number text;
  it jsonb;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_line numeric;
  v_line_tax numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_disc_type text;
  v_disc_amt numeric;
  v_ship numeric;
  v_status public.quotation_status;
  v_rowcount integer;
  v_row_idx integer := 0;
  v_sort integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    COALESCE(us.quotation_prefix, 'QT'),
    COALESCE(us.quotation_number_padding, 4),
    COALESCE(us.quotation_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id;

  IF NOT FOUND THEN
    v_prefix := 'QT';
    v_padding := 4;
    v_next := 1;
  END IF;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_subtotal := v_subtotal + v_line;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  v_disc_type := p_quotation->>'discount_type';
  v_disc_amt := COALESCE((p_quotation->>'discount_amount')::numeric, 0);
  IF v_disc_type = 'percent' THEN
    v_discount := (v_subtotal * v_disc_amt) / 100.0;
  ELSE
    v_discount := v_disc_amt;
  END IF;

  v_ship := COALESCE((p_quotation->>'shipping_amount')::numeric, 0);
  v_total := v_subtotal + v_tax_total - v_discount + v_ship;

  v_status := COALESCE((p_quotation->>'status')::public.quotation_status, 'active');

  INSERT INTO public.quotations (
    user_id,
    customer_id,
    number,
    issue_date,
    valid_until,
    status,
    currency,
    from_snapshot,
    bill_to_snapshot,
    client_snapshot,
    subtotal,
    tax_total,
    discount_type,
    discount_amount,
    shipping_amount,
    total,
    notes,
    terms
  ) VALUES (
    v_user_id,
    NULLIF(p_quotation->>'customer_id', '')::uuid,
    v_number,
    COALESCE((p_quotation->>'issue_date')::date, CURRENT_DATE),
    COALESCE((p_quotation->>'valid_until')::date, CURRENT_DATE + 14),
    v_status,
    COALESCE(p_quotation->>'currency', 'MUR'),
    COALESCE(p_quotation->'from_snapshot', '{}'::jsonb),
    COALESCE(p_quotation->'bill_to_snapshot', '{}'::jsonb),
    p_quotation->'client_snapshot',
    v_subtotal,
    v_tax_total,
    NULLIF(p_quotation->>'discount_type', ''),
    COALESCE((p_quotation->>'discount_amount')::numeric, 0),
    v_ship,
    v_total,
    NULLIF(p_quotation->>'notes', ''),
    NULLIF(p_quotation->>'terms', '')
  )
  RETURNING id INTO v_quotation_id;

  v_row_idx := 0;
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_sort := COALESCE(
      CASE
        WHEN (it->>'sort_order') IS NOT NULL AND btrim(it->>'sort_order') <> ''
        THEN (it->>'sort_order')::integer
        ELSE NULL
      END,
      v_row_idx
    );
    INSERT INTO public.quotation_items (
      quotation_id,
      item,
      description,
      quantity,
      unit_price,
      tax_percent,
      line_subtotal,
      line_tax,
      line_total,
      sort_order
    ) VALUES (
      v_quotation_id,
      COALESCE(it->>'item', ''),
      NULLIF(it->>'description', ''),
      COALESCE((it->>'quantity')::numeric, 0),
      COALESCE((it->>'unit_price')::numeric, 0),
      COALESCE((it->>'tax_percent')::numeric, 0),
      v_line,
      v_line_tax,
      v_line + v_line_tax,
      v_sort
    );
    v_row_idx := v_row_idx + 1;
  END LOOP;

  UPDATE public.user_settings
  SET
    quotation_prefix = COALESCE(quotation_prefix, v_prefix),
    quotation_number_padding = COALESCE(quotation_number_padding, v_padding),
    quotation_next_number = v_next + 1
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RAISE EXCEPTION 'No user_settings row for this user. Save Company Settings / preferences once, then try again.';
  END IF;

  RETURN v_quotation_id;
END;
$$;


ALTER FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") IS 'Creates a quotation with next QT- style number, line items, and computed totals (same flow as invoices).';



CREATE OR REPLACE FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_sales_order_id uuid;
  v_prefix text;
  v_padding int;
  v_next int;
  v_number text;
  it jsonb;
  v_subtotal numeric := 0;
  v_tax_total numeric := 0;
  v_line numeric;
  v_line_tax numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_disc_type text;
  v_disc_amt numeric;
  v_ship numeric;
  v_status public.sales_order_status;
  v_rowcount integer;
  v_row_idx integer := 0;
  v_sort integer;
  v_from_qid uuid;
  v_q_owner uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_from_qid := NULLIF(btrim(COALESCE(p_sales_order->>'created_from_quotation_id', '')), '')::uuid;
  IF v_from_qid IS NOT NULL THEN
    SELECT q.user_id INTO v_q_owner FROM public.quotations q WHERE q.id = v_from_qid;
    IF v_q_owner IS NULL THEN
      RAISE EXCEPTION 'Source quotation not found';
    END IF;
    IF v_q_owner <> v_user_id THEN
      RAISE EXCEPTION 'Source quotation does not belong to this user';
    END IF;
  END IF;

  SELECT
    COALESCE(us.sales_order_prefix, 'SO'),
    COALESCE(us.sales_order_number_padding, 4),
    COALESCE(us.sales_order_next_number, 1)
  INTO v_prefix, v_padding, v_next
  FROM public.user_settings us
  WHERE us.user_id = v_user_id;

  IF NOT FOUND THEN
    v_prefix := 'SO';
    v_padding := 4;
    v_next := 1;
  END IF;

  v_number := v_prefix || '-' || lpad(v_next::text, v_padding, '0');

  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_subtotal := v_subtotal + v_line;
    v_tax_total := v_tax_total + v_line_tax;
  END LOOP;

  v_disc_type := p_sales_order->>'discount_type';
  v_disc_amt := COALESCE((p_sales_order->>'discount_amount')::numeric, 0);
  IF v_disc_type = 'percent' THEN
    v_discount := (v_subtotal * v_disc_amt) / 100.0;
  ELSE
    v_discount := v_disc_amt;
  END IF;

  v_ship := COALESCE((p_sales_order->>'shipping_amount')::numeric, 0);
  v_total := v_subtotal + v_tax_total - v_discount + v_ship;

  v_status := COALESCE((p_sales_order->>'status')::public.sales_order_status, 'active');

  INSERT INTO public.sales_orders (
    user_id,
    customer_id,
    created_from_quotation_id,
    number,
    issue_date,
    valid_until,
    status,
    currency,
    from_snapshot,
    bill_to_snapshot,
    client_snapshot,
    subtotal,
    tax_total,
    discount_type,
    discount_amount,
    shipping_amount,
    total,
    notes,
    terms
  ) VALUES (
    v_user_id,
    NULLIF(p_sales_order->>'customer_id', '')::uuid,
    v_from_qid,
    v_number,
    COALESCE((p_sales_order->>'issue_date')::date, CURRENT_DATE),
    COALESCE((p_sales_order->>'valid_until')::date, CURRENT_DATE + 14),
    v_status,
    COALESCE(p_sales_order->>'currency', 'MUR'),
    COALESCE(p_sales_order->'from_snapshot', '{}'::jsonb),
    COALESCE(p_sales_order->'bill_to_snapshot', '{}'::jsonb),
    p_sales_order->'client_snapshot',
    v_subtotal,
    v_tax_total,
    NULLIF(p_sales_order->>'discount_type', ''),
    COALESCE((p_sales_order->>'discount_amount')::numeric, 0),
    v_ship,
    v_total,
    NULLIF(p_sales_order->>'notes', ''),
    NULLIF(p_sales_order->>'terms', '')
  )
  RETURNING id INTO v_sales_order_id;

  v_row_idx := 0;
  FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_line := COALESCE((it->>'quantity')::numeric, 0) * COALESCE((it->>'unit_price')::numeric, 0);
    v_line_tax := v_line * (COALESCE((it->>'tax_percent')::numeric, 0) / 100.0);
    v_sort := COALESCE(
      CASE
        WHEN (it->>'sort_order') IS NOT NULL AND btrim(it->>'sort_order') <> ''
        THEN (it->>'sort_order')::integer
        ELSE NULL
      END,
      v_row_idx
    );
    INSERT INTO public.sales_order_items (
      sales_order_id,
      item,
      description,
      quantity,
      unit_price,
      tax_percent,
      line_subtotal,
      line_tax,
      line_total,
      sort_order
    ) VALUES (
      v_sales_order_id,
      COALESCE(it->>'item', ''),
      NULLIF(it->>'description', ''),
      COALESCE((it->>'quantity')::numeric, 0),
      COALESCE((it->>'unit_price')::numeric, 0),
      COALESCE((it->>'tax_percent')::numeric, 0),
      v_line,
      v_line_tax,
      v_line + v_line_tax,
      v_sort
    );
    v_row_idx := v_row_idx + 1;
  END LOOP;

  UPDATE public.user_settings
  SET
    sales_order_prefix = COALESCE(sales_order_prefix, v_prefix),
    sales_order_number_padding = COALESCE(sales_order_number_padding, v_padding),
    sales_order_next_number = v_next + 1
  WHERE user_id = v_user_id;

  GET DIAGNOSTICS v_rowcount = ROW_COUNT;
  IF v_rowcount = 0 THEN
    RAISE EXCEPTION 'No user_settings row for this user. Save Company Settings / preferences once, then try again.';
  END IF;

  RETURN v_sales_order_id;
END;
$$;


ALTER FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") IS 'Creates a sales order with next SO- style number, line items, totals; optional created_from_quotation_id must reference own quotation.';



CREATE OR REPLACE FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric DEFAULT 0, "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_delivery_date" "date" DEFAULT NULL::"date", "p_fulfillment_status" "text" DEFAULT 'new'::"text", "p_payment_status" "text" DEFAULT 'unpaid'::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id          uuid := auth.uid();
  v_order_id         uuid;
  v_number           text;
  v_subtotal         numeric := 0;
  v_discount         numeric := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_total            numeric;
  v_customer_snap    jsonb;
  v_from_snap        jsonb;
  v_item             jsonb;
  v_sort             int := 0;
  v_qty              numeric;
  v_price            numeric;
  v_line_total       numeric;
  v_next_seq         int;
  v_fulfillment      public.sales_order_fulfillment_status;
  v_payment          public.sales_order_payment_status;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %', p_company_id;
  END IF;

  v_fulfillment := COALESCE(
    NULLIF(TRIM(p_fulfillment_status), ''),
    'new'
  )::public.sales_order_fulfillment_status;

  v_payment := COALESCE(
    NULLIF(TRIM(p_payment_status), ''),
    'unpaid'
  )::public.sales_order_payment_status;

  SELECT COALESCE(MAX((regexp_match(so.number, '^SOM-([0-9]+)$'))[1]::int), 0) + 1
  INTO v_next_seq
  FROM public.sales_orders so
  WHERE so.company_id = p_company_id
    AND so.number ~ '^SOM-[0-9]+$';

  LOOP
    v_number := 'SOM-' || lpad(v_next_seq::text, GREATEST(4, length(v_next_seq::text)), '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.sales_orders
      WHERE company_id = p_company_id AND number = v_number
    );
    v_next_seq := v_next_seq + 1;
  END LOOP;

  v_customer_snap := (
    SELECT jsonb_build_object(
      'id',             c.id,
      'name',           COALESCE(NULLIF(TRIM(c.full_name), ''),
                                  NULLIF(TRIM(c.contact_name), ''),
                                  NULLIF(TRIM(c.company_name), ''), ''),
      'phone',          COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(p_phone), ''), ''),
      'address_line_1', COALESCE(NULLIF(TRIM(c.address_line_1), ''),
                                  NULLIF(TRIM(c.street), ''),
                                  NULLIF(TRIM(p_address), ''), ''),
      'email',          COALESCE(NULLIF(TRIM(c.email), ''), '')
    )
    FROM public.customers c
    WHERE c.id = p_customer_id
  );

  IF v_customer_snap IS NULL THEN
    v_customer_snap := jsonb_build_object(
      'id', p_customer_id,
      'address_line_1', COALESCE(p_address, ''),
      'phone', COALESCE(p_phone, '')
    );
  END IF;

  v_from_snap := (
    SELECT jsonb_build_object('company_id', co.id, 'name', co.name)
    FROM public.companies co
    WHERE co.id = p_company_id
  );

  IF v_from_snap IS NULL THEN
    v_from_snap := jsonb_build_object('company_id', p_company_id);
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty   := COALESCE((v_item->>'quantity')::numeric, 0);
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;

  v_discount := LEAST(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount;

  INSERT INTO public.sales_orders (
    user_id, company_id, customer_id, city_id,
    number, issue_date, valid_until, delivery_date,
    status, fulfillment_status, payment_status,
    currency,
    from_snapshot, bill_to_snapshot,
    subtotal, tax_total, discount_amount, discount_type, shipping_amount, total,
    notes
  )
  VALUES (
    v_user_id, p_company_id, p_customer_id, p_city_id,
    v_number, CURRENT_DATE, CURRENT_DATE + 30, p_delivery_date,
    'active'::public.sales_order_status,
    v_fulfillment,
    v_payment,
    p_currency,
    v_from_snap, v_customer_snap,
    v_subtotal, 0,
    v_discount,
    CASE WHEN v_discount > 0 THEN 'value' ELSE NULL END,
    0, v_total,
    NULLIF(TRIM(p_notes), '')
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty        := COALESCE((v_item->>'quantity')::numeric, 1);
    v_price      := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_total := v_qty * v_price;

    INSERT INTO public.sales_order_items (
      sales_order_id, company_id, product_id,
      item, description,
      quantity, unit_price,
      tax_percent, line_subtotal, line_tax, line_total,
      sort_order
    )
    VALUES (
      v_order_id, p_company_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      v_item->>'name',
      NULLIF(TRIM(COALESCE(v_item->>'description', '')), ''),
      v_qty, v_price,
      0, v_line_total, 0, v_line_total,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;

  RETURN v_order_id;
END;
$_$;


ALTER FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_fulfillment_status" "text", "p_payment_status" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_credit_note"("p_credit_note_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cn public.credit_notes%ROWTYPE;
  v_inv public.invoices%ROWTYPE;
  v_other_credits numeric(14, 2);
  v_new_due numeric(14, 2);
BEGIN
  SELECT * INTO v_cn
  FROM public.credit_notes
  WHERE id = p_credit_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;

  IF v_cn.status = 'posted'::public.credit_note_status
     AND v_cn.related_invoice_id IS NOT NULL THEN
    SELECT * INTO v_inv
    FROM public.invoices
    WHERE id = v_cn.related_invoice_id
    FOR UPDATE;

    IF FOUND AND v_inv.status <> 'cancelled'::invoice_status THEN
      v_other_credits := GREATEST(
        0,
        public.invoice_posted_credit_total(v_cn.related_invoice_id) - v_cn.total
      );

      v_new_due := GREATEST(
        0,
        COALESCE(v_inv.total, 0)
          - COALESCE(v_inv.amount_paid, 0)
          - v_other_credits
      );

      UPDATE public.invoices
      SET
        amount_due = v_new_due,
        status = CASE
          WHEN v_new_due > 0.005 THEN 'unpaid'::invoice_status
          ELSE v_inv.status
        END,
        updated_at = now()
      WHERE id = v_inv.id;
    END IF;
  END IF;

  DELETE FROM public.credit_notes WHERE id = p_credit_note_id;
END;
$$;


ALTER FUNCTION "public"."delete_credit_note"("p_credit_note_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_so public.sales_orders%ROWTYPE;
  v_invoice_id uuid;
  v_invoice_number text;
  v_next_number integer;
BEGIN
  SELECT *
  INTO v_so
  FROM public.sales_orders
  WHERE id = p_sales_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Only generate invoice when sales order is paid
  IF v_so.payment_status::text <> 'paid' THEN
    RETURN;
  END IF;

  -- Prevent duplicate invoice creation
  IF EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.created_from_sales_order_id = v_so.id
  ) THEN

    -- Normal sales orders may be completed.
    -- Upselling orders must stay fulfillment_status = 'upselling'.
    IF v_so.fulfillment_status::text <> 'upselling' THEN
      UPDATE public.sales_orders
      SET
        fulfillment_status = 'completed',
        updated_at = now()
      WHERE id = v_so.id
        AND fulfillment_status::text <> 'completed';
    END IF;

    RETURN;
  END IF;

  -- Do not create invoice without items
  IF NOT EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = v_so.id
  ) THEN
    RETURN;
  END IF;

  -- Lock per user to avoid duplicate invoice numbers during concurrent updates
  PERFORM pg_advisory_xact_lock(hashtext(v_so.user_id::text));

  SELECT coalesce(
    max(
      substring(i.number from 'INV-([0-9]+)')::integer
    ),
    0
  ) + 1
  INTO v_next_number
  FROM public.invoices i
  WHERE i.user_id = v_so.user_id
    AND i.number ~ '^INV-[0-9]+$';

  LOOP
    v_invoice_number := 'INV-' || lpad(v_next_number::text, 5, '0');

    BEGIN
      INSERT INTO public.invoices (
        user_id,
        customer_id,
        number,
        issue_date,
        due_date,
        status,
        currency,
        from_snapshot,
        bill_to_snapshot,
        client_snapshot,
        subtotal,
        tax_total,
        discount_type,
        discount_amount,
        shipping_amount,
        total,
        notes,
        terms,
        payment_method,
        amount_paid,
        amount_due,
        credit_applied,
        created_from_quotation_id,
        created_from_sales_order_id,
        company_id
      )
      VALUES (
        v_so.user_id,
        v_so.customer_id,
        v_invoice_number,
        current_date,
        current_date + 14,
        'paid',
        v_so.currency,
        v_so.from_snapshot,
        v_so.bill_to_snapshot,
        v_so.client_snapshot,
        v_so.subtotal,
        v_so.tax_total,
        v_so.discount_type,
        v_so.discount_amount,
        v_so.shipping_amount,
        v_so.total,
        v_so.notes,
        v_so.terms,
        null,
        v_so.total,
        0,
        0,
        v_so.created_from_quotation_id,
        v_so.id,
        v_so.company_id
      )
      RETURNING id INTO v_invoice_id;

      EXIT;

    EXCEPTION
      WHEN unique_violation THEN
        v_next_number := v_next_number + 1;
    END;
  END LOOP;

  INSERT INTO public.invoice_items (
    invoice_id,
    item,
    description,
    quantity,
    unit_price,
    tax_percent,
    line_subtotal,
    line_tax,
    line_total,
    company_id,
    product_id
  )
  SELECT
    v_invoice_id,
    soi.item,
    soi.description,
    soi.quantity,
    soi.unit_price,
    soi.tax_percent,
    soi.line_subtotal,
    soi.line_tax,
    soi.line_total,
    soi.company_id,
    soi.product_id
  FROM public.sales_order_items soi
  WHERE soi.sales_order_id = v_so.id
  ORDER BY soi.sort_order, soi.id;

  -- Normal sales orders become completed.
  -- Upselling sales orders stay upselling.
  IF v_so.fulfillment_status::text <> 'upselling' THEN
    UPDATE public.sales_orders
    SET
      fulfillment_status = 'completed',
      updated_at = now()
    WHERE id = v_so.id
      AND fulfillment_status::text <> 'completed';
  END IF;
END;
$_$;


ALTER FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_note_nav_facets"("p_company_id" "uuid", "p_month_start" "date", "p_quarter_start" "date", "p_year_start" "date") RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'companyTotal',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE cn.company_id = p_company_id OR cn.company_id IS NULL),
    'draftCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'draft'::public.credit_note_status),
    'postedCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'posted'::public.credit_note_status),
    'cancelledCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.status = 'cancelled'::public.credit_note_status),
    'thisMonthCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_month_start),
    'thisQuarterCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_quarter_start),
    'thisYearCount',
    (SELECT count(*)::bigint FROM public.credit_notes cn
     WHERE (cn.company_id = p_company_id OR cn.company_id IS NULL)
       AND cn.issue_date >= p_year_start)
  );
$$;


ALTER FUNCTION "public"."get_credit_note_nav_facets"("p_company_id" "uuid", "p_month_start" "date", "p_quarter_start" "date", "p_year_start" "date") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "company_name" "text",
    "contact_name" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "street" "text",
    "city" "text",
    "postal" "text",
    "country" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address_line_1" "text",
    "address_line_2" "text",
    "company_id" "uuid",
    "city_id" "uuid",
    "phone_2" "text",
    "map_location" "text",
    CONSTRAINT "customers_type_check" CHECK (("type" = ANY (ARRAY['company'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") RETURNS SETOF "public"."customers"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.*
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.company_id = p_company_id
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_company_member(p_company_id);

  RETURN (
    WITH inv AS (
      SELECT i.status, i.issue_date, i.due_date, i.currency, i.total
      FROM public.invoices i
      WHERE i.company_id = p_company_id
    ),
    inv_active AS (
      SELECT *
      FROM inv
      WHERE status <> 'cancelled'::invoice_status
    ),
    inv_paid_year AS (
      SELECT total, coalesce(issue_date, due_date) AS invoice_date
      FROM inv
      WHERE status = 'paid'::invoice_status
        AND coalesce(issue_date, due_date) IS NOT NULL
        AND extract(year FROM coalesce(issue_date, due_date))::int = p_year
    )
    SELECT json_build_object(
      'netSales',
      coalesce((SELECT sum(total) FROM inv_active), 0),
      'totalPaid',
      coalesce(
        (SELECT sum(total) FROM inv WHERE status = 'paid'::invoice_status),
        0
      ),
      'totalExpense',
      coalesce(
        (SELECT sum(amount) FROM public.expenses e WHERE e.company_id = p_company_id),
        0
      ),
      'totalPurchases',
      coalesce(
        (
          SELECT sum(total)
          FROM public.purchase_invoices pi
          WHERE pi.company_id = p_company_id
            AND pi.status <> 'cancelled'::purchase_invoice_status
        ),
        0
      ),
      'salesInvoiceCount',
      (SELECT count(*)::bigint FROM inv_active),
      'salesInvoicesByYear',
      coalesce(
        (
          SELECT json_agg(
            json_build_object(
              'year', y.issue_year,
              'count', y.cnt
            )
            ORDER BY y.issue_year DESC
          )
          FROM (
            SELECT
              extract(year FROM coalesce(issue_date, due_date))::int AS issue_year,
              count(*)::bigint AS cnt
            FROM inv_active
            WHERE coalesce(issue_date, due_date) IS NOT NULL
            GROUP BY 1
          ) y
        ),
        '[]'::json
      ),
      'incomeByMonth',
      coalesce(
        (
          SELECT json_agg(
            json_build_object(
              'month', m.month_key,
              'income', m.income
            )
            ORDER BY m.month_key
          )
          FROM (
            SELECT
              to_char(invoice_date, 'YYYY-MM') AS month_key,
              sum(total) AS income
            FROM inv_paid_year
            GROUP BY 1
          ) m
        ),
        '[]'::json
      ),
      'customerCount',
      (
        SELECT count(*)::bigint
        FROM public.customers c
        WHERE c.company_id = p_company_id
      ),
      'productCount',
      (
        SELECT count(*)::bigint
        FROM public.products p
        WHERE p.company_id = p_company_id
      ),
      'driverSettlementCount',
      (
        SELECT count(*)::bigint
        FROM public.delivery_driver_settlements dds
        WHERE dds.company_id = p_company_id
      ),
      'driverSettlementsCashTotal',
      coalesce(
        (
          SELECT sum(cash_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
        ),
        0
      ),
      'driverSettlementsBankTotal',
      coalesce(
        (
          SELECT sum(bank_transfer_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
        ),
        0
      ),
      'driverSettlementsDueOpenTotal',
      coalesce(
        (
          SELECT sum(due_amount)
          FROM public.delivery_driver_settlements dds
          WHERE dds.company_id = p_company_id
            AND coalesce(due_amount, 0) > 0
        ),
        0
      ),
      'driverSettlementsOpenDueCount',
      (
        SELECT count(*)::bigint
        FROM public.delivery_driver_settlements dds
        WHERE dds.company_id = p_company_id
          AND coalesce(due_amount, 0) > 0
      ),
      'driverSettlementsDuePaidTotal',
      coalesce(
        (
          SELECT sum(amount)
          FROM public.driver_credit_settlements dcs
          WHERE dcs.company_id = p_company_id
            AND dcs.delivery_id IS NULL
            AND coalesce(dcs.amount, 0) > 0
        ),
        0
      ),
      'currency',
      coalesce(
        (
          SELECT currency
          FROM inv
          WHERE currency IS NOT NULL
          ORDER BY issue_date DESC NULLS LAST, due_date DESC NULLS LAST
          LIMIT 1
        ),
        (
          SELECT currency
          FROM public.expenses e
          WHERE e.company_id = p_company_id AND e.currency IS NOT NULL
          ORDER BY e.expense_date DESC NULLS LAST
          LIMIT 1
        ),
        (
          SELECT currency
          FROM public.purchase_invoices pi
          WHERE pi.company_id = p_company_id AND pi.currency IS NOT NULL
          LIMIT 1
        ),
        'MUR'
      )
    )
  );
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) IS 'Dashboard aggregates for /app; scoped strictly to p_company_id with membership check.';



CREATE OR REPLACE FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH inv AS (
    SELECT i.id, i.currency
    FROM public.invoices i
    WHERE (i.company_id = p_company_id OR i.company_id IS NULL)
      AND i.status <> 'cancelled'::invoice_status
      AND i.issue_date >= p_start_date
      AND i.issue_date <= p_end_date
  ),
  aggregated AS (
    SELECT
      coalesce(nullif(trim(ii.item), ''), 'Unknown') AS product,
      sum(coalesce(ii.quantity, 0)) AS total_qty,
      sum(coalesce(ii.quantity, 0) * coalesce(ii.unit_price, 0)) AS total_amount
    FROM inv
    INNER JOIN public.invoice_items ii ON ii.invoice_id = inv.id
    GROUP BY 1
  )
  SELECT json_build_object(
    'currency',
    coalesce(
      (
        SELECT i.currency
        FROM inv i
        WHERE i.currency IS NOT NULL
        ORDER BY i.id
        LIMIT 1
      ),
      'MUR'
    ),
    'invoiceCount',
    (SELECT count(*)::bigint FROM inv),
    'rows',
    coalesce(
      (
        SELECT json_agg(
          json_build_object(
            'product', a.product,
            'totalQty', a.total_qty,
            'totalAmount', a.total_amount
          )
          ORDER BY a.product
        )
        FROM aggregated a
      ),
      '[]'::json
    ),
    'grandTotalQty',
    coalesce((SELECT sum(total_qty) FROM aggregated), 0),
    'grandTotalAmount',
    coalesce((SELECT sum(total_amount) FROM aggregated), 0)
  );
$$;


ALTER FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Invoice pivot aggregates; matches app filters (company_id = p or null, non-cancelled, issue_date range).';



CREATE OR REPLACE FUNCTION "public"."get_plans"() RETURNS json
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', p.id,
        'name', p.name,
        'description', p.description,
        'price', p.price,
        'currency', p.currency,
        'billing_cycle', p.billing_cycle,
        'max_users', p.max_users,
        'is_active', p.is_active,
        'features', (
          SELECT COALESCE(json_agg(f.code), '[]'::json)
          FROM public.plan_features pf
          JOIN public.features f ON f.id = pf.feature_id
          WHERE pf.plan_id = p.id
        )
      )
      ORDER BY p.name, p.billing_cycle  -- ✅ moved here
    )
    FROM public.plans p
  );
END;
$$;


ALTER FUNCTION "public"."get_plans"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "sku" "text",
    "name" "text" NOT NULL,
    "description" "text",
    "unit" "text" DEFAULT 'ea'::"text" NOT NULL,
    "cost_price" numeric DEFAULT 0 NOT NULL,
    "sale_price" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "image_base64" "text",
    "image_mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_cost_price_check" CHECK (("cost_price" >= (0)::numeric)),
    CONSTRAINT "products_image_base64_size_check" CHECK ((("image_base64" IS NULL) OR ("octet_length"("image_base64") <= 5242880))),
    CONSTRAINT "products_image_mime_type_check" CHECK ((("image_mime_type" IS NULL) OR ("image_mime_type" = ANY (ARRAY['image/png'::"text", 'image/jpeg'::"text", 'image/webp'::"text", 'image/gif'::"text", 'image/svg+xml'::"text"])))),
    CONSTRAINT "products_sale_price_check" CHECK (("sale_price" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") RETURNS SETOF "public"."products"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.company_id = p_company_id
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sales_order_list_facets"("p_company_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT json_build_object(
    'total',
    (SELECT count(*)::bigint
     FROM public.sales_orders so
     WHERE so.company_id = p_company_id),
    'byFulfillment',
    COALESCE(
      (
        SELECT json_object_agg(f.fulfillment_status::text, f.cnt)
        FROM (
          SELECT so.fulfillment_status, count(*)::bigint AS cnt
          FROM public.sales_orders so
          WHERE so.company_id = p_company_id
          GROUP BY so.fulfillment_status
        ) f
      ),
      '{}'::json
    ),
    'byPayment',
    COALESCE(
      (
        SELECT json_object_agg(p.payment_status::text, p.cnt)
        FROM (
          SELECT so.payment_status, count(*)::bigint AS cnt
          FROM public.sales_orders so
          WHERE so.company_id = p_company_id
          GROUP BY so.payment_status
        ) p
      ),
      '{}'::json
    ),
    'missingCity',
    public.count_sales_orders_missing_city(p_company_id),
    'missingAddress',
    public.count_sales_orders_missing_address(p_company_id),
    'missingBoth',
    public.count_sales_orders_missing_both(p_company_id)
  );
$$;


ALTER FUNCTION "public"."get_sales_order_list_facets"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.list_staff_products_for_company(p_company_id) p
  WHERE p.id = p_product_id
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") RETURNS TABLE("city_id" "uuid", "sort_order" integer)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT zc.city_id, MIN(zc.sort_order)::int AS sort_order
  FROM public.zone_cities zc
  INNER JOIN public.zones z ON z.id = zc.zone_id
  WHERE zc.company_id = p_company_id
    AND z.company_id = p_company_id
    AND z.driver_user_id = auth.uid()
    AND z.is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  GROUP BY zc.city_id
  ORDER BY sort_order, zc.city_id;
$$;


ALTER FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.delivery_date is not null
     and new.driver_user_id is not null then
    perform public.assign_sales_orders_to_delivery_by_date(new.id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.phone
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sales_order_delivered_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery_id uuid;
  v_delivery public.deliveries%rowtype;
  v_stock_location_id uuid;
  v_stock_location_name text;
  v_driver_name text;
  v_item record;
  v_available_stock numeric;
  v_existing_count integer;
  v_reference_type text := 'delivered_to_customer';
begin
  -- Only run when fulfillment_status changes to delivered to customer
  if new.fulfillment_status::text <> 'delivered to customer' then
    return new;
  end if;

  if old.fulfillment_status::text = new.fulfillment_status::text then
    return new;
  end if;

  -- Prevent duplicate stock-out for this sales order
  select count(*)
  into v_existing_count
  from public.inventory_movements
  where sales_order_id = new.id
    and reference_type = v_reference_type;

  if v_existing_count > 0 then
    return new;
  end if;

  -- Try to find linked delivery note
  select dso.delivery_id
  into v_delivery_id
  from public.delivery_sales_orders dso
  join public.deliveries d
    on d.id = dso.delivery_id
  where dso.sales_order_id = new.id
  order by d.created_at desc
  limit 1;

  -- Case A: delivered through driver delivery note
  if v_delivery_id is not null then
    select *
    into v_delivery
    from public.deliveries
    where id = v_delivery_id
    for update;

    if not found then
      raise exception 'Delivery note not found for sales order %.', new.id;
    end if;

    if v_delivery.status::text <> 'delivered_to_driver' then
      raise exception 'Delivery note must be delivered to driver before sales order can be delivered to customer.';
    end if;

    if v_delivery.location_id is null then
      raise exception 'Delivery note has no driver location assigned.';
    end if;

    v_stock_location_id := v_delivery.location_id;

    select coalesce(up.full_name, au.email, v_delivery.driver_user_id::text)
    into v_driver_name
    from auth.users au
    left join public.user_profiles up
      on up.id = au.id
    where au.id = v_delivery.driver_user_id;

    if v_driver_name is null then
      v_driver_name := v_delivery.driver_user_id::text;
    end if;

  -- Case B: direct delivery, no delivery note
  else
    select id
    into v_stock_location_id
    from public.locations
    where company_id = new.company_id
      and location_type = 'warehouse'
      and is_primary_warehouse = true
      and is_active = true
    limit 1;

    if v_stock_location_id is null then
      raise exception 'No active primary warehouse defined for this company.';
    end if;

    v_driver_name := null;
  end if;

  select name
  into v_stock_location_name
  from public.locations
  where id = v_stock_location_id;

  -- Validate available stock only
  for v_item in
    select
      soi.product_id,
      p.name as product_name,
      sum(soi.quantity) as quantity
    from public.sales_order_items soi
    join public.products p
      on p.id = soi.product_id
    where soi.sales_order_id = new.id
      and soi.product_id is not null
    group by soi.product_id, p.name
  loop
    select pls.quantity
    into v_available_stock
    from public.product_location_stocks pls
    where pls.company_id = new.company_id
      and pls.product_id = v_item.product_id
      and pls.location_id = v_stock_location_id
    for update;

    if coalesce(v_available_stock, 0) < v_item.quantity then
      raise exception
        'Not enough stock in % for product %. Required %, available %.',
        coalesce(v_stock_location_name, 'selected stock location'),
        v_item.product_name,
        v_item.quantity,
        coalesce(v_available_stock, 0);
    end if;
  end loop;

  -- Insert movement only.
  -- product_location_stocks will be updated by inventory_movements_apply_to_balances().
  with order_items as (
    select
      soi.product_id,
      p.name as product_name,
      sum(soi.quantity) as quantity
    from public.sales_order_items soi
    join public.products p
      on p.id = soi.product_id
    where soi.sales_order_id = new.id
      and soi.product_id is not null
    group by soi.product_id, p.name
  )
  insert into public.inventory_movements (
    company_id,
    user_id,
    product_id,
    event_type,
    from_location_id,
    to_location_id,
    quantity,
    delivery_id,
    sales_order_id,
    reference_type,
    reference_number,
    note
  )
  select
    new.company_id,
    coalesce(auth.uid(), new.user_id),
    oi.product_id,
    'adjustment_out',
    v_stock_location_id,
    null,
    oi.quantity,
    v_delivery_id,
    new.id,
    v_reference_type,
    new.number,
    case
      when v_delivery_id is not null then
        concat(
          oi.quantity,
          ' x ',
          oi.product_name,
          ' delivered to customer from driver ',
          v_driver_name
        )
      else
        concat(
          oi.quantity,
          ' x ',
          oi.product_name,
          ' delivered to customer directly from ',
          v_stock_location_name
        )
    end
  from order_items oi
  on conflict do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_sales_order_delivered_to_customer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_sales_order_item_invoice_check"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Existing invoice generation for paid sales orders
  PERFORM public.generate_invoice_from_paid_sales_order(NEW.sales_order_id);

  -- New upselling stock out
  PERFORM public.stock_out_upselling_sales_order_item(NEW.id);

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_sales_order_item_invoice_check"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_upselling_sales_order_delivery_note"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.fulfillment_status::text = 'upselling' THEN
    PERFORM public.assign_upselling_sales_order_to_delivery_note(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_upselling_sales_order_delivery_note"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_movements_apply_to_balances"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Locations must belong to the same company as the movement
  IF NEW.to_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.locations l
      WHERE l.id = NEW.to_location_id
        AND l.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'to_location_id is not valid for this company';
    END IF;
  END IF;

  IF NEW.from_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.locations l
      WHERE l.id = NEW.from_location_id
        AND l.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'from_location_id is not valid for this company';
    END IF;
  END IF;

  IF NEW.event_type = 'transfer' THEN
    UPDATE public.product_location_stocks pls
    SET
      quantity = pls.quantity - NEW.quantity,
      updated_at = now()
    WHERE pls.company_id = NEW.company_id
      AND pls.product_id = NEW.product_id
      AND pls.location_id = NEW.from_location_id
      AND pls.quantity >= NEW.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock at source location (or no stock row for this product).';
    END IF;

    DELETE FROM public.product_location_stocks pls
    WHERE pls.company_id = NEW.company_id
      AND pls.product_id = NEW.product_id
      AND pls.location_id = NEW.from_location_id
      AND pls.quantity = 0;

    INSERT INTO public.product_location_stocks (company_id, product_id, location_id, quantity)
    VALUES (NEW.company_id, NEW.product_id, NEW.to_location_id, NEW.quantity)
    ON CONFLICT (product_id, location_id) DO UPDATE
    SET
      quantity = public.product_location_stocks.quantity + EXCLUDED.quantity,
      updated_at = now();

    RETURN NEW;
  END IF;

  IF NEW.event_type = 'refill' THEN
    INSERT INTO public.product_location_stocks (company_id, product_id, location_id, quantity)
    VALUES (NEW.company_id, NEW.product_id, NEW.to_location_id, NEW.quantity)
    ON CONFLICT (product_id, location_id) DO UPDATE
    SET
      quantity = public.product_location_stocks.quantity + EXCLUDED.quantity,
      updated_at = now();

    RETURN NEW;
  END IF;

  IF NEW.event_type = 'adjustment_out' THEN
    UPDATE public.product_location_stocks pls
    SET
      quantity = pls.quantity - NEW.quantity,
      updated_at = now()
    WHERE pls.company_id = NEW.company_id
      AND pls.product_id = NEW.product_id
      AND pls.location_id = NEW.from_location_id
      AND pls.quantity >= NEW.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for adjustment (or no stock row).';
    END IF;

    DELETE FROM public.product_location_stocks pls
    WHERE pls.company_id = NEW.company_id
      AND pls.product_id = NEW.product_id
      AND pls.location_id = NEW.from_location_id
      AND pls.quantity = 0;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Unknown event_type: %', NEW.event_type;
END;
$$;


ALTER FUNCTION "public"."inventory_movements_apply_to_balances"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inventory_movements_set_company"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT p.company_id
  INTO NEW.company_id
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'product_id % not found', NEW.product_id;
  END IF;

  IF NEW.quantity IS NULL OR NEW.quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."inventory_movements_set_company"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(sum(cn.total), 0)::numeric
  FROM public.credit_notes cn
  WHERE cn.related_invoice_id = p_invoice_id
    AND cn.status = 'posted'::public.credit_note_status;
$$;


ALTER FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_creditable_invoices"("p_company_id" "uuid", "p_customer_id" "uuid") RETURNS json
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.issue_date DESC, t.number DESC),
    '[]'::json
  )
  FROM (
    SELECT
      i.id,
      i.number,
      i.issue_date,
      i.currency,
      i.status,
      i.total AS original_amount,
      CASE
        WHEN i.status = 'paid'::invoice_status THEN 0::numeric
        ELSE GREATEST(
          0,
          COALESCE(
            NULLIF(i.amount_due, 0),
            GREATEST(0, i.total - COALESCE(i.amount_paid, 0))
          )
        )
      END AS outstanding_balance,
      public.invoice_posted_credit_total(i.id) AS already_credited,
      GREATEST(
        0,
        COALESCE(i.total, 0) - public.invoice_posted_credit_total(i.id)
      ) AS creditable_balance
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.customer_id = p_customer_id
      AND i.status <> 'cancelled'::invoice_status
      AND COALESCE(i.total, 0) > 0.005
      AND GREATEST(
        0,
        COALESCE(i.total, 0) - public.invoice_posted_credit_total(i.id)
      ) > 0.005
  ) t;
$$;


ALTER FUNCTION "public"."list_creditable_invoices"("p_company_id" "uuid", "p_customer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") RETURNS SETOF "public"."customers"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT c.*
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND c.is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  ORDER BY c.full_name ASC NULLS LAST, c.company_name ASC NULLS LAST, c.email ASC;
$$;


ALTER FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer DEFAULT 25, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "customer_id" "uuid", "city_id" "uuid", "number" "text", "issue_date" "date", "delivery_date" "date", "notes" "text", "status" "text", "subtotal" numeric, "total" numeric, "currency" "text", "fulfillment_status" "text", "payment_status" "text", "bill_to_snapshot" "jsonb", "customer_name" "text", "customer_phone" "text", "customer_city" "text", "customer_address" "text", "customer_map_location" "text", "item_summary" "text", "line_items" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM (
    SELECT
      so.id,
      so.customer_id,
      so.city_id,
      so.number,
      so.issue_date,
      so.delivery_date,
      so.notes,
      so.status::text,
      so.subtotal,
      so.total,
      so.currency,
      so.fulfillment_status::text,
      so.payment_status::text,
      so.bill_to_snapshot,
      COALESCE(
        NULLIF(TRIM(c.full_name),    ''),
        NULLIF(TRIM(c.company_name), ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'full_name'),    ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'company_name'), ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'name'),         '')
      ) AS customer_name,
      COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(so.bill_to_snapshot->>'phone', '')) AS customer_phone,
      COALESCE(
        NULLIF(so.bill_to_snapshot->>'city', ''),
        (
          SELECT NULLIF(TRIM(ci.name), '')
          FROM public.cities ci
          WHERE ci.id = so.city_id
          LIMIT 1
        ),
        NULLIF(TRIM(c.city), '')
      ) AS customer_city,
      COALESCE(
        NULLIF(so.bill_to_snapshot->>'address_line_1', ''),
        NULLIF(so.bill_to_snapshot->>'street', ''),
        NULLIF(TRIM(c.address_line_1), ''),
        NULLIF(TRIM(c.street), '')
      ) AS customer_address,
      NULLIF(TRIM(c.map_location), '') AS customer_map_location,

      (
        SELECT string_agg(
          TRIM(COALESCE(soi.item, '')) || ' x' ||
            CASE
              WHEN soi.quantity = FLOOR(soi.quantity)
              THEN FLOOR(soi.quantity)::bigint::text
              ELSE TRIM(TO_CHAR(soi.quantity, 'FM999999990.##'))
            END,
          ', '
          ORDER BY soi.sort_order ASC, soi.id ASC
        )
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = so.id
          AND TRIM(COALESCE(soi.item, '')) <> ''
      ) AS item_summary,

      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'item',          TRIM(COALESCE(soi.item, '')),
              'quantity',      soi.quantity,
              'unit_price',    soi.unit_price,
              'line_total',    soi.line_total,
              'description',   NULLIF(TRIM(COALESCE(soi.description, '')), ''),
              'product_id',    soi.product_id
            )
            ORDER BY soi.sort_order ASC, soi.id ASC
          ) FILTER (WHERE TRIM(COALESCE(soi.item, '')) <> ''),
          '[]'::jsonb
        )
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = so.id
      ) AS line_items

    FROM public.sales_orders so
    LEFT JOIN public.customers c ON c.id = so.customer_id
    WHERE so.company_id = p_company_id
      AND so.fulfillment_status::text <> 'upselling'
      AND (
        EXISTS (
          SELECT 1
          FROM public.delivery_sales_orders dso
          JOIN public.deliveries d ON d.id = dso.delivery_id
          WHERE dso.sales_order_id = so.id
            AND d.company_id = p_company_id
            AND d.driver_user_id = auth.uid()
            AND COALESCE(dso.is_active, true) = true
        )
        OR EXISTS (
          SELECT 1
          FROM public.deliveries d
          WHERE d.id = so.active_driver_delivery_id
            AND d.company_id = p_company_id
            AND d.driver_user_id = auth.uid()
        )
      )
      AND EXISTS (
        SELECT 1
        FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = p_company_id
          AND cu.is_active = true
      )
    ORDER BY so.issue_date DESC NULLS LAST, so.created_at DESC
  ) AS rowset
  LIMIT p_limit
  OFFSET COALESCE(p_offset, 0);
$$;


ALTER FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    SUM(pls.quantity)::numeric AS total_quantity,
    jsonb_agg(
      jsonb_build_object(
        'location_id',   ld.location_id,
        'location_name', l.name,
        'quantity',      pls.quantity
      )
      ORDER BY l.name
    ) AS stock_locations
  FROM public.location_drivers ld
  INNER JOIN public.product_location_stocks pls
    ON pls.location_id = ld.location_id
   AND pls.quantity > 0
  INNER JOIN public.products p
    ON p.id = pls.product_id
   AND p.company_id = p_company_id
  INNER JOIN public.locations l
    ON l.id = ld.location_id
  WHERE ld.company_id = p_company_id
    AND ld.driver_user_id = auth.uid()
    AND ld.is_active = true
    AND (ld.assigned_until IS NULL OR ld.assigned_until >= CURRENT_DATE)
    AND COALESCE(p.is_active, true) = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  GROUP BY
    p.id, p.company_id, p.name, p.sku, p.unit, p.sale_price, p.currency,
    p.description, p.is_active, p.created_at, p.updated_at
  HAVING SUM(pls.quantity) > 0
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") RETURNS TABLE("location_id" "uuid", "is_primary" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT ld.location_id, ld.is_primary
  FROM public.location_drivers ld
  INNER JOIN public.locations l ON l.id = ld.location_id
  WHERE ld.company_id = p_company_id
    AND ld.driver_user_id = auth.uid()
    AND ld.is_active = true
    AND l.is_active = true
    AND COALESCE(l.is_stock_location, true) = true
    AND (ld.assigned_until IS NULL OR ld.assigned_until >= CURRENT_DATE)
    AND public._mobile_user_in_company(p_company_id)
  ORDER BY ld.is_primary DESC NULLS LAST, ld.created_at ASC;
$$;


ALTER FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    SUM(pls.quantity)::numeric AS total_quantity,
    jsonb_agg(
      jsonb_build_object(
        'location_id', pls.location_id,
        'location_name', l.name,
        'quantity', pls.quantity
      )
      ORDER BY l.name
    ) AS stock_locations
  FROM public.products p
  INNER JOIN public.product_location_stocks pls
    ON pls.product_id = p.id
   AND pls.quantity > 0
  INNER JOIN public.locations l ON l.id = pls.location_id
  WHERE p.company_id = p_company_id
    AND COALESCE(p.is_active, true) = true
    AND public._mobile_user_in_company(p_company_id)
    AND pls.location_id IN (
      SELECT ld.location_id
      FROM public.location_drivers ld
      INNER JOIN public.locations loc ON loc.id = ld.location_id
      WHERE ld.company_id = p_company_id
        AND ld.driver_user_id = auth.uid()
        AND ld.is_active = true
        AND loc.is_active = true
        AND COALESCE(loc.is_stock_location, true) = true
        AND (ld.assigned_until IS NULL OR ld.assigned_until >= CURRENT_DATE)
    )
  GROUP BY p.id
  HAVING SUM(pls.quantity) > 0
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") RETURNS TABLE("location_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT l.id
  FROM public.locations l
  WHERE l.company_id = p_company_id
    AND l.is_active = true
    AND COALESCE(l.is_stock_location, true) = true
    AND lower(trim(l.location_type::text)) = 'warehouse'
    AND l.is_primary_warehouse = true
    AND public._mobile_user_in_company(p_company_id)
  ORDER BY l.name ASC, l.created_at ASC;
$$;


ALTER FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    SUM(pls.quantity)::numeric AS total_quantity,
    jsonb_agg(
      jsonb_build_object(
        'location_id',   l.id,
        'location_name', l.name,
        'quantity',      pls.quantity
      )
      ORDER BY l.name
    ) AS stock_locations
  FROM public.locations l
  INNER JOIN public.product_location_stocks pls
    ON pls.location_id = l.id
   AND pls.quantity > 0
  INNER JOIN public.products p
    ON p.id = pls.product_id
   AND p.company_id = p_company_id
  WHERE l.company_id = p_company_id
    AND l.is_active = true
    AND COALESCE(l.is_stock_location, true) = true
    AND lower(trim(l.location_type::text)) = 'warehouse'
    AND l.is_primary_warehouse = true
    AND COALESCE(p.is_active, true) = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  GROUP BY
    p.id, p.company_id, p.name, p.sku, p.unit, p.sale_price, p.currency,
    p.description, p.is_active, p.created_at, p.updated_at
  HAVING SUM(pls.quantity) > 0
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") RETURNS SETOF "public"."products"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.company_id = p_company_id
    AND p.is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    SUM(pls.quantity)::numeric AS total_quantity,
    jsonb_agg(
      jsonb_build_object(
        'location_id', pls.location_id,
        'location_name', l.name,
        'quantity', pls.quantity
      )
      ORDER BY l.name
    ) AS stock_locations
  FROM public.products p
  INNER JOIN public.product_location_stocks pls
    ON pls.product_id = p.id
   AND pls.location_id = ANY (p_location_ids)
   AND pls.quantity > 0
  INNER JOIN public.locations l ON l.id = pls.location_id
  WHERE p.company_id = p_company_id
    AND COALESCE(p.is_active, true) = true
    AND p_location_ids IS NOT NULL
    AND cardinality(p_location_ids) > 0
    AND public._mobile_user_in_company(p_company_id)
  GROUP BY p.id
  HAVING SUM(pls.quantity) > 0
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "created_from_quotation_id" "uuid",
    "number" "text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date" NOT NULL,
    "status" "public"."sales_order_status" DEFAULT 'active'::"public"."sales_order_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "from_snapshot" "jsonb" NOT NULL,
    "bill_to_snapshot" "jsonb" NOT NULL,
    "client_snapshot" "jsonb",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_total" numeric DEFAULT 0 NOT NULL,
    "discount_type" "text",
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "shipping_amount" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "fulfillment_status" "public"."sales_order_fulfillment_status" DEFAULT 'new'::"public"."sales_order_fulfillment_status" NOT NULL,
    "payment_status" "public"."sales_order_payment_status" DEFAULT 'unpaid'::"public"."sales_order_payment_status" NOT NULL,
    "city_id" "uuid",
    "delivery_date" "date",
    "active_driver_delivery_id" "uuid",
    CONSTRAINT "sales_orders_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."sales_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."sales_orders" IS 'Sales orders; same line/totals model as quotations';



COMMENT ON COLUMN "public"."sales_orders"."created_from_quotation_id" IS 'Source quotation when converted from quote; NULL for standalone orders';



COMMENT ON COLUMN "public"."sales_orders"."active_driver_delivery_id" IS 'Delivery note that handed stock to the driver for this order; set when status moves to Delivered to driver, cleared on Delivered to customer / completed / cancelled.';



CREATE OR REPLACE FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") RETURNS SETOF "public"."sales_orders"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT so.*
  FROM public.sales_orders so
  WHERE so.company_id = p_company_id
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  ORDER BY so.issue_date DESC NULLS LAST;
$$;


ALTER FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text" DEFAULT NULL::"text", "p_fulfillment_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT NULL::integer, "p_offset" integer DEFAULT NULL::integer, "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_exclude_fulfillment_status" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "customer_id" "uuid", "city_id" "uuid", "number" "text", "issue_date" "date", "delivery_date" "date", "notes" "text", "status" "text", "subtotal" numeric, "total" numeric, "currency" "text", "fulfillment_status" "text", "payment_status" "text", "bill_to_snapshot" "jsonb", "customer_name" "text", "customer_phone" "text", "customer_city" "text", "customer_address" "text", "customer_map_location" "text", "item_summary" "text", "line_items" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM (
    SELECT
      so.id,
      so.customer_id,
      so.city_id,
      so.number,
      so.issue_date,
      so.delivery_date,
      so.notes,
      so.status::text,
      so.subtotal,
      so.total,
      so.currency,
      so.fulfillment_status::text,
      so.payment_status::text,
      so.bill_to_snapshot,
      COALESCE(
        NULLIF(TRIM(c.full_name),    ''),
        NULLIF(TRIM(c.company_name), ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'full_name'),    ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'company_name'), ''),
        NULLIF(TRIM(so.bill_to_snapshot->>'name'),         '')
      ) AS customer_name,
      COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(so.bill_to_snapshot->>'phone', '')) AS customer_phone,
      COALESCE(
        NULLIF(so.bill_to_snapshot->>'city', ''),
        (
          SELECT NULLIF(TRIM(ci.name), '')
          FROM public.cities ci
          WHERE ci.id = so.city_id
          LIMIT 1
        ),
        NULLIF(TRIM(c.city), '')
      ) AS customer_city,
      COALESCE(
        NULLIF(so.bill_to_snapshot->>'address_line_1', ''),
        NULLIF(so.bill_to_snapshot->>'street', ''),
        NULLIF(TRIM(c.address_line_1), ''),
        NULLIF(TRIM(c.street), '')
      ) AS customer_address,
      NULLIF(TRIM(c.map_location), '') AS customer_map_location,

      (
        SELECT string_agg(
          TRIM(COALESCE(soi.item, '')) || ' x' ||
            CASE
              WHEN soi.quantity = FLOOR(soi.quantity)
              THEN FLOOR(soi.quantity)::bigint::text
              ELSE TRIM(TO_CHAR(soi.quantity, 'FM999999990.##'))
            END,
          ', '
          ORDER BY soi.sort_order ASC, soi.id ASC
        )
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = so.id
          AND TRIM(COALESCE(soi.item, '')) <> ''
      ) AS item_summary,

      (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'item',          TRIM(COALESCE(soi.item, '')),
              'quantity',      soi.quantity,
              'unit_price',    soi.unit_price,
              'line_total',    soi.line_total,
              'description',   NULLIF(TRIM(COALESCE(soi.description, '')), ''),
              'product_id',    soi.product_id
            )
            ORDER BY soi.sort_order ASC, soi.id ASC
          ) FILTER (WHERE TRIM(COALESCE(soi.item, '')) <> ''),
          '[]'::jsonb
        )
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = so.id
      ) AS line_items

    FROM public.sales_orders so
    LEFT JOIN public.customers c ON c.id = so.customer_id
    WHERE so.company_id = p_company_id
      AND (p_status IS NULL OR so.status::text = p_status)
      AND (p_fulfillment_status IS NULL OR so.fulfillment_status::text = p_fulfillment_status)
      AND (p_exclude_fulfillment_status IS NULL OR so.fulfillment_status::text <> p_exclude_fulfillment_status)
      AND (p_user_id IS NULL OR so.user_id = p_user_id)
      AND EXISTS (
        SELECT 1
        FROM public.company_users cu
        WHERE cu.user_id = auth.uid()
          AND cu.company_id = p_company_id
          AND cu.is_active = true
      )
    ORDER BY so.issue_date DESC NULLS LAST, so.created_at DESC
  ) AS rowset
  LIMIT p_limit
  OFFSET COALESCE(p_offset, 0);
$$;


ALTER FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text", "p_fulfillment_status" "text", "p_limit" integer, "p_offset" integer, "p_user_id" "uuid", "p_exclude_fulfillment_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") RETURNS TABLE("id" "uuid", "user_id" "uuid", "customer_id" "uuid", "number" "text", "issue_date" "date", "subtotal" numeric, "tax_total" numeric, "discount_amount" numeric, "shipping_amount" numeric, "total" numeric, "currency" "text", "fulfillment_status" "text", "payment_status" "text", "customer_name" "text", "line_items" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    so.id,
    so.user_id,
    so.customer_id,
    so.number,
    so.issue_date,
    so.subtotal,
    so.tax_total,
    so.discount_amount,
    so.shipping_amount,
    so.total,
    so.currency,
    so.fulfillment_status::text,
    so.payment_status::text,
    COALESCE(
      NULLIF(TRIM(c.full_name), ''),
      NULLIF(TRIM(c.company_name), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'full_name'), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'company_name'), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'name'), ''),
      'Unknown customer'
    ) AS customer_name,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'item',        TRIM(COALESCE(soi.item, '')),
            'quantity',    soi.quantity,
            'unit_price',  soi.unit_price,
            'line_total',  soi.line_total,
            'line_tax',    soi.line_tax,
            'product_id',  soi.product_id
          )
          ORDER BY soi.sort_order ASC, soi.id ASC
        ) FILTER (WHERE TRIM(COALESCE(soi.item, '')) <> ''),
        '[]'::jsonb
      )
      FROM public.sales_order_items soi
      WHERE soi.sales_order_id = so.id
    ) AS line_items
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND so.issue_date >= p_from_date
    AND so.issue_date <= p_to_date
    AND COALESCE(so.fulfillment_status::text, '') <> 'cancelled'
    AND so.payment_status::text = 'paid'
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  ORDER BY so.issue_date DESC, so.created_at DESC;
$$;


ALTER FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") RETURNS TABLE("id" "uuid", "customer_id" "uuid", "number" "text", "issue_date" "date", "subtotal" numeric, "tax_total" numeric, "discount_amount" numeric, "shipping_amount" numeric, "total" numeric, "currency" "text", "fulfillment_status" "text", "payment_status" "text", "customer_name" "text", "line_items" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    so.id,
    so.customer_id,
    so.number,
    so.issue_date,
    so.subtotal,
    so.tax_total,
    so.discount_amount,
    so.shipping_amount,
    so.total,
    so.currency,
    so.fulfillment_status::text,
    so.payment_status::text,
    COALESCE(
      NULLIF(TRIM(c.full_name), ''),
      NULLIF(TRIM(c.company_name), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'full_name'), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'company_name'), ''),
      NULLIF(TRIM(so.bill_to_snapshot->>'name'), ''),
      'Unknown customer'
    ) AS customer_name,
    (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'item',        TRIM(COALESCE(soi.item, '')),
            'quantity',    soi.quantity,
            'unit_price',  soi.unit_price,
            'line_total',  soi.line_total,
            'line_tax',    soi.line_tax,
            'product_id',  soi.product_id
          )
          ORDER BY soi.sort_order ASC, soi.id ASC
        ) FILTER (WHERE TRIM(COALESCE(soi.item, '')) <> ''),
        '[]'::jsonb
      )
      FROM public.sales_order_items soi
      WHERE soi.sales_order_id = so.id
    ) AS line_items
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND so.issue_date >= p_from_date
    AND so.issue_date <= p_to_date
    AND COALESCE(so.fulfillment_status::text, '') <> 'cancelled'
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  ORDER BY so.issue_date DESC, so.created_at DESC;
$$;


ALTER FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    COALESCE(SUM(pls.quantity), 0)::numeric AS total_quantity,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'location_id',   pls.location_id,
          'location_name', l.name,
          'quantity',      pls.quantity
        )
        ORDER BY l.name
      ) FILTER (WHERE pls.id IS NOT NULL),
      '[]'::jsonb
    ) AS stock_locations
  FROM public.products p
  LEFT JOIN public.product_location_stocks pls
    ON pls.product_id = p.id
   AND pls.company_id = p_company_id
  LEFT JOIN public.locations l
    ON l.id = pls.location_id
  WHERE p.company_id = p_company_id
    AND COALESCE(p.is_active, true) = true
    AND EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = p_company_id
        AND cu.is_active = true
    )
  GROUP BY
    p.id, p.company_id, p.name, p.sku, p.unit, p.sale_price, p.currency,
    p.description, p.is_active, p.created_at, p.updated_at
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.id,
    p.company_id,
    p.name,
    p.sku,
    p.unit,
    p.sale_price,
    p.currency,
    p.description,
    p.is_active,
    p.created_at,
    p.updated_at,
    SUM(pls.quantity)::numeric AS total_quantity,
    jsonb_agg(
      jsonb_build_object(
        'location_id', pls.location_id,
        'location_name', l.name,
        'quantity', pls.quantity
      )
      ORDER BY l.name
    ) AS stock_locations
  FROM public.products p
  INNER JOIN public.product_location_stocks pls
    ON pls.product_id = p.id
   AND pls.quantity > 0
  INNER JOIN public.locations l ON l.id = pls.location_id
  WHERE p.company_id = p_company_id
    AND COALESCE(p.is_active, true) = true
    AND public._mobile_user_in_company(p_company_id)
    AND pls.location_id IN (
      SELECT wh.id
      FROM public.locations wh
      WHERE wh.company_id = p_company_id
        AND wh.is_active = true
        AND COALESCE(wh.is_stock_location, true) = true
        AND lower(trim(wh.location_type::text)) = 'warehouse'
        AND wh.is_primary_warehouse = true
    )
  GROUP BY p.id
  HAVING SUM(pls.quantity) > 0
  ORDER BY p.name ASC;
$$;


ALTER FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."location_type_enum_values"() RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    array_agg(e.enumlabel::text order by e.enumsortorder),
    '{}'::text[]
  )
  from pg_catalog.pg_enum e
  join pg_catalog.pg_type t on e.enumtypid = t.oid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'location_type';
$$;


ALTER FUNCTION "public"."location_type_enum_values"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."location_type_enum_values"() IS 'Returns ordered labels for enum public.location_type (for UI selects).';



CREATE OR REPLACE FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
  v_primary_warehouse_id uuid;
  v_driver_location_id uuid;
  v_existing_transfer_count integer;
  v_item record;
  v_available_stock numeric;
  v_product_name text;
begin
  select *
  into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found.';
  end if;

  select count(*)
  into v_existing_transfer_count
  from public.inventory_movements
  where delivery_id = p_delivery_id
    and reference_type = 'delivery_to_driver';

  if v_existing_transfer_count > 0 then
    raise exception 'This delivery has already been transferred to the driver location.';
  end if;

  select id
  into v_primary_warehouse_id
  from public.locations
  where company_id = v_delivery.company_id
    and location_type = 'warehouse'
    and is_primary_warehouse = true
    and is_active = true
  limit 1;

  if v_primary_warehouse_id is null then
    raise exception 'No active primary warehouse defined for this company.';
  end if;

  select ld.location_id
  into v_driver_location_id
  from public.location_drivers ld
  join public.locations l
    on l.id = ld.location_id
  where ld.company_id = v_delivery.company_id
    and ld.driver_user_id = v_delivery.driver_user_id
    and ld.is_active = true
    and l.is_active = true
    and l.location_type = 'driver_location'
  limit 1;

  if v_driver_location_id is null then
    raise exception 'This driver has no active driver location.';
  end if;

  if not exists (
    select 1
    from public.delivery_sales_orders
    where delivery_id = p_delivery_id
  ) then
    raise exception 'Delivery has no linked sales orders.';
  end if;

  for v_item in
    select
      soi.product_id,
      sum(soi.quantity) as quantity
    from public.delivery_sales_orders dso
    join public.sales_order_items soi
      on soi.sales_order_id = dso.sales_order_id
    where dso.delivery_id = p_delivery_id
      and soi.product_id is not null
    group by soi.product_id
  loop
    select quantity
    into v_available_stock
    from public.product_location_stocks
    where company_id = v_delivery.company_id
      and product_id = v_item.product_id
      and location_id = v_primary_warehouse_id
    for update;

    if coalesce(v_available_stock, 0) < v_item.quantity then
      select coalesce(
        nullif(trim(p.name), ''),
        nullif(trim(p.sku), ''),
        v_item.product_id::text
      )
      into v_product_name
      from public.products p
      where p.id = v_item.product_id
        and p.company_id = v_delivery.company_id;

      raise exception
        'Not enough stock in primary warehouse for product %. Required %, available %.',
        coalesce(v_product_name, v_item.product_id::text),
        v_item.quantity,
        coalesce(v_available_stock, 0);
    end if;
  end loop;

  insert into public.inventory_movements (
    company_id,
    user_id,
    product_id,
    event_type,
    from_location_id,
    to_location_id,
    quantity,
    delivery_id,
    reference_type,
    note
  )
  select
    v_delivery.company_id,
    p_user_id,
    soi.product_id,
    'transfer',
    v_primary_warehouse_id,
    v_driver_location_id,
    sum(soi.quantity),
    p_delivery_id,
    'delivery_to_driver',
    'Stock transferred from primary warehouse to driver location'
  from public.delivery_sales_orders dso
  join public.sales_order_items soi
    on soi.sales_order_id = dso.sales_order_id
  where dso.delivery_id = p_delivery_id
    and soi.product_id is not null
  group by soi.product_id
  on conflict do nothing;

  for v_item in
    select
      soi.product_id,
      sum(soi.quantity) as quantity
    from public.delivery_sales_orders dso
    join public.sales_order_items soi
      on soi.sales_order_id = dso.sales_order_id
    where dso.delivery_id = p_delivery_id
      and soi.product_id is not null
    group by soi.product_id
  loop
    update public.product_location_stocks
    set
      quantity = quantity - v_item.quantity,
      updated_at = now()
    where company_id = v_delivery.company_id
      and product_id = v_item.product_id
      and location_id = v_primary_warehouse_id;

    insert into public.product_location_stocks (
      company_id,
      product_id,
      location_id,
      quantity
    )
    values (
      v_delivery.company_id,
      v_item.product_id,
      v_driver_location_id,
      v_item.quantity
    )
    on conflict (company_id, product_id, location_id)
    do update set
      quantity = public.product_location_stocks.quantity + excluded.quantity,
      updated_at = now();
  end loop;

  update public.deliveries
  set
    from_location_id = v_primary_warehouse_id,
    location_id = v_driver_location_id,
    status = 'delivered_to_driver',
    delivered_to_driver_at = now(),
    updated_at = now()
  where id = p_delivery_id;
end;
$$;


ALTER FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
  v_primary_warehouse_id uuid;
  v_driver_location_id uuid;
  v_existing_transfer_count integer;
  v_item record;
  v_available_stock numeric;
  v_product_name text;
begin
  select *
  into v_delivery
  from public.deliveries
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'Delivery not found.';
  end if;

  select id
  into v_primary_warehouse_id
  from public.locations
  where company_id = v_delivery.company_id
    and location_type = 'warehouse'
    and is_primary_warehouse = true
    and is_active = true
  limit 1;

  if v_primary_warehouse_id is null then
    raise exception 'No active primary warehouse defined for this company.';
  end if;

  select ld.location_id
  into v_driver_location_id
  from public.location_drivers ld
  join public.locations l on l.id = ld.location_id
  where ld.company_id = v_delivery.company_id
    and ld.driver_user_id = v_delivery.driver_user_id
    and ld.is_active = true
    and l.is_active = true
    and l.location_type = 'driver_location'
  limit 1;

  if v_driver_location_id is null then
    raise exception 'This driver has no active driver location.';
  end if;

  if not exists (
    select 1
    from public.delivery_sales_orders
    where delivery_id = p_delivery_id
  ) then
    raise exception 'Delivery has no linked sales orders.';
  end if;

  if p_transfer_stock then
    select count(*)
    into v_existing_transfer_count
    from public.inventory_movements
    where delivery_id = p_delivery_id
      and reference_type = 'delivery_to_driver';

    if v_existing_transfer_count > 0 then
      raise exception 'This delivery has already been transferred to the driver location.';
    end if;

    for v_item in
      select soi.product_id, sum(soi.quantity) as quantity
      from public.delivery_sales_orders dso
      join public.sales_order_items soi on soi.sales_order_id = dso.sales_order_id
      where dso.delivery_id = p_delivery_id
        and soi.product_id is not null
      group by soi.product_id
    loop
      select quantity
      into v_available_stock
      from public.product_location_stocks
      where company_id = v_delivery.company_id
        and product_id = v_item.product_id
        and location_id = v_primary_warehouse_id
      for update;

      if coalesce(v_available_stock, 0) < v_item.quantity then
        select coalesce(nullif(trim(p.name), ''), nullif(trim(p.sku), ''), v_item.product_id::text)
        into v_product_name
        from public.products p
        where p.id = v_item.product_id
          and p.company_id = v_delivery.company_id;

        raise exception
          'Not enough stock in primary warehouse for product %. Required %, available %.',
          coalesce(v_product_name, v_item.product_id::text),
          v_item.quantity,
          coalesce(v_available_stock, 0);
      end if;
    end loop;

    insert into public.inventory_movements (
      company_id,
      user_id,
      product_id,
      event_type,
      from_location_id,
      to_location_id,
      quantity,
      delivery_id,
      reference_type,
      note
    )
    select
      v_delivery.company_id,
      p_user_id,
      soi.product_id,
      'transfer',
      v_primary_warehouse_id,
      v_driver_location_id,
      sum(soi.quantity),
      p_delivery_id,
      'delivery_to_driver',
      'Stock transferred from primary warehouse to driver location'
    from public.delivery_sales_orders dso
    join public.sales_order_items soi on soi.sales_order_id = dso.sales_order_id
    where dso.delivery_id = p_delivery_id
      and soi.product_id is not null
    group by soi.product_id;
  end if;

  update public.deliveries
  set
    from_location_id = v_primary_warehouse_id,
    location_id = v_driver_location_id,
    status = 'delivered_to_driver',
    delivered_to_driver_at = now(),
    updated_at = now()
  where id = p_delivery_id;
end;
$$;


ALTER FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_city_text"("input" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select trim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(unaccent(coalesce(input, ''))),
          '[^a-z0-9 ]',
          ' ',
          'g'
        ),
        '\bst\b',
        'saint',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;


ALTER FUNCTION "public"."normalize_city_text"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_credit_note"("p_credit_note_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_cn public.credit_notes%ROWTYPE;
  v_inv public.invoices%ROWTYPE;
  v_outstanding numeric(14, 2);
  v_already numeric(14, 2);
  v_new_due numeric(14, 2);
BEGIN
  SELECT * INTO v_cn
  FROM public.credit_notes
  WHERE id = p_credit_note_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found';
  END IF;

  IF v_cn.status <> 'draft'::public.credit_note_status THEN
    RAISE EXCEPTION 'Only draft credit notes can be posted';
  END IF;

  IF v_cn.related_invoice_id IS NULL THEN
    RAISE EXCEPTION 'Credit note must be linked to an invoice';
  END IF;

  SELECT * INTO v_inv
  FROM public.invoices
  WHERE id = v_cn.related_invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Related invoice not found';
  END IF;

  IF v_inv.status = 'cancelled'::invoice_status THEN
    RAISE EXCEPTION 'Cannot post credit against a cancelled invoice';
  END IF;

  v_already := public.invoice_posted_credit_total(v_cn.related_invoice_id);

  IF v_cn.total > GREATEST(0, v_inv.total - v_already) + 0.005 THEN
    RAISE EXCEPTION 'Credit total (%) exceeds remaining creditable amount on invoice (%)',
      v_cn.total, GREATEST(0, v_inv.total - v_already);
  END IF;

  v_outstanding := CASE
    WHEN v_inv.status = 'paid'::invoice_status THEN 0::numeric
    ELSE GREATEST(
      0,
      COALESCE(
        NULLIF(v_inv.amount_due, 0),
        GREATEST(0, v_inv.total - COALESCE(v_inv.amount_paid, 0))
      )
    )
  END;

  v_new_due := GREATEST(0, v_outstanding - v_cn.total);

  UPDATE public.invoices
  SET
    amount_due = v_new_due,
    status = CASE
      WHEN v_new_due <= 0.005 THEN 'paid'::invoice_status
      ELSE v_inv.status
    END,
    updated_at = now()
  WHERE id = v_inv.id;

  UPDATE public.credit_notes
  SET status = 'posted'::public.credit_note_status, updated_at = now()
  WHERE id = p_credit_note_id;
END;
$$;


ALTER FUNCTION "public"."post_credit_note"("p_credit_note_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_location_stocks_set_company_and_validate"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  p_company uuid;
  l_company uuid;
BEGIN
  SELECT company_id INTO p_company FROM public.products WHERE id = NEW.product_id;
  IF p_company IS NULL THEN
    RAISE EXCEPTION 'product_id % not found', NEW.product_id;
  END IF;

  SELECT company_id INTO l_company FROM public.locations WHERE id = NEW.location_id;
  IF l_company IS NULL THEN
    RAISE EXCEPTION 'location_id % not found', NEW.location_id;
  END IF;

  IF p_company IS DISTINCT FROM l_company THEN
    RAISE EXCEPTION 'Product and location must belong to the same company';
  END IF;

  NEW.company_id := p_company;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."product_location_stocks_set_company_and_validate"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."product_location_stocks_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."product_location_stocks_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_invoices_recompute_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total numeric := COALESCE(NEW.total, 0);
  v_paid numeric := COALESCE(NEW.amount_paid, 0);
  v_due_amt numeric := COALESCE(NEW.amount_due, 0);
BEGIN
  IF NEW.status = 'cancelled'::public.purchase_invoice_status THEN
    RETURN NEW;
  END IF;

  -- Keep amount_due consistent if caller zeroes paid but forgets due
  IF v_due_amt < 0 THEN
    v_due_amt := 0;
    NEW.amount_due := 0;
  END IF;

  IF v_total <= 0 THEN
    IF v_paid <= 0 THEN
      NEW.status := 'unpaid'::public.purchase_invoice_status;
    ELSE
      NEW.status := 'paid'::public.purchase_invoice_status;
    END IF;
    RETURN NEW;
  END IF;

  IF v_due_amt <= 0 AND v_paid >= v_total THEN
    NEW.status := 'paid'::public.purchase_invoice_status;
    NEW.amount_due := 0;
    RETURN NEW;
  END IF;

  IF v_due_amt <= 0 THEN
    NEW.status := 'paid'::public.purchase_invoice_status;
    RETURN NEW;
  END IF;

  IF NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue'::public.purchase_invoice_status;
    RETURN NEW;
  END IF;

  IF v_paid > 0 AND v_due_amt > 0 THEN
    NEW.status := 'partially_paid'::public.purchase_invoice_status;
    RETURN NEW;
  END IF;

  NEW.status := 'unpaid'::public.purchase_invoice_status;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."purchase_invoices_recompute_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_invoices_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."purchase_invoices_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purchase_orders_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."purchase_orders_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.purchase_invoices
  SET status = 'overdue'::public.purchase_invoice_status
  WHERE status IN (
    'unpaid'::public.purchase_invoice_status,
    'partially_paid'::public.purchase_invoice_status
  )
    AND amount_due > 0
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;


ALTER FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() IS 'Call from pg_cron or Edge: mark unpaid/partially_paid rows as overdue when past due_date.';



CREATE OR REPLACE FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_remove_from_current_delivery" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_sales_order public.sales_orders%rowtype;
begin
  if p_new_delivery_date is null then
    raise exception 'New delivery date is required.';
  end if;

  -- Lock sales order
  select *
  into v_sales_order
  from public.sales_orders
  where id = p_sales_order_id
  for update;

  if not found then
    raise exception 'Sales order not found.';
  end if;

  -- Do not allow reschedule after customer delivery
  if v_sales_order.fulfillment_status::text in ('delivered to customer', 'completed') then
    raise exception 'This sales order is already delivered/completed and cannot be rescheduled.';
  end if;

  -- Optional: do not allow reschedule after paid
  if v_sales_order.payment_status::text = 'paid' then
    raise exception 'This sales order is already paid and cannot be rescheduled.';
  end if;

  -- Remove from current delivery note so it can be assigned to a future delivery note
  if p_remove_from_current_delivery = true then
    delete from public.delivery_sales_orders
    where sales_order_id = p_sales_order_id;
  end if;

  -- Update sales order
  update public.sales_orders
  set
    delivery_date = p_new_delivery_date,
    fulfillment_status = 'rescheduled',
    notes = case
      when p_reason is null or trim(p_reason) = '' then notes
      else concat(
        coalesce(notes, ''),
        case when coalesce(notes, '') = '' then '' else E'\n' end,
        'Rescheduled to ',
        p_new_delivery_date::text,
        ' by mobile user. Reason: ',
        p_reason
      )
    end,
    updated_at = now()
  where id = p_sales_order_id;
end;
$$;


ALTER FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text", "p_remove_from_current_delivery" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_company_id uuid;
  v_driver_location_id uuid;
  v_primary_warehouse_id uuid;
  v_available_stock numeric;
  v_product_name text;
  v_driver_name text;
  v_warehouse_name text;
begin
  if p_quantity <= 0 then
    raise exception 'Return quantity must be greater than zero.';
  end if;

  -- Find driver's active location
  select
    ld.company_id,
    ld.location_id
  into
    v_company_id,
    v_driver_location_id
  from public.location_drivers ld
  join public.locations l
    on l.id = ld.location_id
  where ld.driver_user_id = p_driver_user_id
    and ld.is_active = true
    and l.is_active = true
    and l.location_type = 'driver_location'
  limit 1;

  if v_driver_location_id is null then
    raise exception 'Driver has no active driver location.';
  end if;

  -- Find company primary warehouse
  select id, name
  into v_primary_warehouse_id, v_warehouse_name
  from public.locations
  where company_id = v_company_id
    and location_type = 'warehouse'
    and is_primary_warehouse = true
    and is_active = true
  limit 1;

  if v_primary_warehouse_id is null then
    raise exception 'No active primary warehouse found for this company.';
  end if;

  -- Lock and check driver stock
  select quantity
  into v_available_stock
  from public.product_location_stocks
  where company_id = v_company_id
    and product_id = p_product_id
    and location_id = v_driver_location_id
  for update;

  if coalesce(v_available_stock, 0) < p_quantity then
    raise exception
      'Not enough stock in driver location. Required %, available %.',
      p_quantity,
      coalesce(v_available_stock, 0);
  end if;

  select name
  into v_product_name
  from public.products
  where id = p_product_id;

  select coalesce(up.full_name, au.email, p_driver_user_id::text)
  into v_driver_name
  from auth.users au
  left join public.user_profiles up
    on up.id = au.id
  where au.id = p_driver_user_id;

  -- Create movement
  insert into public.inventory_movements (
    company_id,
    user_id,
    product_id,
    event_type,
    from_location_id,
    to_location_id,
    quantity,
    reference_type,
    note
  )
  values (
    v_company_id,
    p_user_id,
    p_product_id,
    'transfer',
    v_driver_location_id,
    v_primary_warehouse_id,
    p_quantity,
    'driver_stock_return',
    concat(
      p_quantity,
      ' x ',
      coalesce(v_product_name, p_product_id::text),
      ' returned from driver ',
      coalesce(v_driver_name, p_driver_user_id::text),
      ' to ',
      coalesce(v_warehouse_name, 'primary warehouse')
    )
  );

  -- Decrease driver stock
  update public.product_location_stocks
  set
    quantity = quantity - p_quantity,
    updated_at = now()
  where company_id = v_company_id
    and product_id = p_product_id
    and location_id = v_driver_location_id;

  -- Increase warehouse stock
  insert into public.product_location_stocks (
    company_id,
    product_id,
    location_id,
    quantity
  )
  values (
    v_company_id,
    p_product_id,
    v_primary_warehouse_id,
    p_quantity
  )
  on conflict (company_id, product_id, location_id)
  do update set
    quantity = public.product_location_stocks.quantity + excluded.quantity,
    updated_at = now();
end;
$$;


ALTER FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sales_order_fulfillment_status_enum_values"() RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    array_agg(e.enumlabel::text order by e.enumsortorder),
    '{}'::text[]
  )
  from pg_catalog.pg_enum e
  join pg_catalog.pg_type t on e.enumtypid = t.oid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'sales_order_fulfillment_status';
$$;


ALTER FUNCTION "public"."sales_order_fulfillment_status_enum_values"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sales_order_fulfillment_status_enum_values"() IS 'Returns ordered labels for enum public.sales_order_fulfillment_status (for UI filters).';



CREATE OR REPLACE FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") RETURNS "uuid"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT coalesce(array_agg(so.id), '{}'::uuid[])
  FROM public.sales_orders so
  LEFT JOIN public.customers c ON c.id = so.customer_id
  WHERE so.company_id = p_company_id
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'address_line_1'), ''), '') = ''
    AND coalesce(nullif(trim(so.bill_to_snapshot->>'street'), ''), '') = ''
    AND (
      so.customer_id IS NULL
      OR (
        coalesce(nullif(trim(c.address_line_1), ''), '') = ''
        AND coalesce(nullif(trim(c.street), ''), '') = ''
      )
    );
$$;


ALTER FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") IS 'IDs of orders with missing address for PostgREST .in() list filtering.';



CREATE OR REPLACE FUNCTION "public"."sales_order_payment_status_enum_values"() RETURNS "text"[]
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select coalesce(
    array_agg(e.enumlabel::text order by e.enumsortorder),
    '{}'::text[]
  )
  from pg_catalog.pg_enum e
  join pg_catalog.pg_type t on e.enumtypid = t.oid
  join pg_catalog.pg_namespace n on n.oid = t.typnamespace
  where n.nspname = 'public'
    and t.typname = 'sales_order_payment_status';
$$;


ALTER FUNCTION "public"."sales_order_payment_status_enum_values"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."sales_order_payment_status_enum_values"() IS 'Returns ordered labels for enum public.sales_order_payment_status (for UI filters).';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end$$;


ALTER FUNCTION "public"."set_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_soi public.sales_order_items%ROWTYPE;
  v_so public.sales_orders%ROWTYPE;
  v_location_id uuid;
  v_available_qty numeric;
BEGIN
  SELECT *
  INTO v_soi
  FROM public.sales_order_items
  WHERE id = p_sales_order_item_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_soi.product_id IS NULL THEN
    RETURN;
  END IF;

  SELECT *
  INTO v_so
  FROM public.sales_orders
  WHERE id = v_soi.sales_order_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_so.fulfillment_status::text <> 'upselling' THEN
    RETURN;
  END IF;

  IF v_so.payment_status::text <> 'paid' THEN
    RETURN;
  END IF;

  -- Prevent duplicate stock-out for the same sales order item
  IF EXISTS (
    SELECT 1
    FROM public.inventory_movements im
    WHERE im.company_id = v_so.company_id
      AND im.sales_order_id = v_so.id
      AND im.product_id = v_soi.product_id
      AND im.reference_type = 'upselling_stock_out'
      AND im.reference_number = v_soi.id::text
  ) THEN
    RETURN;
  END IF;

  -- Resolve driver stock location
  IF v_so.active_driver_delivery_id IS NOT NULL THEN
    SELECT COALESCE(d.location_id, d.from_location_id)
    INTO v_location_id
    FROM public.deliveries d
    WHERE d.id = v_so.active_driver_delivery_id
      AND d.company_id = v_so.company_id;
  END IF;

  IF v_location_id IS NULL THEN
    SELECT ld.location_id
    INTO v_location_id
    FROM public.location_drivers ld
    JOIN public.locations l
      ON l.id = ld.location_id
    WHERE ld.company_id = v_so.company_id
      AND ld.driver_user_id = v_so.user_id
      AND ld.is_active = true
      AND l.is_active = true
      AND l.location_type::text = 'driver_location'
    ORDER BY ld.is_primary DESC, ld.created_at DESC
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    SELECT l.id
    INTO v_location_id
    FROM public.locations l
    WHERE l.company_id = v_so.company_id
      AND l.user_id = v_so.user_id
      AND l.is_active = true
      AND l.location_type::text = 'driver_location'
    ORDER BY l.is_default DESC, l.created_at DESC
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION
      'No driver stock location found for upselling sales order %. user_id=% company_id=%',
      v_so.id,
      v_so.user_id,
      v_so.company_id;
  END IF;

  -- Check stock only. Do NOT deduct here.
  SELECT pls.quantity
  INTO v_available_qty
  FROM public.product_location_stocks pls
  WHERE pls.company_id = v_so.company_id
    AND pls.product_id = v_soi.product_id
    AND pls.location_id = v_location_id
  FOR UPDATE;

  IF v_available_qty IS NULL THEN
    RAISE EXCEPTION
      'No stock row found for upselling. product_id=% location_id=%',
      v_soi.product_id,
      v_location_id;
  END IF;

  IF v_available_qty < v_soi.quantity THEN
    RAISE EXCEPTION
      'Insufficient stock for upselling. product_id=% location_id=% available_quantity=% required_quantity=%',
      v_soi.product_id,
      v_location_id,
      v_available_qty,
      v_soi.quantity;
  END IF;

  -- Insert movement only.
  -- inventory_movements_apply_to_balances() will deduct the stock.
  INSERT INTO public.inventory_movements (
    company_id,
    user_id,
    product_id,
    event_type,
    from_location_id,
    to_location_id,
    quantity,
    note,
    delivery_id,
    sales_order_id,
    reference_type,
    reference_number
  )
  VALUES (
    v_so.company_id,
    v_so.user_id,
    v_soi.product_id,
    'adjustment_out',
    v_location_id,
    null,
    v_soi.quantity,
    'Upselling stock out to customer',
    v_so.active_driver_delivery_id,
    v_so.id,
    'upselling_stock_out',
    v_soi.id::text
  );
END;
$$;


ALTER FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suppliers_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."suppliers_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_delivery_date date;
BEGIN
  SELECT delivery_date
  INTO v_delivery_date
  FROM public.deliveries
  WHERE id = NEW.delivery_id;

  UPDATE public.sales_orders
  SET
    delivery_date = v_delivery_date,
    updated_at = now()
  WHERE id = NEW.sales_order_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.sales_orders so
  SET
    delivery_date = NEW.delivery_date,
    updated_at = now()
  FROM public.delivery_sales_orders dso
  WHERE dso.sales_order_id = so.id
    AND dso.delivery_id = NEW.id
    AND dso.is_active = true;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_deliveries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.deliveries
  SET updated_at = now()
  WHERE id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."touch_deliveries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_map_location IS NULL OR TRIM(p_map_location) = '' THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.is_active = true
  ) THEN
    RAISE EXCEPTION 'not a company member';
  END IF;

  UPDATE public.customers c
  SET
    map_location = TRIM(p_map_location),
    updated_at = now()
  WHERE c.id = p_customer_id
    AND c.company_id = p_company_id;

  RETURN FOUND;
END;
$$;


ALTER FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric DEFAULT 0, "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_delivery_date" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id          uuid := auth.uid();
  v_subtotal         numeric := 0;
  v_discount         numeric := GREATEST(COALESCE(p_discount_amount, 0), 0);
  v_total            numeric;
  v_customer_snap    jsonb;
  v_item             jsonb;
  v_sort             int := 0;
  v_qty              numeric;
  v_price            numeric;
  v_line_total       numeric;
  v_updated          int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_users
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %', p_company_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sales_orders so
    WHERE so.id = p_sales_order_id
      AND so.company_id = p_company_id
      AND so.user_id = v_user_id
      AND so.fulfillment_status IN (
        'new'::public.sales_order_fulfillment_status,
        'upselling'::public.sales_order_fulfillment_status
      )
  ) THEN
    RAISE EXCEPTION 'Order not found or not editable (fulfillment must be new or upselling)';
  END IF;

  v_customer_snap := (
    SELECT jsonb_build_object(
      'id',             c.id,
      'name',           COALESCE(NULLIF(TRIM(c.full_name), ''),
                                  NULLIF(TRIM(c.contact_name), ''),
                                  NULLIF(TRIM(c.company_name), ''), ''),
      'phone',          COALESCE(NULLIF(TRIM(c.phone), ''), NULLIF(TRIM(p_phone), ''), ''),
      'address_line_1', COALESCE(NULLIF(TRIM(c.address_line_1), ''),
                                  NULLIF(TRIM(c.street), ''),
                                  NULLIF(TRIM(p_address), ''), ''),
      'email',          COALESCE(NULLIF(TRIM(c.email), ''), '')
    )
    FROM public.customers c
    WHERE c.id = p_customer_id
  );

  IF v_customer_snap IS NULL THEN
    v_customer_snap := jsonb_build_object(
      'id', p_customer_id,
      'address_line_1', COALESCE(p_address, ''),
      'phone', COALESCE(p_phone, '')
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty   := COALESCE((v_item->>'quantity')::numeric, 0);
    v_price := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_subtotal := v_subtotal + (v_qty * v_price);
  END LOOP;

  v_discount := LEAST(v_discount, v_subtotal);
  v_total := v_subtotal - v_discount;

  UPDATE public.sales_orders so
  SET
    customer_id       = p_customer_id,
    city_id           = p_city_id,
    currency          = p_currency,
    bill_to_snapshot  = v_customer_snap,
    delivery_date     = COALESCE(p_delivery_date, so.delivery_date),
    subtotal          = v_subtotal,
    tax_total         = 0,
    discount_amount   = v_discount,
    discount_type     = CASE WHEN v_discount > 0 THEN 'value' ELSE NULL END,
    shipping_amount   = 0,
    total             = v_total,
    notes             = NULLIF(TRIM(p_notes), ''),
    updated_at        = now()
  WHERE so.id = p_sales_order_id
    AND so.company_id = p_company_id
    AND so.user_id = v_user_id
    AND so.fulfillment_status IN (
      'new'::public.sales_order_fulfillment_status,
      'upselling'::public.sales_order_fulfillment_status
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'Order update failed';
  END IF;

  DELETE FROM public.sales_order_items soi
  WHERE soi.sales_order_id = p_sales_order_id
    AND soi.company_id = p_company_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty        := COALESCE((v_item->>'quantity')::numeric, 1);
    v_price      := COALESCE((v_item->>'unit_price')::numeric, 0);
    v_line_total := v_qty * v_price;

    INSERT INTO public.sales_order_items (
      sales_order_id, company_id, product_id,
      item, description,
      quantity, unit_price,
      tax_percent, line_subtotal, line_tax, line_total,
      sort_order
    )
    VALUES (
      p_sales_order_id, p_company_id,
      NULLIF(v_item->>'product_id', '')::uuid,
      v_item->>'name',
      NULLIF(TRIM(COALESCE(v_item->>'description', '')), ''),
      v_qty, v_price,
      0, v_line_total, 0, v_line_total,
      v_sort
    );
    v_sort := v_sort + 1;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %', p_company_id;
  END IF;

  UPDATE public.sales_orders
  SET fulfillment_status = p_fulfillment_status::public.sales_order_fulfillment_status,
      updated_at = now()
  WHERE id = p_sales_order_id
    AND company_id = p_company_id;
END;
$$;


ALTER FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.company_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.company_id = p_company_id
      AND cu.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not authorized for company %', p_company_id;
  END IF;

  UPDATE public.sales_orders
  SET notes = p_notes
  WHERE id = p_sales_order_id
    AND company_id = p_company_id;
END;
$$;


ALTER FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p_company_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = p_company_id
          AND c.is_active = true
          AND c.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.company_users cu
        WHERE cu.company_id = p_company_id
          AND cu.user_id = auth.uid()
          AND cu.is_active = true
      )
    );
$$;


ALTER FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  g_company uuid;
  c_company uuid;
BEGIN
  SELECT g.company_id INTO g_company FROM public.whatsapp_groups g WHERE g.id = NEW.whatsapp_group_id;
  IF g_company IS NULL THEN
    RAISE EXCEPTION 'whatsapp_group_id % not found', NEW.whatsapp_group_id;
  END IF;

  SELECT c.company_id INTO c_company FROM public.customers c WHERE c.id = NEW.customer_id;
  IF c_company IS NULL THEN
    RAISE EXCEPTION 'customer_id % not found', NEW.customer_id;
  END IF;

  IF g_company IS DISTINCT FROM c_company THEN
    RAISE EXCEPTION 'Customer must belong to the same company as the WhatsApp group';
  END IF;

  NEW.company_id := g_company;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "region" "text",
    CONSTRAINT "cities_region_check" CHECK ((("region" IS NULL) OR ("region" = ANY (ARRAY['North'::"text", 'East'::"text", 'South'::"text", 'West'::"text", 'Center'::"text"]))))
);


ALTER TABLE "public"."cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_aliases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city_id" "uuid" NOT NULL,
    "alias" "text" NOT NULL,
    "normalized_alias" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."city_aliases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."city_match_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "raw_address" "text" NOT NULL,
    "normalized_address" "text",
    "predicted_city_id" "uuid",
    "confirmed_city_id" "uuid",
    "predicted_score" numeric,
    "was_correct" boolean,
    "whatsapp_user_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."city_match_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "brn" "text",
    "vat_number" "text",
    "email" "text",
    "phone" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "country" "text",
    "plan_id" "uuid" NOT NULL,
    "subscription_start_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "subscription_end_date" "date",
    "is_trial" boolean DEFAULT false,
    "max_users_override" integer,
    "billing_contact_name" "text",
    "billing_contact_email" "text",
    "billing_contact_phone" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_code" "text" NOT NULL,
    "company_logo_url" "text"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT false,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."company_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "is_owner" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "invited_at" timestamp with time zone,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "driver_rate" numeric(12,2),
    CONSTRAINT "company_users_driver_rate_non_negative" CHECK ((("driver_rate" IS NULL) OR ("driver_rate" >= (0)::numeric)))
);


ALTER TABLE "public"."company_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_note_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "credit_note_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "product_id" "uuid",
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(14,4) DEFAULT 1 NOT NULL,
    "unit_price" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_percent" numeric(8,4) DEFAULT 0 NOT NULL,
    "line_subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "line_tax" numeric(14,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invoice_item_id" "uuid"
);


ALTER TABLE "public"."credit_note_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_note_items" IS 'Line items for credit notes.';



COMMENT ON COLUMN "public"."credit_note_items"."invoice_item_id" IS 'Source invoice line when crediting against an invoice.';



CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" "text" NOT NULL,
    "company_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "related_invoice_id" "uuid",
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "public"."credit_note_status" DEFAULT 'issued'::"public"."credit_note_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "subtotal" numeric(14,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(14,2) DEFAULT 0 NOT NULL,
    "total" numeric(14,2) DEFAULT 0 NOT NULL,
    "discount_type" "text" DEFAULT 'value'::"text" NOT NULL,
    "discount_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "reason" "text",
    "notes" "text",
    "terms" "text",
    "from_snapshot" "jsonb",
    "bill_to_snapshot" "jsonb",
    "client_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "credit_type" "text" DEFAULT 'partial'::"text" NOT NULL,
    CONSTRAINT "credit_notes_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['full'::"text", 'partial'::"text"]))),
    CONSTRAINT "credit_notes_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."credit_notes" OWNER TO "postgres";


COMMENT ON TABLE "public"."credit_notes" IS 'Customer credit notes (returns, corrections).';



COMMENT ON COLUMN "public"."credit_notes"."credit_type" IS 'full = credit entire invoice balance; partial = selected lines/qty.';



CREATE TABLE IF NOT EXISTS "public"."customer_credit_balances" (
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "balance" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "customer_credit_balances_balance_check" CHECK (("balance" >= (0)::numeric))
);


ALTER TABLE "public"."customer_credit_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_credit_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "invoice_id" "uuid",
    "amount" numeric NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "customer_credit_settlements_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."customer_credit_settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "driver_user_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."delivery_note_status" DEFAULT 'new'::"public"."delivery_note_status" NOT NULL,
    "driver_status" boolean,
    "delivery_date" "date",
    "from_location_id" "uuid",
    "location_id" "uuid",
    "delivered_to_driver_at" timestamp with time zone,
    "driver_settlement_status" "public"."driver_settlement_status" DEFAULT 'pending'::"public"."driver_settlement_status" NOT NULL
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."deliveries" IS 'Outbound delivery batch; lines in delivery_sales_orders. Set sales_orders.fulfillment_status to delivered to driver on save.';



COMMENT ON COLUMN "public"."deliveries"."driver_user_id" IS 'auth.users.id of the driver (member with Driver role on company team).';



COMMENT ON COLUMN "public"."deliveries"."created_by" IS 'auth.users.id of the user who saved this delivery.';



COMMENT ON COLUMN "public"."deliveries"."status" IS 'Delivery note state: New, then handed to driver (delivered_to_driver), then completed.';



CREATE TABLE IF NOT EXISTS "public"."delivery_driver_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "driver_user_id" "uuid" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "amount_to_owner" numeric(14,2) NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "settlement_cash_total" numeric(14,2),
    "driver_daily_rate" numeric(14,2),
    "linked_orders_total" numeric(14,2),
    "bank_reference" "text",
    "expense_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cash_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "bank_transfer_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    "due_amount" numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT "delivery_driver_settlements_split_ck" CHECK (((("amount_to_owner" <= (0)::numeric) AND ("cash_amount" = (0)::numeric) AND ("bank_transfer_amount" = (0)::numeric) AND ("due_amount" = (0)::numeric)) OR (("amount_to_owner" > (0)::numeric) AND ("cash_amount" >= (0)::numeric) AND ("bank_transfer_amount" >= (0)::numeric) AND ("due_amount" >= (0)::numeric) AND ("round"((("cash_amount" + "bank_transfer_amount") + "due_amount"), 2) = "round"(("amount_to_owner")::numeric, 2)))))
);


ALTER TABLE "public"."delivery_driver_settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."delivery_driver_settlements" IS 'Admin record of how the driver returned money to the owner when settling a delivery driver balance.';



COMMENT ON COLUMN "public"."delivery_driver_settlements"."amount_to_owner" IS 'Net amount returned to owner from the driver for this delivery (preview "amount to return to owner").';



COMMENT ON COLUMN "public"."delivery_driver_settlements"."bank_reference" IS 'Required when bank_transfer_amount > 0.';



COMMENT ON COLUMN "public"."delivery_driver_settlements"."cash_amount" IS 'Portion of amount_to_owner received as cash.';



COMMENT ON COLUMN "public"."delivery_driver_settlements"."bank_transfer_amount" IS 'Portion of amount_to_owner received by bank transfer.';



COMMENT ON COLUMN "public"."delivery_driver_settlements"."due_amount" IS 'Portion of amount_to_owner not paid in cash or bank; recorded on driver balance.';



CREATE TABLE IF NOT EXISTS "public"."delivery_sales_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "deactivated_at" timestamp with time zone,
    "deactivation_reason" "text"
);


ALTER TABLE "public"."delivery_sales_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."delivery_sales_orders" IS 'Sales orders included in a delivery. Enforce “only new SOs” and “one active delivery per SO” in application logic or add a partial unique index when you add a delivery status column.';



COMMENT ON COLUMN "public"."delivery_sales_orders"."sales_order_id" IS 'Only rows with fulfillment_status = new should be inserted; app updates to delivery note created after commit.';



CREATE TABLE IF NOT EXISTS "public"."delivery_upselling_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "commission_amount" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "recorded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "delivery_upselling_commissions_commission_amount_check" CHECK (("commission_amount" >= (0)::numeric))
);


ALTER TABLE "public"."delivery_upselling_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driver_credit_balances" (
    "user_id" "uuid" NOT NULL,
    "driver_user_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "balance" numeric(14,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driver_credit_balances" OWNER TO "postgres";


COMMENT ON TABLE "public"."driver_credit_balances" IS 'Running credit balance per driver within a company (e.g. over-collection on delivery).';



CREATE TABLE IF NOT EXISTS "public"."driver_credit_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_id" "uuid",
    "driver_user_id" "uuid" NOT NULL,
    "delivery_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driver_credit_settlements" OWNER TO "postgres";


COMMENT ON TABLE "public"."driver_credit_settlements" IS 'Settlement history when driver credit is applied or manually reduced.';



CREATE TABLE IF NOT EXISTS "public"."employee_advances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "amount_deducted" numeric(12,2) DEFAULT 0 NOT NULL,
    "deduction_per_period" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "employee_advances_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'fully_deducted'::"text"])))
);


ALTER TABLE "public"."employee_advances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "position" "text",
    "basic_salary" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_type" "text" DEFAULT 'monthly'::"text" NOT NULL,
    "join_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "transport_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "other_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "employees_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['monthly'::"text", 'daily'::"text", 'hourly'::"text"]))),
    CONSTRAINT "employees_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_percent" numeric DEFAULT 0 NOT NULL,
    "line_subtotal" numeric DEFAULT 0 NOT NULL,
    "line_tax" numeric DEFAULT 0 NOT NULL,
    "line_total" numeric DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "expense_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "expense_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "expense_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."expense_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "category" "text",
    "expense_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "payment_method" "text",
    "invoice_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "line_items" "jsonb" DEFAULT '[]'::"jsonb",
    "company_id" "uuid",
    CONSTRAINT "expenses_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "expenses_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['Cash'::"text", 'Card Payment'::"text", 'Credit Facilities'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "from_location_id" "uuid",
    "to_location_id" "uuid",
    "quantity" numeric NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "delivery_id" "uuid",
    "sales_order_id" "uuid",
    "reference_type" "text",
    "reference_number" "text",
    CONSTRAINT "inventory_movements_adjustment_out_shape" CHECK ((("event_type" IS DISTINCT FROM 'adjustment_out'::"text") OR (("from_location_id" IS NOT NULL) AND ("to_location_id" IS NULL)))),
    CONSTRAINT "inventory_movements_event_type_check" CHECK (("event_type" = ANY (ARRAY['transfer'::"text", 'refill'::"text", 'adjustment_out'::"text"]))),
    CONSTRAINT "inventory_movements_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "inventory_movements_refill_shape" CHECK ((("event_type" IS DISTINCT FROM 'refill'::"text") OR (("to_location_id" IS NOT NULL) AND ("from_location_id" IS NULL)))),
    CONSTRAINT "inventory_movements_transfer_shape" CHECK ((("event_type" IS DISTINCT FROM 'transfer'::"text") OR (("from_location_id" IS NOT NULL) AND ("to_location_id" IS NOT NULL) AND ("from_location_id" IS DISTINCT FROM "to_location_id"))))
);


ALTER TABLE "public"."inventory_movements" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_movements" IS 'Append-only inventory history. INSERT a row to transfer, refill, or remove stock; trigger updates product_location_stocks.';



COMMENT ON COLUMN "public"."inventory_movements"."event_type" IS 'transfer: from_location -> to_location; refill: inbound to to_location only; adjustment_out: remove from from_location only.';



CREATE TABLE IF NOT EXISTS "public"."locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "code" "text",
    "description" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "postal" "text",
    "country" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "map_link" "text",
    "location_type" "public"."location_type" DEFAULT 'warehouse'::"public"."location_type" NOT NULL,
    "parent_location_id" "uuid",
    "is_stock_location" boolean DEFAULT true NOT NULL,
    "is_primary_warehouse" boolean DEFAULT false NOT NULL,
    CONSTRAINT "locations_primary_warehouse_type_check" CHECK ((("is_primary_warehouse" = false) OR ("location_type" = 'warehouse'::"public"."location_type")))
);


ALTER TABLE "public"."locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_location_stocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "quantity" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_location_stocks_quantity_check" CHECK (("quantity" >= (0)::numeric))
);


ALTER TABLE "public"."product_location_stocks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."inventory_stock_by_location" WITH ("security_invoker"='true') AS
 SELECT "pls"."company_id",
    "pls"."location_id",
    "l"."name" AS "location_name",
    COALESCE("l"."code", ''::"text") AS "location_code",
    "pls"."product_id",
    "p"."name" AS "product_name",
    COALESCE("p"."sku", ''::"text") AS "product_sku",
    "pls"."quantity",
    "pls"."updated_at" AS "balance_updated_at"
   FROM (("public"."product_location_stocks" "pls"
     JOIN "public"."locations" "l" ON ((("l"."id" = "pls"."location_id") AND ("l"."company_id" = "pls"."company_id"))))
     JOIN "public"."products" "p" ON ((("p"."id" = "pls"."product_id") AND ("p"."company_id" = "pls"."company_id"))));


ALTER VIEW "public"."inventory_stock_by_location" OWNER TO "postgres";


COMMENT ON VIEW "public"."inventory_stock_by_location" IS 'Current on-hand quantity per company, location, and product.';



CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric(12,3) NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "tax_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "line_subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_tax" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    "product_id" "uuid",
    CONSTRAINT "invoice_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "invoice_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "invoice_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "number" "text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'unpaid'::"public"."invoice_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "from_snapshot" "jsonb" NOT NULL,
    "bill_to_snapshot" "jsonb" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount_type" "text",
    "discount_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "shipping_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_snapshot" "jsonb",
    "payment_method" "text",
    "amount_paid" numeric DEFAULT 0 NOT NULL,
    "amount_due" numeric DEFAULT 0 NOT NULL,
    "credit_applied" numeric DEFAULT 0 NOT NULL,
    "created_from_quotation_id" "uuid",
    "created_from_sales_order_id" "uuid",
    "company_id" "uuid",
    CONSTRAINT "invoices_amount_due_check" CHECK (("amount_due" >= (0)::numeric)),
    CONSTRAINT "invoices_amount_paid_check" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "invoices_credit_applied_check" CHECK (("credit_applied" >= (0)::numeric)),
    CONSTRAINT "invoices_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"]))),
    CONSTRAINT "invoices_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['Cash'::"text", 'Card Payment'::"text", 'Credit Facilities'::"text"]))),
    CONSTRAINT "invoices_status_check" CHECK ((("status")::"text" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."payment_method" IS 'Payment method: Cash, Card Payment, or Credit Facilities';



COMMENT ON COLUMN "public"."invoices"."amount_paid" IS 'Amount that has been paid for this invoice';



COMMENT ON COLUMN "public"."invoices"."amount_due" IS 'Remaining amount due (total - amount_paid)';



COMMENT ON COLUMN "public"."invoices"."created_from_quotation_id" IS 'Source quotation when converted; NULL for standalone invoices';



COMMENT ON COLUMN "public"."invoices"."created_from_sales_order_id" IS 'Source sales order when converted; NULL for standalone invoices';



CREATE OR REPLACE VIEW "public"."invoices_list" WITH ("security_invoker"='on') AS
 SELECT "id",
    "user_id",
    "number",
    "status",
    ("status")::"text" AS "status_text",
    "issue_date",
    "due_date",
    "currency",
    COALESCE(("bill_to_snapshot" ->> 'company_name'::"text"), ("bill_to_snapshot" ->> 'full_name'::"text")) AS "bill_to_name",
    ("bill_to_snapshot" ->> 'email'::"text") AS "bill_to_email",
    ("bill_to_snapshot" ->> 'phone'::"text") AS "bill_to_phone",
    "subtotal",
    "tax_total",
    "total",
    "created_at",
    "updated_at"
   FROM "public"."invoices" "i";


ALTER VIEW "public"."invoices_list" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."location_drivers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "driver_user_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "assigned_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "assigned_until" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "location_drivers_check" CHECK ((("assigned_until" IS NULL) OR ("assigned_until" >= "assigned_from")))
);


ALTER TABLE "public"."location_drivers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "month" smallint NOT NULL,
    "year" smallint NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "total_gross" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_net" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "payroll_runs_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "payroll_runs_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'processed'::"text"]))),
    CONSTRAINT "payroll_runs_year_check" CHECK ((("year" >= 2020) AND ("year" <= 2100)))
);


ALTER TABLE "public"."payroll_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payslip_advance_deductions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payslip_id" "uuid" NOT NULL,
    "advance_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid"
);


ALTER TABLE "public"."payslip_advance_deductions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payslips" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payroll_run_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "basic_salary" numeric(12,2) NOT NULL,
    "transport_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "other_allowance" numeric(12,2) DEFAULT 0 NOT NULL,
    "gross_salary" numeric(12,2) NOT NULL,
    "advance_deduction" numeric(12,2) DEFAULT 0 NOT NULL,
    "absence_deduction" numeric(12,2) DEFAULT 0 NOT NULL,
    "other_deduction" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_deductions" numeric(12,2) DEFAULT 0 NOT NULL,
    "net_salary" numeric(12,2) NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "payment_method" "text",
    "payment_date" "date",
    "expense_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "payslips_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['Cash'::"text", 'Card Payment'::"text", 'Bank Transfer'::"text"])))),
    CONSTRAINT "payslips_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."payslips" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL,
    "is_enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."plan_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text",
    "max_users" integer DEFAULT 1 NOT NULL,
    "billing_cycle" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plans_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"])))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "number_prefix" "text" DEFAULT 'INV'::"text" NOT NULL,
    "number_padding" integer DEFAULT 5 NOT NULL,
    "next_number" integer DEFAULT 1 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "payment_terms" integer DEFAULT 14 NOT NULL,
    "default_notes" "text",
    "default_terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "preferences_next_number_check" CHECK (("next_number" >= 1)),
    CONSTRAINT "preferences_number_padding_check" CHECK ((("number_padding" >= 1) AND ("number_padding" <= 10))),
    CONSTRAINT "preferences_payment_terms_check" CHECK (("payment_terms" >= 0))
);


ALTER TABLE "public"."preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "account_type" "text" DEFAULT 'company'::"text" NOT NULL,
    "company_name" "text",
    "logo_url" "text",
    "registration_id" "text",
    "full_name" "text",
    "tax_id" "text",
    "email" "text",
    "phone" "text",
    "street" "text",
    "city" "text",
    "postal" "text",
    "country" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address_line_1" "text",
    "address_line_2" "text",
    "bank_name" "text",
    "bank_acc_num" "text",
    "vat_number" "text",
    "vat_registered" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_account_type_check" CHECK (("account_type" = ANY (ARRAY['company'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."vat_number" IS 'VAT number for company accounts';



CREATE TABLE IF NOT EXISTS "public"."purchase_invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_invoice_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_percent" numeric DEFAULT 0 NOT NULL,
    "line_subtotal" numeric DEFAULT 0 NOT NULL,
    "line_tax" numeric DEFAULT 0 NOT NULL,
    "line_total" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "purchase_invoice_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "purchase_invoice_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "purchase_invoice_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "number" "text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "due_date" "date" NOT NULL,
    "status" "public"."purchase_invoice_status" DEFAULT 'unpaid'::"public"."purchase_invoice_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "from_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "bill_to_snapshot" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "client_snapshot" "jsonb",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_total" numeric DEFAULT 0 NOT NULL,
    "discount_type" "text",
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "shipping_amount" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "payment_method" "text",
    "amount_paid" numeric DEFAULT 0 NOT NULL,
    "amount_due" numeric DEFAULT 0 NOT NULL,
    "created_from_purchase_order_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "purchase_invoices_amount_due_check" CHECK (("amount_due" >= (0)::numeric)),
    CONSTRAINT "purchase_invoices_amount_paid_check" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "purchase_invoices_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"]))),
    CONSTRAINT "purchase_invoices_payment_method_check" CHECK ((("payment_method" IS NULL) OR ("payment_method" = ANY (ARRAY['Cash'::"text", 'Card Payment'::"text", 'Credit Facilities'::"text", 'Bank Transfer'::"text"]))))
);


ALTER TABLE "public"."purchase_invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_invoices" IS 'Accounts-payable bills from suppliers; mirrors sales invoices with supplier_id';



COMMENT ON COLUMN "public"."purchase_invoices"."status" IS 'Recomputed on write: unpaid, partially_paid, paid, overdue, cancelled';



COMMENT ON COLUMN "public"."purchase_invoices"."bill_to_snapshot" IS 'Supplier/vendor snapshot at invoice time';



COMMENT ON COLUMN "public"."purchase_invoices"."amount_paid" IS 'Cumulative amount paid toward this bill';



COMMENT ON COLUMN "public"."purchase_invoices"."amount_due" IS 'Remaining balance (typically total - amount_paid after discounts/shipping)';



CREATE TABLE IF NOT EXISTS "public"."purchase_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_order_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_percent" numeric DEFAULT 0 NOT NULL,
    "line_subtotal" numeric DEFAULT 0 NOT NULL,
    "line_tax" numeric DEFAULT 0 NOT NULL,
    "line_total" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "purchase_order_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "purchase_order_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "purchase_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."purchase_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."purchase_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "number" "text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date" NOT NULL,
    "status" "public"."purchase_order_status" DEFAULT 'active'::"public"."purchase_order_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "from_snapshot" "jsonb" NOT NULL,
    "bill_to_snapshot" "jsonb" NOT NULL,
    "client_snapshot" "jsonb",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_total" numeric DEFAULT 0 NOT NULL,
    "discount_type" "text",
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "shipping_amount" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "purchase_orders_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."purchase_orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."purchase_orders" IS 'Purchase orders to suppliers; lines/totals match sales_orders';



COMMENT ON COLUMN "public"."purchase_orders"."supplier_id" IS 'Linked supplier (vendor); NULL if one-off / manual bill_to only';



COMMENT ON COLUMN "public"."purchase_orders"."bill_to_snapshot" IS 'Supplier/vendor address at time of order (mirrors bill_to on SO)';



CREATE TABLE IF NOT EXISTS "public"."quotation_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quotation_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_percent" numeric DEFAULT 0 NOT NULL,
    "line_subtotal" numeric DEFAULT 0 NOT NULL,
    "line_tax" numeric DEFAULT 0 NOT NULL,
    "line_total" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "quotation_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "quotation_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "quotation_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."quotation_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."quotation_items"."sort_order" IS 'Display order within the quotation (0-based)';



CREATE TABLE IF NOT EXISTS "public"."quotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "customer_id" "uuid",
    "number" "text" NOT NULL,
    "issue_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "valid_until" "date" NOT NULL,
    "status" "public"."quotation_status" DEFAULT 'active'::"public"."quotation_status" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "from_snapshot" "jsonb" NOT NULL,
    "bill_to_snapshot" "jsonb" NOT NULL,
    "client_snapshot" "jsonb",
    "subtotal" numeric DEFAULT 0 NOT NULL,
    "tax_total" numeric DEFAULT 0 NOT NULL,
    "discount_type" "text",
    "discount_amount" numeric DEFAULT 0 NOT NULL,
    "shipping_amount" numeric DEFAULT 0 NOT NULL,
    "total" numeric DEFAULT 0 NOT NULL,
    "notes" "text",
    "terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "quotations_discount_type_check" CHECK (("discount_type" = ANY (ARRAY['value'::"text", 'percent'::"text"])))
);


ALTER TABLE "public"."quotations" OWNER TO "postgres";


COMMENT ON TABLE "public"."quotations" IS 'Sales quotations; same line/totals model as invoices, no payment fields';



CREATE TABLE IF NOT EXISTS "public"."role_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "feature_id" "uuid" NOT NULL
);


ALTER TABLE "public"."role_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sales_order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sales_order_id" "uuid" NOT NULL,
    "item" "text" NOT NULL,
    "description" "text",
    "quantity" numeric NOT NULL,
    "unit_price" numeric NOT NULL,
    "tax_percent" numeric DEFAULT 0 NOT NULL,
    "line_subtotal" numeric DEFAULT 0 NOT NULL,
    "line_tax" numeric DEFAULT 0 NOT NULL,
    "line_total" numeric DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "company_id" "uuid",
    "product_id" "uuid",
    CONSTRAINT "sales_order_items_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "sales_order_items_tax_percent_check" CHECK (("tax_percent" >= (0)::numeric)),
    CONSTRAINT "sales_order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."sales_order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'company'::"text" NOT NULL,
    "company_name" "text",
    "contact_name" "text",
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "street" "text",
    "city" "text",
    "postal" "text",
    "country" "text",
    "address_line_1" "text",
    "address_line_2" "text",
    "supplier_code" "text",
    "vat_number" "text",
    "registration_id" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid",
    CONSTRAINT "suppliers_type_check" CHECK (("type" = ANY (ARRAY['company'::"text", 'individual'::"text"])))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."suppliers" IS 'Vendors / suppliers; scoped per authenticated user';



COMMENT ON COLUMN "public"."suppliers"."supplier_code" IS 'Optional short reference code unique to the user (enforce in app if needed)';



CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "system_role" "public"."system_role" DEFAULT 'member'::"public"."system_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "currency" "text" DEFAULT 'MUR'::"text" NOT NULL,
    "number_prefix" "text" DEFAULT 'INV'::"text" NOT NULL,
    "number_padding" integer DEFAULT 4 NOT NULL,
    "next_number" integer DEFAULT 1 NOT NULL,
    "payment_terms" integer DEFAULT 14 NOT NULL,
    "default_notes" "text",
    "default_terms" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "quotation_prefix" "text" DEFAULT 'QT'::"text" NOT NULL,
    "quotation_number_padding" integer DEFAULT 4 NOT NULL,
    "quotation_next_number" integer DEFAULT 1 NOT NULL,
    "sales_order_prefix" "text" DEFAULT 'SO'::"text" NOT NULL,
    "sales_order_number_padding" integer DEFAULT 4 NOT NULL,
    "sales_order_next_number" integer DEFAULT 1 NOT NULL,
    "purchase_order_prefix" "text" DEFAULT 'PO'::"text" NOT NULL,
    "purchase_order_number_padding" integer DEFAULT 4 NOT NULL,
    "purchase_order_next_number" integer DEFAULT 1 NOT NULL,
    "purchase_invoice_prefix" "text" DEFAULT 'PINV'::"text" NOT NULL,
    "purchase_invoice_number_padding" integer DEFAULT 4 NOT NULL,
    "purchase_invoice_next_number" integer DEFAULT 1 NOT NULL,
    "company_id" "uuid",
    "credit_note_prefix" "text" DEFAULT 'CN'::"text" NOT NULL,
    "credit_note_number_padding" integer DEFAULT 4 NOT NULL,
    "credit_note_next_number" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "user_settings_purchase_invoice_next_number_check" CHECK (("purchase_invoice_next_number" >= 1)),
    CONSTRAINT "user_settings_purchase_invoice_number_padding_check" CHECK ((("purchase_invoice_number_padding" >= 1) AND ("purchase_invoice_number_padding" <= 10))),
    CONSTRAINT "user_settings_purchase_order_next_number_check" CHECK (("purchase_order_next_number" >= 1)),
    CONSTRAINT "user_settings_purchase_order_number_padding_check" CHECK ((("purchase_order_number_padding" >= 1) AND ("purchase_order_number_padding" <= 10))),
    CONSTRAINT "user_settings_quotation_next_number_check" CHECK (("quotation_next_number" >= 1)),
    CONSTRAINT "user_settings_quotation_number_padding_check" CHECK ((("quotation_number_padding" >= 1) AND ("quotation_number_padding" <= 10))),
    CONSTRAINT "user_settings_sales_order_next_number_check" CHECK (("sales_order_next_number" >= 1)),
    CONSTRAINT "user_settings_sales_order_number_padding_check" CHECK ((("sales_order_number_padding" >= 1) AND ("sales_order_number_padding" <= 10)))
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."user_settings"."quotation_prefix" IS 'Prefix for generated quotation numbers, e.g. QT';



COMMENT ON COLUMN "public"."user_settings"."quotation_number_padding" IS 'Zero-pad width for quotation sequence';



COMMENT ON COLUMN "public"."user_settings"."quotation_next_number" IS 'Next sequence value for quotations for this user';



COMMENT ON COLUMN "public"."user_settings"."sales_order_prefix" IS 'Prefix for generated sales order numbers, e.g. SO';



COMMENT ON COLUMN "public"."user_settings"."sales_order_number_padding" IS 'Zero-pad width for sales order sequence';



COMMENT ON COLUMN "public"."user_settings"."sales_order_next_number" IS 'Next sequence value for sales orders for this user';



COMMENT ON COLUMN "public"."user_settings"."purchase_order_prefix" IS 'Prefix for generated purchase order numbers, e.g. PO';



COMMENT ON COLUMN "public"."user_settings"."purchase_order_number_padding" IS 'Zero-pad width for purchase order sequence';



COMMENT ON COLUMN "public"."user_settings"."purchase_order_next_number" IS 'Next sequence value for purchase orders for this user';



COMMENT ON COLUMN "public"."user_settings"."purchase_invoice_prefix" IS 'Prefix for generated purchase invoice numbers, e.g. PINV';



COMMENT ON COLUMN "public"."user_settings"."purchase_invoice_number_padding" IS 'Zero-pad width for purchase invoice sequence';



COMMENT ON COLUMN "public"."user_settings"."purchase_invoice_next_number" IS 'Next sequence value for purchase invoices for this user';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_ad_click_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company" "text" NOT NULL,
    "ad_id" "text" NOT NULL,
    "stat_date" "date" NOT NULL,
    "meta_clicks" integer DEFAULT 0 NOT NULL,
    "meta_conversations_started" integer DEFAULT 0 NOT NULL,
    "synced_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_ad_click_stats_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"])))
);


ALTER TABLE "public"."whatsapp_ad_click_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_ad_referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "source_id" "text",
    "source_url" "text",
    "source_type" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_ad_referrals_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"])))
);


ALTER TABLE "public"."whatsapp_ad_referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_bot_item_colors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "color_name" "text" NOT NULL,
    "color_hex" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_bot_item_colors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_bot_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ad_link" "text",
    "image_base64" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "product_name" "text",
    "price" "text",
    "company" "text" DEFAULT 'spark'::"text" NOT NULL,
    "price_amount" numeric DEFAULT 0,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "ad_link_2" "text",
    "ad_id" "text",
    "ad_id_2" "text",
    "is_website" boolean DEFAULT true,
    "is_whatsapp" boolean DEFAULT true,
    "source" "text",
    CONSTRAINT "whatsapp_bot_items_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"]))),
    CONSTRAINT "whatsapp_bot_items_price_amount_check" CHECK (("price_amount" >= (0)::numeric))
);


ALTER TABLE "public"."whatsapp_bot_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_bot_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_name" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "city" "text" NOT NULL,
    "address" "text" NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "customer_phone_number" "text" NOT NULL,
    "order_ref" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "company" "text" DEFAULT 'spark'::"text" NOT NULL,
    "city_id" "uuid",
    "notes" "text",
    "source" "text",
    CONSTRAINT "whatsapp_bot_orders_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"]))),
    CONSTRAINT "whatsapp_bot_orders_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'complete'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."whatsapp_bot_orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_bot_orders_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "product_name" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "line_total" numeric(12,2) DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "color_id" "uuid",
    "color_name" "text",
    "color_hex" "text",
    CONSTRAINT "whatsapp_bot_orders_items_line_total_check" CHECK (("line_total" >= (0)::numeric)),
    CONSTRAINT "whatsapp_bot_orders_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "whatsapp_bot_orders_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."whatsapp_bot_orders_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_catalogue_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "image_base64" "text",
    "image_mime_type" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_catalogue_posts_image_mime_check" CHECK ((("image_mime_type" IS NULL) OR ("image_mime_type" = ANY (ARRAY['image/png'::"text", 'image/jpeg'::"text", 'image/webp'::"text", 'image/gif'::"text"])))),
    CONSTRAINT "whatsapp_catalogue_posts_image_pair_check" CHECK (((("image_base64" IS NULL) AND ("image_mime_type" IS NULL)) OR (("image_base64" IS NOT NULL) AND ("image_mime_type" IS NOT NULL)))),
    CONSTRAINT "whatsapp_catalogue_posts_image_size_check" CHECK ((("image_base64" IS NULL) OR ("octet_length"("image_base64") <= 5242880)))
);


ALTER TABLE "public"."whatsapp_catalogue_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_catalogue_posts" IS 'Catalogue-style posts: description + optional image stored as raw Base64 + MIME (no data: prefix).';



COMMENT ON COLUMN "public"."whatsapp_catalogue_posts"."image_base64" IS 'Raw Base64 only (no data:image/...;base64, prefix).';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_group_customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "whatsapp_group_id" "uuid" NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_group_customers" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_group_customers" IS 'Customers added to a whatsapp_groups row; one row per (group, customer).';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_groups" OWNER TO "postgres";


COMMENT ON TABLE "public"."whatsapp_groups" IS 'Named WhatsApp-style broadcast groups; members linked in whatsapp_group_customers.';



CREATE TABLE IF NOT EXISTS "public"."whatsapp_inbound_dedup" (
    "message_id" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "company" "text" DEFAULT 'spark'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."whatsapp_inbound_dedup" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_scheduled_promos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "company" "text" NOT NULL,
    "kind" "text" DEFAULT 'flavour_promo'::"text" NOT NULL,
    "send_at" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_id" "uuid",
    CONSTRAINT "whatsapp_scheduled_promos_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"])))
);


ALTER TABLE "public"."whatsapp_scheduled_promos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_session_cart_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "company" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "color_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "whatsapp_session_cart_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."whatsapp_session_cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_sessions" (
    "phone" "text" NOT NULL,
    "state" "text" DEFAULT 'idle'::"text" NOT NULL,
    "selected_item_id" "uuid",
    "quantity" integer,
    "city" "text",
    "address" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_name" "text",
    "total" numeric,
    "draft_order_id" "uuid",
    "reminder_count" integer DEFAULT 0 NOT NULL,
    "last_inbound_at" timestamp with time zone,
    "last_reminder_at" timestamp with time zone,
    "company" "text" DEFAULT 'spark'::"text" NOT NULL,
    "region" "text",
    "message_status" "public"."whatsapp_message_status",
    "message_notes" "text",
    "converted_order_id" "uuid",
    CONSTRAINT "whatsapp_sessions_company_check" CHECK (("company" = ANY (ARRAY['spark'::"text", 'sodamax'::"text"])))
);


ALTER TABLE "public"."whatsapp_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."worker_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "worker_kind" "public"."worker_kind" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "job_types" "text"[] NOT NULL,
    "other_job_type" "text",
    "years_experience" smallint NOT NULL,
    "district" "text" NOT NULL,
    "areas_served" "text",
    "services_offered" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "subscription_plan" "public"."subscription_plan" NOT NULL,
    "bio" "text" NOT NULL,
    "terms_accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "profile_status" "public"."worker_profile_status" DEFAULT 'pending'::"public"."worker_profile_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_applications_job_types_check" CHECK (("cardinality"("job_types") >= 1)),
    CONSTRAINT "worker_applications_years_experience_check" CHECK (("years_experience" >= 0))
);

ALTER TABLE ONLY "public"."worker_applications" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_applications" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_applications" IS 'Worker registration submissions (register page)';



COMMENT ON COLUMN "public"."worker_applications"."job_types" IS 'Multi-select job type slugs; other_job_type when other included';



COMMENT ON COLUMN "public"."worker_applications"."profile_status" IS 'pending=new; active=listed; inactive=suspended; rejected=declined';



CREATE TABLE IF NOT EXISTS "public"."worker_monthly_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "worker_application_id" "uuid" NOT NULL,
    "year" smallint NOT NULL,
    "month" smallint NOT NULL,
    "status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "worker_monthly_payments_month_check" CHECK ((("month" >= 1) AND ("month" <= 12))),
    CONSTRAINT "worker_monthly_payments_status_check" CHECK (("status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'pending'::"text"]))),
    CONSTRAINT "worker_monthly_payments_year_check" CHECK ((("year" >= 2020) AND ("year" <= 2100)))
);

ALTER TABLE ONLY "public"."worker_monthly_payments" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_monthly_payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."worker_monthly_payments" IS 'Per-worker monthly fee status; supports prepaid future months (status=paid ahead of calendar month).';



CREATE TABLE IF NOT EXISTS "public"."zone_cities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "city_id" "uuid" NOT NULL,
    "sort_order" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "zone_cities_sort_order_positive" CHECK (("sort_order" > 0))
);


ALTER TABLE "public"."zone_cities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "driver_user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_company_name_unique" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_aliases"
    ADD CONSTRAINT "city_aliases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."city_match_logs"
    ADD CONSTRAINT "city_match_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_company_code_key" UNIQUE ("company_code");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_pkey" PRIMARY KEY ("user_id", "customer_id");



ALTER TABLE ONLY "public"."customer_credit_settlements"
    ADD CONSTRAINT "customer_credit_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_driver_settlements"
    ADD CONSTRAINT "delivery_driver_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_sales_orders"
    ADD CONSTRAINT "delivery_sales_orders_delivery_id_sales_order_id_key" UNIQUE ("delivery_id", "sales_order_id");



ALTER TABLE ONLY "public"."delivery_sales_orders"
    ADD CONSTRAINT "delivery_sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_delivery_sales_order_unique" UNIQUE ("delivery_id", "sales_order_id");



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driver_credit_balances"
    ADD CONSTRAINT "driver_credit_balances_pkey" PRIMARY KEY ("company_id", "driver_user_id");



ALTER TABLE ONLY "public"."driver_credit_settlements"
    ADD CONSTRAINT "driver_credit_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_advances"
    ADD CONSTRAINT "employee_advances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_items"
    ADD CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_number_key" UNIQUE ("user_id", "number");



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_company_id_location_id_driver_user_id_key" UNIQUE ("company_id", "location_id", "driver_user_id");



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_user_id_month_year_key" UNIQUE ("user_id", "month", "year");



ALTER TABLE ONLY "public"."payslip_advance_deductions"
    ADD CONSTRAINT "payslip_advance_deductions_payslip_id_advance_id_key" UNIQUE ("payslip_id", "advance_id");



ALTER TABLE ONLY "public"."payslip_advance_deductions"
    ADD CONSTRAINT "payslip_advance_deductions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_payroll_run_id_employee_id_key" UNIQUE ("payroll_run_id", "employee_id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_unique" UNIQUE ("plan_id", "feature_id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preferences"
    ADD CONSTRAINT "preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."preferences"
    ADD CONSTRAINT "preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."product_location_stocks"
    ADD CONSTRAINT "product_location_stocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_location_stocks"
    ADD CONSTRAINT "product_location_stocks_product_location_uniq" UNIQUE ("product_id", "location_id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoice_items"
    ADD CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_user_number_unique" UNIQUE ("user_id", "number");



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_user_number_unique" UNIQUE ("user_id", "number");



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_user_number_unique" UNIQUE ("user_id", "number");



ALTER TABLE ONLY "public"."role_features"
    ADD CONSTRAINT "role_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_user_number_unique" UNIQUE ("user_id", "number");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "unique_company_user" UNIQUE ("company_id", "user_id");



ALTER TABLE ONLY "public"."role_features"
    ADD CONSTRAINT "unique_role_feature" UNIQUE ("role_id", "feature_id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "unique_role_name_per_company" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."whatsapp_ad_click_stats"
    ADD CONSTRAINT "whatsapp_ad_click_stats_company_ad_id_stat_date_key" UNIQUE ("company", "ad_id", "stat_date");



ALTER TABLE ONLY "public"."whatsapp_ad_click_stats"
    ADD CONSTRAINT "whatsapp_ad_click_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_ad_referrals"
    ADD CONSTRAINT "whatsapp_ad_referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_bot_item_colors"
    ADD CONSTRAINT "whatsapp_bot_item_colors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_bot_items"
    ADD CONSTRAINT "whatsapp_bot_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_bot_orders_items"
    ADD CONSTRAINT "whatsapp_bot_orders_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_bot_orders"
    ADD CONSTRAINT "whatsapp_bot_orders_order_ref_key" UNIQUE ("order_ref");



ALTER TABLE ONLY "public"."whatsapp_bot_orders"
    ADD CONSTRAINT "whatsapp_bot_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_catalogue_posts"
    ADD CONSTRAINT "whatsapp_catalogue_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_group_customers"
    ADD CONSTRAINT "whatsapp_group_customers_group_customer_uniq" UNIQUE ("whatsapp_group_id", "customer_id");



ALTER TABLE ONLY "public"."whatsapp_group_customers"
    ADD CONSTRAINT "whatsapp_group_customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_inbound_dedup"
    ADD CONSTRAINT "whatsapp_inbound_dedup_pkey" PRIMARY KEY ("message_id");



ALTER TABLE ONLY "public"."whatsapp_scheduled_promos"
    ADD CONSTRAINT "whatsapp_scheduled_promos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_session_cart_items"
    ADD CONSTRAINT "whatsapp_session_cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("phone", "company");



ALTER TABLE ONLY "public"."worker_applications"
    ADD CONSTRAINT "worker_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_monthly_payments"
    ADD CONSTRAINT "worker_monthly_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."worker_monthly_payments"
    ADD CONSTRAINT "worker_monthly_payments_worker_year_month" UNIQUE ("worker_application_id", "year", "month");



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_zone_city_unique" UNIQUE ("zone_id", "city_id");



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_zone_sort_order_unique" UNIQUE ("zone_id", "sort_order");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_company_name_unique" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "credit_notes_company_number_uq" ON "public"."credit_notes" USING "btree" ("company_id", "number");



CREATE INDEX "customer_credit_balances_customer_idx" ON "public"."customer_credit_balances" USING "btree" ("customer_id");



CREATE UNIQUE INDEX "delivery_sales_orders_unique_pair" ON "public"."delivery_sales_orders" USING "btree" ("delivery_id", "sales_order_id");



CREATE INDEX "idx_cities_company_active" ON "public"."cities" USING "btree" ("company_id", "is_active");



CREATE INDEX "idx_cities_company_id" ON "public"."cities" USING "btree" ("company_id");



CREATE INDEX "idx_cities_company_region" ON "public"."cities" USING "btree" ("company_id", "region");



CREATE INDEX "idx_cities_company_region_active" ON "public"."cities" USING "btree" ("company_id", "region", "is_active");



CREATE INDEX "idx_credit_note_items_credit_note" ON "public"."credit_note_items" USING "btree" ("credit_note_id");



CREATE INDEX "idx_credit_notes_company_issue" ON "public"."credit_notes" USING "btree" ("company_id", "issue_date" DESC);



CREATE INDEX "idx_credit_notes_customer" ON "public"."credit_notes" USING "btree" ("company_id", "customer_id");



CREATE INDEX "idx_customers_city_id" ON "public"."customers" USING "btree" ("city_id");



CREATE INDEX "idx_customers_company_city" ON "public"."customers" USING "btree" ("company_id", "city_id");



CREATE INDEX "idx_customers_company_id" ON "public"."customers" USING "btree" ("company_id");



CREATE INDEX "idx_customers_is_active" ON "public"."customers" USING "btree" ("user_id", "is_active");



CREATE INDEX "idx_customers_search" ON "public"."customers" USING "btree" ("user_id", "email", "company_name", "full_name");



CREATE INDEX "idx_customers_user_id" ON "public"."customers" USING "btree" ("user_id");



CREATE INDEX "idx_deliveries_company_created" ON "public"."deliveries" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_deliveries_driver" ON "public"."deliveries" USING "btree" ("driver_user_id");



CREATE INDEX "idx_delivery_driver_settlements_company_created" ON "public"."delivery_driver_settlements" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_delivery_driver_settlements_driver" ON "public"."delivery_driver_settlements" USING "btree" ("driver_user_id");



CREATE INDEX "idx_delivery_sales_orders_delivery" ON "public"."delivery_sales_orders" USING "btree" ("delivery_id");



CREATE INDEX "idx_delivery_sales_orders_sales_order" ON "public"."delivery_sales_orders" USING "btree" ("sales_order_id");



CREATE INDEX "idx_driver_credit_balances_company_balance" ON "public"."driver_credit_balances" USING "btree" ("company_id", "balance" DESC);



CREATE INDEX "idx_driver_credit_settlements_company_driver" ON "public"."driver_credit_settlements" USING "btree" ("company_id", "driver_user_id", "created_at" DESC);



CREATE INDEX "idx_employee_advances_employee_id" ON "public"."employee_advances" USING "btree" ("employee_id");



CREATE INDEX "idx_employee_advances_status" ON "public"."employee_advances" USING "btree" ("status");



CREATE INDEX "idx_employees_company_id" ON "public"."employees" USING "btree" ("company_id");



CREATE INDEX "idx_employees_status" ON "public"."employees" USING "btree" ("status");



CREATE INDEX "idx_employees_user_id" ON "public"."employees" USING "btree" ("user_id");



CREATE INDEX "idx_expenses_company_id" ON "public"."expenses" USING "btree" ("company_id");



CREATE INDEX "idx_invoices_company_id" ON "public"."invoices" USING "btree" ("company_id");



CREATE INDEX "idx_payroll_runs_company_id" ON "public"."payroll_runs" USING "btree" ("company_id");



CREATE INDEX "idx_payroll_runs_user_id" ON "public"."payroll_runs" USING "btree" ("user_id");



CREATE INDEX "idx_payroll_runs_year_month" ON "public"."payroll_runs" USING "btree" ("year", "month");



CREATE INDEX "idx_payslip_advance_deductions_payslip" ON "public"."payslip_advance_deductions" USING "btree" ("payslip_id");



CREATE INDEX "idx_payslips_company_id" ON "public"."payslips" USING "btree" ("company_id");



CREATE INDEX "idx_payslips_employee_id" ON "public"."payslips" USING "btree" ("employee_id");



CREATE INDEX "idx_payslips_payment_status" ON "public"."payslips" USING "btree" ("payment_status");



CREATE INDEX "idx_payslips_payroll_run_id" ON "public"."payslips" USING "btree" ("payroll_run_id");



CREATE INDEX "idx_purchase_invoices_company_id" ON "public"."purchase_invoices" USING "btree" ("company_id");



CREATE INDEX "idx_purchase_orders_company_id" ON "public"."purchase_orders" USING "btree" ("company_id");



CREATE INDEX "idx_quotations_company_id" ON "public"."quotations" USING "btree" ("company_id");



CREATE INDEX "idx_sales_orders_active_driver_delivery" ON "public"."sales_orders" USING "btree" ("company_id", "active_driver_delivery_id") WHERE ("active_driver_delivery_id" IS NOT NULL);



CREATE INDEX "idx_sales_orders_city_id" ON "public"."sales_orders" USING "btree" ("city_id");



CREATE INDEX "idx_sales_orders_company_city" ON "public"."sales_orders" USING "btree" ("company_id", "city_id");



CREATE INDEX "idx_sales_orders_company_id" ON "public"."sales_orders" USING "btree" ("company_id");



CREATE INDEX "idx_suppliers_company_id" ON "public"."suppliers" USING "btree" ("company_id");



CREATE INDEX "idx_worker_applications_district" ON "public"."worker_applications" USING "btree" ("district");



CREATE INDEX "idx_worker_applications_job_types" ON "public"."worker_applications" USING "gin" ("job_types");



CREATE INDEX "idx_worker_applications_phone" ON "public"."worker_applications" USING "btree" ("phone");



CREATE INDEX "idx_worker_applications_profile_status_created" ON "public"."worker_applications" USING "btree" ("profile_status", "created_at" DESC);



CREATE INDEX "idx_worker_applications_user_id" ON "public"."worker_applications" USING "btree" ("user_id");



CREATE INDEX "idx_worker_monthly_payments_worker_year" ON "public"."worker_monthly_payments" USING "btree" ("worker_application_id", "year");



CREATE INDEX "idx_zone_cities_city_id" ON "public"."zone_cities" USING "btree" ("city_id");



CREATE INDEX "idx_zone_cities_company_id" ON "public"."zone_cities" USING "btree" ("company_id");



CREATE INDEX "idx_zone_cities_zone_id" ON "public"."zone_cities" USING "btree" ("zone_id");



CREATE INDEX "idx_zone_cities_zone_order" ON "public"."zone_cities" USING "btree" ("zone_id", "sort_order");



CREATE INDEX "idx_zones_company_active" ON "public"."zones" USING "btree" ("company_id", "is_active");



CREATE INDEX "idx_zones_company_driver" ON "public"."zones" USING "btree" ("company_id", "driver_user_id");



CREATE INDEX "idx_zones_company_id" ON "public"."zones" USING "btree" ("company_id");



CREATE INDEX "idx_zones_driver_user_id" ON "public"."zones" USING "btree" ("driver_user_id");



CREATE INDEX "inventory_movements_company_created_idx" ON "public"."inventory_movements" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "inventory_movements_company_id_idx" ON "public"."inventory_movements" USING "btree" ("company_id");



CREATE INDEX "inventory_movements_product_created_idx" ON "public"."inventory_movements" USING "btree" ("product_id", "created_at" DESC);



CREATE INDEX "invoice_items_product_id_idx" ON "public"."invoice_items" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "invoices_created_from_quotation_idx" ON "public"."invoices" USING "btree" ("created_from_quotation_id") WHERE ("created_from_quotation_id" IS NOT NULL);



CREATE INDEX "invoices_created_from_sales_order_idx" ON "public"."invoices" USING "btree" ("created_from_sales_order_id") WHERE ("created_from_sales_order_id" IS NOT NULL);



CREATE UNIQUE INDEX "invoices_one_per_sales_order_uidx" ON "public"."invoices" USING "btree" ("created_from_sales_order_id") WHERE ("created_from_sales_order_id" IS NOT NULL);



CREATE INDEX "invoices_pivot_lookup_idx" ON "public"."invoices" USING "btree" ("company_id", "issue_date") WHERE ("status" <> 'cancelled'::"public"."invoice_status");



CREATE INDEX "location_drivers_active_idx" ON "public"."location_drivers" USING "btree" ("company_id", "location_id", "is_active");



CREATE INDEX "location_drivers_company_idx" ON "public"."location_drivers" USING "btree" ("company_id");



CREATE INDEX "location_drivers_driver_idx" ON "public"."location_drivers" USING "btree" ("driver_user_id");



CREATE INDEX "location_drivers_location_idx" ON "public"."location_drivers" USING "btree" ("location_id");



CREATE UNIQUE INDEX "location_drivers_unique_pair" ON "public"."location_drivers" USING "btree" ("company_id", "location_id", "driver_user_id");



CREATE INDEX "locations_company_active_idx" ON "public"."locations" USING "btree" ("company_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "locations_company_code_key" ON "public"."locations" USING "btree" ("company_id", "lower"("code")) WHERE (("code" IS NOT NULL) AND ("btrim"("code") <> ''::"text"));



CREATE UNIQUE INDEX "locations_company_code_unique" ON "public"."locations" USING "btree" ("company_id", "lower"("code")) WHERE ("code" IS NOT NULL);



CREATE INDEX "locations_company_id_idx" ON "public"."locations" USING "btree" ("company_id");



CREATE INDEX "locations_company_type_idx" ON "public"."locations" USING "btree" ("company_id", "location_type");



CREATE UNIQUE INDEX "locations_one_default_per_company" ON "public"."locations" USING "btree" ("company_id") WHERE ("is_default" = true);



CREATE INDEX "locations_parent_location_idx" ON "public"."locations" USING "btree" ("company_id", "parent_location_id");



CREATE UNIQUE INDEX "one_active_delivery_note_per_sales_order" ON "public"."delivery_sales_orders" USING "btree" ("sales_order_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "one_active_location_per_driver" ON "public"."location_drivers" USING "btree" ("company_id", "driver_user_id") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "one_customer_delivery_stockout_per_sales_order_product" ON "public"."inventory_movements" USING "btree" ("sales_order_id", "product_id", "from_location_id", "reference_type") WHERE ("reference_type" = 'delivered_to_customer'::"text");



CREATE UNIQUE INDEX "one_primary_driver_per_location" ON "public"."location_drivers" USING "btree" ("company_id", "location_id") WHERE (("is_primary" = true) AND ("is_active" = true));



CREATE UNIQUE INDEX "one_primary_warehouse_per_company" ON "public"."locations" USING "btree" ("company_id") WHERE (("location_type" = 'warehouse'::"public"."location_type") AND ("is_primary_warehouse" = true) AND ("is_active" = true));



CREATE INDEX "product_location_stocks_company_id_idx" ON "public"."product_location_stocks" USING "btree" ("company_id");



CREATE INDEX "product_location_stocks_location_id_idx" ON "public"."product_location_stocks" USING "btree" ("location_id");



CREATE INDEX "product_location_stocks_product_id_idx" ON "public"."product_location_stocks" USING "btree" ("product_id");



CREATE UNIQUE INDEX "product_location_stocks_unique_location_product" ON "public"."product_location_stocks" USING "btree" ("company_id", "product_id", "location_id");



CREATE INDEX "products_company_id_idx" ON "public"."products" USING "btree" ("company_id");



CREATE UNIQUE INDEX "products_company_sku_key" ON "public"."products" USING "btree" ("company_id", "lower"("sku")) WHERE (("sku" IS NOT NULL) AND ("btrim"("sku") <> ''::"text"));



CREATE INDEX "purchase_invoice_items_pi_id_idx" ON "public"."purchase_invoice_items" USING "btree" ("purchase_invoice_id");



CREATE INDEX "purchase_invoice_items_pi_sort_idx" ON "public"."purchase_invoice_items" USING "btree" ("purchase_invoice_id", "sort_order");



CREATE INDEX "purchase_invoices_created_from_po_idx" ON "public"."purchase_invoices" USING "btree" ("created_from_purchase_order_id");



CREATE INDEX "purchase_invoices_due_date_idx" ON "public"."purchase_invoices" USING "btree" ("due_date");



CREATE INDEX "purchase_invoices_issue_date_idx" ON "public"."purchase_invoices" USING "btree" ("issue_date" DESC);



CREATE INDEX "purchase_invoices_status_idx" ON "public"."purchase_invoices" USING "btree" ("status");



CREATE INDEX "purchase_invoices_supplier_id_idx" ON "public"."purchase_invoices" USING "btree" ("supplier_id");



CREATE INDEX "purchase_invoices_user_id_idx" ON "public"."purchase_invoices" USING "btree" ("user_id");



CREATE INDEX "purchase_order_items_po_id_idx" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id");



CREATE INDEX "purchase_order_items_po_sort_idx" ON "public"."purchase_order_items" USING "btree" ("purchase_order_id", "sort_order");



CREATE INDEX "purchase_orders_issue_date_idx" ON "public"."purchase_orders" USING "btree" ("issue_date" DESC);



CREATE INDEX "purchase_orders_supplier_id_idx" ON "public"."purchase_orders" USING "btree" ("supplier_id");



CREATE INDEX "purchase_orders_user_id_idx" ON "public"."purchase_orders" USING "btree" ("user_id");



CREATE INDEX "quotation_items_quotation_id_idx" ON "public"."quotation_items" USING "btree" ("quotation_id");



CREATE INDEX "quotation_items_quotation_sort_idx" ON "public"."quotation_items" USING "btree" ("quotation_id", "sort_order");



CREATE INDEX "quotations_customer_id_idx" ON "public"."quotations" USING "btree" ("customer_id");



CREATE INDEX "quotations_issue_date_idx" ON "public"."quotations" USING "btree" ("issue_date" DESC);



CREATE INDEX "quotations_user_id_idx" ON "public"."quotations" USING "btree" ("user_id");



CREATE INDEX "sales_order_items_product_id_idx" ON "public"."sales_order_items" USING "btree" ("product_id");



CREATE INDEX "sales_order_items_sales_order_id_idx" ON "public"."sales_order_items" USING "btree" ("sales_order_id");



CREATE INDEX "sales_order_items_sales_order_sort_idx" ON "public"."sales_order_items" USING "btree" ("sales_order_id", "sort_order");



CREATE INDEX "sales_orders_company_city_idx" ON "public"."sales_orders" USING "btree" ("company_id", "city_id");



CREATE INDEX "sales_orders_company_delivery_date_idx" ON "public"."sales_orders" USING "btree" ("company_id", "delivery_date");



CREATE INDEX "sales_orders_created_from_quotation_idx" ON "public"."sales_orders" USING "btree" ("created_from_quotation_id") WHERE ("created_from_quotation_id" IS NOT NULL);



CREATE INDEX "sales_orders_customer_id_idx" ON "public"."sales_orders" USING "btree" ("customer_id");



CREATE INDEX "sales_orders_issue_date_idx" ON "public"."sales_orders" USING "btree" ("issue_date" DESC);



CREATE INDEX "sales_orders_user_id_idx" ON "public"."sales_orders" USING "btree" ("user_id");



CREATE INDEX "suppliers_created_at_idx" ON "public"."suppliers" USING "btree" ("created_at" DESC);



CREATE INDEX "suppliers_user_active_idx" ON "public"."suppliers" USING "btree" ("user_id", "is_active");



CREATE INDEX "suppliers_user_id_idx" ON "public"."suppliers" USING "btree" ("user_id");



CREATE UNIQUE INDEX "uq_delivery_driver_settlements_delivery_id" ON "public"."delivery_driver_settlements" USING "btree" ("delivery_id");



CREATE UNIQUE INDEX "uq_inventory_movements_upselling_stock_out_item" ON "public"."inventory_movements" USING "btree" ("company_id", "sales_order_id", "product_id", "reference_number") WHERE ("reference_type" = 'upselling_stock_out'::"text");



CREATE INDEX "whatsapp_ad_click_stats_company_date_idx" ON "public"."whatsapp_ad_click_stats" USING "btree" ("company", "stat_date" DESC);



CREATE INDEX "whatsapp_ad_referrals_company_received_idx" ON "public"."whatsapp_ad_referrals" USING "btree" ("company", "received_at" DESC);



CREATE INDEX "whatsapp_ad_referrals_phone_idx" ON "public"."whatsapp_ad_referrals" USING "btree" ("company", "phone");



CREATE INDEX "whatsapp_bot_items_ad_id_2_idx" ON "public"."whatsapp_bot_items" USING "btree" ("company", "ad_id_2") WHERE ("ad_id_2" IS NOT NULL);



CREATE INDEX "whatsapp_bot_items_ad_id_idx" ON "public"."whatsapp_bot_items" USING "btree" ("company", "ad_id") WHERE ("ad_id" IS NOT NULL);



CREATE INDEX "whatsapp_bot_items_company_sort_idx" ON "public"."whatsapp_bot_items" USING "btree" ("company", "sort_order");



CREATE INDEX "whatsapp_bot_orders_items_item_id_idx" ON "public"."whatsapp_bot_orders_items" USING "btree" ("item_id") WHERE ("item_id" IS NOT NULL);



CREATE INDEX "whatsapp_bot_orders_items_order_id_idx" ON "public"."whatsapp_bot_orders_items" USING "btree" ("order_id");



CREATE INDEX "whatsapp_bot_orders_source_idx" ON "public"."whatsapp_bot_orders" USING "btree" ("company", "source");



CREATE INDEX "whatsapp_catalogue_posts_company_created_idx" ON "public"."whatsapp_catalogue_posts" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "whatsapp_catalogue_posts_company_id_idx" ON "public"."whatsapp_catalogue_posts" USING "btree" ("company_id");



CREATE INDEX "whatsapp_group_customers_customer_id_idx" ON "public"."whatsapp_group_customers" USING "btree" ("customer_id");



CREATE INDEX "whatsapp_group_customers_group_id_idx" ON "public"."whatsapp_group_customers" USING "btree" ("whatsapp_group_id");



CREATE INDEX "whatsapp_groups_company_id_idx" ON "public"."whatsapp_groups" USING "btree" ("company_id");



CREATE UNIQUE INDEX "whatsapp_groups_company_name_lower_key" ON "public"."whatsapp_groups" USING "btree" ("company_id", "lower"("name"));



CREATE INDEX "whatsapp_inbound_dedup_created_at_idx" ON "public"."whatsapp_inbound_dedup" USING "btree" ("created_at");



CREATE INDEX "whatsapp_scheduled_promos_due_idx" ON "public"."whatsapp_scheduled_promos" USING "btree" ("send_at") WHERE ("sent_at" IS NULL);



CREATE INDEX "whatsapp_scheduled_promos_pending_idx" ON "public"."whatsapp_scheduled_promos" USING "btree" ("send_at") WHERE (("sent_at" IS NULL) AND ("order_id" IS NOT NULL));



CREATE INDEX "whatsapp_sessions_message_status_idx" ON "public"."whatsapp_sessions" USING "btree" ("company", "message_status");



CREATE UNIQUE INDEX "worker_applications_email_unique" ON "public"."worker_applications" USING "btree" ("lower"("btrim"("email"))) WHERE (("email" IS NOT NULL) AND ("btrim"("email") <> ''::"text"));



CREATE INDEX "zone_cities_zone_city_idx" ON "public"."zone_cities" USING "btree" ("zone_id", "city_id");



CREATE INDEX "zones_company_driver_idx" ON "public"."zones" USING "btree" ("company_id", "driver_user_id");



CREATE OR REPLACE TRIGGER "employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "expenses_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "inventory_movements_apply" AFTER INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."inventory_movements_apply_to_balances"();



CREATE OR REPLACE TRIGGER "inventory_movements_set_company" BEFORE INSERT ON "public"."inventory_movements" FOR EACH ROW EXECUTE FUNCTION "public"."inventory_movements_set_company"();



CREATE OR REPLACE TRIGGER "locations_set_updated_at" BEFORE UPDATE ON "public"."locations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payroll_runs_updated_at" BEFORE UPDATE ON "public"."payroll_runs" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payslips_updated_at" BEFORE UPDATE ON "public"."payslips" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "product_location_stocks_set_company" BEFORE INSERT OR UPDATE OF "product_id", "location_id" ON "public"."product_location_stocks" FOR EACH ROW EXECUTE FUNCTION "public"."product_location_stocks_set_company_and_validate"();



CREATE OR REPLACE TRIGGER "product_location_stocks_updated_at" BEFORE UPDATE ON "public"."product_location_stocks" FOR EACH ROW EXECUTE FUNCTION "public"."product_location_stocks_touch_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_invoices_recompute_status_trg" BEFORE INSERT OR UPDATE OF "amount_paid", "amount_due", "total", "due_date", "status" ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."purchase_invoices_recompute_status"();



CREATE OR REPLACE TRIGGER "purchase_invoices_updated_at" BEFORE UPDATE ON "public"."purchase_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."purchase_invoices_set_updated_at"();



CREATE OR REPLACE TRIGGER "purchase_orders_updated_at" BEFORE UPDATE ON "public"."purchase_orders" FOR EACH ROW EXECUTE FUNCTION "public"."purchase_orders_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_whatsapp_bot_items_updated_at" BEFORE UPDATE ON "public"."whatsapp_bot_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_whatsapp_bot_orders_items_updated_at" BEFORE UPDATE ON "public"."whatsapp_bot_orders_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_whatsapp_bot_orders_updated_at" BEFORE UPDATE ON "public"."whatsapp_bot_orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."suppliers_set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_worker_applications_updated_at" BEFORE UPDATE ON "public"."worker_applications" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "tr_worker_monthly_payments_updated_at" BEFORE UPDATE ON "public"."worker_monthly_payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_create_invoice_when_sales_order_paid" AFTER UPDATE OF "payment_status" ON "public"."sales_orders" FOR EACH ROW WHEN ((("old"."payment_status" IS DISTINCT FROM "new"."payment_status") AND ("new"."payment_status" = 'paid'::"public"."sales_order_payment_status"))) EXECUTE FUNCTION "public"."create_invoice_from_paid_sales_order"();



CREATE OR REPLACE TRIGGER "trg_create_invoice_when_sales_order_paid_on_insert" AFTER INSERT ON "public"."sales_orders" FOR EACH ROW WHEN (("new"."payment_status" = 'paid'::"public"."sales_order_payment_status")) EXECUTE FUNCTION "public"."create_invoice_from_paid_sales_order"();



CREATE OR REPLACE TRIGGER "trg_customers_updated" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_delivery_auto_assign_sales_orders_on_update" AFTER UPDATE OF "delivery_date", "driver_user_id" ON "public"."deliveries" FOR EACH ROW WHEN ((("old"."delivery_date" IS DISTINCT FROM "new"."delivery_date") OR ("old"."driver_user_id" IS DISTINCT FROM "new"."driver_user_id"))) EXECUTE FUNCTION "public"."handle_delivery_auto_assign_sales_orders"();



CREATE OR REPLACE TRIGGER "trg_delivery_sales_orders_touch_delivery" AFTER INSERT OR DELETE OR UPDATE ON "public"."delivery_sales_orders" FOR EACH ROW EXECUTE FUNCTION "public"."touch_deliveries_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_preferences_set_user" BEFORE INSERT ON "public"."preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_user_id"();



CREATE OR REPLACE TRIGGER "trg_preferences_updated" BEFORE UPDATE ON "public"."preferences" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_updated" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sales_order_delivered_to_customer" AFTER UPDATE OF "fulfillment_status" ON "public"."sales_orders" FOR EACH ROW WHEN ((("old"."fulfillment_status" IS DISTINCT FROM "new"."fulfillment_status") AND (("new"."fulfillment_status")::"text" = 'delivered to customer'::"text"))) EXECUTE FUNCTION "public"."handle_sales_order_delivered_to_customer"();



CREATE OR REPLACE TRIGGER "trg_sales_order_items_invoice_check" AFTER INSERT ON "public"."sales_order_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_sales_order_item_invoice_check"();



CREATE OR REPLACE TRIGGER "trg_sync_sales_order_delivery_date_when_linked" AFTER INSERT OR UPDATE OF "delivery_id", "sales_order_id", "is_active" ON "public"."delivery_sales_orders" FOR EACH ROW WHEN (("new"."is_active" = true)) EXECUTE FUNCTION "public"."sync_sales_order_delivery_date_when_linked"();



CREATE OR REPLACE TRIGGER "trg_sync_sales_orders_delivery_date_from_delivery" AFTER INSERT OR UPDATE OF "delivery_date" ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"();



CREATE OR REPLACE TRIGGER "trg_upselling_sales_order_delivery_note" AFTER INSERT OR UPDATE OF "fulfillment_status", "delivery_date" ON "public"."sales_orders" FOR EACH ROW WHEN ((("new"."fulfillment_status")::"text" = 'upselling'::"text")) EXECUTE FUNCTION "public"."handle_upselling_sales_order_delivery_note"();



CREATE OR REPLACE TRIGGER "trg_user_settings_updated" BEFORE UPDATE ON "public"."user_settings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "whatsapp_group_customers_company" BEFORE INSERT OR UPDATE OF "whatsapp_group_id", "customer_id" ON "public"."whatsapp_group_customers" FOR EACH ROW EXECUTE FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"();



ALTER TABLE ONLY "public"."cities"
    ADD CONSTRAINT "cities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."city_aliases"
    ADD CONSTRAINT "city_aliases_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."city_match_logs"
    ADD CONSTRAINT "city_match_logs_confirmed_city_id_fkey" FOREIGN KEY ("confirmed_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."city_match_logs"
    ADD CONSTRAINT "city_match_logs_predicted_city_id_fkey" FOREIGN KEY ("predicted_city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."company_roles"("id");



ALTER TABLE ONLY "public"."company_users"
    ADD CONSTRAINT "company_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_invoice_item_id_fkey" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_note_items"
    ADD CONSTRAINT "credit_note_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."credit_notes"
    ADD CONSTRAINT "credit_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_credit_balances"
    ADD CONSTRAINT "customer_credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customer_credit_settlements"
    ADD CONSTRAINT "customer_credit_settlements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."customer_credit_settlements"
    ADD CONSTRAINT "customer_credit_settlements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."customer_credit_settlements"
    ADD CONSTRAINT "customer_credit_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."delivery_driver_settlements"
    ADD CONSTRAINT "delivery_driver_settlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_driver_settlements"
    ADD CONSTRAINT "delivery_driver_settlements_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_driver_settlements"
    ADD CONSTRAINT "delivery_driver_settlements_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."delivery_driver_settlements"
    ADD CONSTRAINT "delivery_driver_settlements_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."delivery_sales_orders"
    ADD CONSTRAINT "delivery_sales_orders_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_sales_orders"
    ADD CONSTRAINT "delivery_sales_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."delivery_upselling_commissions"
    ADD CONSTRAINT "delivery_upselling_commissions_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."driver_credit_balances"
    ADD CONSTRAINT "driver_credit_balances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_credit_balances"
    ADD CONSTRAINT "driver_credit_balances_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_credit_balances"
    ADD CONSTRAINT "driver_credit_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_credit_settlements"
    ADD CONSTRAINT "driver_credit_settlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_credit_settlements"
    ADD CONSTRAINT "driver_credit_settlements_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."driver_credit_settlements"
    ADD CONSTRAINT "driver_credit_settlements_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driver_credit_settlements"
    ADD CONSTRAINT "driver_credit_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_advances"
    ADD CONSTRAINT "employee_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_advances"
    ADD CONSTRAINT "employee_advances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_items"
    ADD CONSTRAINT "expense_items_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "fk_customers_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "fk_employees_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "fk_expenses_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "fk_invoices_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "fk_payroll_runs_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "fk_payslips_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "fk_purchase_invoices_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "fk_purchase_orders_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "fk_quotations_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "fk_sales_orders_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "fk_suppliers_company" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id");



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."inventory_movements"
    ADD CONSTRAINT "inventory_movements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_from_quotation_id_fkey" FOREIGN KEY ("created_from_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_created_from_sales_order_id_fkey" FOREIGN KEY ("created_from_sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."location_drivers"
    ADD CONSTRAINT "location_drivers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_parent_location_id_fkey" FOREIGN KEY ("parent_location_id") REFERENCES "public"."locations"("id");



ALTER TABLE ONLY "public"."locations"
    ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."payroll_runs"
    ADD CONSTRAINT "payroll_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslip_advance_deductions"
    ADD CONSTRAINT "payslip_advance_deductions_advance_id_fkey" FOREIGN KEY ("advance_id") REFERENCES "public"."employee_advances"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslip_advance_deductions"
    ADD CONSTRAINT "payslip_advance_deductions_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payslips"
    ADD CONSTRAINT "payslips_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_features"
    ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."preferences"
    ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_location_stocks"
    ADD CONSTRAINT "product_location_stocks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_location_stocks"
    ADD CONSTRAINT "product_location_stocks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_location_stocks"
    ADD CONSTRAINT "product_location_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_invoice_items"
    ADD CONSTRAINT "purchase_invoice_items_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "public"."purchase_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_created_from_purchase_order_id_fkey" FOREIGN KEY ("created_from_purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_invoices"
    ADD CONSTRAINT "purchase_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."purchase_orders"
    ADD CONSTRAINT "purchase_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotation_items"
    ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "public"."quotations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."quotations"
    ADD CONSTRAINT "quotations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_features"
    ADD CONSTRAINT "role_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_features"
    ADD CONSTRAINT "role_features_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."company_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_order_items"
    ADD CONSTRAINT "sales_order_items_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_active_driver_delivery_id_fkey" FOREIGN KEY ("active_driver_delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_created_from_quotation_id_fkey" FOREIGN KEY ("created_from_quotation_id") REFERENCES "public"."quotations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sales_orders"
    ADD CONSTRAINT "sales_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_bot_item_colors"
    ADD CONSTRAINT "whatsapp_bot_item_colors_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."whatsapp_bot_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_bot_orders"
    ADD CONSTRAINT "whatsapp_bot_orders_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id");



ALTER TABLE ONLY "public"."whatsapp_bot_orders_items"
    ADD CONSTRAINT "whatsapp_bot_orders_items_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "public"."whatsapp_bot_item_colors"("id");



ALTER TABLE ONLY "public"."whatsapp_bot_orders_items"
    ADD CONSTRAINT "whatsapp_bot_orders_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."whatsapp_bot_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_bot_orders_items"
    ADD CONSTRAINT "whatsapp_bot_orders_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."whatsapp_bot_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_catalogue_posts"
    ADD CONSTRAINT "whatsapp_catalogue_posts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_catalogue_posts"
    ADD CONSTRAINT "whatsapp_catalogue_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."whatsapp_group_customers"
    ADD CONSTRAINT "whatsapp_group_customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_group_customers"
    ADD CONSTRAINT "whatsapp_group_customers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_group_customers"
    ADD CONSTRAINT "whatsapp_group_customers_group_id_fkey" FOREIGN KEY ("whatsapp_group_id") REFERENCES "public"."whatsapp_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_groups"
    ADD CONSTRAINT "whatsapp_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."whatsapp_scheduled_promos"
    ADD CONSTRAINT "whatsapp_scheduled_promos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."whatsapp_bot_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_session_cart_items"
    ADD CONSTRAINT "whatsapp_session_cart_items_color_id_fkey" FOREIGN KEY ("color_id") REFERENCES "public"."whatsapp_bot_item_colors"("id");



ALTER TABLE ONLY "public"."whatsapp_session_cart_items"
    ADD CONSTRAINT "whatsapp_session_cart_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."whatsapp_bot_items"("id");



ALTER TABLE ONLY "public"."whatsapp_session_cart_items"
    ADD CONSTRAINT "whatsapp_session_cart_items_session_fkey" FOREIGN KEY ("phone", "company") REFERENCES "public"."whatsapp_sessions"("phone", "company") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_converted_order_id_fkey" FOREIGN KEY ("converted_order_id") REFERENCES "public"."whatsapp_bot_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_draft_order_id_fkey" FOREIGN KEY ("draft_order_id") REFERENCES "public"."whatsapp_bot_orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_selected_item_id_fkey" FOREIGN KEY ("selected_item_id") REFERENCES "public"."whatsapp_bot_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_applications"
    ADD CONSTRAINT "worker_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."worker_monthly_payments"
    ADD CONSTRAINT "worker_monthly_payments_worker_application_id_fkey" FOREIGN KEY ("worker_application_id") REFERENCES "public"."worker_applications"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_cities"
    ADD CONSTRAINT "zone_cities_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_driver_user_id_fkey" FOREIGN KEY ("driver_user_id") REFERENCES "auth"."users"("id");



CREATE POLICY "Allow delete role_features" ON "public"."role_features" FOR DELETE USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow insert role_features" ON "public"."role_features" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow public read access" ON "public"."whatsapp_bot_item_colors" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access" ON "public"."whatsapp_bot_items" FOR SELECT TO "authenticated", "anon" USING (("company" = 'sodamax'::"text"));



CREATE POLICY "Allow read role_features" ON "public"."role_features" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow read role_features" ON "public"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "Allow update role_features" ON "public"."role_features" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can delete own expenses" ON "public"."expenses" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own expenses" ON "public"."expenses" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own employee advances" ON "public"."employee_advances" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own employees" ON "public"."employees" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own payroll runs" ON "public"."payroll_runs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage payslip advance deductions" ON "public"."payslip_advance_deductions" USING ((EXISTS ( SELECT 1
   FROM ("public"."payslips" "p"
     JOIN "public"."payroll_runs" "pr" ON (("pr"."id" = "p"."payroll_run_id")))
  WHERE (("p"."id" = "payslip_advance_deductions"."payslip_id") AND ("pr"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own expenses" ON "public"."expenses" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own expenses" ON "public"."expenses" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view payslips via payroll" ON "public"."payslips" USING ((EXISTS ( SELECT 1
   FROM "public"."payroll_runs" "pr"
  WHERE (("pr"."id" = "payslips"."payroll_run_id") AND ("pr"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cities" ON "public"."cities" USING (true) WITH CHECK (true);



ALTER TABLE "public"."city_aliases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."city_match_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_authenticated_delete" ON "public"."companies" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "companies_authenticated_insert" ON "public"."companies" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "companies_authenticated_select" ON "public"."companies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "companies_authenticated_update" ON "public"."companies" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."company_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_roles_authenticated_delete" ON "public"."company_roles" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "company_roles_authenticated_insert" ON "public"."company_roles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "company_roles_authenticated_select" ON "public"."company_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "company_roles_authenticated_update" ON "public"."company_roles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."company_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_users_authenticated_delete" ON "public"."company_users" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "company_users_authenticated_insert" ON "public"."company_users" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "company_users_authenticated_select" ON "public"."company_users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "company_users_authenticated_update" ON "public"."company_users" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."credit_note_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_note_items_delete_member" ON "public"."credit_note_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."credit_notes" "cn"
  WHERE (("cn"."id" = "credit_note_items"."credit_note_id") AND (("cn"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("cn"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "credit_note_items_insert_member" ON "public"."credit_note_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."credit_notes" "cn"
  WHERE (("cn"."id" = "credit_note_items"."credit_note_id") AND (("cn"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("cn"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "credit_note_items_select_member" ON "public"."credit_note_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."credit_notes" "cn"
  WHERE (("cn"."id" = "credit_note_items"."credit_note_id") AND (("cn"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("cn"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "credit_note_items_update_member" ON "public"."credit_note_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."credit_notes" "cn"
  WHERE (("cn"."id" = "credit_note_items"."credit_note_id") AND (("cn"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("cn"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_notes_delete_member" ON "public"."credit_notes" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "credit_notes_insert_member" ON "public"."credit_notes" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "credit_notes_select_member" ON "public"."credit_notes" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "credit_notes_update_member" ON "public"."credit_notes" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."customer_credit_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_credit_settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_delete_member" ON "public"."customers" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "customers_insert_member" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "customers_select_member" ON "public"."customers" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "customers_update_member" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids"))) WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deliveries_delete_member" ON "public"."deliveries" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "deliveries_insert_member" ON "public"."deliveries" FOR INSERT TO "authenticated" WITH CHECK (((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) AND ("created_by" = "auth"."uid"()) AND ((EXISTS ( SELECT 1
   FROM "public"."company_users" "d"
  WHERE (("d"."company_id" = "d"."company_id") AND ("d"."user_id" = "deliveries"."driver_user_id") AND ("d"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."companies" "o"
  WHERE (("o"."id" = "deliveries"."company_id") AND ("o"."owner_user_id" = "deliveries"."driver_user_id") AND ("o"."is_active" = true)))))));



CREATE POLICY "deliveries_select_member" ON "public"."deliveries" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "deliveries_update_member" ON "public"."deliveries" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."delivery_driver_settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_driver_settlements_delete_member" ON "public"."delivery_driver_settlements" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "delivery_driver_settlements_insert_member" ON "public"."delivery_driver_settlements" FOR INSERT TO "authenticated" WITH CHECK (((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) AND ("recorded_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."deliveries" "d"
  WHERE (("d"."id" = "delivery_driver_settlements"."delivery_id") AND ("d"."company_id" = "d"."company_id") AND ("d"."driver_user_id" = "d"."driver_user_id"))))));



CREATE POLICY "delivery_driver_settlements_select_member" ON "public"."delivery_driver_settlements" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "delivery_driver_settlements_update_member" ON "public"."delivery_driver_settlements" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."delivery_sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery_sales_orders_delete_member" ON "public"."delivery_sales_orders" FOR DELETE TO "authenticated" USING (("delivery_id" IN ( SELECT "d"."id"
   FROM "public"."deliveries" "d"
  WHERE (("d"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("d"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))));



CREATE POLICY "delivery_sales_orders_insert_member" ON "public"."delivery_sales_orders" FOR INSERT TO "authenticated" WITH CHECK (("delivery_id" IN ( SELECT "d"."id"
   FROM "public"."deliveries" "d"
  WHERE (("d"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("d"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))));



CREATE POLICY "delivery_sales_orders_select_member" ON "public"."delivery_sales_orders" FOR SELECT TO "authenticated" USING (("delivery_id" IN ( SELECT "d"."id"
   FROM "public"."deliveries" "d"
  WHERE (("d"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("d"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))));



CREATE POLICY "delivery_sales_orders_update_member" ON "public"."delivery_sales_orders" FOR UPDATE TO "authenticated" USING (("delivery_id" IN ( SELECT "d"."id"
   FROM "public"."deliveries" "d"
  WHERE (("d"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("d"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))) WITH CHECK (("delivery_id" IN ( SELECT "d"."id"
   FROM "public"."deliveries" "d"
  WHERE (("d"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("d"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))));



ALTER TABLE "public"."delivery_upselling_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driver_credit_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "driver_credit_balances_insert_member" ON "public"."driver_credit_balances" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))));



CREATE POLICY "driver_credit_balances_select_member" ON "public"."driver_credit_balances" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "driver_credit_balances_update_member" ON "public"."driver_credit_balances" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."driver_credit_settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "driver_credit_settlements_insert_member" ON "public"."driver_credit_settlements" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))));



CREATE POLICY "driver_credit_settlements_select_member" ON "public"."driver_credit_settlements" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."employee_advances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_delete_member" ON "public"."expenses" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "expenses_insert_member" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "expenses_select_member" ON "public"."expenses" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "expenses_update_member" ON "public"."expenses" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids"))) WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



ALTER TABLE "public"."features" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "features_authenticated_delete" ON "public"."features" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "features_authenticated_insert" ON "public"."features" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "features_authenticated_select" ON "public"."features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "features_authenticated_update" ON "public"."features" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."inventory_movements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_movements_insert_member" ON "public"."inventory_movements" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "inventory_movements"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "inventory_movements_select_member" ON "public"."inventory_movements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "inventory_movements"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoice_items_delete_member" ON "public"."invoice_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND (("inv"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("inv"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "invoice_items_insert_member" ON "public"."invoice_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND (("inv"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("inv"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "invoice_items_select_member" ON "public"."invoice_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND (("inv"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("inv"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "invoice_items_update_member" ON "public"."invoice_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND (("inv"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("inv"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."invoices" "inv"
  WHERE (("inv"."id" = "invoice_items"."invoice_id") AND (("inv"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("inv"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_delete_member" ON "public"."invoices" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "invoices_insert_member" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "invoices_select_member" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "invoices_update_member" ON "public"."invoices" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



ALTER TABLE "public"."location_drivers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "location_drivers" ON "public"."location_drivers" USING (true) WITH CHECK (true);



ALTER TABLE "public"."locations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "locations_delete_member" ON "public"."locations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "locations"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "locations_insert_member" ON "public"."locations" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "locations"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "locations_select_member" ON "public"."locations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "locations"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "locations_update_member" ON "public"."locations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "locations"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "locations"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."payroll_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payslip_advance_deductions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payslips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_features" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_features_authenticated_delete" ON "public"."plan_features" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "plan_features_authenticated_insert" ON "public"."plan_features" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "plan_features_authenticated_select" ON "public"."plan_features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "plan_features_authenticated_update" ON "public"."plan_features" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plans_authenticated_delete" ON "public"."plans" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "plans_authenticated_insert" ON "public"."plans" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "plans_authenticated_select" ON "public"."plans" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "plans_authenticated_update" ON "public"."plans" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "preferences_select_own" ON "public"."preferences" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "preferences_upsert_own" ON "public"."preferences" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."product_location_stocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_location_stocks_delete_member" ON "public"."product_location_stocks" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "product_location_stocks"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "product_location_stocks_insert_member" ON "public"."product_location_stocks" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "product_location_stocks"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "product_location_stocks_select_member" ON "public"."product_location_stocks" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "product_location_stocks"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "product_location_stocks_update_member" ON "public"."product_location_stocks" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "product_location_stocks"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "product_location_stocks"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products" ON "public"."products" USING (true) WITH CHECK (true);



CREATE POLICY "products_delete_member" ON "public"."products" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "products_insert_member" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "products_select_member" ON "public"."products" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "products_update_member" ON "public"."products" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids"))) WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_authenticated_delete" ON "public"."profiles" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "profiles_authenticated_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "profiles_authenticated_select" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "profiles_authenticated_update" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_upsert_own" ON "public"."profiles" TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."purchase_invoice_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_invoice_items_delete_own" ON "public"."purchase_invoice_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND ("pi"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_invoice_items_insert_own" ON "public"."purchase_invoice_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND ("pi"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_invoice_items_select_own" ON "public"."purchase_invoice_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND ("pi"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_invoice_items_update_own" ON "public"."purchase_invoice_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_invoices" "pi"
  WHERE (("pi"."id" = "purchase_invoice_items"."purchase_invoice_id") AND ("pi"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."purchase_invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_invoices_delete_own" ON "public"."purchase_invoices" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_invoices_insert_own" ON "public"."purchase_invoices" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_invoices_select_own" ON "public"."purchase_invoices" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_invoices_update_own" ON "public"."purchase_invoices" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."purchase_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_order_items_delete_own" ON "public"."purchase_order_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."purchase_order_id") AND ("po"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_order_items_insert_own" ON "public"."purchase_order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."purchase_order_id") AND ("po"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_order_items_select_own" ON "public"."purchase_order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."purchase_order_id") AND ("po"."user_id" = "auth"."uid"())))));



CREATE POLICY "purchase_order_items_update_own" ON "public"."purchase_order_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."purchase_orders" "po"
  WHERE (("po"."id" = "purchase_order_items"."purchase_order_id") AND ("po"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."purchase_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "purchase_orders_delete_own" ON "public"."purchase_orders" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_orders_insert_own" ON "public"."purchase_orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_orders_select_own" ON "public"."purchase_orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "purchase_orders_update_own" ON "public"."purchase_orders" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."quotation_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotation_items_delete_own" ON "public"."quotation_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."quotations" "q"
  WHERE (("q"."id" = "quotation_items"."quotation_id") AND ("q"."user_id" = "auth"."uid"())))));



CREATE POLICY "quotation_items_insert_own" ON "public"."quotation_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."quotations" "q"
  WHERE (("q"."id" = "quotation_items"."quotation_id") AND ("q"."user_id" = "auth"."uid"())))));



CREATE POLICY "quotation_items_select_own" ON "public"."quotation_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."quotations" "q"
  WHERE (("q"."id" = "quotation_items"."quotation_id") AND ("q"."user_id" = "auth"."uid"())))));



CREATE POLICY "quotation_items_update_own" ON "public"."quotation_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."quotations" "q"
  WHERE (("q"."id" = "quotation_items"."quotation_id") AND ("q"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."quotations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotations_delete_own" ON "public"."quotations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "quotations_insert_own" ON "public"."quotations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "quotations_select_own" ON "public"."quotations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "quotations_update_own" ON "public"."quotations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."role_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sales_order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_order_items_delete_member" ON "public"."sales_order_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."sales_order_id") AND (("so"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("so"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "sales_order_items_insert_member" ON "public"."sales_order_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."sales_order_id") AND (("so"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("so"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "sales_order_items_select_member" ON "public"."sales_order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."sales_order_id") AND (("so"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("so"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



CREATE POLICY "sales_order_items_update_member" ON "public"."sales_order_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."sales_order_id") AND (("so"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("so"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."sales_orders" "so"
  WHERE (("so"."id" = "sales_order_items"."sales_order_id") AND (("so"."company_id" IN ( SELECT "c"."id"
           FROM "public"."companies" "c"
          WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("so"."company_id" IN ( SELECT "cu"."company_id"
           FROM "public"."company_users" "cu"
          WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))))));



ALTER TABLE "public"."sales_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sales_orders_delete_member" ON "public"."sales_orders" FOR DELETE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "sales_orders_insert_member" ON "public"."sales_orders" FOR INSERT TO "authenticated" WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "sales_orders_select_member" ON "public"."sales_orders" FOR SELECT TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "sales_orders_update_member" ON "public"."sales_orders" FOR UPDATE TO "authenticated" USING ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))))) WITH CHECK ((("company_id" IN ( SELECT "c"."id"
   FROM "public"."companies" "c"
  WHERE (("c"."owner_user_id" = "auth"."uid"()) AND ("c"."is_active" = true)))) OR ("company_id" IN ( SELECT "cu"."company_id"
   FROM "public"."company_users" "cu"
  WHERE (("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "settings_select_own" ON "public"."user_settings" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "settings_upsert_own" ON "public"."user_settings" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "suppliers_delete_member" ON "public"."suppliers" FOR DELETE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "suppliers_delete_own" ON "public"."suppliers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "suppliers_insert_member" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "suppliers_insert_own" ON "public"."suppliers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "suppliers_select_member" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "suppliers_select_own" ON "public"."suppliers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "suppliers_update_member" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids"))) WITH CHECK (("company_id" IN ( SELECT "public"."company_member_company_ids"() AS "company_member_company_ids")));



CREATE POLICY "suppliers_update_own" ON "public"."suppliers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_ad_click_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_ad_referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_bot_item_colors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_bot_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_bot_items" ON "public"."whatsapp_bot_items" USING (true) WITH CHECK (true);



ALTER TABLE "public"."whatsapp_bot_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_bot_orders_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_catalogue_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_catalogue_posts_delete_member" ON "public"."whatsapp_catalogue_posts" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_catalogue_posts"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_catalogue_posts_insert_member" ON "public"."whatsapp_catalogue_posts" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_catalogue_posts"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "whatsapp_catalogue_posts_select_member" ON "public"."whatsapp_catalogue_posts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_catalogue_posts"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_catalogue_posts_update_member" ON "public"."whatsapp_catalogue_posts" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_catalogue_posts"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_catalogue_posts"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."whatsapp_group_customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_group_customers_delete_member" ON "public"."whatsapp_group_customers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_group_customers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_group_customers_insert_member" ON "public"."whatsapp_group_customers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_group_customers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_group_customers_select_member" ON "public"."whatsapp_group_customers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_group_customers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_group_customers_update_member" ON "public"."whatsapp_group_customers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_group_customers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_group_customers"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."whatsapp_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_groups_delete_member" ON "public"."whatsapp_groups" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_groups"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_groups_insert_member" ON "public"."whatsapp_groups" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_groups"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))));



CREATE POLICY "whatsapp_groups_select_member" ON "public"."whatsapp_groups" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_groups"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



CREATE POLICY "whatsapp_groups_update_member" ON "public"."whatsapp_groups" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_groups"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."company_users" "cu"
  WHERE (("cu"."company_id" = "whatsapp_groups"."company_id") AND ("cu"."user_id" = "auth"."uid"()) AND ("cu"."is_active" = true)))));



ALTER TABLE "public"."whatsapp_inbound_dedup" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_scheduled_promos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_session_cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."worker_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "worker_applications_delete_anon_backoffice" ON "public"."worker_applications" FOR DELETE TO "anon" USING (true);



CREATE POLICY "worker_applications_insert_public" ON "public"."worker_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("user_id" IS NULL) OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "worker_applications_select_anon_backoffice" ON "public"."worker_applications" FOR SELECT TO "anon" USING (true);



CREATE POLICY "worker_applications_select_public_or_own" ON "public"."worker_applications" FOR SELECT TO "authenticated", "anon" USING ((("profile_status" = 'active'::"public"."worker_profile_status") OR (("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "worker_applications_update_anon_backoffice" ON "public"."worker_applications" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "worker_applications_update_own" ON "public"."worker_applications" FOR UPDATE TO "authenticated" USING ((("user_id" IS NOT NULL) AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."worker_monthly_payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "worker_monthly_payments_delete_anon" ON "public"."worker_monthly_payments" FOR DELETE TO "anon" USING (true);



CREATE POLICY "worker_monthly_payments_insert_anon" ON "public"."worker_monthly_payments" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "worker_monthly_payments_select_anon" ON "public"."worker_monthly_payments" FOR SELECT TO "anon" USING (true);



CREATE POLICY "worker_monthly_payments_update_anon" ON "public"."worker_monthly_payments" FOR UPDATE TO "anon" USING (true) WITH CHECK (true);



ALTER TABLE "public"."zone_cities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zone_cities" ON "public"."zone_cities" USING (true) WITH CHECK (true);



ALTER TABLE "public"."zones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zones" ON "public"."zones" USING (true) WITH CHECK (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_mobile_user_in_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_update_sales_order_fulfillment_for_company_internal"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assert_company_member"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assert_company_member"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assert_company_member"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_company_member"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."company_member_company_ids"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."company_member_company_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."company_member_company_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."company_member_company_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_address"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_both"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_sales_orders_missing_city"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text", "p_phone" "text", "p_billing_contact_name" "text", "p_billing_contact_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text", "p_phone" "text", "p_billing_contact_name" "text", "p_billing_contact_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text", "p_phone" "text", "p_billing_contact_name" "text", "p_billing_contact_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_credit_note"("p_credit_note" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_credit_note"("p_credit_note" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_credit_note"("p_credit_note" "jsonb", "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice"("p_customer_id" "uuid", "p_issue_date" "date", "p_due_date" "date", "p_items" "public"."invoice_item_input"[], "p_discount_type" "text", "p_discount_amount" numeric, "p_shipping_amount" numeric, "p_notes" "text", "p_terms" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice"("p_customer_id" "uuid", "p_issue_date" "date", "p_due_date" "date", "p_items" "public"."invoice_item_input"[], "p_discount_type" "text", "p_discount_amount" numeric, "p_shipping_amount" numeric, "p_notes" "text", "p_terms" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice"("p_customer_id" "uuid", "p_issue_date" "date", "p_due_date" "date", "p_items" "public"."invoice_item_input"[], "p_discount_type" "text", "p_discount_amount" numeric, "p_shipping_amount" numeric, "p_notes" "text", "p_terms" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invoice_from_paid_sales_order"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_invoice_from_paid_sales_order"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invoice_from_paid_sales_order"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_purchase_invoice"("p_invoice" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_purchase_order"("p_purchase_order" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quotation"("p_quotation" "jsonb", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_sales_order"("p_sales_order" "jsonb", "p_items" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_fulfillment_status" "text", "p_payment_status" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_fulfillment_status" "text", "p_payment_status" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_fulfillment_status" "text", "p_payment_status" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_fulfillment_status" "text", "p_payment_status" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_credit_note"("p_credit_note_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_credit_note"("p_credit_note_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_credit_note"("p_credit_note_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_credit_note_nav_facets"("p_company_id" "uuid", "p_month_start" "date", "p_quarter_start" "date", "p_year_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_note_nav_facets"("p_company_id" "uuid", "p_month_start" "date", "p_quarter_start" "date", "p_year_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_note_nav_facets"("p_company_id" "uuid", "p_month_start" "date", "p_quarter_start" "date", "p_year_start" "date") TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_customer_for_company"("p_company_id" "uuid", "p_customer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_invoice_pivot_data"("p_company_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_plans"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_plans"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_plans"() TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sales_order_list_facets"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sales_order_list_facets"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sales_order_list_facets"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_zone_city_sort_for_driver"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sales_order_delivered_to_customer"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sales_order_delivered_to_customer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sales_order_delivered_to_customer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_sales_order_item_invoice_check"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_sales_order_item_invoice_check"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_sales_order_item_invoice_check"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_upselling_sales_order_delivery_note"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_upselling_sales_order_delivery_note"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_upselling_sales_order_delivery_note"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inventory_movements_apply_to_balances"() TO "anon";
GRANT ALL ON FUNCTION "public"."inventory_movements_apply_to_balances"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."inventory_movements_apply_to_balances"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inventory_movements_set_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."inventory_movements_set_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."inventory_movements_set_company"() TO "service_role";



GRANT ALL ON FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_creditable_invoices"("p_company_id" "uuid", "p_customer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_creditable_invoices"("p_company_id" "uuid", "p_customer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_creditable_invoices"("p_company_id" "uuid", "p_customer_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_customers_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_driver_delivery_note_orders_for_company_view"("p_company_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_driver_location_products"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_driver_stock_location_ids_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_driver_upselling_products_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_location_ids_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_primary_warehouse_products"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_products_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_products_for_company_at_locations"("p_company_id" "uuid", "p_location_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_orders" TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text", "p_fulfillment_status" "text", "p_limit" integer, "p_offset" integer, "p_user_id" "uuid", "p_exclude_fulfillment_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text", "p_fulfillment_status" "text", "p_limit" integer, "p_offset" integer, "p_user_id" "uuid", "p_exclude_fulfillment_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text", "p_fulfillment_status" "text", "p_limit" integer, "p_offset" integer, "p_user_id" "uuid", "p_exclude_fulfillment_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_company_view"("p_company_id" "uuid", "p_status" "text", "p_fulfillment_status" "text", "p_limit" integer, "p_offset" integer, "p_user_id" "uuid", "p_exclude_fulfillment_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_item_pivot"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_sales_orders_for_report"("p_company_id" "uuid", "p_from_date" "date", "p_to_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_staff_products_for_company"("p_company_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_wholesale_order_products_for_company"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."location_type_enum_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."location_type_enum_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."location_type_enum_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_city_text"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_city_text"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_city_text"("input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."post_credit_note"("p_credit_note_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."post_credit_note"("p_credit_note_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_credit_note"("p_credit_note_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."product_location_stocks_set_company_and_validate"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_location_stocks_set_company_and_validate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_location_stocks_set_company_and_validate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."product_location_stocks_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."product_location_stocks_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."product_location_stocks_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purchase_invoices_recompute_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_invoices_recompute_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_invoices_recompute_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purchase_invoices_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_invoices_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_invoices_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purchase_orders_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."purchase_orders_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purchase_orders_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_purchase_invoice_overdue_statuses"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text", "p_remove_from_current_delivery" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text", "p_remove_from_current_delivery" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text", "p_remove_from_current_delivery" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_order_fulfillment_status_enum_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_order_fulfillment_status_enum_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_order_fulfillment_status_enum_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_order_ids_missing_address"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sales_order_payment_status_enum_values"() TO "anon";
GRANT ALL ON FUNCTION "public"."sales_order_payment_status_enum_values"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sales_order_payment_status_enum_values"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."suppliers_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."suppliers_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."suppliers_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_sales_orders_delivery_date_from_delivery"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_deliveries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_deliveries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_deliveries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent"("regdictionary", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_init"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric, "p_city_id" "uuid", "p_delivery_date" "date", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sales_order_fulfillment_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_fulfillment_status" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sales_order_notes_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_company_member"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"() TO "anon";
GRANT ALL ON FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."whatsapp_group_customers_set_and_validate_company"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."cities" TO "anon";
GRANT ALL ON TABLE "public"."cities" TO "authenticated";
GRANT ALL ON TABLE "public"."cities" TO "service_role";



GRANT ALL ON TABLE "public"."city_aliases" TO "anon";
GRANT ALL ON TABLE "public"."city_aliases" TO "authenticated";
GRANT ALL ON TABLE "public"."city_aliases" TO "service_role";



GRANT ALL ON TABLE "public"."city_match_logs" TO "anon";
GRANT ALL ON TABLE "public"."city_match_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."city_match_logs" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_roles" TO "anon";
GRANT ALL ON TABLE "public"."company_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_roles" TO "service_role";



GRANT ALL ON TABLE "public"."company_users" TO "anon";
GRANT ALL ON TABLE "public"."company_users" TO "authenticated";
GRANT ALL ON TABLE "public"."company_users" TO "service_role";



GRANT ALL ON TABLE "public"."credit_note_items" TO "anon";
GRANT ALL ON TABLE "public"."credit_note_items" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_note_items" TO "service_role";



GRANT ALL ON TABLE "public"."credit_notes" TO "anon";
GRANT ALL ON TABLE "public"."credit_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_notes" TO "service_role";



GRANT ALL ON TABLE "public"."customer_credit_balances" TO "anon";
GRANT ALL ON TABLE "public"."customer_credit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_credit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."customer_credit_settlements" TO "anon";
GRANT ALL ON TABLE "public"."customer_credit_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_credit_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries" TO "anon";
GRANT ALL ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_driver_settlements" TO "anon";
GRANT ALL ON TABLE "public"."delivery_driver_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_driver_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_sales_orders" TO "anon";
GRANT ALL ON TABLE "public"."delivery_sales_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_sales_orders" TO "service_role";



GRANT ALL ON TABLE "public"."delivery_upselling_commissions" TO "anon";
GRANT ALL ON TABLE "public"."delivery_upselling_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_upselling_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."driver_credit_balances" TO "anon";
GRANT ALL ON TABLE "public"."driver_credit_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_credit_balances" TO "service_role";



GRANT ALL ON TABLE "public"."driver_credit_settlements" TO "anon";
GRANT ALL ON TABLE "public"."driver_credit_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."driver_credit_settlements" TO "service_role";



GRANT ALL ON TABLE "public"."employee_advances" TO "anon";
GRANT ALL ON TABLE "public"."employee_advances" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_advances" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."expense_items" TO "anon";
GRANT ALL ON TABLE "public"."expense_items" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_items" TO "service_role";



GRANT ALL ON TABLE "public"."expenses" TO "anon";
GRANT ALL ON TABLE "public"."expenses" TO "authenticated";
GRANT ALL ON TABLE "public"."expenses" TO "service_role";



GRANT ALL ON TABLE "public"."features" TO "anon";
GRANT ALL ON TABLE "public"."features" TO "authenticated";
GRANT ALL ON TABLE "public"."features" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_movements" TO "anon";
GRANT ALL ON TABLE "public"."inventory_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_movements" TO "service_role";



GRANT ALL ON TABLE "public"."locations" TO "anon";
GRANT ALL ON TABLE "public"."locations" TO "authenticated";
GRANT ALL ON TABLE "public"."locations" TO "service_role";



GRANT ALL ON TABLE "public"."product_location_stocks" TO "anon";
GRANT ALL ON TABLE "public"."product_location_stocks" TO "authenticated";
GRANT ALL ON TABLE "public"."product_location_stocks" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_stock_by_location" TO "anon";
GRANT ALL ON TABLE "public"."inventory_stock_by_location" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_stock_by_location" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."invoices_list" TO "anon";
GRANT ALL ON TABLE "public"."invoices_list" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices_list" TO "service_role";



GRANT ALL ON TABLE "public"."location_drivers" TO "anon";
GRANT ALL ON TABLE "public"."location_drivers" TO "authenticated";
GRANT ALL ON TABLE "public"."location_drivers" TO "service_role";



GRANT ALL ON TABLE "public"."payroll_runs" TO "anon";
GRANT ALL ON TABLE "public"."payroll_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll_runs" TO "service_role";



GRANT ALL ON TABLE "public"."payslip_advance_deductions" TO "anon";
GRANT ALL ON TABLE "public"."payslip_advance_deductions" TO "authenticated";
GRANT ALL ON TABLE "public"."payslip_advance_deductions" TO "service_role";



GRANT ALL ON TABLE "public"."payslips" TO "anon";
GRANT ALL ON TABLE "public"."payslips" TO "authenticated";
GRANT ALL ON TABLE "public"."payslips" TO "service_role";



GRANT ALL ON TABLE "public"."plan_features" TO "anon";
GRANT ALL ON TABLE "public"."plan_features" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_features" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."preferences" TO "anon";
GRANT ALL ON TABLE "public"."preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."preferences" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_invoices" TO "anon";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_order_items" TO "anon";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."purchase_orders" TO "anon";
GRANT ALL ON TABLE "public"."purchase_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."purchase_orders" TO "service_role";



GRANT ALL ON TABLE "public"."quotation_items" TO "anon";
GRANT ALL ON TABLE "public"."quotation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."quotation_items" TO "service_role";



GRANT ALL ON TABLE "public"."quotations" TO "anon";
GRANT ALL ON TABLE "public"."quotations" TO "authenticated";
GRANT ALL ON TABLE "public"."quotations" TO "service_role";



GRANT ALL ON TABLE "public"."role_features" TO "anon";
GRANT ALL ON TABLE "public"."role_features" TO "authenticated";
GRANT ALL ON TABLE "public"."role_features" TO "service_role";



GRANT ALL ON TABLE "public"."sales_order_items" TO "anon";
GRANT ALL ON TABLE "public"."sales_order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_order_items" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_ad_click_stats" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_ad_click_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_ad_click_stats" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_ad_referrals" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_ad_referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_ad_referrals" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_bot_item_colors" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_bot_item_colors" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_bot_item_colors" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_bot_items" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_bot_items" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_bot_items" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_bot_orders" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_bot_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_bot_orders" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_bot_orders_items" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_bot_orders_items" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_bot_orders_items" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_catalogue_posts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_catalogue_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_catalogue_posts" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_group_customers" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_group_customers" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_group_customers" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_groups" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_groups" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_inbound_dedup" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_inbound_dedup" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_inbound_dedup" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_scheduled_promos" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_scheduled_promos" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_scheduled_promos" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_session_cart_items" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_session_cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_session_cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."worker_applications" TO "anon";
GRANT ALL ON TABLE "public"."worker_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_applications" TO "service_role";



GRANT ALL ON TABLE "public"."worker_monthly_payments" TO "anon";
GRANT ALL ON TABLE "public"."worker_monthly_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."worker_monthly_payments" TO "service_role";



GRANT ALL ON TABLE "public"."zone_cities" TO "anon";
GRANT ALL ON TABLE "public"."zone_cities" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_cities" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































