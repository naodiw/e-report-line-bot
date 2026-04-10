import { appConfig, nowIso } from "@ereport/core";
import type { CustomerLineMapRow, NotificationEvent, NotificationTarget } from "@ereport/core";
import { LineDeliveryService } from "@ereport/connectors";
import { logger } from "@ereport/logging";
import { GoogleSheetsHub } from "@ereport/sheets";

export class NotificationOrchestrator {
  public constructor(
    private readonly sheets: GoogleSheetsHub,
    private readonly line: LineDeliveryService
  ) {}

  public async handleEvents(events: NotificationEvent[]): Promise<void> {
    if (!events.length) return;

    // Load all required data once before the loop to avoid repeated sheet reads
    const [staffTargets, customerMap, notifiedKeys] = await Promise.all([
      this.sheets.getStaffTargets(),
      this.sheets.getCustomerMap(),
      this.sheets.getSuccessfulDedupeKeys()
    ]);

    const enabledStaffTargets = staffTargets.filter(
      (t) => t.enabled && t.eventTypes.includes("NEW_REQUEST")
    );

    for (const event of events) {
      if (event.eventType === "NEW_REQUEST") {
        await this.handleNewRequest(event, enabledStaffTargets, notifiedKeys);
      } else if (event.eventType === "RESULT_COMPLETED") {
        await this.handleCompletedResult(event, customerMap, notifiedKeys);
      }
    }
  }

  private async handleNewRequest(
    event: NotificationEvent,
    targets: NotificationTarget[],
    notifiedKeys: Set<string>
  ): Promise<void> {
    if (!appConfig.staffNotifyEnabled) return;

    for (const target of targets) {
      await this.sendToTarget(target, event, notifiedKeys);
    }
  }

  private async handleCompletedResult(
    event: NotificationEvent,
    customerMap: CustomerLineMapRow[],
    notifiedKeys: Set<string>
  ): Promise<void> {
    if (!appConfig.customerNotifyEnabled) return;

    const mapping = customerMap.find((row) => {
      const sameName = row.requesterName.trim() === (event.requesterName ?? "").trim();
      const sameOrg = row.requesterOrg.trim() === (event.requesterOrg ?? "").trim();
      return row.active && sameName && sameOrg;
    });

    if (!mapping?.lineUserId) {
      logger.warn("Customer LINE mapping not found", {
        requestNo: event.requestNo,
        requesterName: event.requesterName,
        requesterOrg: event.requesterOrg
      });
      await this.sheets.markPendingMap(event);
      return;
    }

    const target: NotificationTarget = {
      type: "user",
      userId: mapping.lineUserId,
      groupId: null,
      enabled: true,
      name: mapping.lineDisplayName || mapping.requesterName,
      eventTypes: ["RESULT_COMPLETED"]
    };

    await this.sendToTarget(target, event, notifiedKeys);
  }

  private async sendToTarget(
    target: NotificationTarget,
    event: NotificationEvent,
    notifiedKeys: Set<string>
  ): Promise<void> {
    const targetId = target.type === "group" ? target.groupId ?? "" : target.userId ?? "";
    if (!targetId) return;

    const key = `${event.dedupeKey}:${targetId}`;
    if (notifiedKeys.has(key)) {
      logger.info("Skipping duplicate notification", { dedupeKey: event.dedupeKey, targetId });
      return;
    }

    try {
      const delivery = await this.line.pushEvent(target, event);
      await this.sheets.appendNotificationLog({
        eventType: event.eventType,
        dedupeKey: event.dedupeKey,
        targetType: target.type,
        targetId,
        externalId: event.externalId,
        domain: event.payload.domain ?? "",
        customerCode: event.customerCode ?? "",
        messagePreview: `${event.eventType}:${event.requestNo ?? event.externalId}`,
        sentAt: nowIso(),
        status: "success",
        lineRequestId: delivery.requestId ?? "",
        errorMessage: ""
      });
      notifiedKeys.add(key);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LINE delivery error";
      logger.error("LINE delivery failed", { targetId, dedupeKey: event.dedupeKey, message });
      await this.sheets.appendNotificationLog({
        eventType: event.eventType,
        dedupeKey: event.dedupeKey,
        targetType: target.type,
        targetId,
        externalId: event.externalId,
        domain: event.payload.domain ?? "",
        customerCode: event.customerCode ?? "",
        messagePreview: `${event.eventType}:${event.requestNo ?? event.externalId}`,
        sentAt: nowIso(),
        status: "failed",
        lineRequestId: "",
        errorMessage: message
      });
    }
  }
}
