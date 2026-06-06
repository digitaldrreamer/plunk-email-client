"use client";

import { useState, useEffect } from "react";
import { DownloadIcon, SmartphoneIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallVariant = "icon" | "button" | "card" | "row";

export function InstallButton({ variant = "icon" }: { variant?: InstallVariant; /** @deprecated */ iconOnly?: boolean }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
      return;
    }

    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  if (installed) return null;

  const handleClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") {
        setPrompt(null);
        setInstalled(true);
      }
    } else {
      setGuideOpen(true);
    }
  };

  let btn: React.ReactNode;

  if (variant === "icon") {
    btn = (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleClick}
          >
            <DownloadIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Install app</TooltipContent>
      </Tooltip>
    );
  } else if (variant === "button") {
    btn = (
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={handleClick}>
        <DownloadIcon className="size-3.5" />
        Install app
      </Button>
    );
  } else if (variant === "card") {
    btn = (
      <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <SmartphoneIcon className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">Install Reclear</p>
          <p className="text-[11px] text-muted-foreground leading-tight">Add to your device for quick access</p>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={handleClick}>
          Install
        </Button>
      </div>
    );
  } else {
    // row — full-width row for mobile bottom sheet
    btn = (
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent transition-colors"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <SmartphoneIcon className="size-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Install app</p>
          <p className="text-xs text-muted-foreground">Add Reclear to your home screen</p>
        </div>
        <DownloadIcon className="size-4 text-muted-foreground shrink-0" />
      </button>
    );
  }

  return (
    <>
      {btn}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SmartphoneIcon className="size-4" />
              Install Reclear
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground pt-1">
            {isIos ? (
              <>
                <p>On <strong className="text-foreground">iOS Safari</strong>:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Tap the <strong className="text-foreground">Share</strong> button (rectangle with arrow) in the toolbar.</li>
                  <li>Scroll down and tap <strong className="text-foreground">Add to Home Screen</strong>.</li>
                  <li>Tap <strong className="text-foreground">Add</strong>.</li>
                </ol>
              </>
            ) : (
              <>
                <p>On <strong className="text-foreground">Chrome / Edge</strong>:</p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>Click the <strong className="text-foreground">⋮</strong> menu in the top-right.</li>
                  <li>Click <strong className="text-foreground">Install Reclear…</strong> or <strong className="text-foreground">Add to Home screen</strong>.</li>
                  <li>Confirm in the dialog.</li>
                </ol>
                <p className="text-xs">
                  If you don&apos;t see that option, the app may need to be served over HTTPS first.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
