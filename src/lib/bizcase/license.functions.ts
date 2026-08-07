import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  key: z.string().min(4).max(200),
  /** Whether this check should count as a new device activation. The initial
   *  redemption in the UI increments; background revalidation does not, so
   *  simply re-checking an already-activated key never burns through MAX_USES. */
  incrementUses: z.boolean().optional(),
});

const PRODUCT_ID = "6tG_g_n57LnSvv1_IMgXiA==";

/** How many devices/browsers a single license key can activate. */
const MAX_USES = 3;

export interface VerifyResult {
  valid: boolean;
  message?: string;
  /** True for network/server hiccups that say nothing about whether the key
   *  is actually valid — callers should NOT revoke access on a transient
   *  failure, only on a genuine rejection from Gumroad. */
  transient?: boolean;
}

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

/** Verifies a Gumroad license key against Gumroad's own API — this is the one
 *  place that decides whether a key is real, so it can't be spoofed by just
 *  writing something to localStorage. Returns a result object rather than
 *  throwing for expected failure cases, so callers can tell a genuine
 *  rejection (bad/refunded/over-activated key) apart from a transient
 *  network or server hiccup that shouldn't cost anyone their access. */
export const verifyLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<VerifyResult> => {
    const key = data.key.trim();
    const incrementUses = data.incrementUses !== false;

    let res: Response;
    try {
      res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_id: PRODUCT_ID,
          license_key: key,
          increment_uses_count: incrementUses ? "true" : "false",
        }),
      });
    } catch {
      return {
        valid: false,
        transient: true,
        message:
          "Could not reach the license server. Check your internet connection and try again.",
      };
    }

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      message?: string;
      uses?: number;
      purchase?: { refunded?: boolean; chargebacked?: boolean; disputed?: boolean };
    } | null;

    if (!json) {
      return {
        valid: false,
        transient: true,
        message: "The license server sent back an unreadable response. Try again in a few minutes.",
      };
    }
    if (!res.ok || !json.success) {
      return {
        valid: false,
        transient: res.status === 429 || res.status >= 500,
        message: friendlyMessage(json.message, res.status),
      };
    }
    if (json.purchase?.refunded) {
      return {
        valid: false,
        message:
          "This purchase was refunded, so the key no longer works. Buy again to unlock the full version.",
      };
    }
    if (json.purchase?.chargebacked || json.purchase?.disputed) {
      return {
        valid: false,
        message:
          "This purchase is disputed, so the key is on hold. Contact support to have it restored.",
      };
    }
    if (typeof json.uses === "number" && json.uses > MAX_USES) {
      return {
        valid: false,
        message: `This key has already been activated on the maximum of ${MAX_USES} devices. Contact support if you need it reset.`,
      };
    }

    return { valid: true };
  });
