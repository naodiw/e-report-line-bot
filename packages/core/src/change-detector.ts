import type { NotificationEvent, SourceRecord } from "./types.js";
import { buildNewRequestEvent, buildResultCompletedEvent } from "./events.js";

export const buildEventsFromRecords = (records: SourceRecord[]): NotificationEvent[] =>
  records.map((record) => {
    if (record.entityType === "request") {
      return buildNewRequestEvent(record);
    }

    return buildResultCompletedEvent(record);
  });
