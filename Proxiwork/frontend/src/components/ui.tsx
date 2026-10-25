import { Link, NavLink } from "react-router-dom";
import { Heart, Inbox, List, LogOut, PanelsTopLeft, Search, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import shortLogo from "../assets/proxiwork-logo-short.png";
import wordmark from "../assets/proxiwork-logo.png";

export function Logo({
  className = "h-[100px] w-[100px]",
  to = "/",
}: {
  className?: string;
  to?: string;
}) {
  return (
    <Link
      aria-label="ProxiWork home"
      className="inline-flex items-center"
      to={to}
    >
      <img
        alt="ProxiWork"
        className={`${className} object-contain`}
        src={wordmark}
      />
    </Link>
  );
}
export function Button({
  children,
  tone = "blue",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "blue" | "purple";
}) {
  return (
    <button
      className={`rounded-xl px-5 py-3 font-bold text-white shadow-sm disabled:opacity-50 ${
        tone === "blue"
          ? "bg-[#0878F9] hover:bg-[#0667D4]"
          : "bg-brand-purple hover:bg-violet-700"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export function JobViewSwitch({ view }: { view: "list" | "swipe" }) {
  const options = [
    { to: "/app/search", label: "List view", value: "list", Icon: List },
    {
      to: "/app/swipe",
      label: "Swipe view",
      value: "swipe",
      Icon: PanelsTopLeft,
    },
  ] as const;

  return (
    <nav
      aria-label="Job view"
      className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
    >
      {options.map(({ to, label, value, Icon }) => {
        const active = view === value;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={`inline-flex h-10 w-11 items-center justify-center rounded-lg transition-colors ${
              active
                ? "bg-teal-100 text-brand-teal shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-brand-teal"
            }`}
            key={value}
            to={to}
          >
            <Icon aria-hidden="true" size={21} />
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Header({ logoTo = "/app/search", mode = "candidate" }: { logoTo?: string; mode?: "candidate" | "employer" }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const links = mode === "employer"
    ? [["Dashboard", "/employer/dashboard"], ["Company", "/employer/company"], ["Profile", "/employer/company"]]
    : [["Find jobs", "/app/search"], ["Activity", "/app/activity"], ["Profile", "/app/profile"]];
  const inboxTo = mode === "employer" ? "/employer/applicants" : "/app/activity";
  const logout = async () => { await signOut(); navigate(mode === "employer" ? "/employer/login" : "/login", { replace: true }); };
  return (
    <header className="border-b-4 border-brand-teal bg-white px-5 py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5">
        <Link
          aria-label={
            logoTo === "/" ? "Go to ProxiWork home" : "Go to Job Search"
          }
          className="inline-flex items-center gap-3"
          to={logoTo}
        >
          <img
            alt=""
            aria-hidden="true"
            className="h-[50px] w-[50px] object-contain"
            src={shortLogo}
          />
          <span className="text-2xl font-black tracking-tight">
            <span className="text-[#0878F9]">Proxi</span>
            <span className="text-brand-teal">Work</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-bold md:flex">
          {links.map(([label, to]) => <Link key={label} to={to}>{label}</Link>)}
          <Link aria-label="Inbox" className="rounded-lg p-2 text-brand-purple hover:bg-violet-50" to={inboxTo}><Inbox size={20} /></Link>
          <button className="inline-flex items-center gap-2 rounded-xl bg-[#7754E8] px-4 py-2 text-white hover:bg-violet-700" onClick={() => setConfirming(true)} type="button"><LogOut size={17} />Log out</button>
        </nav>
      </div>
      {confirming && <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-5" role="dialog"><section className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Log out?</h2><p className="mt-2 text-slate-600">You will need to sign in again to continue.</p></div><button aria-label="Close" className="rounded-lg p-1 hover:bg-slate-100" onClick={() => setConfirming(false)}><X size={20} /></button></div><div className="mt-6 flex justify-end gap-3"><button className="rounded-xl border px-4 py-2 font-bold" onClick={() => setConfirming(false)}>Cancel</button><button className="rounded-xl bg-[#7754E8] px-4 py-2 font-bold text-white" onClick={() => void logout()}>Log out</button></div></section></div>}
    </header>
  );
}
export function BottomNav() {
  const links = [
    [Heart, "/app/activity", "Liked / Applied"],
    [Search, "/app/search", "Search"],
    [UserRound, "/app/profile", "Profile"],
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t bg-white pb-[env(safe-area-inset-bottom)] pt-2 md:hidden">
      {links.map(([Icon, to, label]) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-2 py-2 text-xs ${isActive ? "text-brand-purple" : "text-slate-500"}`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
export function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
      {children}
    </p>
  );
}
