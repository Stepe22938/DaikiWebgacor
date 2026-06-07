import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { MultisessionAppSupport } from "@clerk/react/internal";
import { useSignUp } from "@clerk/react/legacy";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import Home from "@/pages/home";
import Member from "@/pages/member";
import Admin from "@/pages/admin";
import Friends from "@/pages/friends";
import Profile from "@/pages/profile";
import Messages from "@/pages/messages";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  ? publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  : undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function ClerkConfigWarning({ hasNoKey }: { hasNoKey: boolean }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#16120e",
      color: "#ecd79d",
      fontFamily: "Inter, sans-serif",
      padding: "20px",
      textAlign: "center"
    }}>
      <div style={{
        maxWidth: "500px",
        padding: "30px",
        borderRadius: "12px",
        border: "1px solid #3b3223",
        backgroundColor: "#1a1512"
      }}>
        <h2 style={{ color: "#d9a05b", marginBottom: "15px" }}>Konfigurasi Clerk Diperlukan</h2>
        <p style={{ color: "#b3a486", lineHeight: "1.6", marginBottom: "20px" }}>
          {hasNoKey ? (
            <>Anda belum memasukkan API Key untuk Clerk Auth di file <code>.env</code> Anda.</>
          ) : (
            <>Anda sedang menjalankan website ini di lokal (localhost), tetapi masih menggunakan key Clerk bawaan Replit (<code>clerk.localhost</code>).</>
          )}
        </p>
        <p style={{ color: "#b3a486", lineHeight: "1.6", marginBottom: "20px" }}>
          Silakan buka file <code>.env</code> di root project Anda, isi <strong>CLERK_PUBLISHABLE_KEY</strong>, <strong>CLERK_SECRET_KEY</strong>, dan <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> dengan key dari dashboard <a href="https://clerk.com" target="_blank" style={{ color: "#d9a05b", textDecoration: "underline" }}>clerk.com</a> milik Anda sendiri.
        </p>
        <div style={{
          fontSize: "12px",
          color: "#807055",
          borderTop: "1px solid #3b3223",
          paddingTop: "15px"
        }}>
          Setelah mengisi file <code>.env</code>, silakan restart server dev Anda (jalankan ulang <code>pnpm run dev</code>).
        </div>
      </div>
    </div>
  );
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(45 80% 55%)",
    colorForeground: "hsl(45 40% 90%)",
    colorMutedForeground: "hsl(45 20% 60%)",
    colorDanger: "hsl(0 60% 40%)",
    colorBackground: "hsl(30 15% 10%)",
    colorInput: "hsl(30 20% 12%)",
    colorInputForeground: "hsl(45 40% 90%)",
    colorNeutral: "hsl(45 30% 20%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#16120e] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#3b3223]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#ecd79d]",
    headerSubtitle: "text-[#b3a486]",
    socialButtonsBlockButtonText: "text-[#ecd79d]",
    formFieldLabel: "text-[#ecd79d]",
    footerActionLink: "text-[#d9a05b]",
    footerActionText: "text-[#b3a486]",
    dividerText: "text-[#b3a486]",
    identityPreviewEditButton: "text-[#d9a05b]",
    formFieldSuccessText: "text-[#4ade80]",
    alertText: "text-[#f87171]",
    logoBox: "",
    logoImage: "",
    socialButtonsBlockButton: "border-[#3b3223] bg-[#1a1512] hover:bg-[#251e18]",
    formButtonPrimary: "bg-[#d9a05b] text-[#13100c] hover:bg-[#e4b272]",
    formFieldInput: "bg-[#1a1512] border-[#3b3223] text-[#ecd79d]",
    footerAction: "",
    dividerLine: "bg-[#3b3223]",
    alert: "bg-[#7f1d1d] border-[#ef4444]",
    otpCodeFieldInput: "bg-[#1a1512] border-[#3b3223] text-[#ecd79d]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2219] to-background">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        oidcPrompt="login select_account consent"
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2219] to-background">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        oidcPrompt="login select_account consent"
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkMissingUsernameAutoCompleter() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const isSubmittingRef = useRef(false);
  const [publicUsername, setPublicUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsPublicUsername =
    isLoaded &&
    signUp?.status === "missing_requirements" &&
    signUp.missingFields.includes("username");

  async function completeWithPublicUsername(mode: "manual" | "auto") {
    if (!isLoaded || !signUp || isSubmittingRef.current) return;

    const normalizedManual = publicUsername
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

    if (mode === "manual" && normalizedManual.length < 3) {
      setError("Handle minimal 3 karakter.");
      return;
    }

    const generatedPublicUsername =
      signUp.emailAddress?.split("@")[0]?.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) ||
      "player";
    const chosenPublicUsername = mode === "manual" ? normalizedManual : generatedPublicUsername;

    setError(null);
    isSubmittingRef.current = true;
    try {
      const updated = await signUp.update({
        username: `arcadia_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        unsafeMetadata: { publicUsername: chosenPublicUsername },
      });

      if (updated.status === "complete" && updated.createdSessionId) {
        await setActive({ session: updated.createdSessionId, redirectUrl: `${basePath}/member` });
      }
    } catch (error) {
      console.error("Failed to complete Clerk username", error);
      setError("Gagal menyimpan handle. Coba lagi.");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  if (!needsPublicUsername) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#3b3223] bg-[#16120e] p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <img src={`${basePath}/logo.svg`} alt="" className="mx-auto mb-4 h-12 w-12" />
          <h2 className="text-2xl font-bold text-[#ecd79d]">Pilih Handle Publik</h2>
          <p className="mt-2 text-sm text-[#b3a486]">
            Handle boleh sama dengan akun lain karena nanti dibedakan pakai tagar.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-[#ecd79d]" htmlFor="public-username">
            Handle manual
          </label>
          <input
            id="public-username"
            value={publicUsername}
            onChange={(event) => setPublicUsername(event.target.value)}
            placeholder="contoh: steve"
            className="h-11 w-full rounded-lg border border-[#3b3223] bg-[#1a1512] px-3 text-[#ecd79d] outline-none focus:border-[#d9a05b]"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("manual")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-lg bg-[#d9a05b] font-bold text-[#13100c] hover:bg-[#e4b272] disabled:opacity-60"
          >
            Pakai Manual
          </button>
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("auto")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-lg border border-[#3b3223] bg-[#1a1512] font-bold text-[#ecd79d] hover:bg-[#251e18] disabled:opacity-60"
          >
            Generate Otomatis
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  return <Home />;
}


function MemberProtected() {
  return (
    <>
      <Show when="signed-in">
        <Member />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AdminProtected() {
  return (
    <>
      <Show when="signed-in">
        <Admin />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function FriendsProtected() {
  return (
    <>
      <Show when="signed-in">
        <Friends />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ProfileProtected() {
  return (
    <>
      <Show when="signed-in">
        <Profile />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function MessagesProtected() {
  return (
    <>
      <Show when="signed-in">
        <Messages />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || ""}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Enter Arcadia",
            subtitle: "Sign in to access your player profile",
          },
        },
        signUp: {
          start: {
            title: "Join Arcadia Studio",
            subtitle: "Forge your legend today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <MultisessionAppSupport>
          <ClerkMissingUsernameAutoCompleter />
          <ClerkQueryClientCacheInvalidator />
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/member" component={MemberProtected} />
            <Route path="/admin" component={AdminProtected} />
            <Route path="/friends" component={FriendsProtected} />
            <Route path="/profile/:id" component={ProfileProtected} />
            <Route path="/messages" component={MessagesProtected} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={NotFound} />
          </Switch>
        </MultisessionAppSupport>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  const hasNoKey = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  const isReplitClerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.includes("Y2xlcmsubG9jYWx0aG9zdCQ");
  const isRunningLocally = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.");

  if (hasNoKey || (isReplitClerkKey && isRunningLocally)) {
    return <ClerkConfigWarning hasNoKey={hasNoKey} />;
  }

  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
