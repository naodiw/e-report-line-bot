# E-Report LINE Notification System

Polling-based Node.js/TypeScript system for:

- detecting new requests at status `1`
- detecting completed reports at status `8`
- storing operational records in Google Sheets
- notifying staff and customers through one LINE Official Account

## Workflow Rules

- New request event: notify once per `request_no` when a request first appears at status `1`
- Completed result event: notify once per report item when a request reaches status `8` and exposes a report link
- Result notifications are sent one report at a time
- LINE messages must not contain detailed test results

## Repo Layout

- `apps/poller`: polls E-Report and emits normalized events
- `apps/orchestrator`: routes events to Google Sheets and LINE
- `apps/line-bot`: receives LINE webhooks for user and group linking
- `packages/core`: types, config, normalizers, rules
- `packages/connectors`: E-Report and LINE connectors
- `packages/sheets`: Google Sheets adapters
- `packages/logging`: logger and retry helpers

## Setup

1. Fill `.env` from `.env.example`
2. Install dependencies with `npm install`
3. Run type-check with `npm run check`
4. Build with `npm run build`
5. Initialize Google Sheets with `npm run setup:sheets`
6. Start the apps you need

For this project, the configured spreadsheet is:

- [Google Sheet](https://docs.google.com/spreadsheets/d/1hc7BlsZ4h9pK-GtJeQNG5yK3o1_TvgktDXWnYljRsU8/edit?gid=0#gid=0)

You can provide either:

- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SPREADSHEET_URL`

The app will extract the spreadsheet ID automatically from the URL.

Before running writes, share the sheet with the Google service account email from `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Google Sheets Layout

### `requests_raw`

- `external_id`: currently set from `request_no`
- `domain`: `water` or `air`
- `request_no`: from `administrativeWater.php` or `administrativeAir.php`
- `customer_name`: from the "โรงงาน/แหล่ง..." column
- `requester_name`: from the "ผู้ยื่นคำขอ" column
- `requester_org`: from the "ผู้ยื่นคำขอ" secondary line
- `request_type`: set from domain in this scaffold
- `status`: request workflow status, filtered to `1`
- `submitted_at`: request submitted timestamp

### `results_raw`

- `external_id`: `{detailId}:{analysisSampleId}`
- `domain`: `water` or `air`
- `request_no`: from `search.php`
- `sample_id`: from detail row in `getReqDetail` or `getReqDetailAirSound`
- `report_no`: currently populated with `analysisSampleId` until a dedicated report number parser is added
- `report_url`: direct report PDF/endpoint URL
- `customer_name`: from `search.php`
- `requester_name`: from `search.php`
- `requester_org`: from `search.php`
- `status`: result workflow status, filtered to `8`
- `completed_at`: poll timestamp when report-ready item is detected

### `customer_line_map`

- Used to map `requester_name + requester_org` to `line_user_id`
- This is the current rule for customer delivery

### `staff_targets`

- Stores staff group IDs or user IDs for `NEW_REQUEST`
- Staff group IDs can be auto-captured from the LINE webhook

### `notification_log`

- Stores all sends, failures, and pending mapping entries
- Includes `domain` so you can filter water vs air notifications

## E-Report Data Sources

- New requests:
  - `administrativeWater.php`
  - `administrativeAir.php`
  - filtered to status `1`
- Completed reports:
  - `search.php` -> `includes/getInformation.php` with `action=searchData`
  - then detail expansion with `getReqDetail` or `getReqDetailAirSound`
  - filtered to status `8`

## Domain Mapping

- `domain=water` when data comes from water request/result pages
- `domain=air` when data comes from air, odor, or sound pages
- This value is written into `requests_raw`, `results_raw`, and `notification_log`

## Notes

- The current implementation is scaffolded around the confirmed E-Report pages and AJAX endpoints.
- Some selectors and parsing details may need adjustment if the upstream HTML changes.
