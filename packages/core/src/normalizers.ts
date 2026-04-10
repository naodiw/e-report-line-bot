import { STATUS_LABELS } from "./constants.js";
import type { RequestListRow, ResultDetailReportItem, ResultSearchRow, SourceRecord } from "./types.js";
import { hashObject, nowIso, normalizeWhitespace } from "./utils.js";

export const normalizeRequestRow = (row: RequestListRow): SourceRecord => {
  const payload = {
    externalId: row.externalId,
    requestNo: row.requestNo,
    requesterName: row.requesterName,
    requesterOrg: row.requesterOrg,
    customerName: row.customerName,
    sampleCount: row.sampleCount,
    status: row.status
  };

  return {
    source: "e-report",
    entityType: "request",
    domain: row.domain,
    externalId: row.externalId,
    requestNo: row.requestNo,
    sampleId: null,
    reportNo: null,
    customerCode: null,
    customerName: normalizeWhitespace(row.customerName),
    requesterName: normalizeWhitespace(row.requesterName),
    requesterOrg: normalizeWhitespace(row.requesterOrg),
    requestType: row.domain,
    status: row.status,
    statusText: STATUS_LABELS[row.status] ?? null,
    submittedAt: row.submittedAt,
    completedAt: null,
    reportUrl: null,
    lastSeenAt: nowIso(),
    snapshotHash: hashObject(payload),
    raw: {
      sampleCount: row.sampleCount
    }
  };
};

export const normalizeResultRow = (
  row: ResultSearchRow,
  item: ResultDetailReportItem
): SourceRecord => {
  const payload = {
    detailId: row.detailId,
    sampleId: item.sampleId,
    reportUrl: item.reportUrl,
    status: row.status,
    customerName: row.customerName
  };

  return {
    source: "e-report",
    entityType: "result",
    domain: row.domain,
    externalId: `${row.detailId}:${item.analysisSampleId}`,
    requestNo: row.requestNo,
    sampleId: item.sampleId,
    reportNo: item.analysisSampleId,
    customerCode: null,
    customerName: normalizeWhitespace(row.customerName),
    requesterName: normalizeWhitespace(row.requesterName),
    requesterOrg: normalizeWhitespace(row.requesterOrg),
    requestType: row.requestType,
    status: row.status,
    statusText: STATUS_LABELS[row.status] ?? null,
    submittedAt: row.submittedAt,
    // The E-Report API does not expose the actual completion date.
    // This records the time the poller first detected the result as completed.
    completedAt: nowIso(),
    reportUrl: item.reportUrl,
    lastSeenAt: nowIso(),
    snapshotHash: hashObject(payload),
    raw: {
      parameterGroup: item.parameterGroup,
      detailId: row.detailId
    }
  };
};
