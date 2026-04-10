export type EntityType = "request" | "result";
export type DomainName = "water" | "air";
export type TargetType = "user" | "group";
export type EventType = "NEW_REQUEST" | "RESULT_COMPLETED" | "PENDING_MAPPING";

export interface SourceRecord {
  source: "e-report";
  entityType: EntityType;
  domain: DomainName;
  externalId: string;
  requestNo: string | null;
  sampleId: string | null;
  reportNo: string | null;
  customerCode: string | null;
  customerName: string | null;
  requesterName: string | null;
  requesterOrg: string | null;
  requestType: string | null;
  status: string;
  statusText: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  reportUrl: string | null;
  lastSeenAt: string;
  snapshotHash: string;
  raw: Record<string, string | null>;
}

export interface NotificationEvent {
  eventType: EventType;
  dedupeKey: string;
  externalId: string;
  requestNo: string | null;
  customerCode: string | null;
  customerName: string | null;
  requesterName: string | null;
  requesterOrg: string | null;
  reportNo: string | null;
  sampleId: string | null;
  payload: Record<string, string | null>;
}

export interface NotificationTarget {
  type: TargetType;
  userId: string | null;
  groupId: string | null;
  name: string | null;
  enabled: boolean;
  eventTypes: EventType[];
}

export interface CustomerLineMapRow {
  requesterName: string;
  requesterOrg: string;
  customerCode: string;
  customerName: string;
  referenceNo: string;
  lineUserId: string;
  lineDisplayName: string;
  linkStatus: string;
  linkedAt: string;
  active: boolean;
  remark: string;
}

export interface StaffTargetRow {
  targetType: TargetType;
  targetName: string;
  groupId: string;
  lineUserId: string;
  enabled: boolean;
  eventTypes: EventType[];
  priority: string;
  remark: string;
}

export interface NotificationLogRow {
  eventType: EventType;
  dedupeKey: string;
  targetType: TargetType;
  targetId: string;
  externalId: string;
  domain: string;
  customerCode: string;
  messagePreview: string;
  sentAt: string;
  status: string;
  lineRequestId: string;
  errorMessage: string;
}

export interface RequestListRow {
  requestNo: string;
  submittedAt: string;
  requesterName: string;
  requesterOrg: string;
  customerName: string;
  sampleCount: string;
  status: string;
  domain: DomainName;
  externalId: string;
}

export interface ResultSearchRow {
  requestNo: string;
  requestType: string;
  submittedAt: string;
  requesterName: string;
  requesterOrg: string;
  customerName: string;
  sampleCount: string;
  status: string;
  detailId: string;
  domain: DomainName;
}

export interface ResultDetailReportItem {
  requestNo: string;
  detailId: string;
  sampleId: string;
  analysisSampleId: string;
  reportUrl: string;
  customerName: string;
  parameterGroup: string;
  status: string;
  domain: DomainName;
}
