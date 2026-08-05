import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ key: z.string().min(4).max(200) });

const PRODUCT_ID = "6tG_g_n57LnSvv1_IMgXiA==";

/** Verifies a Gumroad license key. Returns { valid: true } or throws with a readable message. */
export const verifyLicenseKey = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const body = new URLSearchParams({
      product_id: PRODUCT_ID,
      license_key: data.key.trim(),
      increment_uses_count: "false",
    });

    let res: Response;
    try {
      res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch {
      throw new Error("Could not reach the license server. Check your connection and try again.");
    }

    const json = (await res.json().catch(() => null)) as
      | { success?: boolean; message?: string; purchase?: { refunded?: boolean } }
      | null;

    if (!res.ok || !json?.success) {
      throw new Error(json?.message ?? "That license key was not recognised.");
    }
    if (json.purchase?.refunded) {
      throw new Error("This license was refunded and is no longer valid.");
    }

    return { valid: true as const };
  });
