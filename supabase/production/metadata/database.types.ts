export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          region: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      city_aliases: {
        Row: {
          alias: string
          city_id: string
          created_at: string | null
          id: string
          normalized_alias: string
          source: string | null
        }
        Insert: {
          alias: string
          city_id: string
          created_at?: string | null
          id?: string
          normalized_alias: string
          source?: string | null
        }
        Update: {
          alias?: string
          city_id?: string
          created_at?: string | null
          id?: string
          normalized_alias?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_aliases_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      city_match_logs: {
        Row: {
          confirmed_city_id: string | null
          created_at: string | null
          id: string
          normalized_address: string | null
          predicted_city_id: string | null
          predicted_score: number | null
          raw_address: string
          was_correct: boolean | null
          whatsapp_user_id: string | null
        }
        Insert: {
          confirmed_city_id?: string | null
          created_at?: string | null
          id?: string
          normalized_address?: string | null
          predicted_city_id?: string | null
          predicted_score?: number | null
          raw_address: string
          was_correct?: boolean | null
          whatsapp_user_id?: string | null
        }
        Update: {
          confirmed_city_id?: string | null
          created_at?: string | null
          id?: string
          normalized_address?: string | null
          predicted_city_id?: string | null
          predicted_score?: number | null
          raw_address?: string
          was_correct?: boolean | null
          whatsapp_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "city_match_logs_confirmed_city_id_fkey"
            columns: ["confirmed_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "city_match_logs_predicted_city_id_fkey"
            columns: ["predicted_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          billing_contact_email: string | null
          billing_contact_name: string | null
          billing_contact_phone: string | null
          brn: string | null
          city: string | null
          company_code: string
          company_logo_url: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          is_trial: boolean | null
          max_users_override: number | null
          name: string
          owner_user_id: string
          phone: string | null
          plan_id: string
          subscription_end_date: string | null
          subscription_start_date: string
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brn?: string | null
          city?: string | null
          company_code: string
          company_logo_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          max_users_override?: number | null
          name: string
          owner_user_id: string
          phone?: string | null
          plan_id: string
          subscription_end_date?: string | null
          subscription_start_date?: string
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          billing_contact_email?: string | null
          billing_contact_name?: string | null
          billing_contact_phone?: string | null
          brn?: string | null
          city?: string | null
          company_code?: string
          company_logo_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_trial?: boolean | null
          max_users_override?: number | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          plan_id?: string
          subscription_end_date?: string | null
          subscription_start_date?: string
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      company_roles: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          driver_rate: number | null
          id: string
          invited_at: string | null
          is_active: boolean
          is_owner: boolean
          joined_at: string | null
          role_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          driver_rate?: number | null
          id?: string
          invited_at?: string | null
          is_active?: boolean
          is_owner?: boolean
          joined_at?: string | null
          role_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          driver_rate?: number | null
          id?: string
          invited_at?: string | null
          is_active?: boolean
          is_owner?: boolean
          joined_at?: string | null
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_items: {
        Row: {
          company_id: string | null
          created_at: string
          credit_note_id: string
          description: string | null
          id: string
          invoice_item_id: string | null
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          product_id: string | null
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          credit_note_id: string
          description?: string | null
          id?: string
          invoice_item_id?: string | null
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          credit_note_id?: string
          description?: string | null
          id?: string
          invoice_item_id?: string | null
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_invoice_item_id_fkey"
            columns: ["invoice_item_id"]
            isOneToOne: false
            referencedRelation: "invoice_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          bill_to_snapshot: Json | null
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          credit_type: string
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string
          from_snapshot: Json | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          reason: string | null
          related_invoice_id: string | null
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_to_snapshot?: Json | null
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          credit_type?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string
          from_snapshot?: Json | null
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          reason?: string | null
          related_invoice_id?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_to_snapshot?: Json | null
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          credit_type?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string
          from_snapshot?: Json | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          reason?: string | null
          related_invoice_id?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_balances: {
        Row: {
          balance: number
          company_id: string | null
          created_at: string
          customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          company_id?: string | null
          created_at?: string
          customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          company_id?: string | null
          created_at?: string
          customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_balances_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_credit_settlements: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_credit_settlements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_settlements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_credit_settlements_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          city_id: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          map_location: string | null
          phone: string | null
          phone_2: string | null
          postal: string | null
          street: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          city_id?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          map_location?: string | null
          phone?: string | null
          phone_2?: string | null
          postal?: string | null
          street?: string | null
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          city_id?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          map_location?: string | null
          phone?: string | null
          phone_2?: string | null
          postal?: string | null
          street?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customers_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          delivered_to_driver_at: string | null
          delivery_date: string | null
          driver_settlement_status: Database["public"]["Enums"]["driver_settlement_status"]
          driver_status: boolean | null
          driver_user_id: string
          from_location_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          status: Database["public"]["Enums"]["delivery_note_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          delivered_to_driver_at?: string | null
          delivery_date?: string | null
          driver_settlement_status?: Database["public"]["Enums"]["driver_settlement_status"]
          driver_status?: boolean | null
          driver_user_id: string
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          delivered_to_driver_at?: string | null
          delivery_date?: string | null
          driver_settlement_status?: Database["public"]["Enums"]["driver_settlement_status"]
          driver_status?: boolean | null
          driver_user_id?: string
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_driver_settlements: {
        Row: {
          amount_to_owner: number
          bank_reference: string | null
          bank_transfer_amount: number
          cash_amount: number
          company_id: string
          created_at: string
          currency: string
          delivery_id: string
          driver_daily_rate: number | null
          driver_user_id: string
          due_amount: number
          expense_id: string | null
          id: string
          linked_orders_total: number | null
          recorded_by: string
          settlement_cash_total: number | null
        }
        Insert: {
          amount_to_owner: number
          bank_reference?: string | null
          bank_transfer_amount?: number
          cash_amount?: number
          company_id: string
          created_at?: string
          currency?: string
          delivery_id: string
          driver_daily_rate?: number | null
          driver_user_id: string
          due_amount?: number
          expense_id?: string | null
          id?: string
          linked_orders_total?: number | null
          recorded_by: string
          settlement_cash_total?: number | null
        }
        Update: {
          amount_to_owner?: number
          bank_reference?: string | null
          bank_transfer_amount?: number
          cash_amount?: number
          company_id?: string
          created_at?: string
          currency?: string
          delivery_id?: string
          driver_daily_rate?: number | null
          driver_user_id?: string
          due_amount?: number
          expense_id?: string | null
          id?: string
          linked_orders_total?: number | null
          recorded_by?: string
          settlement_cash_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_driver_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_driver_settlements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_sales_orders: {
        Row: {
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          delivery_id: string
          id: string
          is_active: boolean
          sales_order_id: string
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          delivery_id: string
          id?: string
          is_active?: boolean
          sales_order_id: string
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          delivery_id?: string
          id?: string
          is_active?: boolean
          sales_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_sales_orders_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_sales_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_upselling_commissions: {
        Row: {
          commission_amount: number
          company_id: string
          created_at: string
          currency: string
          delivery_id: string
          id: string
          recorded_by: string
          sales_order_id: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          company_id: string
          created_at?: string
          currency?: string
          delivery_id: string
          id?: string
          recorded_by: string
          sales_order_id: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          company_id?: string
          created_at?: string
          currency?: string
          delivery_id?: string
          id?: string
          recorded_by?: string
          sales_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_upselling_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_upselling_commissions_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_upselling_commissions_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_credit_balances: {
        Row: {
          balance: number
          company_id: string
          created_at: string
          driver_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          company_id: string
          created_at?: string
          driver_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          company_id?: string
          created_at?: string
          driver_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_credit_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_credit_settlements: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string
          delivery_id: string | null
          driver_user_id: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string
          delivery_id?: string | null
          driver_user_id: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string
          delivery_id?: string | null
          driver_user_id?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_credit_settlements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_credit_settlements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_advances: {
        Row: {
          amount: number
          amount_deducted: number
          company_id: string | null
          created_at: string
          deduction_per_period: number
          employee_id: string
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_deducted?: number
          company_id?: string | null
          created_at?: string
          deduction_per_period: number
          employee_id: string
          id?: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_deducted?: number
          company_id?: string | null
          created_at?: string
          deduction_per_period?: number
          employee_id?: string
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          basic_salary: number
          company_id: string | null
          created_at: string
          currency: string
          email: string | null
          full_name: string
          id: string
          join_date: string
          other_allowance: number
          payment_type: string
          phone: string | null
          position: string | null
          status: string
          transport_allowance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name: string
          id?: string
          join_date?: string
          other_allowance?: number
          payment_type?: string
          phone?: string | null
          position?: string | null
          status?: string
          transport_allowance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          full_name?: string
          id?: string
          join_date?: string
          other_allowance?: number
          payment_type?: string
          phone?: string | null
          position?: string | null
          status?: string
          transport_allowance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_employees_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_items: {
        Row: {
          company_id: string | null
          description: string | null
          expense_id: string
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          expense_id: string
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          expense_id?: string
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_items_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          company_id: string | null
          created_at: string
          currency: string
          description: string
          expense_date: string
          id: string
          invoice_id: string | null
          line_items: Json | null
          notes: string | null
          payment_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          description?: string
          expense_date?: string
          id?: string
          invoice_id?: string | null
          line_items?: Json | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          company_id: string
          created_at: string
          delivery_id: string | null
          event_type: string
          from_location_id: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          reference_number: string | null
          reference_type: string | null
          sales_order_id: string | null
          to_location_id: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          delivery_id?: string | null
          event_type: string
          from_location_id?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity: number
          reference_number?: string | null
          reference_type?: string | null
          sales_order_id?: string | null
          to_location_id?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          delivery_id?: string | null
          event_type?: string
          from_location_id?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          reference_number?: string | null
          reference_type?: string | null
          sales_order_id?: string | null
          to_location_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          invoice_id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          product_id: string | null
          quantity: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          created_from_quotation_id: string | null
          created_from_sales_order_id: string | null
          credit_applied: number
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          due_date: string
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_method: string | null
          shipping_amount: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          created_from_sales_order_id?: string | null
          credit_applied?: number
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          due_date: string
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_quotation_id?: string | null
          created_from_sales_order_id?: string | null
          credit_applied?: number
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          due_date?: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_from_quotation_id_fkey"
            columns: ["created_from_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_from_sales_order_id_fkey"
            columns: ["created_from_sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      location_drivers: {
        Row: {
          assigned_from: string
          assigned_until: string | null
          company_id: string
          created_at: string
          created_by: string | null
          driver_user_id: string
          id: string
          is_active: boolean
          is_primary: boolean
          location_id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          assigned_from?: string
          assigned_until?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          driver_user_id: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          location_id: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          assigned_from?: string
          assigned_until?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          driver_user_id?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          location_id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_drivers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_drivers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          code: string | null
          company_id: string
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_primary_warehouse: boolean
          is_stock_location: boolean
          location_type: Database["public"]["Enums"]["location_type"]
          map_link: string | null
          name: string
          parent_location_id: string | null
          postal: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          company_id: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_primary_warehouse?: boolean
          is_stock_location?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          map_link?: string | null
          name: string
          parent_location_id?: string | null
          postal?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          code?: string | null
          company_id?: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_primary_warehouse?: boolean
          is_stock_location?: boolean
          location_type?: Database["public"]["Enums"]["location_type"]
          map_link?: string | null
          name?: string
          parent_location_id?: string | null
          postal?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          id: string
          month: number
          status: string
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          month: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          month?: number
          status?: string
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_payroll_runs_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      payslip_advance_deductions: {
        Row: {
          advance_id: string
          amount: number
          company_id: string | null
          created_at: string
          id: string
          payslip_id: string
        }
        Insert: {
          advance_id: string
          amount: number
          company_id?: string | null
          created_at?: string
          id?: string
          payslip_id: string
        }
        Update: {
          advance_id?: string
          amount?: number
          company_id?: string | null
          created_at?: string
          id?: string
          payslip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_advance_deductions_advance_id_fkey"
            columns: ["advance_id"]
            isOneToOne: false
            referencedRelation: "employee_advances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_advance_deductions_payslip_id_fkey"
            columns: ["payslip_id"]
            isOneToOne: false
            referencedRelation: "payslips"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          absence_deduction: number
          advance_deduction: number
          basic_salary: number
          company_id: string | null
          created_at: string
          employee_id: string
          expense_id: string | null
          gross_salary: number
          id: string
          net_salary: number
          notes: string | null
          other_allowance: number
          other_deduction: number
          payment_date: string | null
          payment_method: string | null
          payment_status: string
          payroll_run_id: string
          total_deductions: number
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          absence_deduction?: number
          advance_deduction?: number
          basic_salary: number
          company_id?: string | null
          created_at?: string
          employee_id: string
          expense_id?: string | null
          gross_salary: number
          id?: string
          net_salary: number
          notes?: string | null
          other_allowance?: number
          other_deduction?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payroll_run_id: string
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          absence_deduction?: number
          advance_deduction?: number
          basic_salary?: number
          company_id?: string | null
          created_at?: string
          employee_id?: string
          expense_id?: string | null
          gross_salary?: number
          id?: string
          net_salary?: number
          notes?: string | null
          other_allowance?: number
          other_deduction?: number
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: string
          payroll_run_id?: string
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payslips_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_features: {
        Row: {
          feature_id: string
          id: string
          is_enabled: boolean
          plan_id: string
        }
        Insert: {
          feature_id: string
          id?: string
          is_enabled?: boolean
          plan_id: string
        }
        Update: {
          feature_id?: string
          id?: string
          is_enabled?: boolean
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_features_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          billing_cycle: string
          created_at: string
          currency: string | null
          description: string | null
          id: string
          is_active: boolean
          max_users: number
          name: string
          price: number
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          name: string
          price?: number
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          max_users?: number
          name?: string
          price?: number
        }
        Relationships: []
      }
      preferences: {
        Row: {
          company_id: string | null
          created_at: string
          currency: string
          default_notes: string | null
          default_terms: string | null
          id: string
          next_number: number
          number_padding: number
          number_prefix: string
          payment_terms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          id?: string
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          id?: string
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_location_stocks: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_location_stocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          company_id: string
          cost_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          name: string
          sale_price: number
          sku: string | null
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          cost_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          name: string
          sale_price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          cost_price?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          name?: string
          sale_price?: number
          sku?: string | null
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          address_line_1: string | null
          address_line_2: string | null
          bank_acc_num: string | null
          bank_name: string | null
          city: string | null
          company_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          phone: string | null
          postal: string | null
          registration_id: string | null
          street: string | null
          tax_id: string | null
          updated_at: string | null
          vat_number: string | null
          vat_registered: boolean
        }
        Insert: {
          account_type?: string
          address_line_1?: string | null
          address_line_2?: string | null
          bank_acc_num?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Update: {
          account_type?: string
          address_line_1?: string | null
          address_line_2?: string | null
          bank_acc_num?: string | null
          bank_name?: string | null
          city?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          tax_id?: string | null
          updated_at?: string | null
          vat_number?: string | null
          vat_registered?: boolean
        }
        Relationships: []
      }
      purchase_invoice_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          purchase_invoice_id: string
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_invoice_id: string
          quantity: number
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_invoice_id?: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          created_from_purchase_order_id: string | null
          currency: string
          discount_amount: number
          discount_type: string | null
          due_date: string
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_method: string | null
          shipping_amount: number
          status: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_purchase_order_id?: string | null
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          due_date: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          created_from_purchase_order_id?: string | null
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          due_date?: string
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          payment_method?: string | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_invoice_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_invoices_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_created_from_purchase_order_id_fkey"
            columns: ["created_from_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          purchase_order_id: string
          quantity: number
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_order_id: string
          quantity: number
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          purchase_order_id?: string
          quantity?: number
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          shipping_amount: number
          status: Database["public"]["Enums"]["purchase_order_status"]
          subtotal: number
          supplier_id: string | null
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          subtotal?: number
          supplier_id?: string | null
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          quantity: number
          quotation_id: string
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity: number
          quotation_id: string
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          quantity?: number
          quotation_id?: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          bill_to_snapshot: Json
          client_snapshot: Json | null
          company_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          id: string
          issue_date: string
          notes: string | null
          number: string
          shipping_amount: number
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          bill_to_snapshot: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          bill_to_snapshot?: Json
          client_snapshot?: Json | null
          company_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          shipping_amount?: number
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotations_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_features: {
        Row: {
          feature_id: string
          id: string
          role_id: string
        }
        Insert: {
          feature_id: string
          id?: string
          role_id: string
        }
        Update: {
          feature_id?: string
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_features_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_features_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "company_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          company_id: string | null
          description: string | null
          id: string
          item: string
          line_subtotal: number
          line_tax: number
          line_total: number
          product_id: string | null
          quantity: number
          sales_order_id: string
          sort_order: number
          tax_percent: number
          unit_price: number
        }
        Insert: {
          company_id?: string | null
          description?: string | null
          id?: string
          item: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity: number
          sales_order_id: string
          sort_order?: number
          tax_percent?: number
          unit_price: number
        }
        Update: {
          company_id?: string | null
          description?: string | null
          id?: string
          item?: string
          line_subtotal?: number
          line_tax?: number
          line_total?: number
          product_id?: string | null
          quantity?: number
          sales_order_id?: string
          sort_order?: number
          tax_percent?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          active_driver_delivery_id: string | null
          bill_to_snapshot: Json
          city_id: string | null
          client_snapshot: Json | null
          company_id: string
          created_at: string
          created_from_quotation_id: string | null
          currency: string
          customer_id: string | null
          delivery_date: string | null
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          fulfillment_status: Database["public"]["Enums"]["sales_order_fulfillment_status"]
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_status: Database["public"]["Enums"]["sales_order_payment_status"]
          shipping_amount: number
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }
        Insert: {
          active_driver_delivery_id?: string | null
          bill_to_snapshot: Json
          city_id?: string | null
          client_snapshot?: Json | null
          company_id: string
          created_at?: string
          created_from_quotation_id?: string | null
          currency?: string
          customer_id?: string | null
          delivery_date?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot: Json
          fulfillment_status?: Database["public"]["Enums"]["sales_order_fulfillment_status"]
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          payment_status?: Database["public"]["Enums"]["sales_order_payment_status"]
          shipping_amount?: number
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id: string
          valid_until: string
        }
        Update: {
          active_driver_delivery_id?: string | null
          bill_to_snapshot?: Json
          city_id?: string | null
          client_snapshot?: Json | null
          company_id?: string
          created_at?: string
          created_from_quotation_id?: string | null
          currency?: string
          customer_id?: string | null
          delivery_date?: string | null
          discount_amount?: number
          discount_type?: string | null
          from_snapshot?: Json
          fulfillment_status?: Database["public"]["Enums"]["sales_order_fulfillment_status"]
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          payment_status?: Database["public"]["Enums"]["sales_order_payment_status"]
          shipping_amount?: number
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_total?: number
          terms?: string | null
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_orders_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_active_driver_delivery_id_fkey"
            columns: ["active_driver_delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_from_quotation_id_fkey"
            columns: ["created_from_quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          postal: string | null
          registration_id: string | null
          street: string | null
          supplier_code: string | null
          type: string
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          supplier_code?: string | null
          type?: string
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          postal?: string | null
          registration_id?: string | null
          street?: string | null
          supplier_code?: string | null
          type?: string
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_company"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          system_role: Database["public"]["Enums"]["system_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          system_role?: Database["public"]["Enums"]["system_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          company_id: string | null
          created_at: string | null
          credit_note_next_number: number
          credit_note_number_padding: number
          credit_note_prefix: string
          currency: string
          default_notes: string | null
          default_terms: string | null
          next_number: number
          number_padding: number
          number_prefix: string
          payment_terms: number
          purchase_invoice_next_number: number
          purchase_invoice_number_padding: number
          purchase_invoice_prefix: string
          purchase_order_next_number: number
          purchase_order_number_padding: number
          purchase_order_prefix: string
          quotation_next_number: number
          quotation_number_padding: number
          quotation_prefix: string
          sales_order_next_number: number
          sales_order_number_padding: number
          sales_order_prefix: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          credit_note_next_number?: number
          credit_note_number_padding?: number
          credit_note_prefix?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          purchase_invoice_next_number?: number
          purchase_invoice_number_padding?: number
          purchase_invoice_prefix?: string
          purchase_order_next_number?: number
          purchase_order_number_padding?: number
          purchase_order_prefix?: string
          quotation_next_number?: number
          quotation_number_padding?: number
          quotation_prefix?: string
          sales_order_next_number?: number
          sales_order_number_padding?: number
          sales_order_prefix?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          credit_note_next_number?: number
          credit_note_number_padding?: number
          credit_note_prefix?: string
          currency?: string
          default_notes?: string | null
          default_terms?: string | null
          next_number?: number
          number_padding?: number
          number_prefix?: string
          payment_terms?: number
          purchase_invoice_next_number?: number
          purchase_invoice_number_padding?: number
          purchase_invoice_prefix?: string
          purchase_order_next_number?: number
          purchase_order_number_padding?: number
          purchase_order_prefix?: string
          quotation_next_number?: number
          quotation_number_padding?: number
          quotation_prefix?: string
          sales_order_next_number?: number
          sales_order_number_padding?: number
          sales_order_prefix?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ad_click_stats: {
        Row: {
          ad_id: string
          company: string
          id: string
          meta_clicks: number
          meta_conversations_started: number
          stat_date: string
          synced_at: string
        }
        Insert: {
          ad_id: string
          company: string
          id?: string
          meta_clicks?: number
          meta_conversations_started?: number
          stat_date: string
          synced_at?: string
        }
        Update: {
          ad_id?: string
          company?: string
          id?: string
          meta_clicks?: number
          meta_conversations_started?: number
          stat_date?: string
          synced_at?: string
        }
        Relationships: []
      }
      whatsapp_ad_referrals: {
        Row: {
          company: string
          id: string
          phone: string
          received_at: string
          source_id: string | null
          source_type: string | null
          source_url: string | null
        }
        Insert: {
          company: string
          id?: string
          phone: string
          received_at?: string
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Update: {
          company?: string
          id?: string
          phone?: string
          received_at?: string
          source_id?: string | null
          source_type?: string | null
          source_url?: string | null
        }
        Relationships: []
      }
      whatsapp_bot_item_media: {
        Row: {
          created_at: string
          id: string
          item_id: string
          kind: string
          mime_type: string | null
          public_url: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          kind: string
          mime_type?: string | null
          public_url: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          kind?: string
          mime_type?: string | null
          public_url?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_item_media_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_items"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_item_colors: {
        Row: {
          color_hex: string | null
          color_name: string
          created_at: string
          id: string
          item_id: string
          sort_order: number
        }
        Insert: {
          color_hex?: string | null
          color_name: string
          created_at?: string
          id?: string
          item_id: string
          sort_order?: number
        }
        Update: {
          color_hex?: string | null
          color_name?: string
          created_at?: string
          id?: string
          item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_item_colors_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_items"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_items: {
        Row: {
          ad_id: string | null
          ad_id_2: string | null
          ad_link: string | null
          ad_link_2: string | null
          company: string
          created_at: string | null
          description: string | null
          id: string
          image_base64: string | null
          is_website: boolean | null
          is_whatsapp: boolean | null
          promo: boolean | null
          pre_order: boolean | null
          sold_out: boolean | null
          price: string | null
          price_amount: number | null
          product_name: string | null
          sort_order: number
          source: string | null
          updated_at: string | null
        }
        Insert: {
          ad_id?: string | null
          ad_id_2?: string | null
          ad_link?: string | null
          ad_link_2?: string | null
          company?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_base64?: string | null
          is_website?: boolean | null
          is_whatsapp?: boolean | null
          promo?: boolean | null
          pre_order?: boolean | null
          sold_out?: boolean | null
          price?: string | null
          price_amount?: number | null
          product_name?: string | null
          sort_order?: number
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string | null
          ad_id_2?: string | null
          ad_link?: string | null
          ad_link_2?: string | null
          company?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_base64?: string | null
          is_website?: boolean | null
          is_whatsapp?: boolean | null
          promo?: boolean | null
          pre_order?: boolean | null
          sold_out?: boolean | null
          price?: string | null
          price_amount?: number | null
          product_name?: string | null
          sort_order?: number
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_bot_orders: {
        Row: {
          address: string
          city: string
          city_id: string | null
          company: string
          created_at: string | null
          customer_name: string
          customer_phone_number: string
          id: string
          notes: string | null
          order_ref: string
          product_name: string
          quantity: number
          source: string | null
          status: string
          total: number
          updated_at: string | null
        }
        Insert: {
          address: string
          city: string
          city_id?: string | null
          company?: string
          created_at?: string | null
          customer_name: string
          customer_phone_number: string
          id?: string
          notes?: string | null
          order_ref: string
          product_name: string
          quantity?: number
          source?: string | null
          status?: string
          total?: number
          updated_at?: string | null
        }
        Update: {
          address?: string
          city?: string
          city_id?: string | null
          company?: string
          created_at?: string | null
          customer_name?: string
          customer_phone_number?: string
          id?: string
          notes?: string | null
          order_ref?: string
          product_name?: string
          quantity?: number
          source?: string | null
          status?: string
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_orders_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_bot_orders_items: {
        Row: {
          color_hex: string | null
          color_id: string | null
          color_name: string | null
          created_at: string | null
          id: string
          item_id: string | null
          line_total: number
          order_id: string
          product_name: string
          quantity: number
          sort_order: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          color_hex?: string | null
          color_id?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          line_total?: number
          order_id: string
          product_name: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string | null
        }
        Update: {
          color_hex?: string | null
          color_id?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          item_id?: string | null
          line_total?: number
          order_id?: string
          product_name?: string
          quantity?: number
          sort_order?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bot_orders_items_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_item_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_orders_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bot_orders_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_catalogue_posts: {
        Row: {
          company_id: string
          created_at: string
          description: string
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string
          id?: string
          image_base64?: string | null
          image_mime_type?: string | null
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_catalogue_posts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_group_customers: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          id: string
          whatsapp_group_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          whatsapp_group_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          whatsapp_group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_group_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_group_customers_group_id_fkey"
            columns: ["whatsapp_group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_groups: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_dedup: {
        Row: {
          company: string
          created_at: string
          message_id: string
          phone: string
        }
        Insert: {
          company?: string
          created_at?: string
          message_id: string
          phone: string
        }
        Update: {
          company?: string
          created_at?: string
          message_id?: string
          phone?: string
        }
        Relationships: []
      }
      whatsapp_scheduled_promos: {
        Row: {
          company: string
          created_at: string
          error: string | null
          id: string
          kind: string
          order_id: string | null
          phone: string
          send_at: string
          sent_at: string | null
        }
        Insert: {
          company: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          phone: string
          send_at: string
          sent_at?: string | null
        }
        Update: {
          company?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          phone?: string
          send_at?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_scheduled_promos_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_session_cart_items: {
        Row: {
          color_id: string | null
          company: string
          created_at: string
          id: string
          item_id: string
          phone: string
          quantity: number
        }
        Insert: {
          color_id?: string | null
          company: string
          created_at?: string
          id?: string
          item_id: string
          phone: string
          quantity?: number
        }
        Update: {
          color_id?: string | null
          company?: string
          created_at?: string
          id?: string
          item_id?: string
          phone?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_session_cart_items_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_item_colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_session_cart_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_session_cart_items_session_fkey"
            columns: ["phone", "company"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["phone", "company"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          address: string | null
          city: string | null
          company: string
          converted_order_id: string | null
          customer_name: string | null
          draft_order_id: string | null
          last_inbound_at: string | null
          last_reminder_at: string | null
          message_notes: string | null
          message_status:
            | Database["public"]["Enums"]["whatsapp_message_status"]
            | null
          phone: string
          quantity: number | null
          region: string | null
          reminder_count: number
          selected_item_id: string | null
          state: string
          total: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          company?: string
          converted_order_id?: string | null
          customer_name?: string | null
          draft_order_id?: string | null
          last_inbound_at?: string | null
          last_reminder_at?: string | null
          message_notes?: string | null
          message_status?:
            | Database["public"]["Enums"]["whatsapp_message_status"]
            | null
          phone: string
          quantity?: number | null
          region?: string | null
          reminder_count?: number
          selected_item_id?: string | null
          state?: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          company?: string
          converted_order_id?: string | null
          customer_name?: string | null
          draft_order_id?: string | null
          last_inbound_at?: string | null
          last_reminder_at?: string | null
          message_notes?: string | null
          message_status?:
            | Database["public"]["Enums"]["whatsapp_message_status"]
            | null
          phone?: string
          quantity?: number | null
          region?: string | null
          reminder_count?: number
          selected_item_id?: string | null
          state?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sessions_draft_order_id_fkey"
            columns: ["draft_order_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sessions_selected_item_id_fkey"
            columns: ["selected_item_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_bot_items"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_applications: {
        Row: {
          areas_served: string | null
          bio: string
          created_at: string
          district: string
          email: string | null
          first_name: string
          id: string
          job_types: string[]
          last_name: string
          other_job_type: string | null
          phone: string
          profile_status: Database["public"]["Enums"]["worker_profile_status"]
          services_offered: string[]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at: string
          updated_at: string
          user_id: string | null
          worker_kind: Database["public"]["Enums"]["worker_kind"]
          years_experience: number
        }
        Insert: {
          areas_served?: string | null
          bio: string
          created_at?: string
          district: string
          email?: string | null
          first_name: string
          id?: string
          job_types: string[]
          last_name: string
          other_job_type?: string | null
          phone: string
          profile_status?: Database["public"]["Enums"]["worker_profile_status"]
          services_offered?: string[]
          subscription_plan: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string
          updated_at?: string
          user_id?: string | null
          worker_kind: Database["public"]["Enums"]["worker_kind"]
          years_experience: number
        }
        Update: {
          areas_served?: string | null
          bio?: string
          created_at?: string
          district?: string
          email?: string | null
          first_name?: string
          id?: string
          job_types?: string[]
          last_name?: string
          other_job_type?: string | null
          phone?: string
          profile_status?: Database["public"]["Enums"]["worker_profile_status"]
          services_offered?: string[]
          subscription_plan?: Database["public"]["Enums"]["subscription_plan"]
          terms_accepted_at?: string
          updated_at?: string
          user_id?: string | null
          worker_kind?: Database["public"]["Enums"]["worker_kind"]
          years_experience?: number
        }
        Relationships: []
      }
      worker_monthly_payments: {
        Row: {
          created_at: string
          id: string
          month: number
          note: string | null
          paid_at: string | null
          status: string
          updated_at: string
          worker_application_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          month: number
          note?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          worker_application_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          month?: number
          note?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          worker_application_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_monthly_payments_worker_application_id_fkey"
            columns: ["worker_application_id"]
            isOneToOne: false
            referencedRelation: "worker_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_cities: {
        Row: {
          city_id: string
          company_id: string
          created_at: string
          id: string
          sort_order: number
          updated_at: string
          zone_id: string
        }
        Insert: {
          city_id: string
          company_id: string
          created_at?: string
          id?: string
          sort_order: number
          updated_at?: string
          zone_id: string
        }
        Update: {
          city_id?: string
          company_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zone_cities_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_cities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_cities_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          driver_user_id: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_user_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          driver_user_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      inventory_stock_by_location: {
        Row: {
          balance_updated_at: string | null
          company_id: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          product_id: string | null
          product_name: string | null
          product_sku: string | null
          quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_location_stocks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_list: {
        Row: {
          bill_to_email: string | null
          bill_to_name: string | null
          bill_to_phone: string | null
          created_at: string | null
          currency: string | null
          due_date: string | null
          id: string | null
          issue_date: string | null
          number: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          status_text: string | null
          subtotal: number | null
          tax_total: number | null
          total: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bill_to_email?: never
          bill_to_name?: never
          bill_to_phone?: never
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          status_text?: never
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bill_to_email?: never
          bill_to_name?: never
          bill_to_phone?: never
          created_at?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string | null
          issue_date?: string | null
          number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          status_text?: never
          subtotal?: number | null
          tax_total?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _mobile_user_in_company: {
        Args: { p_company_id: string }
        Returns: boolean
      }
      _update_sales_order_fulfillment_for_company_internal: {
        Args: {
          p_company_id: string
          p_fulfillment_status: string
          p_sales_order_id: string
        }
        Returns: undefined
      }
      assert_company_member: {
        Args: { p_company_id: string }
        Returns: undefined
      }
      assign_sales_orders_to_delivery_by_date: {
        Args: { p_delivery_id: string }
        Returns: number
      }
      assign_upselling_sales_order_to_delivery_note: {
        Args: { p_sales_order_id: string }
        Returns: undefined
      }
      company_member_company_ids: { Args: never; Returns: string[] }
      count_sales_orders_missing_address: {
        Args: { p_company_id: string }
        Returns: number
      }
      count_sales_orders_missing_both: {
        Args: { p_company_id: string }
        Returns: number
      }
      count_sales_orders_missing_city: {
        Args: { p_company_id: string }
        Returns: number
      }
      create_company: {
        Args: {
          p_billing_contact_email?: string
          p_billing_contact_name?: string
          p_email?: string
          p_name: string
          p_owner_user_id: string
          p_phone?: string
          p_plan_id: string
        }
        Returns: string
      }
      create_credit_note: {
        Args: { p_credit_note: Json; p_items: Json }
        Returns: string
      }
      create_invoice:
        | {
            Args: {
              p_customer_id: string
              p_discount_amount: number
              p_discount_type: string
              p_due_date: string
              p_issue_date: string
              p_items: Database["public"]["CompositeTypes"]["invoice_item_input"][]
              p_notes: string
              p_shipping_amount: number
              p_terms: string
            }
            Returns: string
          }
        | { Args: { p_invoice: Json; p_items: Json }; Returns: string }
      create_purchase_invoice: {
        Args: { p_invoice: Json; p_items: Json }
        Returns: string
      }
      create_purchase_order: {
        Args: { p_items: Json; p_purchase_order: Json }
        Returns: string
      }
      create_quotation: {
        Args: { p_items: Json; p_quotation: Json }
        Returns: string
      }
      create_sales_order: {
        Args: { p_items: Json; p_sales_order: Json }
        Returns: string
      }
      create_sales_order_for_company: {
        Args: {
          p_address: string
          p_city_id?: string
          p_company_id: string
          p_currency: string
          p_customer_id: string
          p_delivery_date?: string
          p_discount_amount?: number
          p_fulfillment_status?: string
          p_items: Json
          p_notes?: string
          p_payment_status?: string
          p_phone: string
        }
        Returns: string
      }
      delete_credit_note: {
        Args: { p_credit_note_id: string }
        Returns: undefined
      }
      generate_invoice_from_paid_sales_order: {
        Args: { p_sales_order_id: string }
        Returns: undefined
      }
      get_credit_note_nav_facets: {
        Args: {
          p_company_id: string
          p_month_start: string
          p_quarter_start: string
          p_year_start: string
        }
        Returns: Json
      }
      get_customer_for_company: {
        Args: { p_company_id: string; p_customer_id: string }
        Returns: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          city_id: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          map_location: string | null
          phone: string | null
          phone_2: string | null
          postal: string | null
          street: string | null
          type: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_dashboard_stats: {
        Args: { p_company_id: string; p_year: number }
        Returns: Json
      }
      get_invoice_pivot_data: {
        Args: { p_company_id: string; p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_plans: { Args: never; Returns: Json }
      get_product_for_company: {
        Args: { p_company_id: string; p_product_id: string }
        Returns: {
          company_id: string
          cost_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          name: string
          sale_price: number
          sku: string | null
          unit: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_sales_order_list_facets: {
        Args: { p_company_id: string }
        Returns: Json
      }
      get_staff_product_for_company: {
        Args: { p_company_id: string; p_product_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      get_zone_city_sort_for_driver: {
        Args: { p_company_id: string }
        Returns: {
          city_id: string
          sort_order: number
        }[]
      }
      invoice_posted_credit_total: {
        Args: { p_invoice_id: string }
        Returns: number
      }
      list_creditable_invoices: {
        Args: { p_company_id: string; p_customer_id: string }
        Returns: Json
      }
      list_customers_for_company: {
        Args: { p_company_id: string }
        Returns: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          city_id: string | null
          company_id: string | null
          company_name: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          map_location: string | null
          phone: string | null
          phone_2: string | null
          postal: string | null
          street: string | null
          type: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "customers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_driver_delivery_note_orders_for_company_view: {
        Args: { p_company_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          bill_to_snapshot: Json
          city_id: string
          currency: string
          customer_address: string
          customer_city: string
          customer_id: string
          customer_map_location: string
          customer_name: string
          customer_phone: string
          delivery_date: string
          fulfillment_status: string
          id: string
          issue_date: string
          item_summary: string
          line_items: Json
          notes: string
          number: string
          payment_status: string
          status: string
          subtotal: number
          total: number
        }[]
      }
      list_driver_location_products: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      list_driver_stock_location_ids_for_company: {
        Args: { p_company_id: string }
        Returns: {
          is_primary: boolean
          location_id: string
        }[]
      }
      list_driver_upselling_products_for_company: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      list_primary_warehouse_location_ids_for_company: {
        Args: { p_company_id: string }
        Returns: {
          location_id: string
        }[]
      }
      list_primary_warehouse_products: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      list_products_for_company: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          cost_price: number
          created_at: string
          currency: string
          description: string | null
          id: string
          image_base64: string | null
          image_mime_type: string | null
          is_active: boolean
          name: string
          sale_price: number
          sku: string | null
          unit: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_products_for_company_at_locations: {
        Args: { p_company_id: string; p_location_ids: string[] }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      list_sales_orders_for_company: {
        Args: { p_company_id: string }
        Returns: {
          active_driver_delivery_id: string | null
          bill_to_snapshot: Json
          city_id: string | null
          client_snapshot: Json | null
          company_id: string
          created_at: string
          created_from_quotation_id: string | null
          currency: string
          customer_id: string | null
          delivery_date: string | null
          discount_amount: number
          discount_type: string | null
          from_snapshot: Json
          fulfillment_status: Database["public"]["Enums"]["sales_order_fulfillment_status"]
          id: string
          issue_date: string
          notes: string | null
          number: string
          payment_status: Database["public"]["Enums"]["sales_order_payment_status"]
          shipping_amount: number
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax_total: number
          terms: string | null
          total: number
          updated_at: string
          user_id: string
          valid_until: string
        }[]
        SetofOptions: {
          from: "*"
          to: "sales_orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_sales_orders_for_company_view: {
        Args: {
          p_company_id: string
          p_exclude_fulfillment_status?: string
          p_fulfillment_status?: string
          p_limit?: number
          p_offset?: number
          p_status?: string
          p_user_id?: string
        }
        Returns: {
          bill_to_snapshot: Json
          city_id: string
          currency: string
          customer_address: string
          customer_city: string
          customer_id: string
          customer_map_location: string
          customer_name: string
          customer_phone: string
          delivery_date: string
          fulfillment_status: string
          id: string
          issue_date: string
          item_summary: string
          line_items: Json
          notes: string
          number: string
          payment_status: string
          status: string
          subtotal: number
          total: number
        }[]
      }
      list_sales_orders_for_item_pivot: {
        Args: { p_company_id: string; p_from_date: string; p_to_date: string }
        Returns: {
          currency: string
          customer_id: string
          customer_name: string
          discount_amount: number
          fulfillment_status: string
          id: string
          issue_date: string
          line_items: Json
          number: string
          payment_status: string
          shipping_amount: number
          subtotal: number
          tax_total: number
          total: number
          user_id: string
        }[]
      }
      list_sales_orders_for_report: {
        Args: { p_company_id: string; p_from_date: string; p_to_date: string }
        Returns: {
          currency: string
          customer_id: string
          customer_name: string
          discount_amount: number
          fulfillment_status: string
          id: string
          issue_date: string
          line_items: Json
          number: string
          payment_status: string
          shipping_amount: number
          subtotal: number
          tax_total: number
          total: number
        }[]
      }
      list_staff_products_for_company: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      list_wholesale_order_products_for_company: {
        Args: { p_company_id: string }
        Returns: {
          company_id: string
          created_at: string
          currency: string
          description: string
          id: string
          is_active: boolean
          name: string
          sale_price: number
          sku: string
          stock_locations: Json
          total_quantity: number
          unit: string
          updated_at: string
        }[]
      }
      location_type_enum_values: { Args: never; Returns: string[] }
      mark_delivery_delivered_to_driver:
        | {
            Args: { p_delivery_id: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_delivery_id: string
              p_transfer_stock?: boolean
              p_user_id: string
            }
            Returns: undefined
          }
      normalize_city_text: { Args: { input: string }; Returns: string }
      post_credit_note: {
        Args: { p_credit_note_id: string }
        Returns: undefined
      }
      refresh_purchase_invoice_overdue_statuses: {
        Args: never
        Returns: number
      }
      reschedule_sales_order_from_mobile: {
        Args: {
          p_new_delivery_date: string
          p_reason?: string
          p_remove_from_current_delivery?: boolean
          p_sales_order_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      return_driver_stock_to_warehouse: {
        Args: {
          p_driver_user_id: string
          p_product_id: string
          p_quantity: number
          p_user_id: string
        }
        Returns: undefined
      }
      sales_order_fulfillment_status_enum_values: {
        Args: never
        Returns: string[]
      }
      sales_order_ids_missing_address: {
        Args: { p_company_id: string }
        Returns: string[]
      }
      sales_order_payment_status_enum_values: { Args: never; Returns: string[] }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      stock_out_upselling_sales_order_item: {
        Args: { p_sales_order_item_id: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      update_customer_map_location_for_company: {
        Args: {
          p_company_id: string
          p_customer_id: string
          p_map_location: string
        }
        Returns: boolean
      }
      update_sales_order_for_company: {
        Args: {
          p_address: string
          p_city_id?: string
          p_company_id: string
          p_currency: string
          p_customer_id: string
          p_delivery_date?: string
          p_discount_amount?: number
          p_items: Json
          p_notes?: string
          p_phone: string
          p_sales_order_id: string
        }
        Returns: undefined
      }
      update_sales_order_fulfillment_for_company: {
        Args: {
          p_company_id: string
          p_fulfillment_status: string
          p_sales_order_id: string
        }
        Returns: undefined
      }
      update_sales_order_notes_for_company: {
        Args: {
          p_company_id: string
          p_notes: string
          p_sales_order_id: string
        }
        Returns: undefined
      }
      user_is_company_member: {
        Args: { p_company_id: string }
        Returns: boolean
      }
    }
    Enums: {
      credit_note_status:
        | "issued"
        | "applied"
        | "cancelled"
        | "draft"
        | "posted"
      delivery_note_status: "new" | "delivered_to_driver" | "completed"
      driver_settlement_status: "pending" | "settled" | "due"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "unpaid"
        | "paid"
        | "void"
        | "cancelled"
      location_type: "warehouse" | "store" | "driver_location"
      purchase_invoice_status:
        | "unpaid"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      purchase_order_status: "active" | "expired"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "cancelled"
        | "active"
      sales_order_fulfillment_status:
        | "new"
        | "delivered to driver"
        | "delivered to customer"
        | "cancelled"
        | "rescheduled"
        | "delivery note created"
        | "completed"
        | "pending"
        | "upselling"
      sales_order_payment_status: "unpaid" | "partial paid" | "paid"
      sales_order_status: "active" | "expired"
      subscription_plan: "monthly_100" | "yearly_1000"
      system_role: "admin" | "owner" | "member"
      whatsapp_message_status:
        | "called"
        | "message_sent"
        | "call_later"
        | "rejected"
        | "complete"
      worker_kind: "individual" | "contractor"
      worker_profile_status: "pending" | "active" | "inactive" | "rejected"
    }
    CompositeTypes: {
      invoice_item_input: {
        item: string | null
        description: string | null
        quantity: number | null
        unit_price: number | null
        tax_percent: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      credit_note_status: ["issued", "applied", "cancelled", "draft", "posted"],
      delivery_note_status: ["new", "delivered_to_driver", "completed"],
      driver_settlement_status: ["pending", "settled", "due"],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "unpaid",
        "paid",
        "void",
        "cancelled",
      ],
      location_type: ["warehouse", "store", "driver_location"],
      purchase_invoice_status: [
        "unpaid",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      purchase_order_status: ["active", "expired"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "cancelled",
        "active",
      ],
      sales_order_fulfillment_status: [
        "new",
        "delivered to driver",
        "delivered to customer",
        "cancelled",
        "rescheduled",
        "delivery note created",
        "completed",
        "pending",
        "upselling",
      ],
      sales_order_payment_status: ["unpaid", "partial paid", "paid"],
      sales_order_status: ["active", "expired"],
      subscription_plan: ["monthly_100", "yearly_1000"],
      system_role: ["admin", "owner", "member"],
      whatsapp_message_status: [
        "called",
        "message_sent",
        "call_later",
        "rejected",
        "complete",
      ],
      worker_kind: ["individual", "contractor"],
      worker_profile_status: ["pending", "active", "inactive", "rejected"],
    },
  },
} as const
