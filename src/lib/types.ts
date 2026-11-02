export type ItemStatus = "found" | "in_storage" | "claimed" | "returned" | "disposed";
export type LostStatus = "open" | "matched" | "closed";
export type ClaimStatus = "pending" | "approved" | "rejected";

export interface User {
  user_id: number;
  role_id: number;
  department_id: number | null;
  user_type: string;
  id_number: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  year_level: string | null;
  is_active: number;
  created_at: string;
  department_name?: string | null;
  department_code?: string | null;
}

export interface Category {
  category_id: number;
  category_name: string;
  description: string | null;
}

export interface Location {
  location_id: number;
  location_name: string;
  location_type: "found_spot" | "storage";
  building: string | null;
  room: string | null;
  description: string | null;
}

export interface Department {
  department_id: number;
  department_name: string;
  department_code: string | null;
}

export interface LostReport {
  lost_report_id: number;
  user_id: number;
  category_id: number;
  title: string;
  description: string | null;
  brand: string | null;
  color: string | null;
  last_seen_location: string | null;
  date_lost: string;
  status: LostStatus;
  created_at: string;
  updated_at: string;
  category_name?: string;
  owner_name?: string;
  owner_email?: string;
  owner_role_id?: number;
  message_count?: number;
  last_message_at?: string | null;
}

export interface Item {
  item_id: number;
  item_code: string;
  category_id: number;
  found_location_id: number | null;
  found_location_text: string | null;
  storage_location_id: number | null;
  reported_by: number;
  response_to_lost_report_id: number | null;
  title: string;
  description: string | null;
  brand: string | null;
  color: string | null;
  found_id_number: string | null;
  date_found: string;
  status: ItemStatus;
  is_valuable: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
  found_location?: string | null;
  storage_location?: string | null;
  finder_name?: string;
  finder_email?: string;
  finder_role_id?: number;
  image?: string | null;
  pending_claims?: number;
  response_lost_title?: string | null;
  response_lost_id?: number | null;
}

export interface ItemImage {
  item_image_id: number;
  item_id: number;
  file_path: string;
  is_primary: number;
  uploaded_at: string;
}

export interface PostMessage {
  message_id: number;
  lost_report_id: number;
  sender_id: number;
  body: string;
  linked_item_id: number | null;
  created_at: string;
  sender_name?: string;
  sender_role_id?: number;
  item_code?: string | null;
  item_title?: string | null;
  item_status?: ItemStatus | null;
  item_image?: string | null;
}

export interface Thread {
  lost_report_id: number;
  title: string;
  status: LostStatus;
  category_name: string;
  owner_name: string;
  owner_id: number;
  last_body: string;
  last_at: string;
  last_sender: string;
  last_sender_id: number;
  message_count: number;
  unread: number;
}

export interface ClaimEvidence {
  claim_evidence_id: number;
  claim_id: number;
  evidence_type: string;
  file_path: string | null;
  details: string | null;
}

export interface Claim {
  claim_id: number;
  item_id: number;
  claimant_id: number;
  lost_report_id: number | null;
  description_provided: string;
  claim_status: ClaimStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  remarks: string | null;
  created_at: string;
  item_code?: string;
  item_title?: string;
  item_status?: ItemStatus;
  item_is_valuable?: number;
  response_to_lost_report_id?: number | null;
  finder_id?: number;
  finder_name?: string;
  claimant_name?: string;
  claimant_email?: string;
  claimant_phone?: string | null;
  claimant_id_number?: string | null;
  received_by_name?: string | null;
  returned_at?: string | null;
  evidence?: ClaimEvidence[];
}

export interface Notification {
  notification_id: number;
  user_id: number;
  notification_type: string;
  message: string;
  related_item_id: number | null;
  related_claim_id: number | null;
  related_lost_report_id: number | null;
  is_read: number;
  sent_at: string;
}

export interface HistoryRow {
  item_status_history_id: number;
  item_id: number;
  changed_by: number;
  old_status: ItemStatus | null;
  new_status: ItemStatus;
  remarks: string | null;
  changed_at: string;
  full_name: string;
}
