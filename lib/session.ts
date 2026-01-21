import { useEffect, useState } from "react";

export type CustomerType = "avulso" | "regular";

const KEY = "starpro.customerType";
const EVENT_NAME = "starpro:customer-type-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCustomerType(): CustomerType {
  if (!isBrowser()) return "avulso";
  const raw = window.localStorage.getItem(KEY);
  return raw === "regular" ? "regular" : "avulso";
}

export function setCustomerType(type: CustomerType) {
  if (!isBrowser()) return;

  // Só grava valores válidos
  const normalized: CustomerType = type === "regular" ? "regular" : "avulso";
  window.localStorage.setItem(KEY, normalized);

  // Notifica a própria aba (React re-render)
  window.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Opcional: útil se você quiser "zerar" completamente.
 * (Mas normalmente basta setCustomerType("avulso") no logout)
 */
export function clearCustomerType() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT_NAME));
}

/**
 * Hook reativo: quando setCustomerType() roda (ou outra aba altera o localStorage),
 * os componentes re-renderizam automaticamente.
 */
export function useCustomerType() {
  const [type, setType] = useState<CustomerType>("avulso");

  useEffect(() => {
    const sync = () => setType(getCustomerType());

    // Inicializa
    sync();

    // Mudança disparada na mesma aba (setCustomerType)
    const onEvent = () => sync();
    window.addEventListener(EVENT_NAME, onEvent);

    // Mudança vinda de outra aba/janela
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) sync();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(EVENT_NAME, onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return type;
}
