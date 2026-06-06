"use client";

import React, { useRef, useState } from "react";
import {
  SettingsIcon, LoaderIcon, CheckIcon, ShieldIcon, ShieldOffIcon,
  CopyIcon, DownloadIcon, QrCodeIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OtpInput } from "@/components/otp-input";
import { EmailEditor, type EmailEditorRef } from "@/components/email-editor";
import { useEmailStore } from "@/store/email-store";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch } from "@/lib/api";

type TwoFAStep = "idle" | "setup" | "backup-codes" | "done" | "disable-confirm";

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
  const editorRef = useRef<EmailEditorRef>(null);

  // Signature
  const handleSaveSignature = () => {
    const html = editorRef.current?.getHtml() ?? "";
    setSignature(html);
    onClose();
  };

  // Profile
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

  // Password
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

  // 2FA
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

  // Sync 2FA enabled state when modal opens
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
      const data = await apiFetch<{ secret: string; qrCode: string }>("/api/auth/2fa/setup", {
        method: "POST",
      });
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="size-4" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} key={defaultTab} className="pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="signature" className="flex-1">Signature</TabsTrigger>
            <TabsTrigger value="profile" className="flex-1">Profile</TabsTrigger>
            <TabsTrigger value="password" className="flex-1">Password</TabsTrigger>
            <TabsTrigger value="security" className="flex-1" onClick={initTfa}>Security</TabsTrigger>
          </TabsList>

          {/* ── Signature ── */}
          <TabsContent value="signature" className="space-y-4 pt-3">
            <p className="text-xs text-muted-foreground">
              Automatically appended to new messages and replies.
            </p>
            <EmailEditor
              key={open ? "open" : "closed"}
              ref={editorRef}
              placeholder="Your signature…"
              initialHtml={signature}
              minHeight="120px"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSaveSignature}>Save</Button>
            </div>
          </TabsContent>

          {/* ── Profile ── */}
          <TabsContent value="profile" className="space-y-3 pt-3">
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
            {pError && <p className="text-xs text-destructive">{pError}</p>}
            {pSuccess && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckIcon className="size-3" /> Saved
              </p>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveProfile} disabled={pLoading} className="gap-1.5">
                {pLoading ? <LoaderIcon className="size-3 animate-spin" /> : null}
                Save profile
              </Button>
            </div>
          </TabsContent>

          {/* ── Password ── */}
          <TabsContent value="password" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Current password</label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">New password</label>
              <Input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Confirm new password</label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {pwError && <p className="text-xs text-destructive">{pwError}</p>}
            {pwSuccess && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckIcon className="size-3" /> Password changed
              </p>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={handleChangePassword} disabled={pwLoading || !currentPw || !newPw || !confirmPw} className="gap-1.5">
                {pwLoading ? <LoaderIcon className="size-3 animate-spin" /> : null}
                Change password
              </Button>
            </div>
          </TabsContent>

          {/* ── Security / 2FA ── */}
          <TabsContent value="security" className="pt-3">

            {/* idle */}
            {tfaStep === "idle" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Two-factor authentication</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Add an extra layer of security with a TOTP authenticator app.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={tfaEnabled
                      ? "border-green-400/40 text-green-600"
                      : "text-muted-foreground"
                    }
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
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Scan with your authenticator app</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Use Google Authenticator, Authy, or any TOTP app.
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  {tfaQrCode
                    ? <img src={tfaQrCode} alt="QR code" className="size-40 rounded-lg border border-border" />
                    : <div className="size-40 rounded-lg border border-border bg-muted flex items-center justify-center">
                        <QrCodeIcon className="size-8 text-muted-foreground" />
                      </div>
                  }
                </div>

                {/* Manual secret */}
                <div className="space-y-1">
                  <p className="text-[11px] text-muted-foreground">Or enter this code manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-1.5 text-xs font-mono tracking-widest break-all">
                      {tfaSecret}
                    </code>
                    <Button variant="ghost" size="icon-xs" onClick={copySecret} className="shrink-0">
                      {secretCopied ? <CheckIcon className="size-3.5 text-green-600" /> : <CopyIcon className="size-3.5" />}
                    </Button>
                  </div>
                </div>

                {/* OTP verify */}
                <div className="space-y-2">
                  <p className="text-xs font-medium">Enter the 6-digit code to confirm</p>
                  <OtpInput value={tfaOtp} onChange={setTfaOtp} disabled={tfaLoading} />
                </div>

                {tfaError && <p className="text-xs text-destructive">{tfaError}</p>}

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleEnable2FA}
                    disabled={tfaLoading || tfaOtp.length < 6}
                  >
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
                    Save these backup codes somewhere safe. Each code can only be used once if you lose access to your authenticator.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-3 grid grid-cols-2 gap-1.5">
                  {tfaBackupCodes.map((code) => (
                    <code key={code} className="text-xs font-mono text-center py-0.5">{code}</code>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadBackupCodes}>
                    <DownloadIcon className="size-4" />
                    Download codes
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setTfaStep("done")}>
                    I&apos;ve saved these codes
                  </Button>
                </div>
              </div>
            )}

            {/* done */}
            {tfaStep === "done" && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-green-400/30 bg-green-50 dark:bg-green-900/20 p-4">
                  <ShieldIcon className="size-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Two-factor authentication is active</p>
                    <p className="text-xs text-green-600/80 dark:text-green-500/80 mt-0.5">
                      Your account is protected. You&apos;ll need your authenticator app to sign in.
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
