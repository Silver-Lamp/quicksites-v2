export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_tasks: {
        Row: {
          category: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          details: string | null
          id: string
          priority: string
          source: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          priority?: string
          source?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          details?: string | null
          id?: string
          priority?: string
          source?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_1099_filings: {
        Row: {
          affiliate_user_id: string
          amount_reported_cents: number
          created_at: string
          filed_on: string | null
          furnished_on: string | null
          id: string
          iris_submission_id: string | null
          recipient_copy_url: string | null
          status: string
          tax_year: number
          updated_at: string
        }
        Insert: {
          affiliate_user_id: string
          amount_reported_cents?: number
          created_at?: string
          filed_on?: string | null
          furnished_on?: string | null
          id?: string
          iris_submission_id?: string | null
          recipient_copy_url?: string | null
          status?: string
          tax_year: number
          updated_at?: string
        }
        Update: {
          affiliate_user_id?: string
          amount_reported_cents?: number
          created_at?: string
          filed_on?: string | null
          furnished_on?: string | null
          id?: string
          iris_submission_id?: string | null
          recipient_copy_url?: string | null
          status?: string
          tax_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_payouts: {
        Row: {
          affiliate_user_id: string
          amount_cents: number
          currency: string
          error: string | null
          id: string
          is_tpso: boolean
          method: Database["public"]["Enums"]["payout_method"]
          notes: string | null
          paid_at: string
          status: string
          tax_year: number | null
          tx_ref: string | null
        }
        Insert: {
          affiliate_user_id: string
          amount_cents: number
          currency?: string
          error?: string | null
          id?: string
          is_tpso?: boolean
          method: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at: string
          status?: string
          tax_year?: number | null
          tx_ref?: string | null
        }
        Update: {
          affiliate_user_id?: string
          amount_cents?: number
          currency?: string
          error?: string | null
          id?: string
          is_tpso?: boolean
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at?: string
          status?: string
          tax_year?: number | null
          tx_ref?: string | null
        }
        Relationships: []
      }
      affiliate_tax_profiles: {
        Row: {
          address1: string | null
          address2: string | null
          backup_withholding: boolean
          business_name: string | null
          city: string | null
          country: string
          created_at: string
          entity_type: string
          form_file_url: string | null
          form_type: string
          id: string
          legal_name: string
          postal_code: string | null
          region: string | null
          signed_at: string | null
          tin_last4: string | null
          tin_status: string
          tin_type: string | null
          updated_at: string
          user_id: string
          year_valid_through: number | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          backup_withholding?: boolean
          business_name?: string | null
          city?: string | null
          country?: string
          created_at?: string
          entity_type?: string
          form_file_url?: string | null
          form_type?: string
          id?: string
          legal_name: string
          postal_code?: string | null
          region?: string | null
          signed_at?: string | null
          tin_last4?: string | null
          tin_status?: string
          tin_type?: string | null
          updated_at?: string
          user_id: string
          year_valid_through?: number | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          backup_withholding?: boolean
          business_name?: string | null
          city?: string | null
          country?: string
          created_at?: string
          entity_type?: string
          form_file_url?: string | null
          form_type?: string
          id?: string
          legal_name?: string
          postal_code?: string | null
          region?: string | null
          signed_at?: string | null
          tin_last4?: string | null
          tin_status?: string
          tin_type?: string | null
          updated_at?: string
          user_id?: string
          year_valid_through?: number | null
        }
        Relationships: []
      }
      agent_block_presets: {
        Row: {
          created_at: string | null
          fields: Json
          grp: string
          id: string
          name: string
          title: string
        }
        Insert: {
          created_at?: string | null
          fields: Json
          grp: string
          id?: string
          name: string
          title: string
        }
        Update: {
          created_at?: string | null
          fields?: Json
          grp?: string
          id?: string
          name?: string
          title?: string
        }
        Relationships: []
      }
      ai_estimates: {
        Row: {
          assumptions: Json
          breakdown: Json
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          estimated_cost_usd: number
          id: string
          images: number
          input_tokens: number
          minutes_audio: number
          model_code: string
          output_tokens: number
          provider: string
        }
        Insert: {
          assumptions: Json
          breakdown: Json
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          estimated_cost_usd: number
          id?: string
          images?: number
          input_tokens?: number
          minutes_audio?: number
          model_code: string
          output_tokens?: number
          provider: string
        }
        Update: {
          assumptions?: Json
          breakdown?: Json
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          estimated_cost_usd?: number
          id?: string
          images?: number
          input_tokens?: number
          minutes_audio?: number
          model_code?: string
          output_tokens?: number
          provider?: string
        }
        Relationships: []
      }
      ai_model_pricing: {
        Row: {
          created_at: string
          currency: string
          id: string
          image_base_usd: number | null
          image_per_mp_usd: number | null
          input_per_1k_usd: number | null
          is_active: boolean
          modality: string
          model_code: string
          output_per_1k_usd: number | null
          provider: string
          stt_per_min_usd: number | null
          tts_per_1k_chars_usd: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          image_base_usd?: number | null
          image_per_mp_usd?: number | null
          input_per_1k_usd?: number | null
          is_active?: boolean
          modality: string
          model_code: string
          output_per_1k_usd?: number | null
          provider: string
          stt_per_min_usd?: number | null
          tts_per_1k_chars_usd?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          image_base_usd?: number | null
          image_per_mp_usd?: number | null
          input_per_1k_usd?: number | null
          is_active?: boolean
          modality?: string
          model_code?: string
          output_per_1k_usd?: number | null
          provider?: string
          stt_per_min_usd?: number | null
          tts_per_1k_chars_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_pricing_audit: {
        Row: {
          action: string | null
          applied: boolean
          change_pct: number | null
          created_at: string | null
          id: string
          message: string | null
          modality: string
          model_code: string
          new: Json | null
          old: Json | null
          provider: string
          reviewed_at: string | null
          reviewer_id: string | null
        }
        Insert: {
          action?: string | null
          applied?: boolean
          change_pct?: number | null
          created_at?: string | null
          id?: string
          message?: string | null
          modality: string
          model_code: string
          new?: Json | null
          old?: Json | null
          provider: string
          reviewed_at?: string | null
          reviewer_id?: string | null
        }
        Update: {
          action?: string | null
          applied?: boolean
          change_pct?: number | null
          created_at?: string | null
          id?: string
          message?: string | null
          modality?: string
          model_code?: string
          new?: Json | null
          old?: Json | null
          provider?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
        }
        Relationships: []
      }
      ai_pricing_sources: {
        Row: {
          etag: string | null
          last_checked: string | null
          last_hash: string | null
          last_status: number | null
          provider: string
          url: string
        }
        Insert: {
          etag?: string | null
          last_checked?: string | null
          last_hash?: string | null
          last_status?: number | null
          provider: string
          url: string
        }
        Update: {
          etag?: string | null
          last_checked?: string | null
          last_hash?: string | null
          last_status?: number | null
          provider?: string
          url?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          cost_usd: number
          id: string
          images: number | null
          input_tokens: number | null
          metadata: Json | null
          minutes_audio: number | null
          modality: string
          model_code: string
          occurred_at: string
          output_tokens: number | null
          provider: string
          site_id: string | null
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          cost_usd: number
          id?: string
          images?: number | null
          input_tokens?: number | null
          metadata?: Json | null
          minutes_audio?: number | null
          modality: string
          model_code: string
          occurred_at?: string
          output_tokens?: number | null
          provider: string
          site_id?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number
          id?: string
          images?: number | null
          input_tokens?: number | null
          metadata?: Json | null
          minutes_audio?: number | null
          modality?: string
          model_code?: string
          occurred_at?: string
          output_tokens?: number | null
          provider?: string
          site_id?: string | null
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      attributions: {
        Row: {
          first_touch_at: string
          locked_at: string | null
          merchant_id: string
          referral_code: string | null
        }
        Insert: {
          first_touch_at?: string
          locked_at?: string | null
          merchant_id: string
          referral_code?: string | null
        }
        Update: {
          first_touch_at?: string
          locked_at?: string | null
          merchant_id?: string
          referral_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attributions_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      availability: {
        Row: {
          catalog_item_id: string
          ends_at: string | null
          id: string
          kind: string
          metadata: Json
          quantity: number | null
          starts_at: string | null
        }
        Insert: {
          catalog_item_id: string
          ends_at?: string | null
          id?: string
          kind: string
          metadata?: Json
          quantity?: number | null
          starts_at?: string | null
        }
        Update: {
          catalog_item_id?: string
          ends_at?: string | null
          id?: string
          kind?: string
          metadata?: Json
          quantity?: number | null
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      block_checkins: {
        Row: {
          block_id: string | null
          checked_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          block_id?: string | null
          checked_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          block_id?: string | null
          checked_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_checkins_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      block_feedback: {
        Row: {
          action: string | null
          block_id: string | null
          created_at: string | null
          id: string
          message: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          block_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          block_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_feedback_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          actions: Json | null
          created_at: string | null
          emoji: string | null
          id: string
          image_url: string | null
          lat: number | null
          lon: number | null
          message: string | null
          owner_id: string
          room: string | null
          slug: string
          title: string | null
          type: string | null
          visibility: string | null
        }
        Insert: {
          actions?: Json | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          lat?: number | null
          lon?: number | null
          message?: string | null
          owner_id: string
          room?: string | null
          slug: string
          title?: string | null
          type?: string | null
          visibility?: string | null
        }
        Update: {
          actions?: Json | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          image_url?: string | null
          lat?: number | null
          lon?: number | null
          message?: string | null
          owner_id?: string
          room?: string | null
          slug?: string
          title?: string | null
          type?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      branding_logs: {
        Row: {
          created_at: string | null
          details: string | null
          event: string | null
          id: string
          profile_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          event?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          event?: string | null
          id?: string
          profile_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_profiles: {
        Row: {
          accent_color: string | null
          access_token: string | null
          brand: string | null
          created_at: string | null
          id: string
          industry: string | null
          is_public: boolean | null
          is_shared: boolean | null
          layout: string | null
          logo_url: string | null
          name: string
          owner_id: string | null
          password: string | null
          theme: string | null
        }
        Insert: {
          accent_color?: string | null
          access_token?: string | null
          brand?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean | null
          is_shared?: boolean | null
          layout?: string | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          password?: string | null
          theme?: string | null
        }
        Update: {
          accent_color?: string | null
          access_token?: string | null
          brand?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          is_public?: boolean | null
          is_shared?: boolean | null
          layout?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          password?: string | null
          theme?: string | null
        }
        Relationships: []
      }
      call_logs: {
        Row: {
          call_duration: number | null
          call_sid: string | null
          call_status: string | null
          created_at: string | null
          custom_domain: string | null
          direction: string | null
          from_number: string | null
          id: string
          template_slug: string | null
          timestamp: string | null
          to_number: string | null
        }
        Insert: {
          call_duration?: number | null
          call_sid?: string | null
          call_status?: string | null
          created_at?: string | null
          custom_domain?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          template_slug?: string | null
          timestamp?: string | null
          to_number?: string | null
        }
        Update: {
          call_duration?: number | null
          call_sid?: string | null
          call_status?: string | null
          created_at?: string | null
          custom_domain?: string | null
          direction?: string | null
          from_number?: string | null
          id?: string
          template_slug?: string | null
          timestamp?: string | null
          to_number?: string | null
        }
        Relationships: []
      }
      campaign_leads: {
        Row: {
          campaign_id: string
          inserted_at: string | null
          lead_id: string
        }
        Insert: {
          campaign_id: string
          inserted_at?: string | null
          lead_id: string
        }
        Update: {
          campaign_id?: string
          inserted_at?: string | null
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          alt_domains: string[] | null
          arc_offset_y: number | null
          arc_radius: number | null
          city: string | null
          city_lat: number | null
          city_lon: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          domain_ids: string[] | null
          ends_at: string | null
          id: string
          industry: string
          logo_offset_y: number | null
          name: string
          owner_id: string | null
          silent_mode: boolean | null
          starts_at: string | null
          state: string
          status: string | null
        }
        Insert: {
          alt_domains?: string[] | null
          arc_offset_y?: number | null
          arc_radius?: number | null
          city?: string | null
          city_lat?: number | null
          city_lon?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          domain_ids?: string[] | null
          ends_at?: string | null
          id?: string
          industry: string
          logo_offset_y?: number | null
          name: string
          owner_id?: string | null
          silent_mode?: boolean | null
          starts_at?: string | null
          state: string
          status?: string | null
        }
        Update: {
          alt_domains?: string[] | null
          arc_offset_y?: number | null
          arc_radius?: number | null
          city?: string | null
          city_lat?: number | null
          city_lon?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          domain_ids?: string[] | null
          ends_at?: string | null
          id?: string
          industry?: string
          logo_offset_y?: number | null
          name?: string
          owner_id?: string | null
          silent_mode?: boolean | null
          starts_at?: string | null
          state?: string
          status?: string | null
        }
        Relationships: []
      }
      candidate_pages: {
        Row: {
          allow_email: boolean
          allow_text: boolean
          blocks: Json
          enable_donations: boolean
          enable_endorsements: boolean
          enable_events: boolean
          enable_newsletter: boolean
          enable_volunteer: boolean
          is_paid: boolean
          slug: string
          updated_at: string | null
        }
        Insert: {
          allow_email?: boolean
          allow_text?: boolean
          blocks: Json
          enable_donations?: boolean
          enable_endorsements?: boolean
          enable_events?: boolean
          enable_newsletter?: boolean
          enable_volunteer?: boolean
          is_paid?: boolean
          slug: string
          updated_at?: string | null
        }
        Update: {
          allow_email?: boolean
          allow_text?: boolean
          blocks?: Json
          enable_donations?: boolean
          enable_endorsements?: boolean
          enable_events?: boolean
          enable_newsletter?: boolean
          enable_volunteer?: boolean
          is_paid?: boolean
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_pages_slug_fkey"
            columns: ["slug"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["slug"]
          },
        ]
      }
      candidates: {
        Row: {
          city: string
          created_at: string | null
          name: string
          office: string
          photo_url: string | null
          slug: string
        }
        Insert: {
          city: string
          created_at?: string | null
          name: string
          office: string
          photo_url?: string | null
          slug: string
        }
        Update: {
          city?: string
          created_at?: string | null
          name?: string
          office?: string
          photo_url?: string | null
          slug?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          catalog_item_id: string
          id: string
          metadata: Json
          quantity: number
          unit_price_cents: number
        }
        Insert: {
          cart_id: string
          catalog_item_id: string
          id?: string
          metadata?: Json
          quantity: number
          unit_price_cents: number
        }
        Update: {
          cart_id?: string
          catalog_item_id?: string
          id?: string
          metadata?: Json
          quantity?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string | null
          id: string
          merchant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          id?: string
          merchant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          id?: string
          merchant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          images: Json
          merchant_id: string
          metadata: Json
          price_cents: number
          slug: string
          status: string
          tax_code: string | null
          title: string
          type: Database["public"]["Enums"]["catalog_item_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          merchant_id: string
          metadata?: Json
          price_cents: number
          slug: string
          status?: string
          tax_code?: string | null
          title: string
          type: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          merchant_id?: string
          metadata?: Json
          price_cents?: number
          slug?: string
          status?: string
          tax_code?: string | null
          title?: string
          type?: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      chefs: {
        Row: {
          bio: string | null
          certifications: string[] | null
          created_at: string | null
          display_name: string | null
          id: string
          kitchen_video_url: string | null
          location: string | null
          merchant_id: string | null
          name: string
          profile_image_url: string | null
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          certifications?: string[] | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          kitchen_video_url?: string | null
          location?: string | null
          merchant_id?: string | null
          name: string
          profile_image_url?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          certifications?: string[] | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          kitchen_video_url?: string | null
          location?: string | null
          merchant_id?: string | null
          name?: string
          profile_image_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chefs_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      claimed_handles: {
        Row: {
          claimed_at: string | null
          handle: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          handle: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          handle?: string
          user_id?: string
        }
        Relationships: []
      }
      click_events: {
        Row: {
          action: string
          block_id: string
          handle: string | null
          id: string
          ip_address: string | null
          is_duplicate: boolean | null
          metadata: Json | null
          timestamp: string | null
        }
        Insert: {
          action: string
          block_id: string
          handle?: string | null
          id?: string
          ip_address?: string | null
          is_duplicate?: boolean | null
          metadata?: Json | null
          timestamp?: string | null
        }
        Update: {
          action?: string
          block_id?: string
          handle?: string | null
          id?: string
          ip_address?: string | null
          is_duplicate?: boolean | null
          metadata?: Json | null
          timestamp?: string | null
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          ip: string | null
          message: string | null
          role: string | null
          route: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          role?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          ip?: string | null
          message?: string | null
          role?: string | null
          route?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_email: string | null
          created_at: string | null
          id: string
          message: string | null
          snapshot_id: string | null
        }
        Insert: {
          author_email?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          snapshot_id?: string | null
        }
        Update: {
          author_email?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_clawbacks: {
        Row: {
          affiliate_payout_id: string | null
          amount_cents: number
          commission_ledger_id: string
          created_at: string
          id: string
          order_id: string | null
          reason: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          affiliate_payout_id?: string | null
          amount_cents: number
          commission_ledger_id: string
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          affiliate_payout_id?: string | null
          amount_cents?: number
          commission_ledger_id?: string
          created_at?: string
          id?: string
          order_id?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_clawbacks_affiliate_payout_id_fkey"
            columns: ["affiliate_payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_clawbacks_commission_ledger_id_fkey"
            columns: ["commission_ledger_id"]
            isOneToOne: true
            referencedRelation: "commission_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_ledger: {
        Row: {
          adjustments: Json
          amount_cents: number
          created_at: string
          currency: string
          id: string
          payout_id: string | null
          referral_code: string
          status: string
          subject: string
          subject_id: string
        }
        Insert: {
          adjustments?: Json
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          payout_id?: string | null
          referral_code: string
          status?: string
          subject: string
          subject_id: string
        }
        Update: {
          adjustments?: Json
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          payout_id?: string | null
          referral_code?: string
          status?: string
          subject?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "affiliate_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_referral_code_fkey"
            columns: ["referral_code"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      companies: {
        Row: {
          business_hours: Json | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          tenant_id: string | null
        }
        Insert: {
          business_hours?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          tenant_id?: string | null
        }
        Update: {
          business_hours?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_docs: {
        Row: {
          created_at: string | null
          expires_at: string | null
          fields: Json | null
          file_url: string | null
          id: string
          issued_at: string | null
          kind: string | null
          merchant_id: string
          requirement_id: string
          reviewed_at: string | null
          reviewer: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          fields?: Json | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          kind?: string | null
          merchant_id: string
          requirement_id: string
          reviewed_at?: string | null
          reviewer?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          fields?: Json | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          kind?: string | null
          merchant_id?: string
          requirement_id?: string
          reviewed_at?: string | null
          reviewer?: string | null
          status?: string
        }
        Relationships: []
      }
      compliance_notifications: {
        Row: {
          doc_id: string
          id: number
          merchant_id: string
          sent_at: string | null
          stage: number
        }
        Insert: {
          doc_id: string
          id?: number
          merchant_id: string
          sent_at?: string | null
          stage: number
        }
        Update: {
          doc_id?: string
          id?: number
          merchant_id?: string
          sent_at?: string | null
          stage?: number
        }
        Relationships: []
      }
      compliance_requirements: {
        Row: {
          active: boolean
          code: string | null
          details: Json | null
          id: string
          juris_country: string | null
          juris_county: string | null
          juris_state: string | null
          operation_type: string | null
          required: boolean
          version: number
        }
        Insert: {
          active?: boolean
          code?: string | null
          details?: Json | null
          id?: string
          juris_country?: string | null
          juris_county?: string | null
          juris_state?: string | null
          operation_type?: string | null
          required?: boolean
          version?: number
        }
        Update: {
          active?: boolean
          code?: string | null
          details?: Json | null
          id?: string
          juris_country?: string | null
          juris_county?: string | null
          juris_state?: string | null
          operation_type?: string | null
          required?: boolean
          version?: number
        }
        Relationships: []
      }
      compliance_status: {
        Row: {
          expiring: Json | null
          merchant_id: string
          missing: Json | null
          overall: string
          updated_at: string | null
        }
        Insert: {
          expiring?: Json | null
          merchant_id: string
          missing?: Json | null
          overall?: string
          updated_at?: string | null
        }
        Update: {
          expiring?: Json | null
          merchant_id?: string
          missing?: Json | null
          overall?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_message_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          message_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          message_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_notes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          admin_notes: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          include_ai: boolean
          ip: unknown
          message: string
          migrating: boolean
          name: string
          responded_at: string | null
          sites: number
          status: string
          user_agent: string | null
          want_founder: boolean
        }
        Insert: {
          admin_notes?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          include_ai?: boolean
          ip?: unknown
          message: string
          migrating?: boolean
          name: string
          responded_at?: string | null
          sites?: number
          status?: string
          user_agent?: string | null
          want_founder?: boolean
        }
        Update: {
          admin_notes?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          include_ai?: boolean
          ip?: unknown
          message?: string
          migrating?: boolean
          name?: string
          responded_at?: string | null
          sites?: number
          status?: string
          user_agent?: string | null
          want_founder?: boolean
        }
        Relationships: []
      }
      coupon_redemptions: {
        Row: {
          amount_cents_applied: number
          coupon_id: string
          created_at: string | null
          id: number
          merchant_id: string
          order_id: string
          user_id: string | null
        }
        Insert: {
          amount_cents_applied: number
          coupon_id: string
          created_at?: string | null
          id?: number
          merchant_id: string
          order_id: string
          user_id?: string | null
        }
        Update: {
          amount_cents_applied?: number
          coupon_id?: string
          created_at?: string | null
          id?: number
          merchant_id?: string
          order_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          amount_cents: number | null
          code: string
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          merchant_id: string
          min_subtotal_cents: number | null
          percent: number | null
          review_id: string | null
          status: string
          type: string
          user_id: string | null
          uses_allowed: number
          uses_count: number
        }
        Insert: {
          amount_cents?: number | null
          code: string
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          merchant_id: string
          min_subtotal_cents?: number | null
          percent?: number | null
          review_id?: string | null
          status?: string
          type?: string
          user_id?: string | null
          uses_allowed?: number
          uses_count?: number
        }
        Update: {
          amount_cents?: number | null
          code?: string
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          merchant_id?: string
          min_subtotal_cents?: number | null
          percent?: number | null
          review_id?: string | null
          status?: string
          type?: string
          user_id?: string | null
          uses_allowed?: number
          uses_count?: number
        }
        Relationships: []
      }
      cron_runs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error: string | null
          finished_at: string | null
          id: string
          job: string
          ok: boolean | null
          result: Json | null
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job: string
          ok?: boolean | null
          result?: Json | null
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          finished_at?: string | null
          id?: string
          job?: string
          ok?: boolean | null
          result?: Json | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      dashboard_access_log: {
        Row: {
          city: string | null
          country: string | null
          email: string | null
          id: string
          ip_address: string | null
          region: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          region?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          email?: string | null
          id?: string
          ip_address?: string | null
          region?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dashboard_layout_templates: {
        Row: {
          created_at: string | null
          description: string | null
          hidden: string[] | null
          id: string
          layout: Json | null
          name: string
          org_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          hidden?: string[] | null
          id?: string
          layout?: Json | null
          name: string
          org_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          hidden?: string[] | null
          id?: string
          layout?: Json | null
          name?: string
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_layout_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_layout_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_layout_versions: {
        Row: {
          created_at: string | null
          hidden: string[] | null
          id: string
          layout: Json
          role: string
          saved_by: string | null
        }
        Insert: {
          created_at?: string | null
          hidden?: string[] | null
          id?: string
          layout: Json
          role: string
          saved_by?: string | null
        }
        Update: {
          created_at?: string | null
          hidden?: string[] | null
          id?: string
          layout?: Json
          role?: string
          saved_by?: string | null
        }
        Relationships: []
      }
      dashboard_layouts: {
        Row: {
          hidden: string[] | null
          layout: Json | null
          role: string
        }
        Insert: {
          hidden?: string[] | null
          layout?: Json | null
          role: string
        }
        Update: {
          hidden?: string[] | null
          layout?: Json | null
          role?: string
        }
        Relationships: []
      }
      dashboard_user_layouts: {
        Row: {
          dashboard_id: string | null
          name: string | null
          org_id: string | null
          settings: Json | null
          template_id: string | null
          user_id: string
        }
        Insert: {
          dashboard_id?: string | null
          name?: string | null
          org_id?: string | null
          settings?: Json | null
          template_id?: string | null
          user_id: string
        }
        Update: {
          dashboard_id?: string | null
          name?: string | null
          org_id?: string | null
          settings?: Json | null
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_layouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_layouts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboard_user_layouts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "dashboard_layout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      deploy_errors: {
        Row: {
          context: string | null
          created_at: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          context?: string | null
          created_at?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      deploy_logs: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          ip: string | null
          result: Json | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          ip?: string | null
          result?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          ip?: string | null
          result?: Json | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      domains: {
        Row: {
          city: string | null
          claimed_user_id: string | null
          created_at: string | null
          domain: string | null
          id: string
          state: string | null
          template: string | null
        }
        Insert: {
          city?: string | null
          claimed_user_id?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          state?: string | null
          template?: string | null
        }
        Update: {
          city?: string | null
          claimed_user_id?: string | null
          created_at?: string | null
          domain?: string | null
          id?: string
          state?: string | null
          template?: string | null
        }
        Relationships: []
      }
      draft_sites: {
        Row: {
          city: string
          claimed_by: string | null
          date_created: string | null
          domain: string
          id: string
          industry: string | null
          is_claimed: boolean | null
          notes: string | null
          state: string
          template_id: string | null
          user_id: string | null
        }
        Insert: {
          city: string
          claimed_by?: string | null
          date_created?: string | null
          domain: string
          id?: string
          industry?: string | null
          is_claimed?: boolean | null
          notes?: string | null
          state: string
          template_id?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string
          claimed_by?: string | null
          date_created?: string | null
          domain?: string
          id?: string
          industry?: string | null
          is_claimed?: boolean | null
          notes?: string | null
          state?: string
          template_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      early_access_codes: {
        Row: {
          claimed_by: string | null
          code: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          claimed_by?: string | null
          code: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          claimed_by?: string | null
          code?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: []
      }
      early_access_signups: {
        Row: {
          created_at: string | null
          email: string
          id: string
          invite_code: string | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          invite_code?: string | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          invite_code?: string | null
          name?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string | null
          error: string | null
          form_submission_id: string | null
          id: string
          message: string
          response_id: string | null
          site_slug: string | null
          status: string
          subject: string
          to: string[]
          user_email: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          form_submission_id?: string | null
          id?: string
          message: string
          response_id?: string | null
          site_slug?: string | null
          status: string
          subject: string
          to: string[]
          user_email?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          form_submission_id?: string | null
          id?: string
          message?: string
          response_id?: string | null
          site_slug?: string | null
          status?: string
          subject?: string
          to?: string[]
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_form_submission_id_fkey"
            columns: ["form_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string | null
          error: string | null
          html: string
          id: string
          meal_id: string | null
          sent_at: string | null
          status: string
          subject: string
          subscription_id: string | null
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          error?: string | null
          html: string
          id?: string
          meal_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          subscription_id?: string | null
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string | null
          error?: string | null
          html?: string
          id?: string
          meal_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          subscription_id?: string | null
          to_email?: string
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          pathname: string
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          pathname: string
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          pathname?: string
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          badge: string | null
          blurb: string
          category: string
          client_name: string | null
          client_url: string | null
          created_at: string
          doc_href: string | null
          external_url: string | null
          feature_order: number | null
          featured: boolean
          gallery: Json | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_public: boolean
          media_type: Database["public"]["Enums"]["feature_media_type"] | null
          org_id: string
          site_url: string | null
          slug: string
          tags: string[] | null
          thumb_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          badge?: string | null
          blurb: string
          category: string
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          doc_href?: string | null
          external_url?: string | null
          feature_order?: number | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_public?: boolean
          media_type?: Database["public"]["Enums"]["feature_media_type"] | null
          org_id: string
          site_url?: string | null
          slug: string
          tags?: string[] | null
          thumb_url?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          badge?: string | null
          blurb?: string
          category?: string
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          doc_href?: string | null
          external_url?: string | null
          feature_order?: number | null
          featured?: boolean
          gallery?: Json | null
          id?: string
          image_url?: string | null
          is_archived?: boolean
          is_public?: boolean
          media_type?: Database["public"]["Enums"]["feature_media_type"] | null
          org_id?: string
          site_url?: string | null
          slug?: string
          tags?: string[] | null
          thumb_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "features_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string | null
          email: string | null
          email_error: string | null
          email_log_id: string | null
          email_response_id: string | null
          email_status: string | null
          id: string
          name: string | null
          notification_email: string | null
          phone: string | null
          service: string | null
          site_slug: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          email_error?: string | null
          email_log_id?: string | null
          email_response_id?: string | null
          email_status?: string | null
          id?: string
          name?: string | null
          notification_email?: string | null
          phone?: string | null
          service?: string | null
          site_slug?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          email_error?: string | null
          email_log_id?: string | null
          email_response_id?: string | null
          email_status?: string | null
          id?: string
          name?: string | null
          notification_email?: string | null
          phone?: string | null
          service?: string | null
          site_slug?: string | null
          title?: string | null
        }
        Relationships: []
      }
      geo_cache: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          lat: number | null
          lon: number | null
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          state?: string | null
        }
        Relationships: []
      }
      grid_presets: {
        Row: {
          columns: number
          created_at: string | null
          id: string
          items: Json
          name: string
          tags: string[] | null
        }
        Insert: {
          columns: number
          created_at?: string | null
          id?: string
          items: Json
          name: string
          tags?: string[] | null
        }
        Update: {
          columns?: number
          created_at?: string | null
          id?: string
          items?: Json
          name?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      gsc_cache: {
        Row: {
          created_at: string | null
          data: Json
          domain: string
          end_date: string
          expires_at: string | null
          id: string
          start_date: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          domain: string
          end_date: string
          expires_at?: string | null
          id?: string
          start_date: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          domain?: string
          end_date?: string
          expires_at?: string | null
          id?: string
          start_date?: string
        }
        Relationships: []
      }
      gsc_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          domain: string
          expiry: string | null
          id: string
          refresh_token: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          domain: string
          expiry?: string | null
          id?: string
          refresh_token?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          domain?: string
          expiry?: string | null
          id?: string
          refresh_token?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      guest_conversions: {
        Row: {
          created_at: string | null
          guest_user_id: string
          id: string
          method: string | null
          new_user_id: string
        }
        Insert: {
          created_at?: string | null
          guest_user_id: string
          id?: string
          method?: string | null
          new_user_id: string
        }
        Update: {
          created_at?: string | null
          guest_user_id?: string
          id?: string
          method?: string | null
          new_user_id?: string
        }
        Relationships: []
      }
      guest_token_usage: {
        Row: {
          action: string
          created_at: string | null
          id: string
          referrer: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          referrer?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          referrer?: string | null
          user_id?: string
        }
        Relationships: []
      }
      guest_upgrade_events: {
        Row: {
          created_at: string | null
          event: string
          guest_user_id: string
          id: string
          page_url: string | null
          referrer: string | null
          trigger_reason: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string | null
          event: string
          guest_user_id: string
          id?: string
          page_url?: string | null
          referrer?: string | null
          trigger_reason?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string | null
          event?: string
          guest_user_id?: string
          id?: string
          page_url?: string | null
          referrer?: string | null
          trigger_reason?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      industries: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      industry_themes: {
        Row: {
          accent_color: string | null
          background_pattern_url: string | null
          border_radius: string | null
          dark_primary_color: string | null
          font: string | null
          industry: string
          primary_color: string | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          background_pattern_url?: string | null
          border_radius?: string | null
          dark_primary_color?: string | null
          font?: string | null
          industry: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          background_pattern_url?: string | null
          border_radius?: string | null
          dark_primary_color?: string | null
          font?: string | null
          industry?: string
          primary_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ip_geo_cache: {
        Row: {
          city: string | null
          country: string | null
          inserted_at: string | null
          ip: string
          region: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          inserted_at?: string | null
          ip: string
          region?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          inserted_at?: string | null
          ip?: string
          region?: string | null
        }
        Relationships: []
      }
      leaderboard_cache: {
        Row: {
          cached_at: string | null
          payload: Json
          range: string
          slug: string
        }
        Insert: {
          cached_at?: string | null
          payload: Json
          range: string
          slug: string
        }
        Update: {
          cached_at?: string | null
          payload?: Json
          range?: string
          slug?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_full: string | null
          address_lat: number | null
          address_lon: number | null
          address_state: string | null
          address_zip: string | null
          business_name: string | null
          campaign_id: string | null
          contact_name: string | null
          created_at: string | null
          current_campaign_expires_at: string | null
          current_campaign_id: string | null
          date_created: string | null
          domain_id: string | null
          email: string | null
          id: string
          industry: string | null
          link_type: string | null
          notes: string | null
          outreach_status: string | null
          owner_id: string | null
          phone: string | null
          source: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_full?: string | null
          address_lat?: number | null
          address_lon?: number | null
          address_state?: string | null
          address_zip?: string | null
          business_name?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          current_campaign_expires_at?: string | null
          current_campaign_id?: string | null
          date_created?: string | null
          domain_id?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          link_type?: string | null
          notes?: string | null
          outreach_status?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_full?: string | null
          address_lat?: number | null
          address_lon?: number | null
          address_state?: string | null
          address_zip?: string | null
          business_name?: string | null
          campaign_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          current_campaign_expires_at?: string | null
          current_campaign_id?: string | null
          date_created?: string | null
          domain_id?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          link_type?: string | null
          notes?: string | null
          outreach_status?: string | null
          owner_id?: string | null
          phone?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_leads_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_current_campaign_id_fkey"
            columns: ["current_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "draft_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          email: string | null
          ip: string | null
          timestamp: string | null
        }
        Insert: {
          email?: string | null
          ip?: string | null
          timestamp?: string | null
        }
        Update: {
          email?: string | null
          ip?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      meal_post_markers: {
        Row: {
          last_lastcall_at: string | null
          meal_id: string
        }
        Insert: {
          last_lastcall_at?: string | null
          meal_id: string
        }
        Update: {
          last_lastcall_at?: string | null
          meal_id?: string
        }
        Relationships: []
      }
      mehko_opt_in_counties: {
        Row: {
          active: boolean
          county: string
          created_at: string | null
          id: number
          state: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          county: string
          created_at?: string | null
          id?: number
          state: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          county?: string
          created_at?: string | null
          id?: number
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      merchant_billing: {
        Row: {
          created_at: string | null
          id: string
          merchant_id: string
          plan: string | null
          price_cents: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          merchant_id: string
          plan?: string | null
          price_cents?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          merchant_id?: string
          plan?: string | null
          price_cents?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_billing_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: true
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_compliance_profiles: {
        Row: {
          city: string | null
          country: string | null
          county: string | null
          kitchen_address: string | null
          last_reviewed_at: string | null
          merchant_id: string
          operation_type: string | null
          state: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          county?: string | null
          kitchen_address?: string | null
          last_reviewed_at?: string | null
          merchant_id: string
          operation_type?: string | null
          state?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          county?: string | null
          kitchen_address?: string | null
          last_reviewed_at?: string | null
          merchant_id?: string
          operation_type?: string | null
          state?: string | null
        }
        Relationships: []
      }
      merchant_payment_accounts: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          merchant_id: string | null
          provider: string
          provider_account_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          merchant_id?: string | null
          provider: string
          provider_account_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          merchant_id?: string | null
          provider?: string
          provider_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_payment_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          created_at: string | null
          cuisines: string[] | null
          default_currency: string
          default_platform_fee_bps: number
          display_name: string | null
          email: string | null
          id: string
          is_public: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
          provider: string
          rating_avg: number | null
          rating_count: number | null
          region: string | null
          review_code: string | null
          review_incentive_disclosure: string | null
          review_incentive_enabled: boolean
          review_incentive_expires_days: number | null
          review_incentive_min_subtotal_cents: number | null
          review_incentive_percent: number | null
          review_incentive_prefix: string | null
          site_id: string | null
          site_slug: string | null
          social_links: Json | null
          template_id: string | null
          user_id: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          cuisines?: string[] | null
          default_currency?: string
          default_platform_fee_bps?: number
          display_name?: string | null
          email?: string | null
          id?: string
          is_public?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          provider?: string
          rating_avg?: number | null
          rating_count?: number | null
          region?: string | null
          review_code?: string | null
          review_incentive_disclosure?: string | null
          review_incentive_enabled?: boolean
          review_incentive_expires_days?: number | null
          review_incentive_min_subtotal_cents?: number | null
          review_incentive_percent?: number | null
          review_incentive_prefix?: string | null
          site_id?: string | null
          site_slug?: string | null
          social_links?: Json | null
          template_id?: string | null
          user_id: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          created_at?: string | null
          cuisines?: string[] | null
          default_currency?: string
          default_platform_fee_bps?: number
          display_name?: string | null
          email?: string | null
          id?: string
          is_public?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          provider?: string
          rating_avg?: number | null
          rating_count?: number | null
          region?: string | null
          review_code?: string | null
          review_incentive_disclosure?: string | null
          review_incentive_enabled?: boolean
          review_incentive_expires_days?: number | null
          review_incentive_min_subtotal_cents?: number | null
          review_incentive_percent?: number | null
          review_incentive_prefix?: string | null
          site_id?: string | null
          site_slug?: string | null
          social_links?: Json | null
          template_id?: string | null
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      middleware_404_logs: {
        Row: {
          created_at: string
          hostname: string
          id: string
          ip_address: string | null
          pathname: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          ip_address?: string | null
          pathname: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          ip_address?: string | null
          pathname?: string
          reason?: string | null
        }
        Relationships: []
      }
      nav_events: {
        Row: {
          city: string | null
          country: string | null
          current_url: string | null
          device_type: string | null
          hash: string | null
          href: string
          id: string
          ip: string | null
          latitude: number | null
          longitude: number | null
          meta: Json | null
          org: string | null
          pathname: string | null
          referrer: string | null
          region: string | null
          search: string | null
          timestamp: string | null
          timezone: string | null
          ua_browser: string | null
          ua_device: string | null
          ua_os: string | null
          ua_platform: string | null
          ua_type: string | null
          ua_version: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          current_url?: string | null
          device_type?: string | null
          hash?: string | null
          href: string
          id?: string
          ip?: string | null
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          org?: string | null
          pathname?: string | null
          referrer?: string | null
          region?: string | null
          search?: string | null
          timestamp?: string | null
          timezone?: string | null
          ua_browser?: string | null
          ua_device?: string | null
          ua_os?: string | null
          ua_platform?: string | null
          ua_type?: string | null
          ua_version?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          current_url?: string | null
          device_type?: string | null
          hash?: string | null
          href?: string
          id?: string
          ip?: string | null
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          org?: string | null
          pathname?: string | null
          referrer?: string | null
          region?: string | null
          search?: string | null
          timestamp?: string | null
          timezone?: string | null
          ua_browser?: string | null
          ua_device?: string | null
          ua_os?: string | null
          ua_platform?: string | null
          ua_type?: string | null
          ua_version?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      nav_preferences: {
        Row: {
          disabled_flags: string[] | null
          enabled_links: string[] | null
          user_id: string
        }
        Insert: {
          disabled_flags?: string[] | null
          enabled_links?: string[] | null
          user_id: string
        }
        Update: {
          disabled_flags?: string[] | null
          enabled_links?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      not_found_logs: {
        Row: {
          context: string
          id: string
          path: string
          referrer: string | null
          timestamp: string | null
          user_agent: string | null
        }
        Insert: {
          context: string
          id?: string
          path: string
          referrer?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Update: {
          context?: string
          id?: string
          path?: string
          referrer?: string | null
          timestamp?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          catalog_item_id: string | null
          id: string
          merchant_id: string
          metadata: Json
          order_id: string
          quantity: number
          review_token: string | null
          title: string
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          catalog_item_id?: string | null
          id?: string
          merchant_id: string
          metadata?: Json
          order_id: string
          quantity?: number
          review_token?: string | null
          title: string
          total_cents?: number
          unit_price_cents: number
        }
        Update: {
          catalog_item_id?: string | null
          id?: string
          merchant_id?: string
          metadata?: Json
          order_id?: string
          quantity?: number
          review_token?: string | null
          title?: string
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_cents: number | null
          coupon_id: string | null
          created_at: string | null
          currency: string
          discount_cents: number | null
          id: string
          inventory_applied: boolean
          merchant_id: string | null
          platform_fee_cents: number
          provider: string | null
          provider_checkout_id: string | null
          provider_payment_id: string | null
          raw: Json | null
          ref: string | null
          review_token: string | null
          review_token_expires: string | null
          review_token_issued_at: string | null
          shipping_cents: number
          site_id: string | null
          site_slug: string | null
          status: string
          subtotal_cents: number
          tax_cents: number
          total_cents: number
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          amount_cents?: number | null
          coupon_id?: string | null
          created_at?: string | null
          currency?: string
          discount_cents?: number | null
          id?: string
          inventory_applied?: boolean
          merchant_id?: string | null
          platform_fee_cents?: number
          provider?: string | null
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          ref?: string | null
          review_token?: string | null
          review_token_expires?: string | null
          review_token_issued_at?: string | null
          shipping_cents?: number
          site_id?: string | null
          site_slug?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          amount_cents?: number | null
          coupon_id?: string | null
          created_at?: string | null
          currency?: string
          discount_cents?: number | null
          id?: string
          inventory_applied?: boolean
          merchant_id?: string | null
          platform_fee_cents?: number
          provider?: string | null
          provider_checkout_id?: string | null
          provider_payment_id?: string | null
          raw?: Json | null
          ref?: string | null
          review_token?: string | null
          review_token_expires?: string | null
          review_token_issued_at?: string | null
          shipping_cents?: number
          site_id?: string | null
          site_slug?: string | null
          status?: string
          subtotal_cents?: number
          tax_cents?: number
          total_cents?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_domains: {
        Row: {
          host: string
          kind: string
          org_id: string
        }
        Insert: {
          host: string
          kind: string
          org_id: string
        }
        Update: {
          host?: string
          kind?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string | null
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          admin_domain: string | null
          billing_mode: string | null
          branding: Json | null
          canonical_host: string | null
          created_at: string | null
          dark_logo_url: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          name: string
          primary_domain: string | null
          primary_domain_verified: boolean | null
          site_base_domain: string | null
          slug: string
          stripe_connect_account_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          support_email: string | null
          support_url: string | null
          theme_json: Json | null
          updated_at: string | null
          wildcard_enabled: boolean | null
        }
        Insert: {
          admin_domain?: string | null
          billing_mode?: string | null
          branding?: Json | null
          canonical_host?: string | null
          created_at?: string | null
          dark_logo_url?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_domain?: string | null
          primary_domain_verified?: boolean | null
          site_base_domain?: string | null
          slug: string
          stripe_connect_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          support_email?: string | null
          support_url?: string | null
          theme_json?: Json | null
          updated_at?: string | null
          wildcard_enabled?: boolean | null
        }
        Update: {
          admin_domain?: string | null
          billing_mode?: string | null
          branding?: Json | null
          canonical_host?: string | null
          created_at?: string | null
          dark_logo_url?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          primary_domain?: string | null
          primary_domain_verified?: boolean | null
          site_base_domain?: string | null
          slug?: string
          stripe_connect_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          support_email?: string | null
          support_url?: string | null
          theme_json?: Json | null
          updated_at?: string | null
          wildcard_enabled?: boolean | null
        }
        Relationships: []
      }
      param_presets: {
        Row: {
          created_at: string | null
          id: string
          name: string
          query: string
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          query: string
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          query?: string
          slug?: string
        }
        Relationships: []
      }
      partner_payout_accounts: {
        Row: {
          account_ref: string | null
          created_at: string
          id: string
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_ref?: string | null
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_ref?: string | null
          created_at?: string
          id?: string
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_ref: string
          capabilities: Json
          collect_platform_fee: boolean
          created_at: string
          id: string
          merchant_id: string
          platform_fee_min_cents: number
          platform_fee_percent: number
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          account_ref: string
          capabilities?: Json
          collect_platform_fee?: boolean
          created_at?: string
          id?: string
          merchant_id: string
          platform_fee_min_cents?: number
          platform_fee_percent?: number
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_ref?: string
          capabilities?: Json
          collect_platform_fee?: boolean
          created_at?: string
          id?: string
          merchant_id?: string
          platform_fee_min_cents?: number
          platform_fee_percent?: number
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          order_id: string
          provider: string
          provider_payment_id: string
          raw: Json
          state: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          order_id: string
          provider: string
          provider_payment_id: string
          raw: Json
          state: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          order_id?: string
          provider?: string
          provider_payment_id?: string
          raw?: Json
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_run_items: {
        Row: {
          approved_cents_before: number
          created_at: string
          id: string
          marked_paid_cents: number
          payout_run_id: string
          referral_code: string
          rows_marked: number
        }
        Insert: {
          approved_cents_before: number
          created_at?: string
          id?: string
          marked_paid_cents: number
          payout_run_id: string
          referral_code: string
          rows_marked: number
        }
        Update: {
          approved_cents_before?: number
          created_at?: string
          id?: string
          marked_paid_cents?: number
          payout_run_id?: string
          referral_code?: string
          rows_marked?: number
        }
        Relationships: [
          {
            foreignKeyName: "payout_run_items_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "payout_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_runs: {
        Row: {
          actor_email: string | null
          actor_user_id: string
          codes: string[]
          count_codes: number
          count_rows_marked: number
          created_at: string
          id: string
          meta: Json
          range_end: string
          range_start: string
          total_approved_cents_before: number
          total_marked_paid_cents: number
        }
        Insert: {
          actor_email?: string | null
          actor_user_id: string
          codes: string[]
          count_codes: number
          count_rows_marked: number
          created_at?: string
          id?: string
          meta?: Json
          range_end: string
          range_start: string
          total_approved_cents_before: number
          total_marked_paid_cents: number
        }
        Update: {
          actor_email?: string | null
          actor_user_id?: string
          codes?: string[]
          count_codes?: number
          count_rows_marked?: number
          created_at?: string
          id?: string
          meta?: Json
          range_end?: string
          range_start?: string
          total_approved_cents_before?: number
          total_marked_paid_cents?: number
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          email: string | null
          emoji: string | null
          goal_tags: string[] | null
          handle: string | null
          updated_at: string | null
          user_id: string
          visible: boolean | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          emoji?: string | null
          goal_tags?: string[] | null
          handle?: string | null
          updated_at?: string | null
          user_id: string
          visible?: boolean | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          email?: string | null
          emoji?: string | null
          goal_tags?: string[] | null
          handle?: string | null
          updated_at?: string | null
          user_id?: string
          visible?: boolean | null
        }
        Relationships: []
      }
      public_sites: {
        Row: {
          branding_profile_id: string | null
          created_at: string | null
          id: string
          is_public: boolean | null
          language: string | null
          owner_id: string | null
          published_at: string | null
          qr_url: string | null
          slug: string
          snapshot_id: string | null
          status: string | null
        }
        Insert: {
          branding_profile_id?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          language?: string | null
          owner_id?: string | null
          published_at?: string | null
          qr_url?: string | null
          slug: string
          snapshot_id?: string | null
          status?: string | null
        }
        Update: {
          branding_profile_id?: string | null
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          language?: string | null
          owner_id?: string | null
          published_at?: string | null
          qr_url?: string | null
          slug?: string
          snapshot_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_branding_profile"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branding_profile"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      published_site_views: {
        Row: {
          id: string
          referrer: string | null
          site_id: string | null
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          referrer?: string | null
          site_id?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          referrer?: string | null
          site_id?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "published_site_views_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "public_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      published_sites: {
        Row: {
          branding_profile_id: string | null
          domain: string
          id: string
          is_public: boolean | null
          og_image_url: string | null
          published_at: string | null
          snapshot_id: string | null
          status: string | null
          template_id: string
        }
        Insert: {
          branding_profile_id?: string | null
          domain: string
          id?: string
          is_public?: boolean | null
          og_image_url?: string | null
          published_at?: string | null
          snapshot_id?: string | null
          status?: string | null
          template_id: string
        }
        Update: {
          branding_profile_id?: string | null
          domain?: string
          id?: string
          is_public?: boolean | null
          og_image_url?: string | null
          published_at?: string | null
          snapshot_id?: string | null
          status?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_branding_profile"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_branding_profile"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "published_sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "published_sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      published_versions: {
        Row: {
          branding_profile_id: string | null
          created_at: string | null
          id: string
          primary_color: string | null
          secondary_color: string | null
          slug: string
          snapshot_id: string
        }
        Insert: {
          branding_profile_id?: string | null
          created_at?: string | null
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          snapshot_id: string
        }
        Update: {
          branding_profile_id?: string | null
          created_at?: string | null
          id?: string
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          snapshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "published_versions_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "published_versions_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scan_events: {
        Row: {
          code: string
          created_at: string | null
          id: number
          merchant_id: string
          referer: string | null
          ua: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: number
          merchant_id: string
          referer?: string | null
          ua?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: number
          merchant_id?: string
          referer?: string | null
          ua?: string | null
        }
        Relationships: []
      }
      ratelimit_events: {
        Row: {
          key: string
          ts: string
        }
        Insert: {
          key: string
          ts?: string
        }
        Update: {
          key?: string
          ts?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          owner_id: string
          owner_type: string
          plan: Json
        }
        Insert: {
          code: string
          owner_id: string
          owner_type: string
          plan: Json
        }
        Update: {
          code?: string
          owner_id?: string
          owner_type?: string
          plan?: Json
        }
        Relationships: []
      }
      referral_logs: {
        Row: {
          campaign: string | null
          email: string | null
          id: string
          joined_at: string | null
          ref: string | null
          source: string | null
        }
        Insert: {
          campaign?: string | null
          email?: string | null
          id?: string
          joined_at?: string | null
          ref?: string | null
          source?: string | null
        }
        Update: {
          campaign?: string | null
          email?: string | null
          id?: string
          joined_at?: string | null
          ref?: string | null
          source?: string | null
        }
        Relationships: []
      }
      referral_payouts: {
        Row: {
          amount: number | null
          id: string
          note: string | null
          paid_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          note?: string | null
          paid_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          note?: string | null
          paid_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string | null
          id: string
          referred_email: string | null
          referrer_id: string
          reward_points: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          referred_email?: string | null
          referrer_id: string
          reward_points?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          referred_email?: string | null
          referrer_id?: string
          reward_points?: number | null
        }
        Relationships: []
      }
      refund_events: {
        Row: {
          action: string
          actor_role: string
          created_at: string | null
          detail: string | null
          id: number
          refund_id: string
        }
        Insert: {
          action: string
          actor_role: string
          created_at?: string | null
          detail?: string | null
          id?: number
          refund_id: string
        }
        Update: {
          action?: string
          actor_role?: string
          created_at?: string | null
          detail?: string | null
          id?: number
          refund_id?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          approved_cents: number | null
          created_at: string | null
          id: string
          merchant_id: string
          notes: string | null
          order_id: string
          order_item_id: string | null
          payment_provider: string
          provider_payment_id: string
          provider_refund_id: string | null
          reason: string
          requested_cents: number
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_cents?: number | null
          created_at?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          payment_provider: string
          provider_payment_id: string
          provider_refund_id?: string | null
          reason: string
          requested_cents: number
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_cents?: number | null
          created_at?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          payment_provider?: string
          provider_payment_id?: string
          provider_refund_id?: string | null
          reason?: string
          requested_cents?: number
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      regeneration_logs: {
        Row: {
          city: string | null
          domain: string
          id: string
          state: string | null
          status: string | null
          template_id: string
          timestamp: string | null
        }
        Insert: {
          city?: string | null
          domain: string
          id?: string
          state?: string | null
          status?: string | null
          template_id: string
          timestamp?: string | null
        }
        Update: {
          city?: string | null
          domain?: string
          id?: string
          state?: string | null
          status?: string | null
          template_id?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      regeneration_queue: {
        Row: {
          city: string
          created_at: string | null
          domain: string
          finished_at: string | null
          id: string
          log: string | null
          started_at: string | null
          state: string
          status: string | null
          template_id: string
        }
        Insert: {
          city: string
          created_at?: string | null
          domain: string
          finished_at?: string | null
          id?: string
          log?: string | null
          started_at?: string | null
          state: string
          status?: string | null
          template_id: string
        }
        Update: {
          city?: string
          created_at?: string | null
          domain?: string
          finished_at?: string | null
          id?: string
          log?: string | null
          started_at?: string | null
          state?: string
          status?: string | null
          template_id?: string
        }
        Relationships: []
      }
      remix_events: {
        Row: {
          created_at: string | null
          id: string
          original_snapshot_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_snapshot_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          original_snapshot_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      report_tokens: {
        Row: {
          expires_at: string | null
          file_name: string | null
          id: string
          token_hash: string | null
        }
        Insert: {
          expires_at?: string | null
          file_name?: string | null
          id?: string
          token_hash?: string | null
        }
        Update: {
          expires_at?: string | null
          file_name?: string | null
          id?: string
          token_hash?: string | null
        }
        Relationships: []
      }
      report_webhooks: {
        Row: {
          enabled: boolean | null
          event: string
          id: string
          secret_token: string | null
          url: string
        }
        Insert: {
          enabled?: boolean | null
          event: string
          id?: string
          secret_token?: string | null
          url: string
        }
        Update: {
          enabled?: boolean | null
          event?: string
          id?: string
          secret_token?: string | null
          url?: string
        }
        Relationships: []
      }
      review_helpful_votes: {
        Row: {
          created_at: string | null
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          review_id?: string
          user_id?: string
        }
        Relationships: []
      }
      review_token_events: {
        Row: {
          action: string
          created_at: string | null
          id: number
          ip: unknown
          order_id: string | null
          order_item_id: string | null
          token: string
          ua: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: number
          ip?: unknown
          order_id?: string | null
          order_item_id?: string | null
          token: string
          ua?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: number
          ip?: unknown
          order_id?: string | null
          order_item_id?: string | null
          token?: string
          ua?: string | null
        }
        Relationships: []
      }
      role_change_logs: {
        Row: {
          changed_at: string | null
          changed_by: string
          id: string
          new_role: string
          user_email: string
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          id?: string
          new_role: string
          user_email: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_role?: string
          user_email?: string
        }
        Relationships: []
      }
      scheduled_posts: {
        Row: {
          attempts: number
          created_at: string | null
          id: string
          image_url: string | null
          kind: string
          last_error: string | null
          link_url: string
          meal_id: string
          merchant_id: string
          network: string
          scheduled_for: string
          sent_at: string | null
          status: string
          text: string
          webhook_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          kind: string
          last_error?: string | null
          link_url: string
          meal_id: string
          merchant_id: string
          network: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          text: string
          webhook_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          last_error?: string | null
          link_url?: string
          meal_id?: string
          merchant_id?: string
          network?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          text?: string
          webhook_id?: string | null
        }
        Relationships: []
      }
      screenshot_queue: {
        Row: {
          completed_at: string | null
          domain: string
          id: string
          requested_at: string | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          domain: string
          id?: string
          requested_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          domain?: string
          id?: string
          requested_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      session_logs: {
        Row: {
          device: string | null
          email: string | null
          event: string | null
          id: string
          is_mobile: boolean | null
          timestamp: string
          token_end: string | null
          token_start: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          device?: string | null
          email?: string | null
          event?: string | null
          id?: string
          is_mobile?: boolean | null
          timestamp: string
          token_end?: string | null
          token_start?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          device?: string | null
          email?: string | null
          event?: string | null
          id?: string
          is_mobile?: boolean | null
          timestamp?: string
          token_end?: string | null
          token_start?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shared_previews: {
        Row: {
          created_at: string | null
          id: string
          template_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          template_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          template_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      shared_templates: {
        Row: {
          data: Json
          editor_email: string | null
          id: string
          shared_at: string | null
          template_name: string
        }
        Insert: {
          data: Json
          editor_email?: string | null
          id?: string
          shared_at?: string | null
          template_name: string
        }
        Update: {
          data?: Json
          editor_email?: string | null
          id?: string
          shared_at?: string | null
          template_name?: string
        }
        Relationships: []
      }
      short_link_clicks: {
        Row: {
          code: string
          id: number
          ip: unknown
          referer: string | null
          ts: string | null
          ua: string | null
        }
        Insert: {
          code: string
          id?: number
          ip?: unknown
          referer?: string | null
          ts?: string | null
          ua?: string | null
        }
        Update: {
          code?: string
          id?: number
          ip?: unknown
          referer?: string | null
          ts?: string | null
          ua?: string | null
        }
        Relationships: []
      }
      short_links: {
        Row: {
          candidate_slug: string | null
          code: string
          created_at: string | null
          created_by: string | null
          id: string
          long_url: string
          meal_id: string | null
          merchant_id: string | null
          target_url: string | null
        }
        Insert: {
          candidate_slug?: string | null
          code: string
          created_at?: string | null
          created_by?: string | null
          id: string
          long_url: string
          meal_id?: string | null
          merchant_id?: string | null
          target_url?: string | null
        }
        Update: {
          candidate_slug?: string | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          long_url?: string
          meal_id?: string | null
          merchant_id?: string | null
          target_url?: string | null
        }
        Relationships: []
      }
      short_scans: {
        Row: {
          city: string | null
          code: string
          id: number
          ip: unknown
          region: string | null
          ts: string | null
          ua: string | null
        }
        Insert: {
          city?: string | null
          code: string
          id?: number
          ip?: unknown
          region?: string | null
          ts?: string | null
          ua?: string | null
        }
        Update: {
          city?: string | null
          code?: string
          id?: number
          ip?: unknown
          region?: string | null
          ts?: string | null
          ua?: string | null
        }
        Relationships: []
      }
      site_edits: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          site_id: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          content: Json
          created_at?: string | null
          id?: string
          site_id: string
          snapshot: Json
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          site_id?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_edits_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_events: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload: Json
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: []
      }
      site_merchants: {
        Row: {
          created_at: string | null
          merchant_id: string
          role: string
          site_id: string
          status: string
        }
        Insert: {
          created_at?: string | null
          merchant_id: string
          role?: string
          site_id: string
          status?: string
        }
        Update: {
          created_at?: string | null
          merchant_id?: string
          role?: string
          site_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_merchants_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      site_referrals: {
        Row: {
          id: string
          referer: string | null
          site_id: string | null
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          referer?: string | null
          site_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          referer?: string | null
          site_id?: string | null
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_referrals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_themes: {
        Row: {
          id: string
          is_default: boolean | null
          site_slug: string | null
          theme_data: Json | null
          theme_name: string | null
          user_id: string | null
        }
        Insert: {
          id: string
          is_default?: boolean | null
          site_slug?: string | null
          theme_data?: Json | null
          theme_name?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_default?: boolean | null
          site_slug?: string | null
          theme_data?: Json | null
          theme_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sitemap_logs: {
        Row: {
          action: string | null
          created_at: string | null
          error: string | null
          id: string
          sitemap_url: string | null
          status: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          sitemap_url?: string | null
          status?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          sitemap_url?: string | null
          status?: string | null
        }
        Relationships: []
      }
      sites: {
        Row: {
          branding_profile_id: string | null
          business_name: string | null
          company_id: string | null
          created_at: string | null
          data: Json
          domain: string | null
          id: string
          is_published: boolean | null
          location: string | null
          platform_fee_bps: number | null
          published_at: string | null
          published_rev: number | null
          published_snapshot_id: string | null
          seo_description: string | null
          seo_title: string | null
          site_name: string | null
          slug: string
          template_id: string | null
          template_version_id: string | null
          twitter_handle: string | null
          updated_at: string | null
          vanity_url: string | null
        }
        Insert: {
          branding_profile_id?: string | null
          business_name?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: Json
          domain?: string | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          platform_fee_bps?: number | null
          published_at?: string | null
          published_rev?: number | null
          published_snapshot_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string | null
          slug: string
          template_id?: string | null
          template_version_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          vanity_url?: string | null
        }
        Update: {
          branding_profile_id?: string | null
          business_name?: string | null
          company_id?: string | null
          created_at?: string | null
          data?: Json
          domain?: string | null
          id?: string
          is_published?: boolean | null
          location?: string | null
          platform_fee_bps?: number | null
          published_at?: string | null
          published_rev?: number | null
          published_snapshot_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          site_name?: string | null
          slug?: string
          template_id?: string | null
          template_version_id?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          vanity_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_published_snapshot_fk"
            columns: ["published_snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_template_version_id_fkey"
            columns: ["template_version_id"]
            isOneToOne: false
            referencedRelation: "template_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_views: {
        Row: {
          id: string
          ip_address: string | null
          template_name: string
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          ip_address?: string | null
          template_name: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          ip_address?: string | null
          template_name?: string
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          assets_resolved: Json
          banner_url: string | null
          banner_url_meta: Json | null
          brand: string | null
          branding_profile_id: string | null
          business_name: string | null
          city: string | null
          color_mode: string | null
          color_scheme: string | null
          commit_message: string | null
          contact_email: string | null
          created_at: string | null
          custom_domain: string | null
          data: Json | null
          domain: string | null
          editor_email: string | null
          footer_block: Json | null
          gallery_meta: Json | null
          hash: string
          header_block: Json | null
          hero_url: string | null
          hero_url_meta: Json | null
          id: string
          industry: string | null
          is_site: boolean | null
          label: string | null
          latitude: number | null
          layout: string | null
          logo_url: string | null
          logo_url_meta: Json | null
          longitude: number | null
          meta: Json | null
          owner_id: string | null
          phone: string | null
          postal_code: string | null
          published: boolean | null
          published_at: string | null
          published_by: string | null
          published_version_id: string | null
          rev: number
          services_jsonb: Json
          shared_at: string | null
          state: string | null
          team_url: string | null
          template_id: string | null
          template_name: string | null
          template_slug: string | null
          theme: string | null
          thumbnail_url: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          assets_resolved?: Json
          banner_url?: string | null
          banner_url_meta?: Json | null
          brand?: string | null
          branding_profile_id?: string | null
          business_name?: string | null
          city?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit_message?: string | null
          contact_email?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data?: Json | null
          domain?: string | null
          editor_email?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          hash: string
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          id?: string
          industry?: string | null
          is_site?: boolean | null
          label?: string | null
          latitude?: number | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          longitude?: number | null
          meta?: Json | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          published?: boolean | null
          published_at?: string | null
          published_by?: string | null
          published_version_id?: string | null
          rev: number
          services_jsonb?: Json
          shared_at?: string | null
          state?: string | null
          team_url?: string | null
          template_id?: string | null
          template_name?: string | null
          template_slug?: string | null
          theme?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          assets_resolved?: Json
          banner_url?: string | null
          banner_url_meta?: Json | null
          brand?: string | null
          branding_profile_id?: string | null
          business_name?: string | null
          city?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit_message?: string | null
          contact_email?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data?: Json | null
          domain?: string | null
          editor_email?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          hash?: string
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          id?: string
          industry?: string | null
          is_site?: boolean | null
          label?: string | null
          latitude?: number | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          longitude?: number | null
          meta?: Json | null
          owner_id?: string | null
          phone?: string | null
          postal_code?: string | null
          published?: boolean | null
          published_at?: string | null
          published_by?: string | null
          published_version_id?: string | null
          rev?: number
          services_jsonb?: Json
          shared_at?: string | null
          state?: string | null
          team_url?: string | null
          template_id?: string | null
          template_name?: string | null
          template_slug?: string | null
          theme?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_branding_profile_id_fkey"
            columns: ["branding_profile_id"]
            isOneToOne: false
            referencedRelation: "branding_profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "snapshots_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "snapshots_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshots_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string | null
          id: string
          merchant_id: string
          provider: string
          refresh_token: string | null
          user_handle: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          merchant_id: string
          provider: string
          refresh_token?: string | null
          user_handle?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          merchant_id?: string
          provider?: string
          refresh_token?: string | null
          user_handle?: string | null
        }
        Relationships: []
      }
      social_webhooks: {
        Row: {
          created_at: string | null
          default_hashtags: string | null
          enabled: boolean
          endpoint_url: string
          id: string
          kind: string
          last_test_at: string | null
          last_test_error: string | null
          last_test_status: string | null
          merchant_id: string
          name: string
          template_include_image: boolean
          template_include_link: boolean
          template_text_custom: string | null
          template_text_drop: string | null
          template_text_last_call: string | null
        }
        Insert: {
          created_at?: string | null
          default_hashtags?: string | null
          enabled?: boolean
          endpoint_url: string
          id?: string
          kind?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          merchant_id: string
          name: string
          template_include_image?: boolean
          template_include_link?: boolean
          template_text_custom?: string | null
          template_text_drop?: string | null
          template_text_last_call?: string | null
        }
        Update: {
          created_at?: string | null
          default_hashtags?: string | null
          enabled?: boolean
          endpoint_url?: string
          id?: string
          kind?: string
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_status?: string | null
          merchant_id?: string
          name?: string
          template_include_image?: boolean
          template_include_link?: boolean
          template_text_custom?: string | null
          template_text_drop?: string | null
          template_text_last_call?: string | null
        }
        Relationships: []
      }
      starter_templates: {
        Row: {
          data: Json | null
          description: string | null
          id: string
          name: string | null
          preview: string | null
          template_id: string | null
        }
        Insert: {
          data?: Json | null
          description?: string | null
          id: string
          name?: string | null
          preview?: string | null
          template_id?: string | null
        }
        Update: {
          data?: Json | null
          description?: string | null
          id?: string
          name?: string | null
          preview?: string | null
          template_id?: string | null
        }
        Relationships: []
      }
      steward_rewards: {
        Row: {
          created_at: string | null
          id: string
          points: number | null
          reason: string | null
          site_domain: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          points?: number | null
          reason?: string | null
          site_domain?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          points?: number | null
          reason?: string | null
          site_domain?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          domain: string | null
          email: string | null
          id: string
          subscribed_at: string | null
          unsubscribe_token: string | null
        }
        Insert: {
          domain?: string | null
          email?: string | null
          id?: string
          subscribed_at?: string | null
          unsubscribe_token?: string | null
        }
        Update: {
          domain?: string | null
          email?: string | null
          id?: string
          subscribed_at?: string | null
          unsubscribe_token?: string | null
        }
        Relationships: []
      }
      support_campaigns: {
        Row: {
          block_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          goal_count: number | null
          headline: string | null
          id: string
          preclaim_token: string | null
          slug: string
          target_action: string | null
        }
        Insert: {
          block_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          goal_count?: number | null
          headline?: string | null
          id?: string
          preclaim_token?: string | null
          slug: string
          target_action?: string | null
        }
        Update: {
          block_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          goal_count?: number | null
          headline?: string | null
          id?: string
          preclaim_token?: string | null
          slug?: string
          target_action?: string | null
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          receiver_handle: string
          requester_id: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_handle: string
          requester_id?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          receiver_handle?: string
          requester_id?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string | null
          id: string
          meal_id: string | null
          merchant_id: string
          message: string
          order_id: string
          order_item_id: string | null
          photos: Json | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          meal_id?: string | null
          merchant_id: string
          message: string
          order_id: string
          order_item_id?: string | null
          photos?: Json | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          meal_id?: string | null
          merchant_id?: string
          message?: string
          order_id?: string
          order_item_id?: string | null
          photos?: Json | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supporters: {
        Row: {
          candidate_slug: string | null
          created_at: string | null
          email: string
          id: string
          zip: string
        }
        Insert: {
          candidate_slug?: string | null
          created_at?: string | null
          email: string
          id?: string
          zip: string
        }
        Update: {
          candidate_slug?: string | null
          created_at?: string | null
          email?: string
          id?: string
          zip?: string
        }
        Relationships: []
      }
      template_admin_meta: {
        Row: {
          deprecated_files: Json
          template_id: string
          updated_at: string
        }
        Insert: {
          deprecated_files?: Json
          template_id: string
          updated_at?: string
        }
        Update: {
          deprecated_files?: Json
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_admin_meta_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_admin_meta_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_admin_meta_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_admin_meta_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_admin_meta_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: true
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_base_meta: {
        Row: {
          base_slug: string
          canonical_pin_slug: string | null
          display_name: string | null
        }
        Insert: {
          base_slug: string
          canonical_pin_slug?: string | null
          display_name?: string | null
        }
        Update: {
          base_slug?: string
          canonical_pin_slug?: string | null
          display_name?: string | null
        }
        Relationships: []
      }
      template_edits: {
        Row: {
          content: Json | null
          created_at: string | null
          id: string
          snapshot: Json
          template_id: string
          user_id: string
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          id?: string
          snapshot: Json
          template_id: string
          user_id: string
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          id?: string
          snapshot?: Json
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_edits_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_events: {
        Row: {
          actor: Json | null
          at: string
          diff: Json | null
          fields_touched: Json | null
          id: string
          meta: Json | null
          rev_after: number | null
          rev_before: number | null
          template_id: string
          type: string
        }
        Insert: {
          actor?: Json | null
          at?: string
          diff?: Json | null
          fields_touched?: Json | null
          id?: string
          meta?: Json | null
          rev_after?: number | null
          rev_before?: number | null
          template_id: string
          type: string
        }
        Update: {
          actor?: Json | null
          at?: string
          diff?: Json | null
          fields_touched?: Json | null
          id?: string
          meta?: Json | null
          rev_after?: number | null
          rev_before?: number | null
          template_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_images: {
        Row: {
          id: string
          original_name: string | null
          path: string
          template_id: string | null
          type: string | null
          uploaded_at: string | null
          url: string
        }
        Insert: {
          id?: string
          original_name?: string | null
          path: string
          template_id?: string | null
          type?: string | null
          uploaded_at?: string | null
          url: string
        }
        Update: {
          id?: string
          original_name?: string | null
          path?: string
          template_id?: string | null
          type?: string | null
          uploaded_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_images_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_logs: {
        Row: {
          action: string
          actor: string | null
          id: string
          template_name: string
          timestamp: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          id?: string
          template_name: string
          timestamp?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          id?: string
          template_name?: string
          timestamp?: string | null
        }
        Relationships: []
      }
      template_versions: {
        Row: {
          commit_message: string | null
          created_at: string | null
          diff: Json | null
          editor_id: string | null
          forced_revert: boolean | null
          full_data: Json | null
          id: string
          saved_at: string | null
          template_id: string | null
          template_name: string
          thumbnail_url: string | null
        }
        Insert: {
          commit_message?: string | null
          created_at?: string | null
          diff?: Json | null
          editor_id?: string | null
          forced_revert?: boolean | null
          full_data?: Json | null
          id?: string
          saved_at?: string | null
          template_id?: string | null
          template_name: string
          thumbnail_url?: string | null
        }
        Update: {
          commit_message?: string | null
          created_at?: string | null
          diff?: Json | null
          editor_id?: string | null
          forced_revert?: boolean | null
          full_data?: Json | null
          id?: string
          saved_at?: string | null
          template_id?: string | null
          template_name?: string
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "template_bases_secure"
            referencedColumns: ["canonical_id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_latest"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      template_views: {
        Row: {
          domain: string | null
          id: string
          ip_address: string | null
          template_name: string | null
          user_agent: string | null
          viewed_at: string | null
        }
        Insert: {
          domain?: string | null
          id?: string
          ip_address?: string | null
          template_name?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Update: {
          domain?: string | null
          id?: string
          ip_address?: string | null
          template_name?: string | null
          user_agent?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived: boolean | null
          banner_url: string | null
          banner_url_meta: Json | null
          base_slug: string | null
          brand: string | null
          business_name: string | null
          city: string | null
          claim_source: string | null
          claimed_at: string | null
          claimed_by: string | null
          color_mode: string | null
          color_scheme: string | null
          commit: string | null
          company_id: string | null
          contact_email: string | null
          created_at: string | null
          custom_domain: string | null
          data: Json
          default_subdomain: string | null
          domain: string | null
          domain_lc: string | null
          editor_id: string | null
          footer_block: Json | null
          gallery_meta: Json | null
          header_block: Json | null
          hero_url: string | null
          hero_url_meta: Json | null
          hours: Json | null
          id: string
          industry: string | null
          industry_gen: string | null
          industry_label: string | null
          is_site: boolean | null
          is_version: boolean | null
          last_editor: string | null
          latitude: number | null
          layout: string | null
          logo_url: string | null
          logo_url_meta: Json | null
          longitude: number | null
          merchant_id: string | null
          meta: Json | null
          name: string | null
          org_id: string | null
          owner_id: string | null
          phone: string | null
          phone_gen: string | null
          postal_code: string | null
          published: boolean | null
          published_at: string | null
          published_by: string | null
          published_version_id: string | null
          rev: number
          save_count: number | null
          saved_at: string | null
          search_engines_last_ping_response: Json | null
          search_engines_last_pinged_at: string | null
          services: Json | null
          services_jsonb: Json
          site_id: string | null
          site_type: string | null
          site_type_key: string | null
          site_type_label: string | null
          slug: string | null
          state: string | null
          team_url: string | null
          template_name: string
          theme: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived?: boolean | null
          banner_url?: string | null
          banner_url_meta?: Json | null
          base_slug?: string | null
          brand?: string | null
          business_name?: string | null
          city?: string | null
          claim_source?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit?: string | null
          company_id?: string | null
          contact_email?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data: Json
          default_subdomain?: string | null
          domain?: string | null
          domain_lc?: string | null
          editor_id?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          hours?: Json | null
          id?: string
          industry?: string | null
          industry_gen?: string | null
          industry_label?: string | null
          is_site?: boolean | null
          is_version?: boolean | null
          last_editor?: string | null
          latitude?: number | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          longitude?: number | null
          merchant_id?: string | null
          meta?: Json | null
          name?: string | null
          org_id?: string | null
          owner_id?: string | null
          phone?: string | null
          phone_gen?: string | null
          postal_code?: string | null
          published?: boolean | null
          published_at?: string | null
          published_by?: string | null
          published_version_id?: string | null
          rev?: number
          save_count?: number | null
          saved_at?: string | null
          search_engines_last_ping_response?: Json | null
          search_engines_last_pinged_at?: string | null
          services?: Json | null
          services_jsonb?: Json
          site_id?: string | null
          site_type?: string | null
          site_type_key?: string | null
          site_type_label?: string | null
          slug?: string | null
          state?: string | null
          team_url?: string | null
          template_name: string
          theme?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived?: boolean | null
          banner_url?: string | null
          banner_url_meta?: Json | null
          base_slug?: string | null
          brand?: string | null
          business_name?: string | null
          city?: string | null
          claim_source?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit?: string | null
          company_id?: string | null
          contact_email?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data?: Json
          default_subdomain?: string | null
          domain?: string | null
          domain_lc?: string | null
          editor_id?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          hours?: Json | null
          id?: string
          industry?: string | null
          industry_gen?: string | null
          industry_label?: string | null
          is_site?: boolean | null
          is_version?: boolean | null
          last_editor?: string | null
          latitude?: number | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          longitude?: number | null
          merchant_id?: string | null
          meta?: Json | null
          name?: string | null
          org_id?: string | null
          owner_id?: string | null
          phone?: string | null
          phone_gen?: string | null
          postal_code?: string | null
          published?: boolean | null
          published_at?: string | null
          published_by?: string | null
          published_version_id?: string | null
          rev?: number
          save_count?: number | null
          saved_at?: string | null
          search_engines_last_ping_response?: Json | null
          search_engines_last_pinged_at?: string | null
          services?: Json | null
          services_jsonb?: Json
          site_id?: string | null
          site_type?: string | null
          site_type_key?: string | null
          site_type_label?: string | null
          slug?: string | null
          state?: string | null
          team_url?: string | null
          template_name?: string
          theme?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonial_presets: {
        Row: {
          attribution: string | null
          created_at: string | null
          id: string
          industry: string
          quote: string
          tags: string[] | null
        }
        Insert: {
          attribution?: string | null
          created_at?: string | null
          id?: string
          industry: string
          quote: string
          tags?: string[] | null
        }
        Update: {
          attribution?: string | null
          created_at?: string | null
          id?: string
          industry?: string
          quote?: string
          tags?: string[] | null
        }
        Relationships: []
      }
      thank_you_notes: {
        Row: {
          block_id: string | null
          created_at: string | null
          id: string
          message: string | null
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          block_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          block_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: []
      }
      theme_presets: {
        Row: {
          accent_color: string | null
          border_radius: string | null
          created_at: string | null
          dark_mode: string | null
          font_family: string | null
          glow_config: Json | null
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          accent_color?: string | null
          border_radius?: string | null
          created_at?: string | null
          dark_mode?: string | null
          font_family?: string | null
          glow_config?: Json | null
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          accent_color?: string | null
          border_radius?: string | null
          created_at?: string | null
          dark_mode?: string | null
          font_family?: string | null
          glow_config?: Json | null
          id?: string
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      token_logs: {
        Row: {
          downloaded_at: string | null
          file_name: string | null
          id: string
          ip_address: string | null
          ip_location: string | null
          token_hash: string | null
          user_agent: string | null
        }
        Insert: {
          downloaded_at?: string | null
          file_name?: string | null
          id?: string
          ip_address?: string | null
          ip_location?: string | null
          token_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          downloaded_at?: string | null
          file_name?: string | null
          id?: string
          ip_address?: string | null
          ip_location?: string | null
          token_hash?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      tracking_checkins: {
        Row: {
          block_id: string | null
          checked_at: string | null
          id: string
          slug: string
          user_id: string
        }
        Insert: {
          block_id?: string | null
          checked_at?: string | null
          id?: string
          slug: string
          user_id: string
        }
        Update: {
          block_id?: string | null
          checked_at?: string | null
          id?: string
          slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_checkins_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_action_logs: {
        Row: {
          action_type: string
          domain_id: string | null
          id: string
          lead_id: string | null
          timestamp: string | null
          triggered_by: string | null
        }
        Insert: {
          action_type: string
          domain_id?: string | null
          id?: string
          lead_id?: string | null
          timestamp?: string | null
          triggered_by?: string | null
        }
        Update: {
          action_type?: string
          domain_id?: string | null
          id?: string
          lead_id?: string | null
          timestamp?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_action_logs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "draft_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_action_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_deletion_logs: {
        Row: {
          deleted_at: string | null
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          deleted_at?: string | null
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          deleted_at?: string | null
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          cancel_at: string | null
          current_period_end: string | null
          notes: string | null
          plan: string
          price_id: string | null
          status: string
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at?: string | null
          current_period_end?: string | null
          notes?: string | null
          plan?: string
          price_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at?: string | null
          current_period_end?: string | null
          notes?: string | null
          plan?: string
          price_id?: string | null
          status?: string
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          email: string | null
          last_seen_agent: string | null
          last_seen_at: string | null
          last_seen_ip: string | null
          name: string | null
          org_role: string | null
          plan: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          last_seen_agent?: string | null
          last_seen_at?: string | null
          last_seen_ip?: string | null
          name?: string | null
          org_role?: string | null
          plan?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          email?: string | null
          last_seen_agent?: string | null
          last_seen_at?: string | null
          last_seen_ip?: string | null
          name?: string | null
          org_role?: string | null
          plan?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          changed_at: string | null
          id: string
          new_role: string | null
          role: string
          updated_at: string | null
          user_email: string
          user_id: string | null
        }
        Insert: {
          changed_at?: string | null
          id?: string
          new_role?: string | null
          role: string
          updated_at?: string | null
          user_email: string
          user_id?: string | null
        }
        Update: {
          changed_at?: string | null
          id?: string
          new_role?: string | null
          role?: string
          updated_at?: string | null
          user_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          glow_config: Json | null
          user_id: string
        }
        Insert: {
          glow_config?: Json | null
          user_id: string
        }
        Update: {
          glow_config?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_site_settings: {
        Row: {
          glow_config: Json | null
          site_slug: string
          user_id: string
        }
        Insert: {
          glow_config?: Json | null
          site_slug: string
          user_id: string
        }
        Update: {
          glow_config?: Json | null
          site_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_logs: {
        Row: {
          email: string | null
          id: string
          sent_at: string | null
          user_id: string
        }
        Insert: {
          email?: string | null
          id?: string
          sent_at?: string | null
          user_id: string
        }
        Update: {
          email?: string | null
          id?: string
          sent_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist_subscriptions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          meal_id: string
          merchant_id: string
          notified_at: string | null
          site_id: string
          status: string
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          meal_id: string
          merchant_id: string
          notified_at?: string | null
          site_id: string
          status?: string
          token?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          meal_id?: string
          merchant_id?: string
          notified_at?: string | null
          site_id?: string
          status?: string
          token?: string
          user_id?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string | null
          id: number
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          event_type?: string | null
          id?: never
          processed_at?: string
          provider: string
        }
        Update: {
          event_id?: string
          event_type?: string | null
          id?: never
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      block_feedback_summary: {
        Row: {
          block_id: string | null
          cheer_count: number | null
          echo_count: number | null
          reflect_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "block_feedback_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_profiles_with_email: {
        Row: {
          accent_color: string | null
          access_token: string | null
          brand: string | null
          created_at: string | null
          id: string | null
          is_public: boolean | null
          logo_url: string | null
          name: string | null
          owner_email: string | null
          owner_id: string | null
          password: string | null
          theme: string | null
        }
        Relationships: []
      }
      checkin_map_points: {
        Row: {
          block_id: string | null
          lat: number | null
          lon: number | null
          slug: string | null
          total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_checkins_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      click_summary: {
        Row: {
          action: string | null
          block_id: string | null
          click_count: number | null
          day: string | null
          handle: string | null
        }
        Relationships: []
      }
      features_public_portfolio: {
        Row: {
          badge: string | null
          blurb: string | null
          category: string | null
          client_name: string | null
          client_url: string | null
          created_at: string | null
          doc_href: string | null
          external_url: string | null
          feature_order: number | null
          featured: boolean | null
          gallery: Json | null
          id: string | null
          image_url: string | null
          is_archived: boolean | null
          is_public: boolean | null
          media_type: Database["public"]["Enums"]["feature_media_type"] | null
          org_id: string | null
          org_slug: string | null
          site_url: string | null
          slug: string | null
          tags: string[] | null
          thumb_url: string | null
          title: string | null
          updated_at: string | null
          video_url: string | null
        }
        Relationships: [
          {
            foreignKeyName: "features_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "features_org_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_session_summary: {
        Row: {
          first_seen: string | null
          is_mobile: boolean | null
          last_seen: string | null
          session_count: number | null
          type: string | null
        }
        Relationships: []
      }
      org_domains_public: {
        Row: {
          host: string | null
          kind: string | null
          org_id: string | null
        }
        Insert: {
          host?: string | null
          kind?: string | null
          org_id?: string | null
        }
        Update: {
          host?: string | null
          kind?: string | null
          org_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_domains_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations_public"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations_public: {
        Row: {
          billing_mode: string | null
          branding: Json | null
          canonical_host: string | null
          dark_logo_url: string | null
          favicon_url: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          primary_domain: string | null
          slug: string | null
          support_email: string | null
          support_url: string | null
          wildcard_enabled: boolean | null
        }
        Insert: {
          billing_mode?: string | null
          branding?: Json | null
          canonical_host?: string | null
          dark_logo_url?: string | null
          favicon_url?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          primary_domain?: string | null
          slug?: string | null
          support_email?: string | null
          support_url?: string | null
          wildcard_enabled?: boolean | null
        }
        Update: {
          billing_mode?: string | null
          branding?: Json | null
          canonical_host?: string | null
          dark_logo_url?: string | null
          favicon_url?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          primary_domain?: string | null
          slug?: string | null
          support_email?: string | null
          support_url?: string | null
          wildcard_enabled?: boolean | null
        }
        Relationships: []
      }
      template_bases: {
        Row: {
          archived: boolean | null
          banner_url: string | null
          base_slug: string | null
          canonical_created_at: string | null
          canonical_id: string | null
          canonical_slug: string | null
          canonical_template_name: string | null
          canonical_updated_at: string | null
          city: string | null
          color_mode: string | null
          effective_updated_at: string | null
          industry: string | null
          is_site: boolean | null
          latest_version_updated_at: string | null
          owner_id: string | null
        }
        Relationships: []
      }
      template_bases_secure: {
        Row: {
          archived: boolean | null
          base_slug: string | null
          canonical_created_at: string | null
          canonical_id: string | null
          canonical_slug: string | null
          canonical_template_name: string | null
          canonical_updated_at: string | null
          color_mode: string | null
          effective_updated_at: string | null
          industry: string | null
          is_site: boolean | null
          latest_version_updated_at: string | null
          owner_id: string | null
        }
        Relationships: []
      }
      templates_effective: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_name: string | null
          city: string | null
          color_mode: string | null
          color_scheme: string | null
          contact_email: string | null
          custom_domain: string | null
          data: Json | null
          domain: string | null
          footer_block: Json | null
          header_block: Json | null
          id: string | null
          is_version: boolean | null
          latitude: number | null
          layout: string | null
          longitude: number | null
          phone: string | null
          postal_code: string | null
          published: boolean | null
          published_at: string | null
          published_by: string | null
          published_version_id: string | null
          services: Json | null
          slug: string | null
          state: string | null
          template_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      templates_latest: {
        Row: {
          archived: boolean | null
          banner_url: string | null
          banner_url_meta: Json | null
          base_slug: string | null
          brand: string | null
          claim_source: string | null
          claimed_at: string | null
          claimed_by: string | null
          color_mode: string | null
          color_scheme: string | null
          commit: string | null
          created_at: string | null
          custom_domain: string | null
          data: Json | null
          default_subdomain: string | null
          domain: string | null
          editor_id: string | null
          footer_block: Json | null
          gallery_meta: Json | null
          header_block: Json | null
          hero_url: string | null
          hero_url_meta: Json | null
          id: string | null
          industry: string | null
          is_site: boolean | null
          is_version: boolean | null
          last_editor: string | null
          layout: string | null
          logo_url: string | null
          logo_url_meta: Json | null
          meta: Json | null
          name: string | null
          phone: string | null
          published: boolean | null
          save_count: number | null
          saved_at: string | null
          search_engines_last_ping_response: Json | null
          search_engines_last_pinged_at: string | null
          services: Json | null
          site_id: string | null
          slug: string | null
          team_url: string | null
          template_name: string | null
          theme: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Relationships: []
      }
      templates_versions: {
        Row: {
          archived: boolean | null
          banner_url: string | null
          banner_url_meta: Json | null
          base_slug: string | null
          brand: string | null
          claim_source: string | null
          claimed_at: string | null
          claimed_by: string | null
          color_mode: string | null
          color_scheme: string | null
          commit: string | null
          created_at: string | null
          custom_domain: string | null
          data: Json | null
          default_subdomain: string | null
          domain: string | null
          editor_id: string | null
          footer_block: Json | null
          gallery_meta: Json | null
          header_block: Json | null
          hero_url: string | null
          hero_url_meta: Json | null
          id: string | null
          industry: string | null
          is_site: boolean | null
          is_version: boolean | null
          last_editor: string | null
          layout: string | null
          logo_url: string | null
          logo_url_meta: Json | null
          meta: Json | null
          name: string | null
          phone: string | null
          published: boolean | null
          save_count: number | null
          saved_at: string | null
          search_engines_last_ping_response: Json | null
          search_engines_last_pinged_at: string | null
          services: Json | null
          site_id: string | null
          slug: string | null
          team_url: string | null
          template_name: string | null
          theme: string | null
          updated_at: string | null
          verified: boolean | null
        }
        Insert: {
          archived?: boolean | null
          banner_url?: string | null
          banner_url_meta?: Json | null
          base_slug?: string | null
          brand?: string | null
          claim_source?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data?: Json | null
          default_subdomain?: string | null
          domain?: string | null
          editor_id?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          id?: string | null
          industry?: string | null
          is_site?: boolean | null
          is_version?: boolean | null
          last_editor?: string | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          meta?: Json | null
          name?: string | null
          phone?: string | null
          published?: boolean | null
          save_count?: number | null
          saved_at?: string | null
          search_engines_last_ping_response?: Json | null
          search_engines_last_pinged_at?: string | null
          services?: Json | null
          site_id?: string | null
          slug?: string | null
          team_url?: string | null
          template_name?: string | null
          theme?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Update: {
          archived?: boolean | null
          banner_url?: string | null
          banner_url_meta?: Json | null
          base_slug?: string | null
          brand?: string | null
          claim_source?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          color_mode?: string | null
          color_scheme?: string | null
          commit?: string | null
          created_at?: string | null
          custom_domain?: string | null
          data?: Json | null
          default_subdomain?: string | null
          domain?: string | null
          editor_id?: string | null
          footer_block?: Json | null
          gallery_meta?: Json | null
          header_block?: Json | null
          hero_url?: string | null
          hero_url_meta?: Json | null
          id?: string | null
          industry?: string | null
          is_site?: boolean | null
          is_version?: boolean | null
          last_editor?: string | null
          layout?: string | null
          logo_url?: string | null
          logo_url_meta?: Json | null
          meta?: Json | null
          name?: string | null
          phone?: string | null
          published?: boolean | null
          save_count?: number | null
          saved_at?: string | null
          search_engines_last_ping_response?: Json | null
          search_engines_last_pinged_at?: string | null
          services?: Json | null
          site_id?: string | null
          slug?: string | null
          team_url?: string | null
          template_name?: string | null
          theme?: string | null
          updated_at?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_short_links: {
        Args: { p_since?: string }
        Returns: {
          candidate_slug: string
          code: string
          created_at: string
          id: string
          long_url: string
          scan_count: number
          target_url: string
        }[]
      }
      admin_refresh_template_bases: { Args: never; Returns: boolean }
      admin_rename_template_base: {
        Args: { new_base: string; old_base: string; rename_slugs?: boolean }
        Returns: Json
      }
      archive_template: {
        Args: {
          actor_id: string
          archived: boolean
          reason?: string
          template_id: string
        }
        Returns: {
          id: string
          rev: number
        }[]
      }
      base_slug_of: { Args: { _slug: string }; Returns: string }
      commit_template:
        | {
            Args: { p_message?: string; p_ops: Json; p_template_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_actor?: string
              p_base_rev?: number
              p_kind?: string
              p_message?: string
              p_ops: Json
              p_template_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              actor_id?: string
              patch: Json
              reason?: string
              template_id: string
            }
            Returns: undefined
          }
      commit_template_http: { Args: { p_payload: Json }; Returns: Json }
      commit_template_patch: {
        Args: {
          p_actor: string
          p_base_rev: number
          p_id: string
          p_kind?: string
          p_patch: Json
        }
        Returns: {
          id: string
          rev: number
        }[]
      }
      compliance_expire_docs: { Args: never; Returns: undefined }
      compliance_recompute_status: {
        Args: { p_merchant_id: string }
        Returns: undefined
      }
      coupon_consume: { Args: { p_coupon_id: string }; Returns: boolean }
      daily_checkins_by_slug: {
        Args: { slug: string }
        Returns: {
          count: number
          date: string
        }[]
      }
      dec_meal_qty: { Args: { _by: number; _meal: string }; Returns: undefined }
      delete_current_user: { Args: never; Returns: undefined }
      ensure_canonical_template: { Args: { p_id: string }; Returns: string }
      ensure_short_link: {
        Args: {
          p_candidate_slug?: string
          p_code?: string
          p_target_url?: string
          p_url: string
        }
        Returns: string
      }
      generate_unique_template_name: {
        Args: { base?: string }
        Returns: string
      }
      get_latest_template_versions: {
        Args: never
        Returns: {
          id: string
          saved_at: string
          template_name: string
          thumbnail_url: string
        }[]
      }
      get_template_history: {
        Args: { p_template_id: string }
        Returns: {
          actor_id: string
          created_at: string
          id: string
          kind: string
          message: string
          meta: Json
          template_id: string
          type: string
        }[]
      }
      get_total_reward_points: { Args: { user_id: string }; Returns: number }
      introspect_table_columns: {
        Args: { p_table: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_org_member: { Args: { p_org: string }; Returns: boolean }
      is_owner: { Args: { m_id: string; uid: string }; Returns: boolean }
      leaderboard_for_slug: {
        Args: { slug: string }
        Returns: {
          total: number
          user_id: string
        }[]
      }
      leaderboard_for_slug_filtered: {
        Args: { range_filter?: string; slug: string }
        Returns: {
          total_checkins: number
          user_id: string
        }[]
      }
      merge_org_branding: {
        Args: { p_branding: Json; p_org_id: string }
        Returns: undefined
      }
      publish_site: {
        Args: {
          p_message: string
          p_snapshot_id: string
          p_template_id: string
        }
        Returns: {
          published_id: string
        }[]
      }
      recompute_meal_rating: { Args: { p_meal_id: string }; Returns: undefined }
      refresh_template_bases: { Args: never; Returns: undefined }
      safe_jsonb:
        | { Args: { j: Json }; Returns: Json }
        | { Args: { txt: string }; Returns: Json }
      send_email_verification: { Args: never; Returns: undefined }
      send_email_verification_with_log: { Args: never; Returns: undefined }
      set_template_archived: {
        Args: {
          p_actor_id: string
          p_archived: boolean
          p_reason?: string
          p_template_id: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      slug_base_one_tail: { Args: { slug: string }; Returns: string }
      upsert_feature_portfolio: {
        Args: { p_org_id: string; p_payload: Json; p_title: string }
        Returns: {
          badge: string | null
          blurb: string
          category: string
          client_name: string | null
          client_url: string | null
          created_at: string
          doc_href: string | null
          external_url: string | null
          feature_order: number | null
          featured: boolean
          gallery: Json | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_public: boolean
          media_type: Database["public"]["Enums"]["feature_media_type"] | null
          org_id: string
          site_url: string | null
          slug: string
          tags: string[] | null
          thumb_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "features"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_feature_portfolio_by_slug: {
        Args: { p_org_id: string; p_payload: Json; p_slug: string }
        Returns: {
          badge: string | null
          blurb: string
          category: string
          client_name: string | null
          client_url: string | null
          created_at: string
          doc_href: string | null
          external_url: string | null
          feature_order: number | null
          featured: boolean
          gallery: Json | null
          id: string
          image_url: string | null
          is_archived: boolean
          is_public: boolean
          media_type: Database["public"]["Enums"]["feature_media_type"] | null
          org_id: string
          site_url: string | null
          slug: string
          tags: string[] | null
          thumb_url: string | null
          title: string
          updated_at: string
          video_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "features"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      waitlist_counts_for_merchant: {
        Args: { _merchant: string; _site?: string }
        Returns: {
          active_count: number
          meal_id: string
          notified_count: number
          queued_count: number
          title: string
          unsub_count: number
        }[]
      }
    }
    Enums: {
      catalog_item_type: "meal" | "product" | "service" | "digital"
      feature_media_type: "video" | "image" | "link" | "gallery"
      org_role: "owner" | "admin" | "manager" | "viewer"
      payout_method:
        | "ach"
        | "wire"
        | "check"
        | "stripe"
        | "paypal"
        | "venmo"
        | "cash"
        | "other"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      catalog_item_type: ["meal", "product", "service", "digital"],
      feature_media_type: ["video", "image", "link", "gallery"],
      org_role: ["owner", "admin", "manager", "viewer"],
      payout_method: [
        "ach",
        "wire",
        "check",
        "stripe",
        "paypal",
        "venmo",
        "cash",
        "other",
      ],
    },
  },
} as const

