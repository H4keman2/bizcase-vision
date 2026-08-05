import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ key: z.string().min(4).max(200) });

const PRODUCT_ID = "6tG_g_n57LnSvv1_IMgXiA==";

/** Turns a raw Gumroad message into something a buyer can act on. */
function friendlyMessage(raw: string | undefined, status: number): string {
  const m = (raw ?? "").toLowerCase();
  if (m.includes("not found") || m.includes("invalid")) {
    return "That license key was not recognised. Check for typos or extra spaces, and make sure you copied the whole key from your Gumroad receipt.";
  }
  if (m.includes("product")) {
    return "That key belongs to a different product. Use the key from your BizCase Builder receipt.";
  }
  if (status === 429) {
    return "Too many verification attempts. Wait a minute and try again.";
  }
  if (status >= 500) {
    return "The license server is having problems right now. Try again in a few minutes.";
  }
  return raw?.trim()
    ? `License check failed: ${raw.trim()}`
    : "That license key could not be verified. Check the key and try again.";
}

/** Verifies a Gumroad license key. Returns { valid: true } or throws with a readable message. */
export const verifyLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = data.key.trim();

    let res: Response;
    try {
      res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_id: PRODUCT_ID,
          license_key: key,
          increment_uses_count: "false",
        }),
      });
    } catch {
      throw new Error(
        "Could not reach the license server. Check your internet connection and try again.",
      );
    }

    const json = (await res.json().catch(() => null)) as
      | {
          success?: boolean;
          message?: string;
          purchase?: { refunded?: boolean; chargebacked?: boolean; disputed?: boolean };
        }
      | null;

    if (!json) {
      throw new Error(
        "The license server sent back an unreadable response. Try again in a few minutes.",
      );
    }
    if (!res.ok || !json.success) {
      throw new Error(friendlyMessage(json.message, res.status));
    }
    if (json.purchase?.refunded) {
      throw new Error(
        "This purchase was refunded, so the key no longer works. Buy again to unlock the full version.",
      );
    }
    if (json.purchase?.chargebacked || json.purchase?.disputed) {
      throw new Error(
        "This purchase is disputed, so the key is on hold. Contact support to have it restored.",
      );
    }

    return { valid: true as const };
  });
