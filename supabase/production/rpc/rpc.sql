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
CREATE OR REPLACE FUNCTION "public"."assert_company_member"("p_company_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NOT public.user_is_company_member(p_company_id) THEN
    RAISE EXCEPTION 'forbidden: not a member of this company'
      USING ERRCODE = '42501';
CREATE OR REPLACE FUNCTION "public"."assign_sales_orders_to_delivery_by_date"("p_delivery_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
CREATE OR REPLACE FUNCTION "public"."assign_upselling_sales_order_to_delivery_note"("p_sales_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_so public.sales_orders%ROWTYPE;
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
CREATE OR REPLACE FUNCTION "public"."create_company"("p_owner_user_id" "uuid", "p_name" "text", "p_plan_id" "uuid", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_billing_contact_name" "text" DEFAULT NULL::"text", "p_billing_contact_email" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_company_id uuid;
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
CREATE OR REPLACE FUNCTION "public"."create_invoice_from_paid_sales_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.payment_status::text <> 'paid' THEN
    RETURN NEW;
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
CREATE OR REPLACE FUNCTION "public"."create_sales_order_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric DEFAULT 0, "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_delivery_date" "date" DEFAULT NULL::"date", "p_fulfillment_status" "text" DEFAULT 'new'::"text", "p_payment_status" "text" DEFAULT 'unpaid'::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id          uuid := auth.uid();
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
CREATE OR REPLACE FUNCTION "public"."generate_invoice_from_paid_sales_order"("p_sales_order_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_so public.sales_orders%ROWTYPE;
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
CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_company_id" "uuid", "p_year" integer) RETURNS json
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.assert_company_member(p_company_id);
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
CREATE OR REPLACE FUNCTION "public"."get_staff_product_for_company"("p_company_id" "uuid", "p_product_id" "uuid") RETURNS TABLE("id" "uuid", "company_id" "uuid", "name" "text", "sku" "text", "unit" "text", "sale_price" numeric, "currency" "text", "description" "text", "is_active" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "total_quantity" numeric, "stock_locations" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.list_staff_products_for_company(p_company_id) p
  WHERE p.id = p_product_id
  LIMIT 1;
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
CREATE OR REPLACE FUNCTION "public"."handle_delivery_auto_assign_sales_orders"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.delivery_date is not null
     and new.driver_user_id is not null then
    perform public.assign_sales_orders_to_delivery_by_date(new.id);
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
CREATE OR REPLACE FUNCTION "public"."handle_sales_order_delivered_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery_id uuid;
CREATE OR REPLACE FUNCTION "public"."handle_sales_order_item_invoice_check"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Existing invoice generation for paid sales orders
  PERFORM public.generate_invoice_from_paid_sales_order(NEW.sales_order_id);
CREATE OR REPLACE FUNCTION "public"."handle_upselling_sales_order_delivery_note"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.fulfillment_status::text = 'upselling' THEN
    PERFORM public.assign_upselling_sales_order_to_delivery_note(NEW.id);
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
CREATE OR REPLACE FUNCTION "public"."invoice_posted_credit_total"("p_invoice_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COALESCE(sum(cn.total), 0)::numeric
  FROM public.credit_notes cn
  WHERE cn.related_invoice_id = p_invoice_id
    AND cn.status = 'posted'::public.credit_note_status;
$$;
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
CREATE OR REPLACE FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
CREATE OR REPLACE FUNCTION "public"."mark_delivery_delivered_to_driver"("p_delivery_id" "uuid", "p_user_id" "uuid", "p_transfer_stock" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_delivery public.deliveries%rowtype;
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
CREATE OR REPLACE FUNCTION "public"."product_location_stocks_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
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
CREATE OR REPLACE FUNCTION "public"."purchase_invoices_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."purchase_orders_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
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
CREATE OR REPLACE FUNCTION "public"."reschedule_sales_order_from_mobile"("p_sales_order_id" "uuid", "p_new_delivery_date" "date", "p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_remove_from_current_delivery" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_sales_order public.sales_orders%rowtype;
CREATE OR REPLACE FUNCTION "public"."return_driver_stock_to_warehouse"("p_driver_user_id" "uuid", "p_product_id" "uuid", "p_quantity" numeric, "p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_company_id uuid;
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
CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
CREATE OR REPLACE FUNCTION "public"."set_user_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end$$;
CREATE OR REPLACE FUNCTION "public"."stock_out_upselling_sales_order_item"("p_sales_order_item_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_soi public.sales_order_items%ROWTYPE;
CREATE OR REPLACE FUNCTION "public"."suppliers_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."sync_sales_order_delivery_date_when_linked"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_delivery_date date;
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
CREATE OR REPLACE FUNCTION "public"."update_customer_map_location_for_company"("p_company_id" "uuid", "p_customer_id" "uuid", "p_map_location" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF p_map_location IS NULL OR TRIM(p_map_location) = '' THEN
    RETURN false;
CREATE OR REPLACE FUNCTION "public"."update_sales_order_for_company"("p_company_id" "uuid", "p_sales_order_id" "uuid", "p_customer_id" "uuid", "p_currency" "text", "p_address" "text", "p_phone" "text", "p_items" "jsonb", "p_discount_amount" numeric DEFAULT 0, "p_city_id" "uuid" DEFAULT NULL::"uuid", "p_delivery_date" "date" DEFAULT NULL::"date", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id          uuid := auth.uid();
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
