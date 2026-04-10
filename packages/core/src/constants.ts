export const SHEET_NAMES = {
  requestsRaw: "requests_raw",
  resultsRaw: "results_raw",
  customerLineMap: "customer_line_map",
  staffTargets: "staff_targets",
  notificationLog: "notification_log",
  systemConfig: "system_config"
} as const;

export const STATUS_LABELS: Record<string, string> = {
  "1": "Submitted request",
  "8": "Printed copy or attached report"
};

export const SHEET_HEADERS = {
  requestsRaw: [
    "external_id",
    "domain",
    "request_no",
    "customer_code",
    "customer_name",
    "requester_name",
    "requester_org",
    "request_type",
    "status",
    "status_text",
    "submitted_at",
    "last_seen_at",
    "snapshot_hash",
    "first_detected_at",
    "staff_notified",
    "staff_notified_at",
    "staff_notify_key"
  ],
  resultsRaw: [
    "external_id",
    "domain",
    "request_no",
    "sample_id",
    "report_no",
    "report_url",
    "customer_code",
    "customer_name",
    "requester_name",
    "requester_org",
    "status",
    "status_text",
    "submitted_at",
    "completed_at",
    "last_seen_at",
    "snapshot_hash",
    "first_detected_at",
    "customer_notified",
    "customer_notified_at",
    "customer_notify_key",
    "pending_map_reason"
  ],
  customerLineMap: [
    "requester_name",
    "requester_org",
    "customer_code",
    "customer_name",
    "reference_no",
    "line_user_id",
    "line_display_name",
    "link_status",
    "linked_at",
    "active",
    "remark"
  ],
  staffTargets: [
    "target_type",
    "target_name",
    "group_id",
    "line_user_id",
    "enabled",
    "event_types",
    "priority",
    "remark"
  ],
  notificationLog: [
    "event_type",
    "dedupe_key",
    "target_type",
    "target_id",
    "external_id",
    "domain",
    "customer_code",
    "message_preview",
    "sent_at",
    "status",
    "line_request_id",
    "error_message"
  ],
  systemConfig: [
    "key",
    "value"
  ]
} as const;
