import { LineDeliveryService } from "@ereport/connectors";
import { logger } from "@ereport/logging";
import { GoogleSheetsHub } from "@ereport/sheets";
import { NotificationOrchestrator } from "./service.js";

const main = async (): Promise<void> => {
  const sheets = new GoogleSheetsHub();
  const line = new LineDeliveryService();
  const orchestrator = new NotificationOrchestrator(sheets, line);

  logger.info("Orchestrator initialized", {
    service: "orchestrator",
    ready: true,
    methods: Object.getOwnPropertyNames(Object.getPrototypeOf(orchestrator))
  });
};

main().catch((error) => {
  logger.error("Orchestrator failed to start", {
    message: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
