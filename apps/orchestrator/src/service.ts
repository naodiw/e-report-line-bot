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
      const overrideUserId = appConfig.customerNotifyOverrideUserId;
      let resolvedUserId: string;
      let resolvedName: string = event.requesterName ?? "ลูกค้า";
      if (overrideUserId) {
        resolvedUserId = overrideUserId;
      } else {
        const reportName = (event.requesterName ?? "").replace(/^(นางสาว|นาง|นาย)\s*/, "").trim();
        const activeRows = customerMap.filter((row) => row.active);
        const exactMatch = activeRows.find((row) => row.requesterName.trim() === reportName);
        const mapping = exactMatch ?? (() => {
          let best: typeof activeRows[0] | undefined;
          let bestDist = 4;
          for (const row of activeRows) {
            const d = levenshtein(row.requesterName.trim(), reportName);
            if (d < bestDist) { bestDist = d; best = row; }
          }
          return best;
        })();

        if (!mapping?.lineUserId) {
          logger.warn("Customer LINE mapping not found", {
            requestNo: event.requestNo,
            requesterName: event.requesterName,
            requesterOrg: event.requesterOrg
          });
          await this.sheets.markPendingMap(event);
          continue;
        }
        resolvedUserId = mapping.lineUserId;
        resolvedName = mapping.lineDisplayName || mapping.requesterName;
      }

      const key = `${resolvedUserId}::${event.customerName ?? ""}`;
      if (!byUserAndFactory.has(key)) {
        byUserAndFactory.set(key, {
          target: {
            type: "user",
            userId: resolvedUserId,
            groupId: null,
            enabled: true,
            name: resolvedName,
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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}
