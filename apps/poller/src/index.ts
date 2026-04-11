import { buildEventsFromRecords } from "@ereport/core";
import { EReportClient, LineDeliveryService } from "@ereport/connectors";
import { logger } from "@ereport/logging";
import { GoogleSheetsHub } from "@ereport/sheets";
import { NotificationOrchestrator } from "../../orchestrator/src/service.js";

const main = async (): Promise<void> => {
  const eReport = new EReportClient();
  const sheets = new GoogleSheetsHub();
  const orchestrator = new NotificationOrchestrator(sheets, new LineDeliveryService());

  await sheets.ensureOperationalSheets();
  await eReport.login();

  const requestRecords = [
    ...(await eReport.fetchNewRequests("water")),
    ...(await eReport.fetchNewRequests("air")),
    ...(await eReport.fetchNewRequests("soil")),
    ...(await eReport.fetchNewRequests("sewage"))
  ];

  await sheets.bulkUpsertRequestRecords(requestRecords);

  const resultRecords = [
    ...(await eReport.fetchCompletedResults("water")),
    ...(await eReport.fetchCompletedResults("air")),
    ...(await eReport.fetchCompletedResults("soil")),
    ...(await eReport.fetchCompletedResults("sewage"))
  ];

  await sheets.bulkUpsertResultRecords(resultRecords);

  const events = buildEventsFromRecords([...requestRecords, ...resultRecords]);
  await orchestrator.handleEvents(events);

  logger.info("Poller cycle completed", {
    requestCount: requestRecords.length,
    resultCount: resultRecords.length,
    eventCount: events.length
  });
};

main().catch((error) => {
  logger.error("Poller failed", {
    message: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
