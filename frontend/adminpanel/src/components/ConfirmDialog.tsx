"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireKeyword?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  requireKeyword,
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const [typedKeyword, setTypedKeyword] = useState("");

  if (!isOpen) return null;

  const canConfirm = !requireKeyword || typedKeyword.trim().toLowerCase() === requireKeyword.toLowerCase();

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#121316] border border-[#2b2e36] p-6 shadow-none flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-[#22252c] pb-4">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 flex items-center justify-center font-bold flex-shrink-0 ${isDestructive ? "bg-rose-950 text-rose-400 border border-rose-800" : "bg-amber-950 text-amber-400 border border-amber-800"}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                {title}
              </h3>
              <span className="text-[10px] font-mono text-gray-400 uppercase">
                Confirmation Required
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 bg-[#181a1f] border border-[#272a31]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed font-sans">
          {description}
        </p>

        {requireKeyword && (
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-[11px] font-mono text-gray-400">
              Type <strong className="text-rose-400 uppercase">{requireKeyword}</strong> to confirm:
            </label>
            <input
              type="text"
              value={typedKeyword}
              onChange={(e) => setTypedKeyword(e.target.value)}
              placeholder={requireKeyword}
              className="w-full bg-[#181a1f] border border-[#30333d] px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-rose-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#22252c]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            isLoading={isLoading}
            disabled={!canConfirm}
            className="font-bold"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
