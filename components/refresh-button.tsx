"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão de "Atualizar" (Melhores Práticas §4): força a versão mais nova,
 * ignorando cache do navegador (limpa Cache Storage + service workers e
 * recarrega com query param de cache-busting).
 */
export default function RefreshButton() {
  async function hardRefresh() {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // best effort — the cache-busting reload below still runs
    }
    location.replace(`${location.pathname}?refresh=${Date.now()}`);
  }

  return (
    <Button variant="secondary" className="h-11 w-full" onClick={hardRefresh}>
      <RotateCw />
      Update App (clear cache)
    </Button>
  );
}
