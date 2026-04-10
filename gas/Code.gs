// Google Apps Script — E-Report LINE Registration
// Deploy as Web App: Execute as "Me", Who has access "Anyone"
//
// Set SPREADSHEET_ID below to your Google Sheets ID

const SPREADSHEET_ID = "@@SPREADSHEET_ID@@";
const SHEET_NAME = "customer_line_map";

function doPost(e) {
  try {
    const requesterName   = (e.parameter.requesterName   || "").trim();
    const requesterOrg    = (e.parameter.requesterOrg    || "").trim();
    const lineUserId      = (e.parameter.lineUserId      || "").trim();
    const lineDisplayName = (e.parameter.lineDisplayName || "").trim();

    if (!requesterName || !lineUserId) {
      return jsonResponse({ ok: false, error: "Missing required fields" });
    }

    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ ok: false, error: "Sheet not found: " + SHEET_NAME });
    }

    // Check duplicate userId — ถ้า userId นี้ลงทะเบียนไว้แล้ว ให้อัพเดทแทน
    const data2d = sheet.getDataRange().getValues();
    for (let i = 1; i < data2d.length; i++) {
      if (data2d[i][5] === lineUserId) {
        // Update existing row (columns: requester_name, requester_org, line_display_name, link_status, linked_at, active)
        sheet.getRange(i + 1, 1).setValue(requesterName);
        sheet.getRange(i + 1, 2).setValue(requesterOrg);
        sheet.getRange(i + 1, 7).setValue(lineDisplayName);
        sheet.getRange(i + 1, 8).setValue("linked");
        sheet.getRange(i + 1, 9).setValue(new Date().toISOString());
        sheet.getRange(i + 1, 10).setValue("true");
        return jsonResponse({ ok: true, action: "updated" });
      }
    }

    // Append new row
    // Columns: requester_name, requester_org, customer_code, customer_name, reference_no,
    //          line_user_id, line_display_name, link_status, linked_at, active, remark
    sheet.appendRow([
      requesterName,
      requesterOrg,
      "",                          // customer_code (admin fills later)
      "",                          // customer_name (admin fills later)
      "",                          // reference_no
      lineUserId,
      lineDisplayName,
      "linked",
      new Date().toISOString(),
      "true",
      ""                           // remark
    ]);

    return jsonResponse({ ok: true, action: "created" });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Test function — run ใน GAS editor เพื่อทดสอบ
function testPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        requesterName: "นายทดสอบ ระบบ",
        requesterOrg: "หน่วยงานทดสอบ",
        lineUserId: "Utest123456",
        lineDisplayName: "Test User"
      })
    }
  };
  const result = doPost(mockEvent);
  Logger.log(result.getContent());
}
