"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Topbar({
  title,
  back = false,
  brand = false,
  right,
}: {
  title: string;
  back?: boolean;
  brand?: boolean;
  right?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <header className="topbar flex items-center gap-2">
      {back && (
        <button
          onClick={() => router.back()}
          aria-label="Back"
          className="-ml-2 rounded-full p-1.5 active:bg-secondary"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      <h1
        className={
          brand
            ? "text-xl font-extrabold tracking-tight text-primary"
            : "truncate text-lg font-bold"
        }
      >
        {title}
      </h1>
      {right && <div className="ml-auto">{right}</div>}
    </header>
  );
}
