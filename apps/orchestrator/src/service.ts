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

    const [staffTargets, customerMap, notifiedKeys] = await Promise.all([
      this.sheets.getStaffTargets(),
      this.sheets.getCustomerMap(),
      this.sheets.getSuccessfulDedupeKeys()
    ]);

    const enabledStaffTargets = staffTargets.filter(
      (t) => t.enabled && t.eventTypes.includes("NEW_REQUEST")
    );

    const newRequestEvents = events.filter((e) => e.eventType === "NEW_REQUEST");
    const completedEvents = events.filter((e) => e.eventType === "RESULT_COMPLETED");

    if (newRequestEvents.length && appConfig.staffNotifyEnabled) {
      await this.handleNewRequestsBatched(newRequestEvents, enabledStaffTargets, notifiedKeys);
    }

    if (completedEvents.length && appConfig.customerNotifyEnabled) {
      await this.handleCompletedResultsBatched(completedEvents, customerMap, notifiedKeys);
    }
  }

  private async handleNewRequestsBatched(
    events: NotificationEvent[],
    targets: NotificationTarget[],
    notifiedKeys: Set<string>
  ): Promise<void> {
    for (const target of targets) {
      await this.sendBatchedToTarget(target, events, notifiedKeys);
    }
  }

  private async handleCompletedResultsBatched(
    events: NotificationEvent[],
    customerMap: CustomerLineMapRow[],
    notifiedKeys: Set<string>
  ): Promise<void> {
    // Group by lineUserId + customerName (1 message per user per factory)
    const byUserAndFactory = new Map<string, { target: NotificationTarget; events: NotificationEvent[] }>();

    for (const event of events) {
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
        continue;
      }

      const key = `${mapping.lineUserId}::${event.customerName ?? ""}`;
      if (!byUserAndFactory.has(key)) {
        byUserAndFactory.set(key, {
          target: {
            type: "user",
            userId: mapping.lineUserId,
            groupId: null,
            enabled: true,
            name: mapping.lineDisplayName || mapping.requesterName,
            eventTypes: ["RESULT_COMPLETED"]
          },
          events: []
        });
      }
      byUserAndFactory.get(key)!.events.push(event);
    }

    for (const { target, events: userEvents } of byUserAndFactory.values()) {
      await this.sendBatchedToTarget(target, userEvents, notifiedKeys);
    }
  }

  private async sendBatchedToTarget(
    target: NotificationTarget,
    events: NotificationEvent[],
    notifiedKeys: Set<string>
  ): Promise<void> {
    const targetId = target.type === "group" ? target.groupId ?? "" : target.userId ?? "";
    if (!targetId) return;

    // Filter out events already notified
    const newEvents = events.filter((e) => !notifiedKeys.has(`${e.dedupeKey}:${targetId}`));
    if (!newEvents.length) return;

    try {
      const delivery = await this.line.pushBatchedEvents(target, newEvents);
      for (const event of newEvents) {
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
        notifiedKeys.add(`${event.dedupeKey}:${targetId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LINE delivery error";
      logger.error("LINE delivery failed", { targetId, message });
      for (const event of newEvents) {
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
}
