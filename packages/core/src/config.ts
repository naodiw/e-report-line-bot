import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  TZ: z.string().default("Asia/Bangkok"),
  PORT: z.coerce.number().default(3000),
  LINE_BOT_PORT: z.coerce.number().default(3010),
  E_REPORT_BASE_URL: z.string().url(),
  E_REPORT_USERNAME: z.string().min(1),
  E_REPORT_PASSWORD: z.string().min(1),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().optional().default(""),
  LINE_CHANNEL_SECRET: z.string().optional().default(""),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional().default(""),
  GOOGLE_SHEETS_SPREADSHEET_URL: z.string().optional().default(""),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().min(1),
  REQUEST_POLL_INTERVAL_MINUTES: z.coerce.number().default(60),
  RESULT_POLL_INTERVAL_MINUTES: z.coerce.number().default(60),
  RETRY_FAILED_INTERVAL_MINUTES: z.coerce.number().default(120),
  STAFF_NOTIFY_ENABLED: z.string().default("true"),
  CUSTOMER_NOTIFY_ENABLED: z.string().default("true"),
  REQUEST_TRIGGER_STATUSES: z.string().default("1"),
  RESULT_TRIGGER_STATUSES: z.string().default("8"),
  ADMIN_STAFF_GROUP_ID: z.string().optional().default("")
});

const parsed = schema.parse(process.env);

const parseCsv = (value: string): string[] =>
  value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const extractSpreadsheetId = (input: string): string => {
  if (!input) {
    return "";
  }

  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? input;
};

const spreadsheetId = extractSpreadsheetId(
  parsed.GOOGLE_SHEETS_SPREADSHEET_ID || parsed.GOOGLE_SHEETS_SPREADSHEET_URL
);

if (!spreadsheetId) {
  throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID or GOOGLE_SHEETS_SPREADSHEET_URL is required");
}

export const appConfig = {
  nodeEnv: parsed.NODE_ENV,
  timeZone: parsed.TZ,
  port: parsed.PORT,
  lineBotPort: parsed.LINE_BOT_PORT,
  eReportBaseUrl: parsed.E_REPORT_BASE_URL,
  eReportUsername: parsed.E_REPORT_USERNAME,
  eReportPassword: parsed.E_REPORT_PASSWORD,
  lineChannelAccessToken: parsed.LINE_CHANNEL_ACCESS_TOKEN,
  lineChannelSecret: parsed.LINE_CHANNEL_SECRET,
  spreadsheetId,
  googleServiceAccountJson: parsed.GOOGLE_SERVICE_ACCOUNT_JSON,
  requestPollIntervalMinutes: parsed.REQUEST_POLL_INTERVAL_MINUTES,
  resultPollIntervalMinutes: parsed.RESULT_POLL_INTERVAL_MINUTES,
  retryFailedIntervalMinutes: parsed.RETRY_FAILED_INTERVAL_MINUTES,
  staffNotifyEnabled: parsed.STAFF_NOTIFY_ENABLED === "true",
  customerNotifyEnabled: parsed.CUSTOMER_NOTIFY_ENABLED === "true",
  requestTriggerStatuses: parseCsv(parsed.REQUEST_TRIGGER_STATUSES),
  resultTriggerStatuses: parseCsv(parsed.RESULT_TRIGGER_STATUSES),
  adminStaffGroupId: parsed.ADMIN_STAFF_GROUP_ID
} as const;
