"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { VerificationKind } from "@/lib/services/launchpad.api";

export function DemoSkip({
  kind,
  busy,
  onSkip,
}: {
  kind: VerificationKind;
  busy: boolean;
  onSkip: (kind: VerificationKind, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const placeholder = kind === "kyb" ? "Demo Business S.A." : "Demo Judge";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-center text-[12px] text-white/35 hover:text-white/70"
      >
        Judging the demo? Skip verification
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-white/10 p-4">
      <p className="text-[12px] text-white/50">
        Records an approved {kind === "kyb" ? "business" : "identity"}{" "}
        verification under this name. Testnet only.
      </p>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          aria-label="Name to record"
          autoFocus
        />
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => onSkip(kind, name.trim() || placeholder)}
          className="shrink-0"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
