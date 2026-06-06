"use client";

import { useState } from "react";
import Image from "next/image";
import { LoaderIcon, EyeIcon, EyeOffIcon, ShieldIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtpInput } from "@/components/otp-input";
import { useAuthStore, type AuthUser } from "@/store/auth-store";
import { apiUrl } from "@/lib/api";

type Step = "credentials" | "two-factor" | "force-change";

export function LoginForm() {
  const setUser = useAuthStore((s) => s.setUser);
  const markChecked = useAuthStore((s) => s._markSessionChecked);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [tempToken, setTempToken] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [backupCode, setBackupCode] = useState("");

  const [forceUser, setForceUser] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState<Step>("credentials");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");

      if (json.requiresTwoFactor) {
        setTempToken(json.tempToken);
        setOtpCode("");
        setUseBackup(false);
        setStep("two-factor");
        return;
      }

      if (json.mustChangePassword) {
        setForceUser(json.data.user as AuthUser);
        setNewPassword("");
        setConfirmPassword("");
        setStep("force-change");
        return;
      }

      setUser(json.data.user as AuthUser);
      markChecked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const code = useBackup ? backupCode.trim() : otpCode;
    try {
      const res = await fetch(apiUrl("/api/auth/2fa/verify"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");

      if (json.mustChangePassword) {
        setForceUser(json.data.user as AuthUser);
        setNewPassword("");
        setConfirmPassword("");
        setStep("force-change");
        return;
      }

      setUser(json.data.user as AuthUser);
      markChecked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Cookie from login is sent automatically via credentials: "include"
      const res = await fetch(apiUrl("/api/auth/force-change-password"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Failed");
      setUser(json.data.user as AuthUser);
      markChecked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo_transparent.png" alt="reclear" width={120} height={40} className="h-10 w-auto" />
          <div>
            <p className="text-sm text-muted-foreground">
              {step === "credentials" && "Sign in to your account"}
              {step === "two-factor" && "Two-factor authentication"}
              {step === "force-change" && "Set your password"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">

          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Password</label>
                <div className="relative">
                  <Input
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full mt-1" disabled={loading}>
                {loading && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                Sign in
              </Button>
            </form>
          )}

          {step === "two-factor" && (
            <form onSubmit={handleTwoFactor} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldIcon className="size-4 shrink-0" />
                <span>Enter the code from your authenticator app.</span>
              </div>

              {!useBackup ? (
                <div className="space-y-2">
                  <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Backup code</label>
                  <Input
                    placeholder="XXXX-XXXX"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    autoFocus
                    disabled={loading}
                  />
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full"
                disabled={loading || (!useBackup && otpCode.length < 6) || (useBackup && !backupCode.trim())}
              >
                {loading && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                Verify
              </Button>

              <button
                type="button"
                onClick={() => { setUseBackup((v) => !v); setError(""); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {useBackup ? "Use authenticator app instead" : "Use a backup code instead"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(""); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {step === "force-change" && (
            <form onSubmit={handleForceChange} className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Welcome, <strong className="text-foreground">{forceUser?.name}</strong>. Please set a new password before continuing.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">New password</label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Confirm password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button
                type="submit"
                className="w-full mt-1"
                disabled={loading || !newPassword || !confirmPassword}
              >
                {loading && <LoaderIcon className="size-4 mr-2 animate-spin" />}
                Set password & continue
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
