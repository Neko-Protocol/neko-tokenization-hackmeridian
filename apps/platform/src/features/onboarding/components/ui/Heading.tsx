export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-center">
      <h1 className="text-[22px] font-semibold tracking-tight text-white">
        {title}
      </h1>
      {subtitle && <p className="text-[13px] text-white/55">{subtitle}</p>}
    </div>
  );
}
