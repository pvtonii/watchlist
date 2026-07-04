"use client";

import { Home, Search, LibraryBig, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "My List", icon: LibraryBig },
  { href: "/profile", label: "Profile", icon: User },
] as const;

/** Bottom nav — must stay a direct child of <body> (Melhores Práticas v3). */
export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="tabs">
      {TABS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className="tab"
          data-active={
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          }
        >
          <Icon size={22} strokeWidth={2} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
