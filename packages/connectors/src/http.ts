import { URLSearchParams } from "node:url";

export interface HttpSession {
  get(path: string): Promise<string>;
  post(path: string, body: Record<string, string>): Promise<string>;
}

export class CookieHttpSession implements HttpSession {
  private readonly baseUrl: string;
  private cookieHeader = "";

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  }

  public async get(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: this.cookieHeader ? { Cookie: this.cookieHeader } : undefined
    });
    this.captureCookies(response);
    return response.text();
  }

  public async post(path: string, body: Record<string, string>): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(this.cookieHeader ? { Cookie: this.cookieHeader } : {})
      },
      body: new URLSearchParams(body).toString()
    });
    this.captureCookies(response);
    return response.text();
  }

  private captureCookies(response: Response): void {
    const cookies = response.headers.getSetCookie?.() ?? [];
    if (!cookies.length) {
      return;
    }

    const merged = new Map<string, string>();
    if (this.cookieHeader) {
      for (const part of this.cookieHeader.split(";")) {
        const trimmed = part.trim();
        const eq = trimmed.indexOf("=");
        if (eq !== -1) {
          merged.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
        }
      }
    }

    for (const cookie of cookies) {
      const [nameValue] = cookie.split(";");
      const eq = nameValue.indexOf("=");
      if (eq !== -1) {
        merged.set(nameValue.slice(0, eq).trim(), nameValue.slice(eq + 1).trim());
      }
    }

    this.cookieHeader = Array.from(merged.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
}
