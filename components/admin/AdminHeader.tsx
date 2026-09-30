import { Bell } from "lucide-react";

type AdminHeaderProps = {
  title: string;
  description?: string;
};

export function AdminHeader({ title, description }: AdminHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#e4e1da] bg-[#faf9f6] px-8">
      <div>
        <h1 className="text-[15px] font-semibold text-[#1c2321]">{title}</h1>
        {description ? (
          <p className="text-[13px] text-[#6b6558]">{description}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-[#e4e1da] bg-white text-[#4a453c] transition-colors hover:bg-[#f2f0ea]"
          aria-label="Notifikasi"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
        </button>

        <div className="flex items-center gap-2.5 border-l border-[#e4e1da] pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c2321] font-mono text-[12px] font-semibold text-white">
            A
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-medium text-[#1c2321]">Admin</p>
            <p className="text-[11px] text-[#8a8478]">ElWinnare</p>
          </div>
        </div>
      </div>
    </header>
  );
}
