import { Client } from "@line/bot-sdk";
import { appConfig } from "@ereport/core";
import type { NotificationEvent, NotificationTarget } from "@ereport/core";

export class LineDeliveryService {
  private readonly client = appConfig.lineChannelAccessToken && appConfig.lineChannelSecret
    ? new Client({
        channelAccessToken: appConfig.lineChannelAccessToken,
        channelSecret: appConfig.lineChannelSecret
      })
    : null;

  public async pushBatchedEvents(
    target: NotificationTarget,
    events: NotificationEvent[]
  ): Promise<{ requestId: string | null }> {
    if (!this.client) {
      throw new Error("LINE messaging is not configured");
    }

    const to = target.type === "group" ? target.groupId : target.userId;
    if (!to) {
      throw new Error("LINE target is missing destination id");
    }

    const message = events[0].eventType === "NEW_REQUEST"
      ? this.buildNewRequestMessage(events)
      : this.buildResultMessage(events);

    await this.client.pushMessage(to, [{ type: "text", text: message }]);
    return { requestId: null };
  }

  private buildNewRequestMessage(events: NotificationEvent[]): string {
    const byFactory = new Map<string, NotificationEvent[]>();
    for (const e of events) {
      const key = e.customerName ?? "";
      if (!byFactory.has(key)) byFactory.set(key, []);
      byFactory.get(key)!.push(e);
    }

    const lines = [`มีคำร้องใหม่`];
    for (const factoryEvents of byFactory.values()) {
      const factoryName = this.trimCustomerName(factoryEvents[0].customerName || "ไม่ระบุโรงงาน");
      const province = this.extractProvince(factoryEvents[0].requesterOrg ?? "");
      lines.push("", factoryName, `จังหวัด: ${province}`);
      for (const e of factoryEvents) {
        lines.push(`• ${e.requesterName ?? "-"}`);
      }
    }
    return lines.join("\n");
  }

  private extractProvince(org: string): string {
    return org.match(/จังหวัด\s*(.+)/)?.[1]?.trim() ?? "-";
  }

  private trimCustomerName(raw: string): string {
    // Remove factory registration number (10+ digits) and everything after
    return raw.replace(/\s+\d{10,}.*$/, "").trim();
  }

  private buildResultMessage(events: NotificationEvent[]): string {
    const factoryName = this.trimCustomerName(events[0].customerName || "ไม่ระบุโรงงาน");
    const requestNos = [...new Set(events.map((e) => e.requestNo).filter(Boolean))];
    const lines = [
      factoryName,
      `ผลการทดสอบพร้อมแล้ว ${events.length} รายงาน`,
      ...requestNos.map((no) => `• เลขคำร้อง: ${no}`),
      `กรุณาเข้าสู่ระบบ https://e-report.diw.go.th/`
    ];
    return lines.join("\n");
  }
}
