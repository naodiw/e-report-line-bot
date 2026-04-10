import type { NotificationEvent, SourceRecord } from "./types.js";

export const buildNewRequestEvent = (record: SourceRecord): NotificationEvent => ({
  eventType: "NEW_REQUEST",
  dedupeKey: `NEW_REQUEST:${record.requestNo ?? record.externalId}`,
  externalId: record.externalId,
  requestNo: record.requestNo,
  customerCode: record.customerCode,
  customerName: record.customerName,
  requesterName: record.requesterName,
  requesterOrg: record.requesterOrg,
  reportNo: null,
  sampleId: null,
  payload: {
    requestNo: record.requestNo,
    customerName: record.customerName,
    requesterName: record.requesterName,
    requesterOrg: record.requesterOrg,
    requestType: record.requestType,
    submittedAt: record.submittedAt,
    domain: record.domain
  }
});

export const buildResultCompletedEvent = (record: SourceRecord): NotificationEvent => ({
  eventType: "RESULT_COMPLETED",
  dedupeKey: `RESULT_COMPLETED:${record.requestNo ?? "unknown"}:${record.reportNo ?? record.sampleId ?? record.externalId}`,
  externalId: record.externalId,
  requestNo: record.requestNo,
  customerCode: record.customerCode,
  customerName: record.customerName,
  requesterName: record.requesterName,
  requesterOrg: record.requesterOrg,
  reportNo: record.reportNo,
  sampleId: record.sampleId,
  payload: {
    requestNo: record.requestNo,
    customerName: record.customerName,
    requesterName: record.requesterName,
    requesterOrg: record.requesterOrg,
    sampleId: record.sampleId,
    reportNo: record.reportNo,
    reportUrl: record.reportUrl,
    completedAt: record.completedAt,
    domain: record.domain
  }
});
