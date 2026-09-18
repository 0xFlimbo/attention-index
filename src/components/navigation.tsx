"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { ExternalArrow } from "./external-arrow";

/**
 * docs/HOMEPAGE.md §3, docs/DESIGN.md §6 — sticky top nav. `"use client"`
 * because the mobile drawer needs open/close state and keyboard handling —
 * the one nav interaction the batch's motion/interaction budget expects.
 */
interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  // Root-relative, not a bare `#attention`: the section lives on the homepage,
  // so from `/archive` (or any other route) a bare fragment would resolve
  // against the current page and the link would simply do nothing.
  { label: "ATTENTION", href: "/#attention" },
  { label: "CROSSOVER", href: "/#crossover" },
  { label: "ARCHIVE", href: "/archive" },
  { label: "SOURCES", href: "/evidence" },
];

interface NavigationProps {
  repositoryUrl: string | null;
}

/**
 * Same-page anchors (`#attention`) stay plain `<a>` tags; in-app routes
 * (`/archive`, `/evidence`, `/`) use `next/link` so Next can prefetch/soft-
 * navigate them (required by `@next/next/no-html-link-for-pages`).
 */
function NavLink({
  href,
  children,
  ...rest
}: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  if (href.startsWith("#")) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  );
}

export function Navigation({ repositoryUrl }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    closeButtonRef.current?.focus();

    /**
     * The panel declares `aria-modal`, so focus must actually stay inside it —
     * otherwise Tab walks into the page behind, which is still rendered and
     * scrollable. Escape closes and returns focus to the trigger.
     */
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (panel === null) return;

      const focusable = panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg">
      <nav
        aria-label="Primary"
        className="container-editorial flex h-16 items-center justify-between md:h-[72px]"
      >
        <NavLink href="/" className="text-sm font-bold tracking-tight text-ink md:text-base">
          {/* Mobile: "LH / ATTENTION INDEX"; desktop: the full brand line — docs/DESIGN.md §6 */}
          <span className="md:hidden">LH / ATTENTION INDEX</span>
          <span className="hidden md:inline">LAYOFFHEDGE / ATTENTION INDEX</span>
          <span className="sr-only"> — home</span>
        </NavLink>

        {/* Desktop links */}
        <ul className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <li key={item.label}>
              <NavLink
                href={item.href}
                className="text-metadata font-bold text-ink hover:text-accent-ink"
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          {repositoryUrl !== null && (
            <li>
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-metadata font-bold text-ink hover:text-accent-ink"
              >
                GITHUB <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          )}
        </ul>

        {/* Mobile trigger */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setIsMenuOpen(true)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu-panel"
          className="text-metadata min-h-11 min-w-11 font-bold text-ink md:hidden"
        >
          MENU
        </button>
      </nav>

      {/* Mobile full-screen panel */}
      <div
        ref={panelRef}
        id="mobile-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`mobile-menu-panel fixed inset-0 z-50 flex flex-col bg-bg transition-transform duration-300 ease-out md:hidden ${
          isMenuOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="container-editorial flex h-16 items-center justify-between">
          <span className="text-sm font-bold text-ink">LH / ATTENTION INDEX</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="text-metadata min-h-11 min-w-11 font-bold text-ink"
            tabIndex={isMenuOpen ? 0 : -1}
          >
            CLOSE
          </button>
        </div>

        <ul className="container-editorial mt-8 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <li key={item.label} className="border-b border-line">
              <NavLink
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                tabIndex={isMenuOpen ? 0 : -1}
                className="block min-h-11 py-4 text-2xl font-bold text-ink"
              >
                {item.label}
              </NavLink>
            </li>
          ))}
          {repositoryUrl !== null && (
            <li className="border-b border-line">
              <a
                href={repositoryUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                tabIndex={isMenuOpen ? 0 : -1}
                className="block min-h-11 py-4 text-2xl font-bold text-ink"
              >
                GITHUB <ExternalArrow /><span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          )}
        </ul>
      </div>
    </header>
  );
}
