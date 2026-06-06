"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UsersIcon,
  PlusIcon,
  Trash2Icon,
  KeyRoundIcon,
  PencilIcon,
  LoaderIcon,
  CheckIcon,
  XIcon,
  ShieldIcon,
  ShieldOffIcon,
  UserIcon,
  MailIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch, apiUrl, authHeaders } from "@/lib/api";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  recoveryEmail?: string | null;
  role: "admin" | "user";
  disabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
}

type View = "list" | "create" | "edit" | "reset-password";

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function AdminUsersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, user: me } = useAuthStore();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<UserRecord | null>(null);

  // Create form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cRecovery, setCRecovery] = useState("");
  const [cRole, setCRole] = useState<"admin" | "user">("user");
  const [cLoading, setCLoading] = useState(false);
  const [cError, setCError] = useState("");

  // Edit form
  const [eName, setEName] = useState("");
  const [eRecovery, setERecovery] = useState("");
  const [eRole, setERole] = useState<"admin" | "user">("user");
  const [eDisabled, setEDisabled] = useState(false);
  const [eLoading, setELoading] = useState(false);
  const [eError, setEError] = useState("");

  // Reset password
  const [rpLoading, setRpLoading] = useState(false);
  const [rpError, setRpError] = useState("");
  const [rpSent, setRpSent] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<UserRecord[]>("/api/users", { token });
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) { loadUsers(); setView("list"); }
  }, [open, loadUsers]);

  const handleClose = () => { onClose(); setView("list"); setSelected(null); };

  const openEdit = (u: UserRecord) => {
    setSelected(u);
    setEName(u.name);
    setERecovery(u.recoveryEmail ?? "");
    setERole(u.role);
    setEDisabled(u.disabled);
    setEError("");
    setView("edit");
  };

  const openResetPw = (u: UserRecord) => {
    setSelected(u);
    setRpError("");
    setRpSent(false);
    setView("reset-password");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCError("");
    setCLoading(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        token,
        body: JSON.stringify({ name: cName, email: cEmail, recoveryEmail: cRecovery, role: cRole }),
      });
      setCName(""); setCEmail(""); setCRecovery(""); setCRole("user");
      await loadUsers();
      setView("list");
    } catch (err) {
      setCError(err instanceof Error ? err.message : "Failed to invite user");
    } finally {
      setCLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setEError("");
    setELoading(true);
    try {
      await apiFetch(`/api/users/${selected.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ name: eName, recoveryEmail: eRecovery, role: eRole, disabled: eDisabled }),
      });
      await loadUsers();
      setView("list");
    } catch (err) {
      setEError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setELoading(false);
    }
  };

  const handleSendReset = async () => {
    if (!selected) return;
    setRpError("");
    setRpLoading(true);
    try {
      await apiFetch(`/api/users/${selected.id}/send-reset`, {
        method: "POST",
        token,
      });
      setRpSent(true);
    } catch (err) {
      setRpError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setRpLoading(false);
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (!confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
    try {
      const res = await fetch(apiUrl(`/api/users/${u.id}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok && res.status !== 204) {
        const j = await res.json();
        alert(j.error ?? "Failed to delete");
        return;
      }
      await loadUsers();
    } catch {
      alert("Failed to delete user");
    }
  };

  const handleToggleDisable = async (u: UserRecord) => {
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: "PATCH",
        token,
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {view !== "list" && (
              <button
                onClick={() => setView("list")}
                className="text-muted-foreground hover:text-foreground mr-1"
              >
                ←
              </button>
            )}
            <UsersIcon className="size-4" />
            {view === "list" && "Users"}
            {view === "create" && "Invite user"}
            {view === "edit" && `Edit · ${selected?.name}`}
            {view === "reset-password" && `Reset password · ${selected?.name}`}
          </DialogTitle>
        </DialogHeader>

        {/* ── List ── */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pt-1">
            <div className="flex justify-end mb-2">
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => { setCError(""); setView("create"); }}>
                <PlusIcon className="size-3" /> Invite user
              </Button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-8">
                <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && <p className="text-xs text-destructive px-1">{error}</p>}

            {!loading && users.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarFallback className="text-xs bg-muted">{getInitials(u.name)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{u.name}</span>
                    {u.id === me?.id && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                    {u.disabled && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 text-destructive border-destructive/30">
                        disabled
                      </Badge>
                    )}
                    {u.mustChangePassword && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 text-amber-600 border-amber-400/30">
                        invite pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.recoveryEmail && (
                    <p className="text-[11px] text-muted-foreground/60 truncate">↩ {u.recoveryEmail}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {u.twoFactorEnabled && (
                    <ShieldIcon className="size-3.5 text-green-600" aria-label="2FA enabled" />
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] h-5 px-1.5",
                      u.role === "admin" ? "border-primary/40 text-primary" : "text-muted-foreground"
                    )}
                  >
                    {u.role}
                  </Badge>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="shrink-0 text-muted-foreground">
                      <PencilIcon className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => openEdit(u)}>
                      <PencilIcon className="size-4 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openResetPw(u)}
                      disabled={!u.recoveryEmail}
                    >
                      <KeyRoundIcon className="size-4 mr-2" /> Send reset link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleToggleDisable(u)}>
                      {u.disabled
                        ? <><ShieldIcon className="size-4 mr-2" /> Enable account</>
                        : <><ShieldOffIcon className="size-4 mr-2" /> Disable account</>
                      }
                    </DropdownMenuItem>
                    {u.id !== me?.id && (
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2Icon className="size-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}

        {/* ── Create / Invite ── */}
        {view === "create" && (
          <form onSubmit={handleCreate} className="space-y-3 pt-1">
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground">
              A one-time password will be emailed to the recovery address. The user must set a new password on first login.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Full name" required autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Reclear email</label>
                <Input type="email" value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="user@reclear.app" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Recovery email <span className="text-destructive">*</span></label>
              <Input
                type="email"
                value={cRecovery}
                onChange={(e) => setCRecovery(e.target.value)}
                placeholder="personal@example.com"
                required
              />
              <p className="text-[11px] text-muted-foreground">Invite with credentials is sent to this address.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Role</label>
              <div className="flex gap-2">
                {(["user", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setCRole(r)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      cRole === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {r === "admin" ? <ShieldIcon className="size-3" /> : <UserIcon className="size-3" />}
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {cError && <p className="text-xs text-destructive">{cError}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1 gap-1.5" disabled={cLoading}>
                {cLoading ? <LoaderIcon className="size-4 animate-spin" /> : <MailIcon className="size-4" />}
                Send invite
              </Button>
              <Button type="button" variant="outline" onClick={() => setView("list")}>
                <XIcon className="size-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Edit ── */}
        {view === "edit" && selected && (
          <form onSubmit={handleEdit} className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Full name" required autoFocus />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Recovery email</label>
                <Input type="email" value={eRecovery} onChange={(e) => setERecovery(e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Role</label>
              <div className="flex gap-2">
                {(["user", "admin"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setERole(r)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                      eRole === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {r === "admin" ? <ShieldIcon className="size-3" /> : <UserIcon className="size-3" />}
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={eDisabled}
                onChange={(e) => setEDisabled(e.target.checked)}
                className="rounded"
              />
              <span className="text-muted-foreground">Disable account</span>
            </label>

            {eError && <p className="text-xs text-destructive">{eError}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1 gap-1.5" disabled={eLoading}>
                {eLoading ? <LoaderIcon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
                Save changes
              </Button>
              <Button type="button" variant="outline" onClick={() => setView("list")}>
                <XIcon className="size-4" />
              </Button>
            </div>
          </form>
        )}

        {/* ── Reset Password ── */}
        {view === "reset-password" && selected && (
          <div className="space-y-4 pt-1">
            {!rpSent ? (
              <>
                <div className="space-y-1">
                  <p className="text-sm text-foreground font-medium">Send a password reset link</p>
                  <p className="text-xs text-muted-foreground">
                    A reset link will be emailed to{" "}
                    <strong className="text-foreground">{selected.recoveryEmail}</strong>.
                    The link expires in 24 hours.
                  </p>
                </div>

                {rpError && <p className="text-xs text-destructive">{rpError}</p>}

                <div className="flex gap-2">
                  <Button className="flex-1 gap-1.5" onClick={handleSendReset} disabled={rpLoading}>
                    {rpLoading ? <LoaderIcon className="size-4 animate-spin" /> : <MailIcon className="size-4" />}
                    Send reset link
                  </Button>
                  <Button variant="outline" onClick={() => setView("list")}>
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="size-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckIcon className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Reset link sent</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Check <strong>{selected.recoveryEmail}</strong> for the password reset email.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setView("list")}>
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
