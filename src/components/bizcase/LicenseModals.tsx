import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Modal, Btn, LoadingLine } from "./ui";
import { verifyLicenseKey } from "@/lib/bizcase/license.functions";
import { GUMROAD_URL, LICENSE_PRICE, saveLicenseKey } from "@/lib/bizcase/license";

/** Inline upgrade prompt shown wherever a paid feature is blocked. */
export function UpgradeNotice({ reason }: { reason: string }) {
  return (
    <div className="border border-warning bg-warning/10 p-4">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-warning">
        Free version limit
      </p>
      <p className="mt-2 text-sm text-foreground">{reason}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Unlock the full version for a one-time {LICENSE_PRICE} payment, then enter your license key
        from Settings.
      </p>
      <a
        href={GUMROAD_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-block border border-primary px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-primary hover:bg-primary hover:text-primary-foreground"
      >
        Unlock for {LICENSE_PRICE}
      </a>
    </div>
  );
}

/** Standalone upgrade modal (used when a blocked action has no host modal). */
export function UpgradeModal({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <Modal title="Unlock BizCase Builder" onClose={onClose}>
      <UpgradeNotice reason={reason} />
      <div className="mt-5">
        <Btn onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}

/** License key entry modal. */
export function LicenseModal({ onClose }: { onClose: () => void }) {
  const verify = useServerFn(verifyLicenseKey);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError("Paste your license key first. You will find it in your Gumroad purchase receipt.");
      return;
    }
    if (trimmed.length < 8) {
      setError(
        "That key looks too short. Copy the full key from your receipt, including the dashes.",
      );
      return;
    }
    if (/\s/.test(trimmed)) {
      setError("The key contains spaces or line breaks. Paste it as a single unbroken line.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verify({ data: { key: trimmed } });
      saveLicenseKey(trimmed);
      toast.success("License activated — full version unlocked.");
      onClose();
    } catch (e) {
      const message =
        e instanceof Error && e.message
          ? e.message
          : "That license key could not be verified. Check the key and try again.";
      setError(
        /fetch|network|failed to fetch/i.test(message)
          ? "Could not reach the license server. Check your internet connection and try again."
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Enter License Key" onClose={onClose}>
      <p className="mb-4 text-sm text-muted-foreground">
        Paste the license key from your purchase receipt to unlock unlimited cases, Excel import and
        watermark-free exports.
      </p>
      <input
        className="field-inset font-mono"
        placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !busy && unlock()}
      />
      {error && <p className="mt-3 font-mono text-xs text-decline">{error}</p>}
      {busy && (
        <div className="mt-4">
          <LoadingLine label="Verifying license…" />
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Btn variant="primary" disabled={busy} onClick={unlock}>
          Unlock
        </Btn>
        <Btn onClick={onClose}>Cancel</Btn>
        <a
          href={GUMROAD_URL}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground underline hover:text-primary"
        >
          Buy a key · {LICENSE_PRICE}
        </a>
      </div>
    </Modal>
  );
}
