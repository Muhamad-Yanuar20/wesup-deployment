export type UserRole = "supplier" | "umkm" | "admin";
export type AccountStatus =
  | "active"
  | "suspended_temporary"
  | "suspended_permanent"
  | "banned";
export type VerificationStatus = "pending" | "approved" | "rejected";
export type BatchStatus =
  | "draft"
  | "published"
  | "closed"
  | "cancelled"
  | "takedown"
  | "completed";
export type RegistrationStatus =
  | "registered"
  | "pending_payment"
  | "paid"
  | "picked_up"
  | "completed"
  | "no_show"
  | "cancelled"
  | "refund_pending"
  | "refunded";
export type PaymentStatus = "pending" | "paid" | "expired" | "failed" | "refunded";
export type EscrowStatus = "held" | "released" | "refunded" | "forfeited";
export type DisputeStatus =
  | "pending"
  | "under_review"
  | "resolved_supplier"
  | "resolved_umkm";
export type RefundTrigger = "takedown" | "force_majeure" | "dispute_won";
export type RefundStatus =
  | "pending"
  | "waiting_bank_account"
  | "processing"
  | "completed"
  | "failed";
export type NotificationType =
  | "payment_due"
  | "payment_success"
  | "pickup_ready"
  | "dispute"
  | "refund"
  | "suspension"
  | "referral"
  | "batch_update";
