// types/supabase.ts
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';
export type SupabaseCookieAdapter = () => Promise<ReadonlyRequestCookies>;

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];


export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      block_checkins: {
        Row: {
          block_id: string | null;
          checked_at: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          block_id?: string | null;
          checked_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          block_id?: string | null;
          checked_at?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'block_checkins_block_id_fkey';
            columns: ['block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      block_feedback: {
        Row: {
          action: string | null;
          block_id: string | null;
          created_at: string | null;
          id: string;
          message: string | null;
          user_id: string | null;
        };
        Insert: {
          action?: string | null;
          block_id?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          user_id?: string | null;
        };
        Update: {
          action?: string | null;
          block_id?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'block_feedback_block_id_fkey';
            columns: ['block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      blocks: {
        Row: {
          actions: Json | null;
          created_at: string | null;
          emoji: string | null;
          id: string;
          image_url: string | null;
          lat: number | null;
          lon: number | null;
          message: string | null;
          owner_id: string;
          room: string | null;
          slug: string;
          title: string | null;
          type: string | null;
          visibility: string | null;
        };
        Insert: {
          actions?: Json | null;
          created_at?: string | null;
          emoji?: string | null;
          id?: string;
          image_url?: string | null;
          lat?: number | null;
          lon?: number | null;
          message?: string | null;
          owner_id: string;
          room?: string | null;
          slug: string;
          title?: string | null;
          type?: string | null;
          visibility?: string | null;
        };
        Update: {
          actions?: Json | null;
          created_at?: string | null;
          emoji?: string | null;
          id?: string;
          image_url?: string | null;
          lat?: number | null;
          lon?: number | null;
          message?: string | null;
          owner_id?: string;
          room?: string | null;
          slug?: string;
          title?: string | null;
          type?: string | null;
          visibility?: string | null;
        };
        Relationships: [];
      };
      branding_logs: {
        Row: {
          created_at: string | null;
          details: string | null;
          event: string | null;
          id: string;
          profile_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          details?: string | null;
          event?: string | null;
          id?: string;
          profile_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          details?: string | null;
          event?: string | null;
          id?: string;
          profile_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'branding_logs_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'branding_logs_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
        ];
      };
      branding_profiles: {
        Row: {
          accent_color: string | null;
          access_token: string | null;
          brand: string | null;
          created_at: string | null;
          id: string;
          industry: string | null;
          is_public: boolean | null;
          is_shared: boolean | null;
          layout: string | null;
          logo_url: string | null;
          name: string;
          owner_id: string | null;
          password: string | null;
          theme: string | null;
        };
        Insert: {
          accent_color?: string | null;
          access_token?: string | null;
          brand?: string | null;
          created_at?: string | null;
          id?: string;
          industry?: string | null;
          is_public?: boolean | null;
          is_shared?: boolean | null;
          layout?: string | null;
          logo_url?: string | null;
          name: string;
          owner_id?: string | null;
          password?: string | null;
          theme?: string | null;
        };
        Update: {
          accent_color?: string | null;
          access_token?: string | null;
          brand?: string | null;
          created_at?: string | null;
          id?: string;
          industry?: string | null;
          is_public?: boolean | null;
          is_shared?: boolean | null;
          layout?: string | null;
          logo_url?: string | null;
          name?: string;
          owner_id?: string | null;
          password?: string | null;
          theme?: string | null;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          alt_domains: string[] | null;
          city: string | null;
          created_at: string | null;
          created_by: string | null;
          domain_ids: string[] | null;
          ends_at: string | null;
          id: string;
          lead_ids: string[] | null;
          name: string;
          owner_id: string | null;
          starts_at: string | null;
          state: string | null;
          status: string | null;
        };
        Insert: {
          alt_domains?: string[] | null;
          city?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          domain_ids?: string[] | null;
          ends_at?: string | null;
          id?: string;
          lead_ids?: string[] | null;
          name: string;
          owner_id?: string | null;
          starts_at?: string | null;
          state?: string | null;
          status?: string | null;
        };
        Update: {
          alt_domains?: string[] | null;
          city?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          domain_ids?: string[] | null;
          ends_at?: string | null;
          id?: string;
          lead_ids?: string[] | null;
          name?: string;
          owner_id?: string | null;
          starts_at?: string | null;
          state?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      claimed_handles: {
        Row: {
          claimed_at: string | null;
          handle: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string | null;
          handle: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string | null;
          handle?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      click_events: {
        Row: {
          action: string;
          block_id: string;
          handle: string | null;
          id: string;
          ip_address: string | null;
          metadata: Json | null;
          timestamp: string | null;
        };
        Insert: {
          action: string;
          block_id: string;
          handle?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          timestamp?: string | null;
        };
        Update: {
          action?: string;
          block_id?: string;
          handle?: string | null;
          id?: string;
          ip_address?: string | null;
          metadata?: Json | null;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          author_email: string | null;
          created_at: string | null;
          id: string;
          message: string | null;
          snapshot_id: string | null;
        };
        Insert: {
          author_email?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          snapshot_id?: string | null;
        };
        Update: {
          author_email?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          snapshot_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'comments_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      dashboard_access_log: {
        Row: {
          city: string | null;
          country: string | null;
          email: string | null;
          id: string;
          ip_address: string | null;
          region: string | null;
          timestamp: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          email?: string | null;
          id?: string;
          ip_address?: string | null;
          region?: string | null;
          timestamp?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          email?: string | null;
          id?: string;
          ip_address?: string | null;
          region?: string | null;
          timestamp?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      dashboard_layout_templates: {
        Row: {
          created_at: string | null;
          description: string | null;
          hidden: string[] | null;
          id: string;
          layout: Json | null;
          name: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          hidden?: string[] | null;
          id?: string;
          layout?: Json | null;
          name: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          hidden?: string[] | null;
          id?: string;
          layout?: Json | null;
          name?: string;
        };
        Relationships: [];
      };
      dashboard_layout_versions: {
        Row: {
          created_at: string | null;
          hidden: string[] | null;
          id: string;
          layout: Json;
          role: string;
          saved_by: string | null;
        };
        Insert: {
          created_at?: string | null;
          hidden?: string[] | null;
          id?: string;
          layout: Json;
          role: string;
          saved_by?: string | null;
        };
        Update: {
          created_at?: string | null;
          hidden?: string[] | null;
          id?: string;
          layout?: Json;
          role?: string;
          saved_by?: string | null;
        };
        Relationships: [];
      };
      dashboard_layouts: {
        Row: {
          hidden: string[] | null;
          layout: Json | null;
          role: string;
        };
        Insert: {
          hidden?: string[] | null;
          layout?: Json | null;
          role: string;
        };
        Update: {
          hidden?: string[] | null;
          layout?: Json | null;
          role?: string;
        };
        Relationships: [];
      };
      dashboard_user_layouts: {
        Row: {
          dashboard_id: string | null;
          name: string | null;
          settings: Json | null;
          template_id: string | null;
          user_id: string;
        };
        Insert: {
          dashboard_id?: string | null;
          name?: string | null;
          settings?: Json | null;
          template_id?: string | null;
          user_id: string;
        };
        Update: {
          dashboard_id?: string | null;
          name?: string | null;
          settings?: Json | null;
          template_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dashboard_user_layouts_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'dashboard_layout_templates';
            referencedColumns: ['id'];
          },
        ];
      };
      domains: {
        Row: {
          city: string | null;
          date_created: string | null;
          domain: string | null;
          id: string;
          state: string | null;
          template: string | null;
        };
        Insert: {
          city?: string | null;
          date_created?: string | null;
          domain?: string | null;
          id?: string;
          state?: string | null;
          template?: string | null;
        };
        Update: {
          city?: string | null;
          date_created?: string | null;
          domain?: string | null;
          id?: string;
          state?: string | null;
          template?: string | null;
        };
        Relationships: [];
      };
      draft_sites: {
        Row: {
          city: string;
          claimed_by: string | null;
          date_created: string | null;
          domain: string;
          id: string;
          industry: string | null;
          is_claimed: boolean | null;
          notes: string | null;
          state: string;
          template_id: string | null;
          user_id: string | null;
        };
        Insert: {
          city: string;
          claimed_by?: string | null;
          date_created?: string | null;
          domain: string;
          id?: string;
          industry?: string | null;
          is_claimed?: boolean | null;
          notes?: string | null;
          state: string;
          template_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          city?: string;
          claimed_by?: string | null;
          date_created?: string | null;
          domain?: string;
          id?: string;
          industry?: string | null;
          is_claimed?: boolean | null;
          notes?: string | null;
          state?: string;
          template_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      early_access_codes: {
        Row: {
          claimed_by: string | null;
          code: string;
          used: boolean | null;
          used_at: string | null;
        };
        Insert: {
          claimed_by?: string | null;
          code: string;
          used?: boolean | null;
          used_at?: string | null;
        };
        Update: {
          claimed_by?: string | null;
          code?: string;
          used?: boolean | null;
          used_at?: string | null;
        };
        Relationships: [];
      };
      early_access_signups: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          invite_code: string | null;
          name: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          invite_code?: string | null;
          name?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          invite_code?: string | null;
          name?: string | null;
        };
        Relationships: [];
      };
      geo_cache: {
        Row: {
          city: string | null;
          created_at: string | null;
          id: string;
          lat: number | null;
          lon: number | null;
          state: string | null;
        };
        Insert: {
          city?: string | null;
          created_at?: string | null;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          state?: string | null;
        };
        Update: {
          city?: string | null;
          created_at?: string | null;
          id?: string;
          lat?: number | null;
          lon?: number | null;
          state?: string | null;
        };
        Relationships: [];
      };
      guest_conversions: {
        Row: {
          created_at: string | null;
          guest_user_id: string;
          id: string;
          method: string | null;
          new_user_id: string;
        };
        Insert: {
          created_at?: string | null;
          guest_user_id: string;
          id?: string;
          method?: string | null;
          new_user_id: string;
        };
        Update: {
          created_at?: string | null;
          guest_user_id?: string;
          id?: string;
          method?: string | null;
          new_user_id?: string;
        };
        Relationships: [];
      };
      guest_token_usage: {
        Row: {
          action: string;
          created_at: string | null;
          id: string;
          referrer: string | null;
          user_id: string;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          id?: string;
          referrer?: string | null;
          user_id: string;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          id?: string;
          referrer?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      guest_upgrade_events: {
        Row: {
          created_at: string | null;
          event: string;
          guest_user_id: string;
          id: string;
          page_url: string | null;
          referrer: string | null;
          trigger_reason: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_medium: string | null;
          utm_source: string | null;
          utm_term: string | null;
        };
        Insert: {
          created_at?: string | null;
          event: string;
          guest_user_id: string;
          id?: string;
          page_url?: string | null;
          referrer?: string | null;
          trigger_reason?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Update: {
          created_at?: string | null;
          event?: string;
          guest_user_id?: string;
          id?: string;
          page_url?: string | null;
          referrer?: string | null;
          trigger_reason?: string | null;
          utm_campaign?: string | null;
          utm_content?: string | null;
          utm_medium?: string | null;
          utm_source?: string | null;
          utm_term?: string | null;
        };
        Relationships: [];
      };
      industries: {
        Row: {
          id: string;
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          address_city: string | null;
          address_state: string | null;
          business_name: string | null;
          campaign_id: string | null;
          contact_name: string | null;
          created_at: string | null;
          date_created: string | null;
          domain_id: string | null;
          email: string | null;
          id: string;
          industry: string | null;
          notes: string | null;
          outreach_status: string | null;
          owner_id: string | null;
          phone: string | null;
        };
        Insert: {
          address_city?: string | null;
          address_state?: string | null;
          business_name?: string | null;
          campaign_id?: string | null;
          contact_name?: string | null;
          created_at?: string | null;
          date_created?: string | null;
          domain_id?: string | null;
          email?: string | null;
          id?: string;
          industry?: string | null;
          notes?: string | null;
          outreach_status?: string | null;
          owner_id?: string | null;
          phone?: string | null;
        };
        Update: {
          address_city?: string | null;
          address_state?: string | null;
          business_name?: string | null;
          campaign_id?: string | null;
          contact_name?: string | null;
          created_at?: string | null;
          date_created?: string | null;
          domain_id?: string | null;
          email?: string | null;
          id?: string;
          industry?: string | null;
          notes?: string | null;
          outreach_status?: string | null;
          owner_id?: string | null;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'leads_campaign_id_fkey';
            columns: ['campaign_id'];
            isOneToOne: false;
            referencedRelation: 'campaigns';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'leads_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'draft_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      nav_preferences: {
        Row: {
          id: string;
          user_id: string;
          disabled_flags: string[];   // assuming Postgres array
          enabled_links: string[];    // assuming Postgres array
          created_at: string | null;  // optional, if your table includes timestamps
          updated_at: string | null;  // optional
        };
        Insert: {
          user_id: string;
          disabled_flags?: string[];
          enabled_links?: string[];
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          disabled_flags?: string[];
          enabled_links?: string[];
          created_at?: string | null;
          updated_at?: string | null;
        };
      };                 
      not_found_logs: {
        Row: {
          context: string;
          id: string;
          path: string;
          referrer: string | null;
          timestamp: string | null;
          user_agent: string | null;
        };
        Insert: {
          context: string;
          id?: string;
          path: string;
          referrer?: string | null;
          timestamp?: string | null;
          user_agent?: string | null;
        };
        Update: {
          context?: string;
          id?: string;
          path?: string;
          referrer?: string | null;
          timestamp?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      param_presets: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          query: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          query: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          query?: string;
          slug?: string;
        };
        Relationships: [];
      };
      public_profiles: {
        Row: {
          bio: string | null;
          created_at: string | null;
          emoji: string | null;
          goal_tags: string[] | null;
          handle: string | null;
          updated_at: string | null;
          user_id: string;
          visible: boolean | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string | null;
          emoji?: string | null;
          goal_tags?: string[] | null;
          handle?: string | null;
          updated_at?: string | null;
          user_id: string;
          visible?: boolean | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string | null;
          emoji?: string | null;
          goal_tags?: string[] | null;
          handle?: string | null;
          updated_at?: string | null;
          user_id?: string;
          visible?: boolean | null;
        };
        Relationships: [];
      };
      public_sites: {
        Row: {
          branding_profile_id: string | null;
          created_at: string | null;
          id: string;
          is_public: boolean | null;
          language: string | null;
          owner_id: string | null;
          published_at: string | null;
          qr_url: string | null;
          slug: string;
          snapshot_id: string | null;
          status: string | null;
        };
        Insert: {
          branding_profile_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_public?: boolean | null;
          language?: string | null;
          owner_id?: string | null;
          published_at?: string | null;
          qr_url?: string | null;
          slug: string;
          snapshot_id?: string | null;
          status?: string | null;
        };
        Update: {
          branding_profile_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_public?: boolean | null;
          language?: string | null;
          owner_id?: string | null;
          published_at?: string | null;
          qr_url?: string | null;
          slug?: string;
          snapshot_id?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_branding_profile';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_branding_profile';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'published_sites_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'published_sites_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'published_sites_snapshot_id_fkey';
            columns: ['snapshot_id'];
            isOneToOne: false;
            referencedRelation: 'snapshots';
            referencedColumns: ['id'];
          },
        ];
      };
      published_site_views: {
        Row: {
          id: string;
          referrer: string | null;
          site_id: string | null;
          user_agent: string | null;
          viewed_at: string | null;
        };
        Insert: {
          id?: string;
          referrer?: string | null;
          site_id?: string | null;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Update: {
          id?: string;
          referrer?: string | null;
          site_id?: string | null;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'published_site_views_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'public_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      published_sites: {
        Row: {
          branding_profile_id: string | null;
          domain: string;
          id: string;
          is_public: boolean | null;
          published_at: string | null;
          status: string | null;
        };
        Insert: {
          branding_profile_id?: string | null;
          domain: string;
          id?: string;
          is_public?: boolean | null;
          published_at?: string | null;
          status?: string | null;
        };
        Update: {
          branding_profile_id?: string | null;
          domain?: string;
          id?: string;
          is_public?: boolean | null;
          published_at?: string | null;
          status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'fk_branding_profile';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'fk_branding_profile';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
        ];
      };
      published_versions: {
        Row: {
          branding_profile_id: string | null;
          created_at: string | null;
          id: string;
          primary_color: string | null;
          secondary_color: string | null;
          slug: string;
          snapshot_id: string;
        };
        Insert: {
          branding_profile_id?: string | null;
          created_at?: string | null;
          id?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug: string;
          snapshot_id: string;
        };
        Update: {
          branding_profile_id?: string | null;
          created_at?: string | null;
          id?: string;
          primary_color?: string | null;
          secondary_color?: string | null;
          slug?: string;
          snapshot_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'published_versions_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'published_versions_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
        ];
      };
      referral_logs: {
        Row: {
          campaign: string | null;
          email: string | null;
          id: string;
          joined_at: string | null;
          ref: string | null;
          source: string | null;
        };
        Insert: {
          campaign?: string | null;
          email?: string | null;
          id?: string;
          joined_at?: string | null;
          ref?: string | null;
          source?: string | null;
        };
        Update: {
          campaign?: string | null;
          email?: string | null;
          id?: string;
          joined_at?: string | null;
          ref?: string | null;
          source?: string | null;
        };
        Relationships: [];
      };
      referral_payouts: {
        Row: {
          amount: number | null;
          id: string;
          note: string | null;
          paid_at: string | null;
          user_id: string | null;
        };
        Insert: {
          amount?: number | null;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          amount?: number | null;
          id?: string;
          note?: string | null;
          paid_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          created_at: string | null;
          id: string;
          referred_email: string | null;
          referrer_id: string;
          reward_points: number | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          referred_email?: string | null;
          referrer_id: string;
          reward_points?: number | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          referred_email?: string | null;
          referrer_id?: string;
          reward_points?: number | null;
        };
        Relationships: [];
      };
      regeneration_logs: {
        Row: {
          city: string | null;
          domain: string;
          id: string;
          state: string | null;
          status: string | null;
          template_id: string;
          timestamp: string | null;
        };
        Insert: {
          city?: string | null;
          domain: string;
          id?: string;
          state?: string | null;
          status?: string | null;
          template_id: string;
          timestamp?: string | null;
        };
        Update: {
          city?: string | null;
          domain?: string;
          id?: string;
          state?: string | null;
          status?: string | null;
          template_id?: string;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      regeneration_queue: {
        Row: {
          city: string;
          created_at: string | null;
          domain: string;
          finished_at: string | null;
          id: string;
          log: string | null;
          started_at: string | null;
          state: string;
          status: string | null;
          template_id: string;
        };
        Insert: {
          city: string;
          created_at?: string | null;
          domain: string;
          finished_at?: string | null;
          id?: string;
          log?: string | null;
          started_at?: string | null;
          state: string;
          status?: string | null;
          template_id: string;
        };
        Update: {
          city?: string;
          created_at?: string | null;
          domain?: string;
          finished_at?: string | null;
          id?: string;
          log?: string | null;
          started_at?: string | null;
          state?: string;
          status?: string | null;
          template_id?: string;
        };
        Relationships: [];
      };
      remix_events: {
        Row: {
          created_at: string | null;
          id: string;
          original_snapshot_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          original_snapshot_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          original_snapshot_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      report_tokens: {
        Row: {
          expires_at: string | null;
          file_name: string | null;
          id: string;
          token_hash: string | null;
        };
        Insert: {
          expires_at?: string | null;
          file_name?: string | null;
          id?: string;
          token_hash?: string | null;
        };
        Update: {
          expires_at?: string | null;
          file_name?: string | null;
          id?: string;
          token_hash?: string | null;
        };
        Relationships: [];
      };
      report_webhooks: {
        Row: {
          enabled: boolean | null;
          event: string;
          id: string;
          secret_token: string | null;
          url: string;
        };
        Insert: {
          enabled?: boolean | null;
          event: string;
          id?: string;
          secret_token?: string | null;
          url: string;
        };
        Update: {
          enabled?: boolean | null;
          event?: string;
          id?: string;
          secret_token?: string | null;
          url?: string;
        };
        Relationships: [];
      };
      role_change_logs: {
        Row: {
          changed_at: string | null;
          changed_by: string;
          id: string;
          new_role: string;
          user_email: string;
        };
        Insert: {
          changed_at?: string | null;
          changed_by: string;
          id?: string;
          new_role: string;
          user_email: string;
        };
        Update: {
          changed_at?: string | null;
          changed_by?: string;
          id?: string;
          new_role?: string;
          user_email?: string;
        };
        Relationships: [];
      };
      screenshot_queue: {
        Row: {
          completed_at: string | null;
          domain: string;
          id: string;
          requested_at: string | null;
          status: string | null;
        };
        Insert: {
          completed_at?: string | null;
          domain: string;
          id?: string;
          requested_at?: string | null;
          status?: string | null;
        };
        Update: {
          completed_at?: string | null;
          domain?: string;
          id?: string;
          requested_at?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      session_logs: {
        Row: {
          device: string | null;
          email: string | null;
          event: string | null;
          id: string;
          is_mobile: boolean | null;
          timestamp: string;
          token_end: string | null;
          token_start: string | null;
          type: string;
          user_id: string | null;
        };
        Insert: {
          device?: string | null;
          email?: string | null;
          event?: string | null;
          id?: string;
          is_mobile?: boolean | null;
          timestamp: string;
          token_end?: string | null;
          token_start?: string | null;
          type: string;
          user_id?: string | null;
        };
        Update: {
          device?: string | null;
          email?: string | null;
          event?: string | null;
          id?: string;
          is_mobile?: boolean | null;
          timestamp?: string;
          token_end?: string | null;
          token_start?: string | null;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      shared_previews: {
        Row: {
          created_at: string | null;
          id: string;
          template_id: string | null;
          thumbnail_url: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          template_id?: string | null;
          thumbnail_url?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          template_id?: string | null;
          thumbnail_url?: string | null;
        };
        Relationships: [];
      };
      shared_templates: {
        Row: {
          data: Json;
          editor_email: string | null;
          id: string;
          shared_at: string | null;
          template_name: string;
        };
        Insert: {
          data: Json;
          editor_email?: string | null;
          id?: string;
          shared_at?: string | null;
          template_name: string;
        };
        Update: {
          data?: Json;
          editor_email?: string | null;
          id?: string;
          shared_at?: string | null;
          template_name?: string;
        };
        Relationships: [];
      };
      site_events: {
        Row: {
          created_at: string | null;
          id: string;
          payload: Json;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          payload: Json;
          type: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          payload?: Json;
          type?: string;
        };
        Relationships: [];
      };
      sites: {
        Row: {
          branding_profile_id: string | null;
          business_name: string | null;
          content: Json;
          created_at: string | null;
          domain: string | null;
          id: string;
          is_published: boolean | null;
          location: string | null;
          seo_description: string | null;
          seo_title: string | null;
          site_name: string | null;
          slug: string;
          template_id: string | null;
          template_version_id: string | null;
          twitter_handle: string | null;
          updated_at: string | null;
          vanity_url: string | null;
        };
        Insert: {
          branding_profile_id?: string | null;
          business_name?: string | null;
          content: Json;
          created_at?: string | null;
          domain?: string | null;
          id?: string;
          is_published?: boolean | null;
          location?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          site_name?: string | null;
          slug: string;
          template_id?: string | null;
          template_version_id?: string | null;
          twitter_handle?: string | null;
          updated_at?: string | null;
          vanity_url?: string | null;
        };
        Update: {
          branding_profile_id?: string | null;
          business_name?: string | null;
          content?: Json;
          created_at?: string | null;
          domain?: string | null;
          id?: string;
          is_published?: boolean | null;
          location?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          site_name?: string | null;
          slug?: string;
          template_id?: string | null;
          template_version_id?: string | null;
          twitter_handle?: string | null;
          updated_at?: string | null;
          vanity_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sites_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sites_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sites_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sites_template_version_id_fkey';
            columns: ['template_version_id'];
            isOneToOne: false;
            referencedRelation: 'template_versions';
            referencedColumns: ['id'];
          },
        ];
      };
      snapshot_views: {
        Row: {
          id: string;
          ip_address: string | null;
          template_name: string;
          user_agent: string | null;
          viewed_at: string | null;
        };
        Insert: {
          id?: string;
          ip_address?: string | null;
          template_name: string;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Update: {
          id?: string;
          ip_address?: string | null;
          template_name?: string;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Relationships: [];
      };
      snapshots: {
        Row: {
          brand: string | null;
          branding_profile_id: string | null;
          color_scheme: string | null;
          commit_message: string | null;
          created_at: string | null;
          data: Json | null;
          editor_email: string | null;
          id: string;
          shared_at: string | null;
          template_id: string | null;
          template_name: string | null;
          theme: string | null;
          thumbnail_url: string | null;
        };
        Insert: {
          brand?: string | null;
          branding_profile_id?: string | null;
          color_scheme?: string | null;
          commit_message?: string | null;
          created_at?: string | null;
          data?: Json | null;
          editor_email?: string | null;
          id?: string;
          shared_at?: string | null;
          template_id?: string | null;
          template_name?: string | null;
          theme?: string | null;
          thumbnail_url?: string | null;
        };
        Update: {
          brand?: string | null;
          branding_profile_id?: string | null;
          color_scheme?: string | null;
          commit_message?: string | null;
          created_at?: string | null;
          data?: Json | null;
          editor_email?: string | null;
          id?: string;
          shared_at?: string | null;
          template_id?: string | null;
          template_name?: string | null;
          theme?: string | null;
          thumbnail_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'snapshots_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'snapshots_branding_profile_id_fkey';
            columns: ['branding_profile_id'];
            isOneToOne: false;
            referencedRelation: 'branding_profiles_with_email';
            referencedColumns: ['id'];
          },
        ];
      };
      starter_templates: {
        Row: {
          data: Json | null;
          description: string | null;
          id: string;
          name: string | null;
          preview: string | null;
          template_id: string | null;
        };
        Insert: {
          data?: Json | null;
          description?: string | null;
          id: string;
          name?: string | null;
          preview?: string | null;
          template_id?: string | null;
        };
        Update: {
          data?: Json | null;
          description?: string | null;
          id?: string;
          name?: string | null;
          preview?: string | null;
          template_id?: string | null;
        };
        Relationships: [];
      };
      steward_rewards: {
        Row: {
          created_at: string | null;
          id: string;
          points: number | null;
          reason: string | null;
          site_domain: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          points?: number | null;
          reason?: string | null;
          site_domain?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          points?: number | null;
          reason?: string | null;
          site_domain?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          domain: string | null;
          email: string | null;
          id: string;
          subscribed_at: string | null;
          unsubscribe_token: string | null;
        };
        Insert: {
          domain?: string | null;
          email?: string | null;
          id?: string;
          subscribed_at?: string | null;
          unsubscribe_token?: string | null;
        };
        Update: {
          domain?: string | null;
          email?: string | null;
          id?: string;
          subscribed_at?: string | null;
          unsubscribe_token?: string | null;
        };
        Relationships: [];
      };
      support_campaigns: {
        Row: {
          block_id: string | null;
          created_at: string | null;
          created_by: string | null;
          goal_count: number | null;
          headline: string | null;
          id: string;
          preclaim_token: string | null;
          slug: string;
          target_action: string | null;
        };
        Insert: {
          block_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          goal_count?: number | null;
          headline?: string | null;
          id?: string;
          preclaim_token?: string | null;
          slug: string;
          target_action?: string | null;
        };
        Update: {
          block_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          goal_count?: number | null;
          headline?: string | null;
          id?: string;
          preclaim_token?: string | null;
          slug?: string;
          target_action?: string | null;
        };
        Relationships: [];
      };
      support_requests: {
        Row: {
          created_at: string | null;
          id: string;
          message: string | null;
          receiver_handle: string;
          requester_id: string | null;
          slug: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          message?: string | null;
          receiver_handle: string;
          requester_id?: string | null;
          slug?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          message?: string | null;
          receiver_handle?: string;
          requester_id?: string | null;
          slug?: string | null;
        };
        Relationships: [];
      };
      template_images: {
        Row: {
          id: string;
          original_name: string | null;
          path: string;
          template_id: string | null;
          type: string | null;
          uploaded_at: string | null;
          url: string;
        };
        Insert: {
          id?: string;
          original_name?: string | null;
          path: string;
          template_id?: string | null;
          type?: string | null;
          uploaded_at?: string | null;
          url: string;
        };
        Update: {
          id?: string;
          original_name?: string | null;
          path?: string;
          template_id?: string | null;
          type?: string | null;
          uploaded_at?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'template_images_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
        ];
      };
      template_logs: {
        Row: {
          action: string;
          actor: string | null;
          id: string;
          template_name: string;
          timestamp: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          id?: string;
          template_name: string;
          timestamp?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          id?: string;
          template_name?: string;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      template_versions: {
        Row: {
          commit_message: string | null;
          created_at: string | null;
          diff: Json | null;
          editor_id: string | null;
          forced_revert: boolean | null;
          full_data: Json | null;
          id: string;
          saved_at: string | null;
          template_id: string | null;
          template_name: string;
          thumbnail_url: string | null;
        };
        Insert: {
          commit_message?: string | null;
          created_at?: string | null;
          diff?: Json | null;
          editor_id?: string | null;
          forced_revert?: boolean | null;
          full_data?: Json | null;
          id?: string;
          saved_at?: string | null;
          template_id?: string | null;
          template_name: string;
          thumbnail_url?: string | null;
        };
        Update: {
          commit_message?: string | null;
          created_at?: string | null;
          diff?: Json | null;
          editor_id?: string | null;
          forced_revert?: boolean | null;
          full_data?: Json | null;
          id?: string;
          saved_at?: string | null;
          template_id?: string | null;
          template_name?: string;
          thumbnail_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'template_versions_template_id_fkey';
            columns: ['template_id'];
            isOneToOne: false;
            referencedRelation: 'templates';
            referencedColumns: ['id'];
          },
        ];
      };
      template_views: {
        Row: {
          domain: string | null;
          id: string;
          ip_address: string | null;
          template_name: string | null;
          user_agent: string | null;
          viewed_at: string | null;
        };
        Insert: {
          domain?: string | null;
          id?: string;
          ip_address?: string | null;
          template_name?: string | null;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Update: {
          domain?: string | null;
          id?: string;
          ip_address?: string | null;
          template_name?: string | null;
          user_agent?: string | null;
          viewed_at?: string | null;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          banner_url: string | null;
          banner_url_meta: Json | null;
          color_scheme: string | null;
          created_at: string | null;
          custom_domain: string | null;
          data: Json;
          domain: string | null;
          gallery_meta: Json | null;
          hero_url: string | null;
          hero_url_meta: Json | null;
          id: string;
          industry: string | null;
          layout: string | null;
          logo_url: string | null;
          logo_url_meta: Json | null;
          published: boolean | null;
          template_name: string;
          updated_at: string | null;
        };
        Insert: {
          banner_url?: string | null;
          banner_url_meta?: Json | null;
          color_scheme?: string | null;
          created_at?: string | null;
          custom_domain?: string | null;
          data: Json;
          domain?: string | null;
          gallery_meta?: Json | null;
          hero_url?: string | null;
          hero_url_meta?: Json | null;
          id?: string;
          industry?: string | null;
          layout?: string | null;
          logo_url?: string | null;
          logo_url_meta?: Json | null;
          published?: boolean | null;
          template_name: string;
          updated_at?: string | null;
        };
        Update: {
          banner_url?: string | null;
          banner_url_meta?: Json | null;
          color_scheme?: string | null;
          created_at?: string | null;
          custom_domain?: string | null;
          data?: Json;
          domain?: string | null;
          gallery_meta?: Json | null;
          hero_url?: string | null;
          hero_url_meta?: Json | null;
          id?: string;
          industry?: string | null;
          layout?: string | null;
          logo_url?: string | null;
          logo_url_meta?: Json | null;
          published?: boolean | null;
          template_name?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      thank_you_notes: {
        Row: {
          block_id: string | null;
          created_at: string | null;
          id: string;
          message: string | null;
          recipient_id: string | null;
          sender_id: string | null;
        };
        Insert: {
          block_id?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          recipient_id?: string | null;
          sender_id?: string | null;
        };
        Update: {
          block_id?: string | null;
          created_at?: string | null;
          id?: string;
          message?: string | null;
          recipient_id?: string | null;
          sender_id?: string | null;
        };
        Relationships: [];
      };
      token_logs: {
        Row: {
          downloaded_at: string | null;
          file_name: string | null;
          id: string;
          ip_address: string | null;
          ip_location: string | null;
          token_hash: string | null;
          user_agent: string | null;
        };
        Insert: {
          downloaded_at?: string | null;
          file_name?: string | null;
          id?: string;
          ip_address?: string | null;
          ip_location?: string | null;
          token_hash?: string | null;
          user_agent?: string | null;
        };
        Update: {
          downloaded_at?: string | null;
          file_name?: string | null;
          id?: string;
          ip_address?: string | null;
          ip_location?: string | null;
          token_hash?: string | null;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      tracking_checkins: {
        Row: {
          block_id: string | null;
          checked_at: string | null;
          id: string;
          slug: string;
          user_id: string;
        };
        Insert: {
          block_id?: string | null;
          checked_at?: string | null;
          id?: string;
          slug: string;
          user_id: string;
        };
        Update: {
          block_id?: string | null;
          checked_at?: string | null;
          id?: string;
          slug?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tracking_checkins_block_id_fkey';
            columns: ['block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      user_action_logs: {
        Row: {
          action_type: string;
          domain_id: string | null;
          id: string;
          lead_id: string | null;
          timestamp: string | null;
          triggered_by: string | null;
        };
        Insert: {
          action_type: string;
          domain_id?: string | null;
          id?: string;
          lead_id?: string | null;
          timestamp?: string | null;
          triggered_by?: string | null;
        };
        Update: {
          action_type?: string;
          domain_id?: string | null;
          id?: string;
          lead_id?: string | null;
          timestamp?: string | null;
          triggered_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'lead_action_logs_domain_id_fkey';
            columns: ['domain_id'];
            isOneToOne: false;
            referencedRelation: 'draft_sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'lead_action_logs_lead_id_fkey';
            columns: ['lead_id'];
            isOneToOne: false;
            referencedRelation: 'leads';
            referencedColumns: ['id'];
          },
        ];
      };
      user_deletion_logs: {
        Row: {
          deleted_at: string | null;
          email: string | null;
          id: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          user_id: string;
        };
        Update: {
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          avatar_url: string | null;
          last_seen_agent: string | null;
          last_seen_at: string | null;
          last_seen_ip: string | null;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          last_seen_agent?: string | null;
          last_seen_at?: string | null;
          last_seen_ip?: string | null;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          last_seen_agent?: string | null;
          last_seen_at?: string | null;
          last_seen_ip?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          changed_at: string | null;
          id: string;
          new_role: string | null;
          role: string;
          updated_at: string | null;
          user_email: string;
          user_id: string | null;
        };
        Insert: {
          changed_at?: string | null;
          id?: string;
          new_role?: string | null;
          role: string;
          updated_at?: string | null;
          user_email: string;
          user_id?: string | null;
        };
        Update: {
          changed_at?: string | null;
          id?: string;
          new_role?: string | null;
          role?: string;
          updated_at?: string | null;
          user_email?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      verification_logs: {
        Row: {
          email: string | null;
          id: string;
          sent_at: string | null;
          user_id: string;
        };
        Insert: {
          email?: string | null;
          id?: string;
          sent_at?: string | null;
          user_id: string;
        };
        Update: {
          email?: string | null;
          id?: string;
          sent_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      block_feedback_summary: {
        Row: {
          block_id: string | null;
          cheer_count: number | null;
          echo_count: number | null;
          reflect_count: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'block_feedback_block_id_fkey';
            columns: ['block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      branding_profiles_with_email: {
        Row: {
          accent_color: string | null;
          access_token: string | null;
          brand: string | null;
          created_at: string | null;
          id: string | null;
          is_public: boolean | null;
          logo_url: string | null;
          name: string | null;
          owner_email: string | null;
          owner_id: string | null;
          password: string | null;
          theme: string | null;
        };
        Relationships: [];
      };
      checkin_map_points: {
        Row: {
          block_id: string | null;
          lat: number | null;
          lon: number | null;
          slug: string | null;
          total: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tracking_checkins_block_id_fkey';
            columns: ['block_id'];
            isOneToOne: false;
            referencedRelation: 'blocks';
            referencedColumns: ['id'];
          },
        ];
      };
      click_summary: {
        Row: {
          action: string | null;
          block_id: string | null;
          click_count: number | null;
          day: string | null;
          handle: string | null;
        };
        Relationships: [];
      };
      mobile_session_summary: {
        Row: {
          first_seen: string | null;
          is_mobile: boolean | null;
          last_seen: string | null;
          session_count: number | null;
          type: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      daily_checkins_by_slug: {
        Args: { slug: string };
        Returns: {
          date: string;
          count: number;
        }[];
      };
      delete_current_user: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      get_latest_template_versions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          template_name: string;
          thumbnail_url: string;
          saved_at: string;
        }[];
      };
      get_total_reward_points: {
        Args: { user_id: string };
        Returns: number;
      };
      gtrgm_compress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_decompress: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_in: {
        Args: { '': unknown };
        Returns: unknown;
      };
      gtrgm_options: {
        Args: { '': unknown };
        Returns: undefined;
      };
      gtrgm_out: {
        Args: { '': unknown };
        Returns: unknown;
      };
      leaderboard_for_slug: {
        Args: { slug: string };
        Returns: {
          user_id: string;
          total: number;
        }[];
      };
      send_email_verification: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      send_email_verification_with_log: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      set_limit: {
        Args: { '': number };
        Returns: number;
      };
      show_limit: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      show_trgm: {
        Args: { '': string };
        Returns: string[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
