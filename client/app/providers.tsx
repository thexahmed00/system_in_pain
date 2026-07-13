"use client";

import { Provider } from "react-redux";
import { store } from "@/app/store";
import { ProgressSync } from "@/app/store/ProgressSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <ProgressSync />
      {children}
    </Provider>
  );
}
