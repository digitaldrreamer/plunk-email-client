"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  SettingsIcon, LoaderIcon, CheckIcon, ShieldIcon, ShieldOffIcon,
  CopyIcon, DownloadIcon, QrCodeIcon, PenLineIcon, UserIcon,
  LockIcon, ShieldCheckIcon, SunMoonIcon, SunIcon, MoonIcon, MonitorIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OtpInput } from "@/components/otp-input";
import { EmailEditor, type EmailEditorRef } from "@/components/email-editor";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TwoFAStep = "idle" | "setup" | "backup-codes" | "done" | "disable-confirm";
type Tab = "signature" | "profile" | "password" | "security" | "appearance";

const NAV_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "signature",  label: "Signature",  icon: PenLineIcon },
  { id: "profile",    label: "Profile",    icon: UserIcon },
  { id: "password",   label: "Password",   icon: LockIcon },
  { id: "security",   label: "Security",   icon: ShieldCheckIcon },
  { id: "appearance", label: "Appearance", icon: SunMoonIcon },
];

export function SettingsModal({
  open,
  onClose,
  defaultTab = "signature",
}: {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}) {
  const { signature, setSignature } = useEmailStore();
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const editorRef = useRef<EmailEditorRef>(null);

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>((defaultTab as Tab) || "signature");

  useEffect(() => setMounted(true), []);

  // ── Signature ────────────────────────────────────────────────────────────────

  const handleSaveSignature = async () => {
    const html = editorRef.current?.getHtml() ?? "";
    setSignature(html);
    try {
      await apiFetch("/api/auth/me", { method: "PATCH", body: JSON.stringify({ signature: html }) });
    } catch { /* non-fatal */ }
    toast.success("Signature saved");
  };

  // ── Profile ──────────────────────────────────────────────────────────────────

  const [pName, setPName] = useState(user?.name ?? "");
  const [pRecovery, setPRecovery] = useState(user?.recoveryEmail ?? "");
  const [pLoading, setPLoading] = useState(false);
  const [pError, setPError] = useState("");
  const [pSuccess, setPSuccess] = useState(false);

  const handleSaveProfile = async () => {
    setPError(""); setPSuccess(false); setPLoading(true);
    try {
      await apiFetch("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name: pName, recoveryEmail: pRecovery }),
      });
      updateUser({ name: pName, recoveryEmail: pRecovery || null });
      setPSuccess(true);
    } catch (err) {
      setPError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setPLoading(false);
    }
  };

  // ── Password ─────────────────────────────────────────────────────────────────

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPwError(""); setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters"); return; }
    setPwLoading(true);
    try {
      await apiFetch("/api/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setPwSuccess(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  // ── 2FA ──────────────────────────────────────────────────────────────────────

  const [tfaStep, setTfaStep] = useState<TwoFAStep>("idle");
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaSecret, setTfaSecret] = useState("");
  const [tfaQrCode, setTfaQrCode] = useState("");
  const [tfaOtp, setTfaOtp] = useState("");
  const [tfaBackupCodes, setTfaBackupCodes] = useState<string[]>([]);
  const [tfaDisablePw, setTfaDisablePw] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);
  const [tfaError, setTfaError] = useState("");
  const [secretCopied, setSecretCopied] = useState(false);
  const [tfaInitialized, setTfaInitialized] = useState(false);

  const initTfa = async () => {
    if (tfaInitialized) return;
    try {
      const me = await apiFetch<{ twoFactorEnabled: boolean }>("/api/auth/me");
      setTfaEnabled(!!me.twoFactorEnabled);
    } catch { /* ignore */ }
    setTfaInitialized(true);
  };

  const handleSetup2FA = async () => {
    setTfaError(""); setTfaLoading(true);
    try {
      const data = await apiFetch<{ secret: string; qrCode: string }>("/api/auth/2fa/setup", { method: "POST" });
      setTfaSecret(data.secret);
      setTfaQrCode(data.qrCode);
      setTfaOtp("");
      setTfaStep("setup");
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Failed to start 2FA setup");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setTfaError(""); setTfaLoading(true);
    try {
      const data = await apiFetch<{ backupCodes: string[] }>("/api/auth/2fa/enable", {
        method: "POST",
        body: JSON.stringify({ code: tfaOtp }),
      });
      setTfaBackupCodes(data.backupCodes);
      setTfaEnabled(true);
      setTfaStep("backup-codes");
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Incorrect code. Check your authenticator.");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    setTfaError(""); setTfaLoading(true);
    try {
      await apiFetch("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password: tfaDisablePw }),
      });
      setTfaEnabled(false);
      setTfaDisablePw("");
      setTfaStep("idle");
    } catch (err) {
      setTfaError(err instanceof Error ? err.message : "Incorrect password");
    } finally {
      setTfaLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const text = [
      "Reclear — Two-factor authentication backup codes",
      "Keep these codes somewhere safe. Each code can only be used once.",
      "",
      ...tfaBackupCodes,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reclear-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySecret = async () => {
    await navigator.clipboard.writeText(tfaSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setPError(""); setPSuccess(false); setPwError(""); setPwSuccess(false);
      setTfaError(""); setTfaStep("idle"); setTfaInitialized(false);
      onClose();
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "security") initTfa();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          // Desktop: wide centered modal
          "sm:max-w-2xl sm:max-h-[85vh]",
          // Mobile: full-width bottom sheet
          "max-sm:top-auto max-sm:left-0 max-sm:bottom-0",
          "max-sm:translate-x-0 max-sm:translate-y-0",
          "max-sm:max-w-full max-sm:w-full",
          "max-sm:rounded-t-2xl max-sm:rounded-b-none",
          "max-sm:max-h-[90vh]",
        )}
      >
        {/* ── Header ── */}
        <DialogHeader className="flex flex-row items-center gap-2 border-b border-border px-5 py-3 shrink-0">
          <SettingsIcon className="size-4 text-muted-foreground shrink-0" />
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
        </DialogHeader>

        {/* ── Body: sidebar nav + content ── */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">

          {/* Nav */}
          <nav className={cn(
            "shrink-0 flex",
            // Mobile: horizontal scrollable top strip
            "flex-row overflow-x-auto border-b border-border bg-muted/30 px-2",
            // Desktop: vertical sidebar
            "sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto sm:border-b-0 sm:border-r sm:border-border sm:bg-muted/20 sm:w-44 sm:p-2 sm:gap-0.5",
          )}>
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors whitespace-nowrap shrink-0",
                  // Mobile: compact pill
                  "sm:w-full",
                  activeTab === id
                    ? "bg-background text-foreground font-medium shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span className="text-xs sm:text-[13px]">{label}</span>
              </button>
            ))}
          </nav>

          {/* Content panel */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Signature ── */}
            {activeTab === "signature" && (
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Email signature</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically appended to new messages and replies.
                  </p>
                </div>
                <EmailEditor
                  key={open ? "open" : "closed"}
                  ref={editorRef}
                  placeholder="Your signature…"
                  initialHtml={signature}
                  minHeight="140px"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                  <Button size="sm" onClick={handleSaveSignature}>Save signature</Button>
                </div>
              </div>
            )}

            {/* ── Profile ── */}
            {activeTab === "profile" && (
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Profile</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Update your display name and recovery email.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Name</label>
                    <Input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Recovery email</label>
                    <p className="text-[11px] text-muted-foreground">Used to recover your account if you lose access.</p>
                    <Input
                      type="email"
                      value={pRecovery}
                      onChange={(e) => setPRecovery(e.target.value)}
                      placeholder="recovery@example.com (optional)"
                    />
                  </div>
                </div>
                {pError && <p className="text-xs text-destructive">{pError}</p>}
                {pSuccess && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckIcon className="size-3" /> Saved
                  </p>
                )}
                <div className="flex justify-end pt-1">
                  <Button size="sm" onClick={handleSaveProfile} disabled={pLoading} className="gap-1.5">
                    {pLoading && <LoaderIcon className="size-3 animate-spin" />}
                    Save profile
                  </Button>
                </div>
              </div>
            )}

            {/* ── Password ── */}
            {activeTab === "password" && (
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Change password</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose a strong password of at least 8 characters.</p>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Current password</label>
                    <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="••••••••" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">New password</label>
                    <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Confirm new password</label>
                    <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                {pwSuccess && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckIcon className="size-3" /> Password changed
                  </p>
                )}
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    onClick={handleChangePassword}
                    disabled={pwLoading || !currentPw || !newPw || !confirmPw}
                    className="gap-1.5"
                  >
                    {pwLoading && <LoaderIcon className="size-3 animate-spin" />}
                    Change password
                  </Button>
                </div>
              </div>
            )}

            {/* ── Appearance ── */}
            {activeTab === "appearance" && (
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Appearance</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose how Reclear looks to you.</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: "light", label: "Light", Icon: SunIcon },
                    { value: "dark",  label: "Dark",  Icon: MoonIcon },
                    { value: "system", label: "System", Icon: MonitorIcon },
                  ] as const).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors",
                        mounted && theme === value
                          ? "border-primary bg-primary/5 text-foreground font-medium"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <Icon className="size-5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Security / 2FA ── */}
            {activeTab === "security" && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-medium">Security</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage two-factor authentication for your account.</p>
                </div>

                {/* idle */}
                {tfaStep === "idle" && (
                  <div className="rounded-xl border border-border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Two-factor authentication</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Add an extra layer of security with a TOTP authenticator app.
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          tfaEnabled
                            ? "border-green-400/40 text-green-600"
                            : "text-muted-foreground",
                        )}
                      >
                        {tfaEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>

                    {tfaError && <p className="text-xs text-destructive">{tfaError}</p>}

                    {tfaEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                        onClick={() => { setTfaError(""); setTfaDisablePw(""); setTfaStep("disable-confirm"); }}
                      >
                        <ShieldOffIcon className="size-4" />
                        Disable 2FA
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1.5" onClick={handleSetup2FA} disabled={tfaLoading}>
                        {tfaLoading ? <LoaderIcon className="size-4 animate-spin" /> : <ShieldIcon className="size-4" />}
                        Set up 2FA
                      </Button>
                    )}
                  </div>
                )}

                {/* setup: scan QR + verify */}
                {tfaStep === "setup" && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-sm font-medium">Scan with your authenticator app</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Use Google Authenticator, Authy, or any TOTP app.
                      </p>
                    </div>

                    <div className="flex justify-center">
                      {tfaQrCode
                        ? <img src={tfaQrCode} alt="QR code" className="size-44 rounded-xl border border-border" />
                        : <div className="size-44 rounded-xl border border-border bg-muted flex items-center justify-center">
                            <QrCodeIcon className="size-10 text-muted-foreground" />
                          </div>
                      }
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">Or enter this code manually:</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono tracking-widest break-all">
                          {tfaSecret}
                        </code>
                        <Button variant="ghost" size="icon-xs" onClick={copySecret} className="shrink-0">
                          {secretCopied ? <CheckIcon className="size-3.5 text-green-600" /> : <CopyIcon className="size-3.5" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium">Enter the 6-digit code to confirm</p>
                      <OtpInput value={tfaOtp} onChange={setTfaOtp} disabled={tfaLoading} />
                    </div>

                    {tfaError && <p className="text-xs text-destructive">{tfaError}</p>}

                    <div className="flex gap-2">
                      <Button className="flex-1" onClick={handleEnable2FA} disabled={tfaLoading || tfaOtp.length < 6}>
                        {tfaLoading && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                        Verify & enable
                      </Button>
                      <Button variant="outline" onClick={() => { setTfaStep("idle"); setTfaError(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* backup codes */}
                {tfaStep === "backup-codes" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-green-600 flex items-center gap-1.5">
                        <CheckIcon className="size-4" /> 2FA enabled
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Save these backup codes somewhere safe. Each code can only be used once.
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/40 p-4 grid grid-cols-2 gap-2">
                      {tfaBackupCodes.map((code) => (
                        <code key={code} className="text-xs font-mono text-center py-0.5">{code}</code>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadBackupCodes}>
                        <DownloadIcon className="size-4" />
                        Download
                      </Button>
                      <Button size="sm" className="flex-1" onClick={() => setTfaStep("done")}>
                        I&apos;ve saved these codes
                      </Button>
                    </div>
                  </div>
                )}

                {/* done */}
                {tfaStep === "done" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-green-400/30 bg-green-50 dark:bg-green-900/20 p-4">
                      <ShieldIcon className="size-5 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-700 dark:text-green-400">2FA is active</p>
                        <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-0.5">
                          You&apos;ll need your authenticator app to sign in.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => { setTfaError(""); setTfaDisablePw(""); setTfaStep("disable-confirm"); }}
                    >
                      <ShieldOffIcon className="size-4" />
                      Disable 2FA
                    </Button>
                  </div>
                )}

                {/* disable confirm */}
                {tfaStep === "disable-confirm" && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium">Disable two-factor authentication</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Confirm your password to remove 2FA from your account.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium">Password</label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={tfaDisablePw}
                        onChange={(e) => setTfaDisablePw(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {tfaError && <p className="text-xs text-destructive">{tfaError}</p>}

                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleDisable2FA}
                        disabled={tfaLoading || !tfaDisablePw}
                      >
                        {tfaLoading && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                        Disable 2FA
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setTfaStep(tfaEnabled ? (tfaBackupCodes.length ? "done" : "idle") : "idle"); setTfaError(""); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
