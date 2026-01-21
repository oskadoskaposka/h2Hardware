"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect } from "react";
import { auth } from "../lib/firebaseClient";
import { setCustomerType } from "../lib/session";

export default function AuthSync() {
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCustomerType(user ? "regular" : "avulso");
    });
    return () => unsub();
  }, []);

  return null;
}
