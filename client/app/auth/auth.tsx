"use client";

import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import { cn } from "@/app/lib/cn";

const linkBase =
  "inline-flex items-center justify-center gap-2 font-sans font-semibold h-8 px-3 text-sm " +
  "rounded-[var(--radius-md)] select-none transition-colors " +
  "bg-surface text-ink border border-line-strong shadow-pop hover:bg-paper-sunken " +
  "active:translate-y-[2px] active:shadow-none";

export function AuthButton({ className }: { className?: string }) {
  const { user, isLoading } = useUser();

  if (isLoading) return null;

  if (user) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.picture}
            alt={user.name ?? "Account"}
            className="size-8 rounded-full border border-line-strong"
          />
        ) : null}
        <Link href="/auth/logout" className={linkBase}>
          Log out
        </Link>
      </div>
    );
  }

  return (
    <Link href="/auth/login" className={cn(linkBase, className)}>
      Log in
    </Link>
  );
}
