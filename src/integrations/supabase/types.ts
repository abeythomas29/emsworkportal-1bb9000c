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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      default_leave_settings: {
        Row: {
          casual_leave: number
          earned_leave: number
          id: string
          max_earned_leave: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          casual_leave?: number
          earned_leave?: number
          id?: string
          max_earned_leave?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          casual_leave?: number
          earned_leave?: number
          id?: string
          max_earned_leave?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      employee_holidays: {
        Row: {
          created_at: string | null
          holiday_id: string
          id: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          holiday_id: string
          id?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          holiday_id?: string
          id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_holidays_holiday_id_fkey"
            columns: ["holiday_id"]
            isOneToOne: false
            referencedRelation: "holidays"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string | null
          date: string
          day_of_week: string
          holiday_type: string
          id: string
          name: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          date: string
          day_of_week: string
          holiday_type: string
          id?: string
          name: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          date?: string
          day_of_week?: string
          holiday_type?: string
          id?: string
          name?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          city: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estimated_value: number
          id: string
          lost_reason: string | null
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          product_interest: string | null
          source: Database["public"]["Enums"]["lead_source"]
          source_details: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          city?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number
          id?: string
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_details?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          city?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estimated_value?: number
          id?: string
          lost_reason?: string | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          product_interest?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          source_details?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          casual_leave: number
          consecutive_work_days: number
          created_at: string
          earned_leave: number
          id: string
          lwp_taken: number
          updated_at: string
          user_id: string
        }
        Insert: {
          casual_leave?: number
          consecutive_work_days?: number
          created_at?: string
          earned_leave?: number
          id?: string
          lwp_taken?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          casual_leave?: number
          consecutive_work_days?: number
          created_at?: string
          earned_leave?: number
          id?: string
          lwp_taken?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          end_date: string
          id: string
          is_half_day: boolean
          leave_type: string
          reason: string
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date: string
          id?: string
          is_half_day?: boolean
          leave_type: string
          reason: string
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          is_half_day?: boolean
          leave_type?: string
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          ot_minutes: number
          ot_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          ot_minutes: number
          ot_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          ot_minutes?: number
          ot_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      parcels: {
        Row: {
          client_name: string | null
          courier: string
          courier_tracking_url: string | null
          created_at: string
          dispatched_date: string
          id: string
          is_sample: boolean
          notes: string | null
          photo_url: string | null
          status: string
          tracking_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          courier: string
          courier_tracking_url?: string | null
          created_at?: string
          dispatched_date?: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          photo_url?: string | null
          status?: string
          tracking_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          courier?: string
          courier_tracking_url?: string | null
          created_at?: string
          dispatched_date?: string
          id?: string
          is_sample?: boolean
          notes?: string | null
          photo_url?: string | null
          status?: string
          tracking_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      policies: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_log_materials: {
        Row: {
          created_at: string
          id: string
          production_log_id: string
          quantity_consumed: number
          raw_material_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          production_log_id: string
          quantity_consumed: number
          raw_material_id: string
        }
        Update: {
          created_at?: string
          id?: string
          production_log_id?: string
          quantity_consumed?: number
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_log_materials_production_log_id_fkey"
            columns: ["production_log_id"]
            isOneToOne: false
            referencedRelation: "production_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_log_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          product_id: string
          quantity_produced: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity_produced: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity_produced?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          base_salary: number
          birthday: string | null
          created_at: string
          department: string | null
          email: string
          employee_id: string | null
          employee_type: Database["public"]["Enums"]["employee_type"]
          full_name: string
          id: string
          is_active: boolean | null
          joining_date: string | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number
          birthday?: string | null
          created_at?: string
          department?: string | null
          email: string
          employee_id?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"]
          full_name: string
          id: string
          is_active?: boolean | null
          joining_date?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number
          birthday?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employee_id?: string | null
          employee_type?: Database["public"]["Enums"]["employee_type"]
          full_name?: string
          id?: string
          is_active?: boolean | null
          joining_date?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_requests: {
        Row: {
          created_at: string
          expected_delivery: string | null
          handled_at: string | null
          handled_by: string | null
          id: string
          item_name: string
          order_date: string | null
          order_notes: string | null
          quantity: number
          reason: string | null
          status: string
          unit: string
          updated_at: string
          urgency: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          expected_delivery?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          item_name: string
          order_date?: string | null
          order_notes?: string | null
          quantity?: number
          reason?: string | null
          status?: string
          unit?: string
          updated_at?: string
          urgency?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          expected_delivery?: string | null
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          item_name?: string
          order_date?: string | null
          order_notes?: string | null
          quantity?: number
          reason?: string | null
          status?: string
          unit?: string
          updated_at?: string
          urgency?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: []
      }
      raw_materials: {
        Row: {
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      reimbursement_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          category: string
          created_at: string
          description: string
          expense_date: string
          handled_at: string | null
          handled_by: string | null
          id: string
          paid_at: string | null
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          category?: string
          created_at?: string
          description: string
          expense_date?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          paid_at?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          category?: string
          created_at?: string
          description?: string
          expense_date?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          paid_at?: string | null
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_series: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      research_tests: {
        Row: {
          created_at: string
          id: string
          instructions: string
          next_test_changes: string | null
          observation: string | null
          result_recorded_at: string | null
          series_id: string | null
          test_date: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions: string
          next_test_changes?: string | null
          observation?: string | null
          result_recorded_at?: string | null
          series_id?: string | null
          test_date?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string
          next_test_changes?: string | null
          observation?: string | null
          result_recorded_at?: string | null
          series_id?: string | null
          test_date?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_tests_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "research_series"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          balance_due: number
          created_at: string
          id: string
          invoice_date: string
          invoice_no: string
          is_cancelled: boolean
          party_name: string
          payment_type: string | null
          received_amount: number
          total_amount: number
          transaction_type: string | null
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          balance_due?: number
          created_at?: string
          id?: string
          invoice_date: string
          invoice_no: string
          is_cancelled?: boolean
          party_name: string
          payment_type?: string | null
          received_amount?: number
          total_amount?: number
          transaction_type?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          balance_due?: number
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_no?: string
          is_cancelled?: boolean
          party_name?: string
          payment_type?: string | null
          received_amount?: number
          total_amount?: number
          transaction_type?: string | null
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      sales_items: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string | null
          discount: number
          discount_percent: number
          hsn_sac: string | null
          id: string
          invoice_date: string
          invoice_id: string
          invoice_no: string
          item_name: string
          party_name: string
          product_id: string | null
          quantity: number
          stock_deducted: boolean
          tax: number
          tax_percent: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          discount_percent?: number
          hsn_sac?: string | null
          id?: string
          invoice_date: string
          invoice_id: string
          invoice_no: string
          item_name: string
          party_name: string
          product_id?: string | null
          quantity?: number
          stock_deducted?: boolean
          tax?: number
          tax_percent?: number
          unit?: string | null
          unit_price?: number
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number
          discount_percent?: number
          hsn_sac?: string | null
          id?: string
          invoice_date?: string
          invoice_id?: string
          invoice_no?: string
          item_name?: string
          party_name?: string
          product_id?: string | null
          quantity?: number
          stock_deducted?: boolean
          tax?: number
          tax_percent?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_uploads: {
        Row: {
          created_at: string
          file_name: string
          id: string
          invoices_inserted: number
          invoices_skipped: number
          items_inserted: number
          items_matched_to_products: number
          notes: string | null
          stock_deducted_total: number
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          invoices_inserted?: number
          invoices_skipped?: number
          items_inserted?: number
          items_matched_to_products?: number
          notes?: string | null
          stock_deducted_total?: number
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          invoices_inserted?: number
          invoices_skipped?: number
          items_inserted?: number
          items_matched_to_products?: number
          notes?: string | null
          stock_deducted_total?: number
          uploaded_by?: string
        }
        Relationships: []
      }
      stock_receipts: {
        Row: {
          created_at: string
          id: string
          item_type: string
          notes: string | null
          product_id: string | null
          purchase_request_id: string | null
          quantity: number
          raw_material_id: string | null
          received_date: string
          unit: string
          updated_at: string
          user_id: string
          vendor: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          notes?: string | null
          product_id?: string | null
          purchase_request_id?: string | null
          quantity: number
          raw_material_id?: string | null
          received_date?: string
          unit: string
          updated_at?: string
          user_id: string
          vendor?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          notes?: string | null
          product_id?: string | null
          purchase_request_id?: string | null
          quantity?: number
          raw_material_id?: string | null
          received_date?: string
          unit?: string
          updated_at?: string
          user_id?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipts_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_hours: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          start_time: string
          status: string | null
          task_description: string
          total_hours: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          end_time: string
          id?: string
          start_time: string
          status?: string | null
          task_description: string
          total_hours?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          start_time?: string
          status?: string | null
          task_description?: string
          total_hours?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accrue_earned_leave: { Args: never; Returns: undefined }
      cap_earned_leave_year_end: { Args: never; Returns: undefined }
      get_basic_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          department: string
          full_name: string
          id: string
        }[]
      }
      get_sales_dashboard_stats: { Args: never; Returns: Json }
      get_upcoming_birthdays: {
        Args: never
        Returns: {
          avatar_url: string
          birthday: string
          full_name: string
          id: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role:
        | {
            Args: { _role: Database["public"]["Enums"]["app_role"] }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_production_user: { Args: { _user_id: string }; Returns: boolean }
      is_research_user: { Args: { _user_id: string }; Returns: boolean }
      mark_absent_for_missing_checkins: {
        Args: { target_date?: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "employee"
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "leave"
        | "lwp"
        | "holiday"
        | "weekend"
      employee_type: "online" | "offline"
      lead_source:
        | "indiamart"
        | "referral"
        | "website"
        | "direct"
        | "tradeshow"
        | "other"
      lead_status:
        | "new"
        | "sample_requested"
        | "sample_sent"
        | "quote_sent"
        | "negotiation"
        | "won"
        | "lost"
    }
    CompositeTypes: {
      [_ in never]: never
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
      app_role: ["admin", "manager", "employee"],
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "leave",
        "lwp",
        "holiday",
        "weekend",
      ],
      employee_type: ["online", "offline"],
      lead_source: [
        "indiamart",
        "referral",
        "website",
        "direct",
        "tradeshow",
        "other",
      ],
      lead_status: [
        "new",
        "sample_requested",
        "sample_sent",
        "quote_sent",
        "negotiation",
        "won",
        "lost",
      ],
    },
  },
} as const
