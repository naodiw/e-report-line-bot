import { logger } from "@ereport/logging";
import { GoogleSheetsHub } from "@ereport/sheets";

const main = async (): Promise<void> => {
  const sheets = new GoogleSheetsHub();
  await sheets.ensureOperationalSheets();
  logger.info("Operational Google Sheets are ready");
};

main().catch((error) => {
  logger.error("Failed to setup Google Sheets", {
    message: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
