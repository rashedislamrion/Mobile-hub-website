import { ReactNode } from "react";

interface ColoredStatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  colorTint: "blue" | "teal" | "orange" | "peach" | "green" | "purple" | "yellow" | "red" | "pink" | "gray";
  subtitle?: ReactNode;
}

export function ColoredStatCard({ icon, label, value, colorTint, subtitle }: ColoredStatCardProps) {
  const getColors = () => {
    switch (colorTint) {
      case "blue":
        return { bg: "bg-blue-50/70", border: "border-blue-100", iconBg: "bg-white", iconColor: "text-blue-600" };
      case "teal":
        return { bg: "bg-teal-50/70", border: "border-teal-100", iconBg: "bg-white", iconColor: "text-teal-600" };
      case "orange":
        return { bg: "bg-orange-50/70", border: "border-orange-100", iconBg: "bg-white", iconColor: "text-orange-600" };
      case "peach":
        return { bg: "bg-rose-50/70", border: "border-rose-100", iconBg: "bg-white", iconColor: "text-rose-600" };
      case "green":
        return { bg: "bg-emerald-50/70", border: "border-emerald-100", iconBg: "bg-white", iconColor: "text-emerald-600" };
      case "purple":
        return { bg: "bg-purple-50/70", border: "border-purple-100", iconBg: "bg-white", iconColor: "text-purple-600" };
      case "yellow":
        return { bg: "bg-amber-50/70", border: "border-amber-100", iconBg: "bg-white", iconColor: "text-amber-600" };
      case "red":
        return { bg: "bg-red-50/70", border: "border-red-100", iconBg: "bg-white", iconColor: "text-red-600" };
      case "pink":
        return { bg: "bg-pink-50/70", border: "border-pink-100", iconBg: "bg-white", iconColor: "text-pink-600" };
      case "gray":
        return { bg: "bg-slate-50", border: "border-slate-100", iconBg: "bg-white", iconColor: "text-slate-600" };
      default:
        return { bg: "bg-slate-50", border: "border-slate-100", iconBg: "bg-white", iconColor: "text-slate-600" };
    }
  };

  const colors = getColors();

  return (
    <div className={`p-5 rounded-2xl border ${colors.bg} ${colors.border} flex flex-col justify-between h-full`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${colors.iconBg} ${colors.iconColor}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          {subtitle && (
            <span className="text-[11px] font-normal text-slate-500 bg-white/70 px-1.5 py-0.5 rounded border border-slate-200/60 shrink-0" title={typeof subtitle === "string" ? subtitle : undefined}>
              {subtitle}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}
