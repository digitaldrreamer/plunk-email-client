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
  MoreHorizontalIcon,
  ShieldCheckIcon,
  ClockIcon,
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/store/auth-store";
import { apiFetch, apiUrl } from "@/lib/api";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuthGate } from "@/components/auth-gate";

interface UserRecord {
  id?: string;
  name: string;
  email: string;
  recoveryEmail?: string | null;
  role: "admin" | "user";
  disabled?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  mustChangePassword?: boolean;
  twoFactorEnabled?: boolean;
}

type View = "list" | "create" | "edit" | "reset-password";

// Deterministic avatar color from name
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
];

function avatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatLastSeen(ts: string | null | undefined) {
  if (!ts) return null;
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TeamContent() {
  const { user: me } = useAuthStore();
  const isAdmin = me?.role === "admin";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
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

  // Delete confirmation
  const [pendingDelete, setPendingDelete] = useState<UserRecord | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch<UserRecord[]>("/api/users");
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openEdit = (u: UserRecord) => {
    setSelected(u);
    setEName(u.name);
    setERecovery(u.recoveryEmail ?? "");
    setERole(u.role);
    setEDisabled(u.disabled ?? false);
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
        body: JSON.stringify({ name: cName, email: cEmail, recoveryEmail: cRecovery, role: cRole }),
      });
      setCName(""); setCEmail(""); setCRecovery(""); setCRole("user");
      toast.success("Invite sent");
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
    if (!selected?.id) return;
    setEError("");
    setELoading(true);
    try {
      await apiFetch(`/api/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: eName, recoveryEmail: eRecovery, role: eRole, disabled: eDisabled }),
      });
      toast.success("User updated");
      await loadUsers();
      setView("list");
    } catch (err) {
      setEError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setELoading(false);
    }
  };

  const handleSendReset = async () => {
    if (!selected?.id) return;
    setRpError("");
    setRpLoading(true);
    try {
      await apiFetch(`/api/users/${selected.id}/send-reset`, { method: "POST" });
      setRpSent(true);
    } catch (err) {
      setRpError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setRpLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id) return;
    const u = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(apiUrl(`/api/users/${u.id}`), { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) {
        const j = await res.json();
        toast.error(j.error ?? "Failed to delete user");
        return;
      }
      await loadUsers();
      toast.success(`${u.name} removed`);
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const handleToggleDisable = async (u: UserRecord) => {
    if (!u.id) return;
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: !u.disabled }),
      });
      await loadUsers();
      toast.success(u.disabled ? `${u.name} re-enabled` : `${u.name} disabled`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  // Derived stats
  const activeCount = users.filter((u) => !u.disabled).length;
  const twoFaCount = users.filter((u) => u.twoFactorEnabled).length;
  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-5 shrink-0 bg-sidebar">
          {view !== "list" && (
            <button
              onClick={() => { setView("list"); setSelected(null); }}
              className="text-muted-foreground hover:text-foreground mr-1 text-lg leading-none"
              aria-label="Back"
            >
              ←
            </button>
          )}
          <UsersIcon className="size-4 text-muted-foreground shrink-0" />
          <h1 className="text-sm font-semibold">
            {view === "list" && "Team"}
            {view === "create" && "Invite member"}
            {view === "edit" && `Edit · ${selected?.name}`}
            {view === "reset-password" && `Reset password · ${selected?.name}`}
          </h1>
          {view === "list" && isAdmin && (
            <Button
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={() => { setCError(""); setView("create"); }}
            >
              <PlusIcon className="size-3" /> Invite
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 max-w-2xl w-full mx-auto space-y-5">

            {/* ── List ── */}
            {view === "list" && (
              <>
                {/* Stats — admin only */}
                {isAdmin && !loading && users.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Members", value: users.length, icon: UsersIcon },
                      { label: "Active", value: activeCount, icon: ShieldCheckIcon },
                      { label: "2FA on", value: twoFaCount, icon: ShieldIcon },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <Icon className="size-3.5 text-muted-foreground/50" />
                        </div>
                        <p className="text-2xl font-semibold tracking-tight">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section label */}
                {!loading && users.length > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {users.length} {users.length === 1 ? "member" : "members"} · {adminCount} {adminCount === 1 ? "admin" : "admins"}
                    </p>
                    {!isAdmin && (
                      <Badge variant="outline" className="text-[10px] h-5">Read-only</Badge>
                    )}
                  </div>
                )}

                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {error && <p className="text-xs text-destructive">{error}</p>}

                {!loading && users.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <UsersIcon className="size-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium">No team members yet</p>
                    {isAdmin && (
                      <p className="text-xs text-muted-foreground">Invite your first member to get started.</p>
                    )}
                  </div>
                )}

                {/* User rows */}
                {!loading && users.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                    {users.map((u) => {
                      const isMe = u.email === me?.email;
                      const lastSeen = formatLastSeen(u.lastLoginAt);
                      return (
                        <div
                          key={u.email}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 bg-card transition-colors",
                            isAdmin && "hover:bg-muted/30",
                            u.disabled && "opacity-60"
                          )}
                        >
                          {/* Avatar */}
                          <div className={cn(
                            "size-9 rounded-full shrink-0 flex items-center justify-center text-xs font-semibold",
                            avatarColor(u.name)
                          )}>
                            {getInitials(u.name)}
                          </div>

                          {/* Name + email */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium text-foreground leading-tight">
                                {u.name}
                              </span>
                              {isMe && (
                                <span className="text-[10px] text-muted-foreground leading-tight">(you)</span>
                              )}
                              {u.mustChangePassword && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-300/50 dark:border-amber-700/50">
                                  Invited
                                </Badge>
                              )}
                              {u.disabled && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-destructive border-destructive/30">
                                  Disabled
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{u.email}</p>
                          </div>

                          {/* Meta */}
                          <div className="hidden sm:flex items-center gap-2 shrink-0">
                            {lastSeen && (
                              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                                <ClockIcon className="size-3" /> {lastSeen}
                              </span>
                            )}
                            {u.twoFactorEnabled && (
                              <ShieldIcon className="size-3.5 text-emerald-500" title="2FA enabled" />
                            )}
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] h-5 px-2",
                                u.role === "admin"
                                  ? "border-primary/40 text-primary bg-primary/5"
                                  : "text-muted-foreground"
                              )}
                            >
                              {u.role === "admin" ? "Admin" : "Member"}
                            </Badge>
                          </div>

                          {/* Actions — admin only */}
                          {isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="shrink-0 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreHorizontalIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => openEdit(u)}>
                                  <PencilIcon className="size-3.5 mr-2 text-muted-foreground" />
                                  Edit member
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openResetPw(u)}
                                  disabled={!u.recoveryEmail}
                                  title={!u.recoveryEmail ? "No recovery email set" : undefined}
                                >
                                  <KeyRoundIcon className="size-3.5 mr-2 text-muted-foreground" />
                                  Send reset link
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleToggleDisable(u)}>
                                  {u.disabled
                                    ? <><ShieldIcon className="size-3.5 mr-2 text-muted-foreground" /> Enable account</>
                                    : <><ShieldOffIcon className="size-3.5 mr-2 text-muted-foreground" /> Disable account</>
                                  }
                                </DropdownMenuItem>
                                {!isMe && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => setPendingDelete(u)}
                                  >
                                    <Trash2Icon className="size-3.5 mr-2" /> Remove member
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Create / Invite ── */}
            {view === "create" && isAdmin && (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
                  An invite with login credentials will be sent to the recovery email. The member must set a new password on first login.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Full name</label>
                    <Input
                      value={cName}
                      onChange={(e) => setCName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Reclear email</label>
                    <Input
                      type="email"
                      value={cEmail}
                      onChange={(e) => setCEmail(e.target.value)}
                      placeholder="jane@team.reclear.io"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">
                    Recovery email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={cRecovery}
                    onChange={(e) => setCRecovery(e.target.value)}
                    placeholder="jane@personal.com"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">The invite is sent here. Not a reclear.io address.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Role</label>
                  <div className="flex gap-2">
                    {(["user", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setCRole(r)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
                          cRole === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {r === "admin"
                          ? <ShieldIcon className="size-3.5" />
                          : <UserIcon className="size-3.5" />
                        }
                        {r === "admin" ? "Admin" : "Member"}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {cRole === "admin"
                      ? "Admins can manage all team members."
                      : "Members can send and receive email."}
                  </p>
                </div>

                {cError && <p className="text-xs text-destructive">{cError}</p>}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setView("list")}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="gap-1.5" disabled={cLoading}>
                    {cLoading
                      ? <LoaderIcon className="size-3.5 animate-spin" />
                      : <MailIcon className="size-3.5" />}
                    Send invite
                  </Button>
                </div>
              </form>
            )}

            {/* ── Edit ── */}
            {view === "edit" && selected && isAdmin && (
              <form onSubmit={handleEdit} className="space-y-4">
                {/* User identity (read-only) */}
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <div className={cn(
                    "size-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold",
                    avatarColor(selected.name)
                  )}>
                    {getInitials(selected.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{selected.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Name</label>
                    <Input
                      value={eName}
                      onChange={(e) => setEName(e.target.value)}
                      placeholder="Full name"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium">Recovery email</label>
                    <Input
                      type="email"
                      value={eRecovery}
                      onChange={(e) => setERecovery(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Role</label>
                  <div className="flex gap-2">
                    {(["user", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setERole(r)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium transition-colors",
                          eRole === r
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {r === "admin"
                          ? <ShieldIcon className="size-3.5" />
                          : <UserIcon className="size-3.5" />
                        }
                        {r === "admin" ? "Admin" : "Member"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-border p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium">Disable account</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">User won&apos;t be able to log in.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={eDisabled}
                    onClick={() => setEDisabled((v) => !v)}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      eDisabled ? "bg-destructive" : "bg-muted-foreground/30"
                    )}
                  >
                    <span className={cn(
                      "absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform",
                      eDisabled && "translate-x-4"
                    )} />
                  </button>
                </div>

                {eError && <p className="text-xs text-destructive">{eError}</p>}

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setView("list")}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="gap-1.5" disabled={eLoading}>
                    {eLoading
                      ? <LoaderIcon className="size-3.5 animate-spin" />
                      : <CheckIcon className="size-3.5" />}
                    Save changes
                  </Button>
                </div>
              </form>
            )}

            {/* ── Reset Password ── */}
            {view === "reset-password" && selected && isAdmin && (
              <div className="space-y-5">
                {!rpSent ? (
                  <>
                    {/* User card */}
                    <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                      <div className={cn(
                        "size-10 rounded-full shrink-0 flex items-center justify-center text-sm font-semibold",
                        avatarColor(selected.name)
                      )}>
                        {getInitials(selected.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{selected.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium">Send a password reset link</p>
                      <p className="text-xs text-muted-foreground">
                        An email will be sent to{" "}
                        <strong className="text-foreground">{selected.recoveryEmail}</strong>
                        {" "}with a link to set a new password. The link expires in 24 hours.
                      </p>
                    </div>

                    {rpError && <p className="text-xs text-destructive">{rpError}</p>}

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setView("list")}>
                        Cancel
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={handleSendReset} disabled={rpLoading}>
                        {rpLoading
                          ? <LoaderIcon className="size-3.5 animate-spin" />
                          : <MailIcon className="size-3.5" />}
                        Send reset link
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckIcon className="size-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Reset link sent</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sent to <strong>{selected.recoveryEmail}</strong>
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setView("list")}>
                      Done
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{pendingDelete?.name}</strong> ({pendingDelete?.email}).
              Their emails and data will be lost. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={confirmDelete}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function TeamPage() {
  return (
    <AuthGate>
      <AppShell>
        <TeamContent />
      </AppShell>
    </AuthGate>
  );
}
