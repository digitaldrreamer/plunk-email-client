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

export function InstallButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
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
      // No native prompt — show manual instructions
      setGuideOpen(true);
    }
  };

  const btn = iconOnly ? (
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
  ) : (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={handleClick}>
      <DownloadIcon className="size-3.5" />
      Install app
    </Button>
  );

  return (
    <>
      {btn}

      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SmartphoneIcon className="size-4" />
              Install reclear
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
                  <li>Click <strong className="text-foreground">Install reclear…</strong> or <strong className="text-foreground">Add to Home screen</strong>.</li>
                  <li>Confirm in the dialog.</li>
                </ol>
                <p className="text-xs">
                  If you don't see that option, the app may need to be served over HTTPS first.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