export type AuditAction =
  | "verify_supplier"
  | "reject_supplier"
  | "takedown_batch"
  | "resolve_dispute"
  | "approve_refund"
  | "complete_refund"
  | "suspend_user"
  | "ban_user"
  | "unban_user";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          status: AccountStatus;
          full_name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: UserRole;
          status?: AccountStatus;
          full_name: string;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      supplier_profiles: {
        Row: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          business_photo_url: string | null;
          ktp_photo_url: string | null;
          nik: string;
          verification_status: VerificationStatus;
          verification_notes: string | null;
          verified_by: string | null;
          verified_at: string | null;
          is_location_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          business_photo_url?: string | null;
          ktp_photo_url?: string | null;
          nik: string;
          verification_status?: VerificationStatus;
          verification_notes?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          is_location_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_profiles"]["Insert"]>;
      };
      supplier_bank_accounts: {
        Row: {
          id: string;
          supplier_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_bank_accounts"]["Insert"]>;
      };
      umkm_profiles: {
        Row: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          strike_count: number;
          suspended_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          business_name: string;
          address: string;
          latitude: number;
          longitude: number;
          strike_count?: number;
          suspended_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["umkm_profiles"]["Insert"]>;
      };
      umkm_bank_accounts: {
        Row: {
          id: string;
          umkm_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          umkm_id: string;
          bank_name: string;
          account_number: string;
          account_holder_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["umkm_bank_accounts"]["Insert"]>;
      };
      recurring_configs: {
        Row: {
          id: string;
          supplier_id: string;
          name: string | null;
          interval_days: number;
          days_of_week: number[];
          is_active: boolean;
          last_generated_at: string | null;
          next_generation_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          name?: string | null;
          interval_days: number;
          days_of_week?: number[];
          is_active?: boolean;
          last_generated_at?: string | null;
          next_generation_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_configs"]["Insert"]>;
      };
      batches: {
        Row: {
          id: string;
          supplier_id: string;
          recurring_config_id: string | null;
          title: string;
          description: string | null;
          category: string;
          min_quantity: number;
          product_photo_url: string | null;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status: BatchStatus;
          takedown_reason: string | null;
          takedown_by: string | null;
          takedown_at: string | null;
          cancelled_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          recurring_config_id?: string | null;
          title: string;
          description?: string | null;
          category: string;
          min_quantity: number;
          product_photo_url?: string | null;
          pickup_address: string;
          latitude: number;
          longitude: number;
          status?: BatchStatus;
          takedown_reason?: string | null;
          takedown_by?: string | null;
          takedown_at?: string | null;
          cancelled_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batches"]["Insert"]>;
      };
      batch_tiers: {
        Row: {
          id: string;
          batch_id: string;
          tier_number: number;
          min_volume: number;
          max_volume: number | null;
          price_per_unit: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          tier_number: number;
          min_volume: number;
          max_volume?: number | null;
          price_per_unit: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batch_tiers"]["Insert"]>;
      };
      batch_timeline: {
        Row: {
          batch_id: string;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          created_at: string;
        };
        Insert: {
          batch_id: string;
          registration_opens_at: string;
          registration_closes_at: string;
          payment_opens_at: string;
          payment_closes_at: string;
          estimated_ready_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["batch_timeline"]["Insert"]>;
      };
      registrations: {
        Row: {
          id: string;
          batch_id: string;
          umkm_id: string;
          quantity: number;
          consented_at: string;
          consent_latitude: number | null;
          consent_longitude: number | null;
          status: RegistrationStatus;
          locked_tier_number: number | null;
          locked_price_per_unit: number | null;
          final_amount: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          umkm_id: string;
          quantity: number;
          consented_at: string;
          consent_latitude?: number | null;
          consent_longitude?: number | null;
          status?: RegistrationStatus;
          locked_tier_number?: number | null;
          locked_price_per_unit?: number | null;
          final_amount?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["registrations"]["Insert"]>;
      };
      registration_counters: {
        Row: {
          batch_id: string;
          current_count: number;
          updated_at: string;
        };
        Insert: {
          batch_id: string;
          current_count?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["registration_counters"]["Insert"]>;
      };
      payments: {
        Row: {
          id: string;
          registration_id: string;
          midtrans_order_id: string;
          midtrans_transaction_id: string | null;
          gross_amount: number;
          status: PaymentStatus;
          qr_code_url: string | null;
          qr_code_expires_at: string | null;
          paid_at: string | null;
          webhook_payload: Record<string, unknown> | null;
          reconciled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          midtrans_order_id: string;
          midtrans_transaction_id?: string | null;
          gross_amount: number;
          status?: PaymentStatus;
          qr_code_url?: string | null;
          qr_code_expires_at?: string | null;
          paid_at?: string | null;
          webhook_payload?: Record<string, unknown> | null;
          reconciled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
      };
      payment_webhook_logs: {
        Row: {
          id: string;
          payment_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          status: string;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          event_type: string;
          payload: Record<string, unknown>;
          status?: string;
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payment_webhook_logs"]["Insert"]>;
      };
      pickup_codes: {
        Row: {
          id: string;
          registration_id: string;
          qr_code_token: string;
          pin_code: string;
          generated_at: string;
          used_at: string | null;
          used_by_supplier_id: string | null;
        };
        Insert: {
          id?: string;
          registration_id: string;
          qr_code_token: string;
          pin_code: string;
          generated_at?: string;
          used_at?: string | null;
          used_by_supplier_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["pickup_codes"]["Insert"]>;
      };
      pickup_events: {
        Row: {
          id: string;
          registration_id: string;
          supplier_id: string;
          method: "qr" | "pin";
          latitude: number | null;
          longitude: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          supplier_id: string;
          method: "qr" | "pin";
          latitude?: number | null;
          longitude?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pickup_events"]["Insert"]>;
      };
      escrow_holds: {
        Row: {
          id: string;
          registration_id: string;
          amount: number;
          status: EscrowStatus;
          pickup_confirmed_at: string;
          auto_release_at: string;
          released_at: string | null;
          release_destination: "supplier" | "umkm" | null;
          dispute_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          amount: number;
          status?: EscrowStatus;
          pickup_confirmed_at: string;
          auto_release_at: string;
          released_at?: string | null;
          release_destination?: "supplier" | "umkm" | null;
          dispute_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["escrow_holds"]["Insert"]>;
      };
      disputes: {
        Row: {
          id: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          description: string;
          photo_urls: string[];
          status: DisputeStatus;
          admin_id: string | null;
          admin_notes: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          description: string;
          photo_urls?: string[];
          status?: DisputeStatus;
          admin_id?: string | null;
          admin_notes?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["disputes"]["Insert"]>;
      };
      dispute_evidence: {
        Row: {
          id: string;
          dispute_id: string;
          uploaded_by: string;
          file_url: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dispute_id: string;
          uploaded_by: string;
          file_url: string;
          description?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dispute_evidence"]["Insert"]>;
      };
      refund_requests: {
        Row: {
          id: string;
          registration_id: string;
          batch_id: string;
          trigger_type: RefundTrigger;
          amount: number;
          status: RefundStatus;
          umkm_bank_account_id: string | null;
          admin_id: string | null;
          admin_notes: string | null;
          transfer_proof_url: string | null;
          requested_at: string;
          processed_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          batch_id: string;
          trigger_type: RefundTrigger;
          amount: number;
          status?: RefundStatus;
          umkm_bank_account_id?: string | null;
          admin_id?: string | null;
          admin_notes?: string | null;
          transfer_proof_url?: string | null;
          requested_at?: string;
          processed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["refund_requests"]["Insert"]>;
      };
      ratings: {
        Row: {
          id: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          score: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          registration_id: string;
          umkm_id: string;
          supplier_id: string;
          score: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data: Record<string, unknown> | null;
          read_at: string | null;
          sent_via_whatsapp: boolean;
          whatsapp_status: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string;
          data?: Record<string, unknown> | null;
          read_at?: string | null;
          sent_via_whatsapp?: boolean;
          whatsapp_status?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      admin_audit_logs: {
        Row: {
          id: string;
          admin_id: string;
          action_type: AuditAction;
          target_type: string;
          target_id: string;
          details: Record<string, unknown> | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id: string;
          action_type: AuditAction;
          target_type: string;
          target_id: string;
          details?: Record<string, unknown> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_audit_logs"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      is_supplier: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      verification_status: VerificationStatus;
      batch_status: BatchStatus;
      registration_status: RegistrationStatus;
      payment_status: PaymentStatus;
      escrow_status: EscrowStatus;
      dispute_status: DisputeStatus;
      refund_trigger: RefundTrigger;
      refund_status: RefundStatus;
      notification_type: NotificationType;
      audit_action: AuditAction;
    };
    CompositeTypes: Record<string, never>;
  };
}
