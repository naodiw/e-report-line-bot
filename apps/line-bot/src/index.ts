import express from "express";
import { validateSignature, WebhookEvent } from "@line/bot-sdk";
import { appConfig, nowIso } from "@ereport/core";
import { logger } from "@ereport/logging";
import { GoogleSheetsHub } from "@ereport/sheets";

const app = express();
const sheets = new GoogleSheetsHub();

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request, response) => {
    const signature = request.get("x-line-signature") ?? "";
    const body = request.body instanceof Buffer ? request.body.toString("utf8") : "";
    const isValid = validateSignature(body, appConfig.lineChannelSecret, signature);

    if (!isValid) {
      response.status(401).json({ ok: false });
      return;
    }

    // Respond immediately so LINE does not retry
    response.json({ ok: true });

    const parsed = JSON.parse(body) as { events: WebhookEvent[] };
    for (const event of parsed.events) {
      await handleEvent(event).catch((error) => {
        logger.error("Failed to handle LINE event", {
          type: event.type,
          message: error instanceof Error ? error.message : String(error)
        });
      });
    }
  }
);

const handleEvent = async (event: WebhookEvent): Promise<void> => {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const text = event.message.text.trim();
  const source = event.source;

  if (source.type === "group" && source.groupId) {
    const alreadyCaptured = await sheets.hasStaffTarget(source.groupId);
    if (!alreadyCaptured) {
      await sheets.appendStaffTarget({
        targetType: "group",
        targetName: "Captured from LINE webhook",
        groupId: source.groupId,
        lineUserId: "",
        enabled: true,
        eventTypes: ["NEW_REQUEST"],
        priority: "1",
        remark: "Auto-captured staff group"
      });
      logger.info("Captured LINE staff group", { groupId: source.groupId });
    }
    return;
  }

  if (!("userId" in source) || !source.userId) {
    return;
  }

  const match = text.match(/^LINK\s+(.+)$/i);
  if (!match) {
    return;
  }

  const [requesterName, requesterOrg = ""] = match[1].split("|").map((part) => part.trim());
  await sheets.upsertCustomerMap({
    requesterName,
    requesterOrg,
    customerCode: "",
    customerName: "",
    referenceNo: "",
    lineUserId: source.userId,
    lineDisplayName: "",
    linkStatus: "linked",
    linkedAt: nowIso(),
    active: true,
    remark: "Linked from LINE webhook"
  });

  logger.info("Linked LINE user to requester", {
    requesterName,
    requesterOrg,
    userId: source.userId
  });
};

app.listen(appConfig.lineBotPort, () => {
  logger.info("LINE bot service listening", {
    port: appConfig.lineBotPort
  });
});
