"use client";

import { useRef, useState } from "react";
import { FileText, Link2, Plus, Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type { DocumentLinkValue } from "../../utils/fields";

const MAX_DOCUMENTS = 12;

export function isUploadedDocument(doc: DocumentLinkValue): boolean {
  return doc.url.includes("/storage/v1/object/sign/");
}

export function DocumentsField({
  value,
  getValue,
  onChange,
  onUpload,
  surface,
  inputClass,
}: {
  value: DocumentLinkValue[];
  /** Latest value, for uploads that finish after other edits. */
  getValue: () => DocumentLinkValue[];
  onChange: (next: DocumentLinkValue[]) => void;
  onUpload: (file: File) => Promise<DocumentLinkValue>;
  surface: string;
  inputClass: string;
}) {
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const full = value.length + uploading.length >= MAX_DOCUMENTS;

  const upload = async (files: FileList | File[]) => {
    setError(null);
    for (const file of Array.from(files)) {
      if (getValue().length >= MAX_DOCUMENTS) {
        setError(`Up to ${MAX_DOCUMENTS} documents.`);
        break;
      }
      setUploading((u) => [...u, file.name]);
      try {
        const doc = await onUpload(file);
        onChange([...getValue(), doc]);
      } catch (err) {
        setError(err instanceof Error ? `${file.name}: ${err.message}` : "Upload failed.");
      } finally {
        setUploading((u) => {
          const i = u.indexOf(file.name);
          return i === -1 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
        });
      }
    }
  };

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-3">
      {!full && (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition-colors",
            dragging
              ? "border-white/50 bg-white/[0.04] text-white"
              : "border-white/12 text-white/55 hover:border-white/25 hover:text-white"
          )}
        >
          <Upload className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[15px] font-medium">Drop files or click to upload</span>
          <span className="text-[13px] text-white/40">PDF, Word, Excel, CSV or images, up to 20 MB</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp"
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files);
          e.target.value = "";
        }}
      />

      {value.map((d, i) =>
        isUploadedDocument(d) ? (
          <div key={i} className={cn(surface, "flex items-center gap-3 px-4 py-3.5")}>
            <FileText className="h-[18px] w-[18px] shrink-0 text-white/40" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] text-white">{d.name}</span>
              <span className="text-[13px] text-white/40">Uploaded</span>
            </div>
            <button
              type="button"
              aria-label={`Remove ${d.name}`}
              onClick={() => remove(i)}
              className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div key={i} className={cn(surface, "flex items-center gap-3 px-4 py-3.5")}>
            <Link2 className="h-[18px] w-[18px] shrink-0 text-white/30" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                value={d.name}
                autoFocus={i === value.length - 1 && !d.name}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Name, e.g. Appraisal 2026"
                className={inputClass}
              />
              <input
                value={d.url}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                placeholder="https://"
                className={cn(inputClass, "text-[13.5px] text-white/55")}
              />
            </div>
            <button
              type="button"
              aria-label="Remove link"
              onClick={() => remove(i)}
              className="rounded-lg p-1.5 text-white/30 hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      )}

      {uploading.map((name, i) => (
        <div key={`${name}-${i}`} className={cn(surface, "flex items-center gap-3 px-4 py-3.5")}>
          <Spinner className="h-[18px] w-[18px]" />
          <span className="truncate text-[15px] text-white/60">{name}</span>
        </div>
      ))}

      {error && <p className="px-1 text-[13px] text-[#ff8a83]">{error}</p>}

      {!full && (
        <button
          type="button"
          onClick={() => onChange([...value, { name: "", url: "" }])}
          className="inline-flex items-center gap-1.5 self-start px-1 text-[14px] text-white/50 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add a link instead
        </button>
      )}
    </div>
  );
}
