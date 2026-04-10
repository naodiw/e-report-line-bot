import {
  appConfig,
  normalizeRequestRow,
  normalizeResultRow,
  normalizeWhitespace,
  safeCell,
  splitRequester
} from "@ereport/core";
import type {
  DomainName,
  RequestListRow,
  ResultDetailReportItem,
  ResultSearchRow,
  SourceRecord
} from "@ereport/core";
import { logger } from "@ereport/logging";
import { CookieHttpSession } from "./http.js";

const stripHtml = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const extractRows = (tableHtml: string): string[][] => {
  const bodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) {
    return [];
  }

  return Array.from(bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)).map((rowMatch) =>
    Array.from(rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cellMatch) =>
      stripHtml(cellMatch[1])
    )
  );
};

const extractRowHtmlList = (tableHtml: string): string[] => {
  const bodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) {
    return [];
  }

  return Array.from(bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)).map((match) => match[0]);
};

const extractTableById = (html: string, tableId: string): string => {
  const match = html.match(new RegExp(`<table id="${tableId}"[\\s\\S]*?<\\/table>`, "i"));
  return match?.[0] ?? "";
};

const getCurrentBuddhistYear = (): string => String(new Date().getFullYear() + 543);

export class EReportClient {
  private readonly session = new CookieHttpSession(appConfig.eReportBaseUrl);

  public async login(): Promise<void> {
    const raw = await this.session.post("/includes/login_process.php", {
      username: appConfig.eReportUsername,
      password: appConfig.eReportPassword
    });
    const response = JSON.parse(raw) as { status_type?: string };
    if (response.status_type !== "success") {
      throw new Error("E-Report login failed");
    }
  }

  public async fetchNewRequests(domain: DomainName): Promise<SourceRecord[]> {
    const path = domain === "water" ? "/administrativeWater.php" : "/administrativeAir.php";
    const html = await this.session.get(path);
    const tableHtml = extractTableById(html, "alternative-page-datatable");
    const rows = extractRows(tableHtml);

    return rows
      .map((cells): RequestListRow => {
        const requester = splitRequester(safeCell(cells, 3));
        return {
          requestNo: safeCell(cells, 1),
          submittedAt: safeCell(cells, 2),
          requesterName: requester.requesterName,
          requesterOrg: requester.requesterOrg,
          customerName: safeCell(cells, 4),
          sampleCount: safeCell(cells, 5),
          status: safeCell(cells, 6),
          domain,
          externalId: safeCell(cells, 1)
        };
      })
      .filter((row) => appConfig.requestTriggerStatuses.includes(row.status))
      .map(normalizeRequestRow);
  }

  public async fetchCompletedResults(domain: DomainName): Promise<SourceRecord[]> {
    const searchResponse = await this.session.post("/includes/getInformation.php", {
      action: "searchData",
      user_region_id: "2",
      year: getCurrentBuddhistYear(),
      analysis_type_id: domain === "water" ? "1" : "27"
    });

    const searchJson = this.parseJson<{ status?: boolean; search_result: string }>(searchResponse, {
      stage: "searchData",
      domain
    });
    if (searchJson.status === false) {
      return [];
    }

    const rows = extractRowHtmlList(searchJson.search_result)
      .map((rowHtml): ResultSearchRow => {
        const cells = Array.from(rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)).map((cell) =>
          stripHtml(cell[1])
        );
        const requester = splitRequester(safeCell(cells, 4));
        const detailIdMatch = rowHtml.match(/reqInfoDetail(?:AirSound)?\('(\d+)'\)/i);
        return {
          requestNo: safeCell(cells, 1).split("|")[0].trim(),
          requestType: safeCell(cells, 2),
          submittedAt: safeCell(cells, 3),
          requesterName: requester.requesterName,
          requesterOrg: requester.requesterOrg,
          customerName: safeCell(cells, 5),
          sampleCount: safeCell(cells, 6),
          status: safeCell(cells, 7),
          detailId: detailIdMatch?.[1] ?? "",
          domain
        };
      })
      .filter((row) => row.detailId && appConfig.resultTriggerStatuses.includes(row.status));

    const records: SourceRecord[] = [];
    for (const row of rows) {
      const detailItems = await this.fetchResultDetailItems(row.domain, row.detailId, row.requestNo, row.customerName, row.status);
      for (const item of detailItems) {
        records.push(normalizeResultRow(row, item));
      }
    }

    return records;
  }

  private async fetchResultDetailItems(
    domain: DomainName,
    detailId: string,
    requestNo: string,
    customerName: string,
    status: string
  ): Promise<ResultDetailReportItem[]> {
    const action = domain === "air" ? "getReqDetailAirSound" : "getReqDetail";
    const raw = await this.session.post("/includes/getInformation.php", {
      req_analysis_id: detailId,
      action
    });
    const detailJson = this.parseJson<{ status: boolean; html_response: string; html_response_header?: string }>(raw, {
      stage: "detail",
      domain,
      detailId,
      action
    });
    if (!detailJson.status) {
      logger.warn("E-Report detail fetch returned status=false", { detailId, domain });
      return [];
    }

    return Array.from(detailJson.html_response.matchAll(/<tr[\s\S]*?<\/tr>/gi))
      .map((match) => match[0])
      .map((rowHtml) => {
        const cells = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => stripHtml(cell[1]));
        const reportUrlMatch = rowHtml.match(/href="([^"]*ds_report[^"]*id=(\d+))"/i);
        return {
          requestNo,
          detailId,
          sampleId: normalizeWhitespace(safeCell(cells, 0)),
          analysisSampleId: reportUrlMatch?.[2] ?? "",
          reportUrl: reportUrlMatch ? `${appConfig.eReportBaseUrl}/${reportUrlMatch[1].replace(/^\//, "")}` : "",
          customerName,
          parameterGroup: normalizeWhitespace(safeCell(cells, 4)),
          status,
          domain
        } satisfies ResultDetailReportItem;
      })
      .filter((item) => item.analysisSampleId && item.reportUrl);
  }

  private parseJson<T>(raw: string, context: Record<string, string>): T {
    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      logger.error("Failed to parse E-Report JSON response", {
        ...context,
        preview: raw.slice(0, 500),
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
