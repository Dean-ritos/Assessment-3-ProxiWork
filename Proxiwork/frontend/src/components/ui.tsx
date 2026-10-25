import { Link, NavLink } from "react-router-dom";
import { Heart, Search, UserRound } from "lucide-react";
import wordmark from "../assets/proxiwork-logo.png";
export function Logo() {
  return (
    <Link
      aria-label="ProxiWork home"
      className="inline-flex items-center"
      to="/"
    >
      <img
        alt="ProxiWork"
        className="h-10 w-auto object-contain"
        src={wordmark}
      />
    </Link>
  );
}
export function Button({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="rounded-xl bg-brand-purple px-5 py-3 font-bold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}
export function Header() {
  return (
    <header className="border-b-4 border-brand-teal bg-white px-5 py-4">
      <div className="mx-auto flex max-w-6xl justify-between">
        <Logo />
        <nav className="hidden gap-5 text-sm font-bold md:flex">
          <Link to="/app/search">Find jobs</Link>
          <Link to="/app/activity">Activity</Link>
          <Link to="/app/profile">Profile</Link>
        </nav>
      </div>
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
