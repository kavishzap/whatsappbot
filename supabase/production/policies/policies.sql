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
