import { FileText } from "lucide-react";

export function ApplicationPanel() {
  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border border-white/5 bg-[#1C1C1C]">
      <div className="border-b border-white/5 px-5 py-4">
        <h1 className="text-[15px] font-semibold text-white">
          Tokenization application
        </h1>
        <p className="text-[13px] text-white/45">
          Describe the asset you want to tokenize.
        </p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <FileText className="h-5 w-5 text-white/25" />
        <p className="text-[13px] text-white/35">The form will appear here.</p>
      </div>
    </section>
  );
}
