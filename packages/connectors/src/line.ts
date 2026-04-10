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

  public async pushEvent(target: NotificationTarget, event: NotificationEvent): Promise<{ requestId: string | null }> {
    if (!this.client) {
      throw new Error("LINE messaging is not configured");
    }

    const to = target.type === "group" ? target.groupId : target.userId;
    if (!to) {
      throw new Error("LINE target is missing destination id");
    }

    const message = event.eventType === "NEW_REQUEST"
      ? [
          "มีคำร้องใหม่ใน E-Report",
          `เลขคำร้อง: ${event.payload.requestNo ?? "-"}`,
          `ผู้ยื่น: ${event.payload.requesterName ?? "-"}`,
          `หน่วยงาน: ${event.payload.requesterOrg ?? "-"}`,
          `งาน: ${event.payload.domain ?? "-"}`
        ].join("\n")
      : [
          "ผลการทดสอบพร้อมแล้ว",
          `เลขคำร้อง: ${event.payload.requestNo ?? "-"}`,
          `รหัสรายงาน: ${event.payload.reportNo ?? event.payload.sampleId ?? "-"}`,
          "กรุณาเข้าสู่ระบบหรือติดต่อเจ้าหน้าที่เพื่อรับรายงาน"
        ].join("\n");

    await this.client.pushMessage(to, [{ type: "text", text: message }]);
    return { requestId: null };
  }
}
