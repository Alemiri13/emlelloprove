import { ChevronDown, LogOut, Repeat } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { Avatar } from "../ui/Misc";
import { Popover } from "../ui/Popover";

export function UserMenu({ compact }: { compact?: boolean }) {
  const { profilo, session, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const nav = useNavigate();
  const nome = profilo?.nome ?? session?.user.email?.split("@")[0] ?? "";
  return (
    <>
      <button ref={btn} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 h-11 pl-1.5 pr-3 rounded-full hover:bg-ink-100 transition-colors">
        <Avatar name={nome || "U"} size={34} />
        {!compact && <span className="text-[14px] font-semibold hidden sm:block capitalize">{nome}</span>}
        <ChevronDown size={16} className={`text-ink-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={btn} align="end" minWidth={240}>
        <div className="p-4 border-b border-ink-100">
          <div className="font-bold capitalize">{nome}</div>
          <div className="text-xs text-ink-500">@{profilo?.username}</div>
        </div>
        <div className="p-1.5">
          <button onClick={() => { setOpen(false); nav("/uffici"); }} className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14px] font-medium text-ink-700 hover:bg-ink-50">
            <Repeat size={17} /> Cambia ufficio
          </button>
          <button onClick={async () => { setOpen(false); await logout(); nav("/login"); }} className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-[14px] font-medium text-red-600 hover:bg-red-50">
            <LogOut size={17} /> Esci
          </button>
        </div>
      </Popover>
    </>
  );
}
