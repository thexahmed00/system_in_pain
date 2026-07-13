"use client";

import { Provider } from "react-redux";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import type { User } from "@auth0/nextjs-auth0/types";
import { store } from "@/app/store";
import { ProgressSync } from "@/app/store/ProgressSync";
import { PostHogIdentify } from "@/app/auth/PostHogIdentify";

export function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User;
}) {
  return (
    <Auth0Provider user={user}>
      <PostHogIdentify />
      <Provider store={store}>
        <ProgressSync />
        {children}
      </Provider>
    </Auth0Provider>
  );
}
