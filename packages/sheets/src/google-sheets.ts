import { GoogleAuth } from "google-auth-library";
import { google, sheets_v4 } from "googleapis";
import {
  SHEET_HEADERS,
  SHEET_NAMES,
  appConfig,
  nowIso,
  toBoolean
} from "@ereport/core";
import type {
  CustomerLineMapRow,
  EventType,
  NotificationEvent,
  NotificationLogRow,
  NotificationTarget,
  SourceRecord,
  TargetType,
  StaffTargetRow
} from "@ereport/core";

const parseJson = <T>(value: string): T => JSON.parse(value) as T;

export class GoogleSheetsHub {
  private readonly sheets: sheets_v4.Sheets;
  private readonly spreadsheetId: string;

  public constructor() {
    const auth = new GoogleAuth({
      credentials: parseJson<Record<string, string>>(appConfig.googleServiceAccountJson),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    this.sheets = google.sheets({ version: "v4", auth });
    this.spreadsheetId = appConfig.spreadsheetId;
  }

  public async getCustomerMap(): Promise<CustomerLineMapRow[]> {
    const rows = await this.readRows(SHEET_NAMES.customerLineMap);
    return rows.map((row) => ({
      requesterName: row[0] ?? "",
      requesterOrg: row[1] ?? "",
      customerCode: row[2] ?? "",
      customerName: row[3] ?? "",
      referenceNo: row[4] ?? "",
      lineUserId: row[5] ?? "",
      lineDisplayName: row[6] ?? "",
      linkStatus: row[7] ?? "",
      linkedAt: row[8] ?? "",
      active: toBoolean(row[9] ?? "false"),
      remark: row[10] ?? ""
    }));
  }

  public async ensureOperationalSheets(): Promise<void> {
    const existing = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId
    });

    const existingNames = new Set(
      (existing.data.sheets ?? [])
        .map((sheet) => sheet.properties?.title)
        .filter((value): value is string => Boolean(value))
    );

    const required = Object.values(SHEET_NAMES);
    const missing = required.filter((name) => !existingNames.has(name));

    if (missing.length) {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: missing.map((title) => ({
            addSheet: {
              properties: { title }
            }
          }))
        }
      });
    }

    await this.setHeaderRow(SHEET_NAMES.requestsRaw, [...SHEET_HEADERS.requestsRaw]);
    await this.setHeaderRow(SHEET_NAMES.resultsRaw, [...SHEET_HEADERS.resultsRaw]);
    await this.setHeaderRow(SHEET_NAMES.customerLineMap, [...SHEET_HEADERS.customerLineMap]);
    await this.setHeaderRow(SHEET_NAMES.staffTargets, [...SHEET_HEADERS.staffTargets]);
    await this.setHeaderRow(SHEET_NAMES.notificationLog, [...SHEET_HEADERS.notificationLog]);
    await this.setHeaderRow(SHEET_NAMES.systemConfig, [...SHEET_HEADERS.systemConfig]);
  }

  public async getStaffTargets(): Promise<NotificationTarget[]> {
    const rows = await this.readRows(SHEET_NAMES.staffTargets);
    return rows.map((row): NotificationTarget => {
      const eventTypes = (row[5] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean) as EventType[];

      const parsed = {
        targetType: (row[0] ?? "group") as TargetType,
        targetName: row[1] ?? "",
        groupId: row[2] ?? "",
        lineUserId: row[3] ?? "",
        enabled: toBoolean(row[4] ?? "false"),
        eventTypes,
        priority: row[6] ?? "",
        remark: row[7] ?? ""
      } satisfies StaffTargetRow;

      return {
        type: parsed.targetType,
        groupId: parsed.groupId || null,
        userId: parsed.lineUserId || null,
        enabled: parsed.enabled,
        name: parsed.targetName,
        eventTypes: parsed.eventTypes
      };
    });
  }

  public async hasStaffTarget(groupId: string): Promise<boolean> {
    const rows = await this.readRows(SHEET_NAMES.staffTargets);
    return rows.some((row) => row[2] === groupId);
  }

  /**
   * Returns a Set of "dedupeKey:targetId" strings for all successful notifications.
   * Used to deduplicate notifications within a single orchestration cycle.
   */
  public async getSuccessfulDedupeKeys(): Promise<Set<string>> {
    const rows = await this.readRows(SHEET_NAMES.notificationLog);
    const keys = new Set<string>();
    for (const row of rows) {
      // notificationLog columns: event_type(0) dedupe_key(1) target_type(2)
      // target_id(3) external_id(4) domain(5) customer_code(6)
      // message_preview(7) sent_at(8) status(9) line_request_id(10) error_message(11)
      if (row[9] === "success") {
        keys.add(`${row[1]}:${row[3]}`);
      }
    }
    return keys;
  }

  public async appendNotificationLog(row: NotificationLogRow): Promise<void> {
    await this.appendRow(SHEET_NAMES.notificationLog, [
      row.eventType,
      row.dedupeKey,
      row.targetType,
      row.targetId,
      row.externalId,
      row.domain ?? "",
      row.customerCode,
      row.messagePreview,
      row.sentAt,
      row.status,
      row.lineRequestId,
      row.errorMessage
    ]);
  }

  /**
   * Appends only records whose externalId is not already in the sheet.
   * Reads the sheet once for the entire batch to avoid redundant API calls.
   */
  public async bulkUpsertRequestRecords(records: SourceRecord[]): Promise<void> {
    if (!records.length) return;
    const existing = await this.readRows(SHEET_NAMES.requestsRaw);
    const existingIds = new Set(existing.map((row) => row[0]));

    for (const record of records) {
      if (!existingIds.has(record.externalId)) {
        await this.appendRow(SHEET_NAMES.requestsRaw, [
          record.externalId,
          record.domain,
          record.requestNo ?? "",
          record.customerCode ?? "",
          record.customerName ?? "",
          record.requesterName ?? "",
          record.requesterOrg ?? "",
          record.requestType ?? "",
          record.status,
          record.statusText ?? "",
          record.submittedAt ?? "",
          record.lastSeenAt,
          record.snapshotHash,
          nowIso(),
          "",
          "",
          ""
        ]);
        existingIds.add(record.externalId);
      }
    }
  }

  /**
   * Appends only records whose externalId is not already in the sheet.
   * Reads the sheet once for the entire batch to avoid redundant API calls.
   */
  public async bulkUpsertResultRecords(records: SourceRecord[]): Promise<void> {
    if (!records.length) return;
    const existing = await this.readRows(SHEET_NAMES.resultsRaw);
    const existingIds = new Set(existing.map((row) => row[0]));

    for (const record of records) {
      if (!existingIds.has(record.externalId)) {
        await this.appendRow(SHEET_NAMES.resultsRaw, [
          record.externalId,
          record.domain,
          record.requestNo ?? "",
          record.sampleId ?? "",
          record.reportNo ?? "",
          record.reportUrl ?? "",
          record.customerCode ?? "",
          record.customerName ?? "",
          record.requesterName ?? "",
          record.requesterOrg ?? "",
          record.status,
          record.statusText ?? "",
          record.submittedAt ?? "",
          record.completedAt ?? "",
          record.lastSeenAt,
          record.snapshotHash,
          nowIso(),
          "",
          "",
          "",
          ""
        ]);
        existingIds.add(record.externalId);
      }
    }
  }

  public async markPendingMap(event: NotificationEvent): Promise<void> {
    await this.appendNotificationLog({
      eventType: "PENDING_MAPPING",
      dedupeKey: `PENDING_MAPPING:${event.dedupeKey}`,
      targetType: "user",
      targetId: "",
      externalId: event.externalId,
      domain: event.payload.domain ?? "",
      customerCode: event.customerCode ?? "",
      messagePreview: `Pending LINE map for ${event.requesterName ?? "-"}`,
      sentAt: nowIso(),
      status: "pending_map",
      lineRequestId: "",
      errorMessage: ""
    });
  }

  public async upsertCustomerMap(row: CustomerLineMapRow): Promise<void> {
    await this.appendRow(SHEET_NAMES.customerLineMap, [
      row.requesterName,
      row.requesterOrg,
      row.customerCode,
      row.customerName,
      row.referenceNo,
      row.lineUserId,
      row.lineDisplayName,
      row.linkStatus,
      row.linkedAt,
      String(row.active),
      row.remark
    ]);
  }

  public async appendStaffTarget(row: StaffTargetRow): Promise<void> {
    await this.appendRow(SHEET_NAMES.staffTargets, [
      row.targetType,
      row.targetName,
      row.groupId,
      row.lineUserId,
      String(row.enabled),
      row.eventTypes.join(","),
      row.priority,
      row.remark
    ]);
  }

  private async readRows(sheetName: string): Promise<string[][]> {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A2:Z`
    });
    return (response.data.values ?? []) as string[][];
  }

  private async appendRow(sheetName: string, row: string[]): Promise<void> {
    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A:Z`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row]
      }
    });
  }

  private async setHeaderRow(sheetName: string, row: string[]): Promise<void> {
    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [row]
      }
    });
  }
}
