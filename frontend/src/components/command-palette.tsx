"use client";

import { useEffect, useState } from "react";
import {
  InboxIcon, SendIcon, FileIcon, ArchiveIcon, Trash2Icon, StarIcon,
  PenSquareIcon, UsersIcon, SettingsIcon, ShieldIcon, BookUserIcon,
  MoonIcon, SunIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useEmailStore } from "@/store/email-store";
import type { Folder } from "@/data/emails";
import { useAuthStore } from "@/store/auth-store";
import { useTheme } from "next-themes";

interface Props {
  onOpenSettings: (tab?: string) => void;
  onOpenContacts: () => void;
}

export function CommandPalette({ onOpenSettings, onOpenContacts }: Props) {
  const [open, setOpen] = useState(false);
  const { setFolder, setComposing, setFilter } = useEmailStore();
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const run = (fn: () => void) => { setOpen(false); fn(); };

  const goToFolder = (folder: Folder) => run(() => setFolder(folder));

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => goToFolder("inbox")}>
            <InboxIcon className="size-4 mr-2" /> Inbox
          </CommandItem>
          <CommandItem onSelect={() => goToFolder("sent")}>
            <SendIcon className="size-4 mr-2" /> Sent
          </CommandItem>
          <CommandItem onSelect={() => { goToFolder("inbox"); run(() => setFilter("starred")); }}>
            <StarIcon className="size-4 mr-2" /> Starred
          </CommandItem>
          <CommandItem onSelect={() => goToFolder("drafts")}>
            <FileIcon className="size-4 mr-2" /> Drafts
          </CommandItem>
          <CommandItem onSelect={() => goToFolder("archive")}>
            <ArchiveIcon className="size-4 mr-2" /> Archive
          </CommandItem>
          <CommandItem onSelect={() => goToFolder("trash")}>
            <Trash2Icon className="size-4 mr-2" /> Trash
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => setComposing(true))}>
            <PenSquareIcon className="size-4 mr-2" /> Compose new email
          </CommandItem>
          <CommandItem onSelect={() => run(onOpenContacts)}>
            <BookUserIcon className="size-4 mr-2" /> Contacts
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => run(() => onOpenSettings("profile"))}>
            <UsersIcon className="size-4 mr-2" /> Profile settings
          </CommandItem>
          <CommandItem onSelect={() => run(() => onOpenSettings("security"))}>
            <ShieldIcon className="size-4 mr-2" /> Security & 2FA
          </CommandItem>
          <CommandItem onSelect={() => run(() => onOpenSettings("signature"))}>
            <SettingsIcon className="size-4 mr-2" /> Email signature
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme(theme === "dark" ? "light" : "dark"))}>
            {theme === "dark"
              ? <><SunIcon className="size-4 mr-2" /> Switch to light mode</>
              : <><MoonIcon className="size-4 mr-2" /> Switch to dark mode</>
            }
          </CommandItem>
        </CommandGroup>

        {user?.role === "admin" && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              <CommandItem onSelect={() => run(() => onOpenSettings())}>
                <UsersIcon className="size-4 mr-2" /> Manage users
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
