import { useEffect, useRef, useState } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
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
import Premium from "@/pages/premium";
import NotFound from "@/pages/not-found";
import AddFriendPage from "@/pages/add-friend";


const isLocal = window.location.hostname === "localhost" ||
                window.location.hostname === "127.0.0.1" ||
                window.location.hostname.startsWith("192.168.");

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  ? (isLocal ? import.meta.env.VITE_CLERK_PUBLISHABLE_KEY : publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY))
  : undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

type RealmSettings = {
  realmName?: string | null;
  realmLogoUrl?: string | null;
};

const FALLBACK_REALM_NAME = "Arcadia Studio";

function getRealmDisplayName(settings?: RealmSettings | null) {
  return settings?.realmName?.trim() || FALLBACK_REALM_NAME;
}

function useRealmSettings() {
  const [settings, setSettings] = useState<RealmSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${basePath}/api/settings`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Settings request failed: ${response.status}`);
        }
        return response.json() as Promise<RealmSettings>;
      })
      .then((data) => {
        if (!cancelled) {
          setSettings(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSettings({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

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
    logoPlacement: "none" as const,
    logoLinkUrl: basePath || "/",
  },
  variables: {
    colorPrimary: "hsl(270 70% 65%)",
    colorForeground: "hsl(222 35% 12%)",
    colorMutedForeground: "hsl(224 12% 48%)",
    colorDanger: "hsl(0 60% 55%)",
    colorBackground: "hsla(0 0% 100% / 0.74)",
    colorInput: "hsla(0 0% 100% / 0.76)",
    colorInputForeground: "hsl(222 35% 12%)",
    colorNeutral: "hsl(222 18% 88%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full bg-transparent shadow-none border-0",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border border-white/55 !bg-white/45 !rounded-2xl mt-3 backdrop-blur-xl max-lg:!hidden",
    headerTitle: "!text-slate-950 font-black max-lg:!hidden",
    headerSubtitle: "!text-slate-500 max-lg:!hidden",
    socialButtonsBlockButtonText: "!text-slate-800 !font-semibold !opacity-100",
    formFieldLabel: "!text-slate-900 font-semibold",
    footerActionLink: "!text-[#6d28d9] hover:!text-[#4c1d95]",
    footerActionText: "!text-slate-500",
    dividerText: "!text-slate-500",
    identityPreviewEditButton: "!text-[#6d28d9]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-red-400",
    logoBox: "hidden",
    logoImage: "hidden",
    socialButtonsBlockButton: "!w-full !border !border-white/55 !bg-white/42 hover:!bg-white/58 !text-slate-900 !shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_14px_38px_rgba(15,23,42,0.10)] !backdrop-blur-2xl",
    formButtonPrimary: "bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-black shadow-lg shadow-purple-500/25 border-0 max-lg:bg-[#143c69] max-lg:bg-none max-lg:hover:bg-[#0f3158] max-lg:shadow-none",
    formFieldInput: "!bg-white/42 !border !border-white/60 !text-slate-950 focus:!border-purple-400/70 focus:!bg-white/58 placeholder:!text-slate-500 !shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] !backdrop-blur-xl",
    footerAction: "",
    dividerLine: "!bg-slate-200/80",
    alert: "bg-red-950/50 border border-red-500/30",
    otpCodeFieldInput: "!bg-white/42 !border !border-white/60 !text-slate-950",
    formFieldRow: "",
    main: "",
  },
};


// ---- CINEMATIC AUTH PAGE ----
const AUTH_PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 9,
  duration: 6 + Math.random() * 7,
  size: 1.5 + Math.random() * 4,
  opacity: 0.15 + Math.random() * 0.65,
}));

const AUTH_STYLES = `
  @keyframes auth-float-up {
    0%   { transform: translateY(100vh) scale(0.4); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 0.7; }
    100% { transform: translateY(-12vh) scale(1.3); opacity: 0; }
  }
  @keyframes auth-sparkle {
    0%, 100% { opacity: 0; transform: scale(0.4) rotate(0deg); }
    50%       { opacity: 1; transform: scale(1.3) rotate(180deg); }
  }
  @keyframes auth-mobile-header {
    from { transform: translateY(-30px); opacity: 0; }
    to   { transform: translateY(0);     opacity: 1; }
  }
  @keyframes auth-card-in {
    from { transform: translateY(26px) scale(0.97); opacity: 0; filter: blur(10px); }
    to   { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
  }
  @keyframes auth-card-aura {
    0%, 100% { opacity: 0.42; transform: translate3d(-50%, -50%, 0) scale(0.96); }
    50%      { opacity: 0.72; transform: translate3d(-50%, -50%, 0) scale(1.04); }
  }
  @keyframes auth-logo-float {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    50%      { transform: translateY(-5px) rotate(1.5deg); }
  }
  .auth-particle     { animation: auth-float-up linear infinite; }
  .auth-sparkle      { animation: auth-sparkle ease-in-out infinite; }
  .auth-login-card  { animation: auth-card-in 0.82s cubic-bezier(0.22,1,0.36,1) both; }
  .auth-card-aura   { animation: auth-card-aura 5.6s ease-in-out infinite; }
  .auth-login-logo  { animation: auth-logo-float 4.6s ease-in-out infinite; }
  .cl-socialButtonsBlock,
  .cl-socialButtonsBlock > div,
  .cl-socialButtonsBlock > div > div,
  .cl-socialButtonsBlock > div > div > div {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    width: 100% !important;
  }
  .cl-socialButtonsBlockButton {
    width: 100% !important;
    min-height: 46px !important;
    justify-content: center !important;
    gap: 12px !important;
    color: #0f172a !important;
    background: rgba(255,255,255,0.42) !important;
    border: 1px solid rgba(255,255,255,0.58) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.78), 0 14px 38px rgba(15,23,42,0.10) !important;
    backdrop-filter: blur(22px) saturate(150%) !important;
    -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
  }
  .cl-socialButtonsBlockButtonText {
    display: none !important;
  }
  .cl-socialButtonsBlockButton::after {
    display: inline-flex !important;
    color: #1e293b !important;
    font-weight: 800 !important;
    opacity: 1 !important;
    visibility: visible !important;
    line-height: 1 !important;
    pointer-events: none !important;
  }
  .cl-socialButtonsBlockButton__google::after {
    content: "Continue with Google" !important;
  }
  .cl-socialButtonsBlockButton__discord::after {
    content: "Continue with Discord" !important;
  }
  .cl-socialButtonsBlockButton__facebook::after {
    content: "Continue with Facebook" !important;
  }
  @media (max-width: 1023px) {
    .cl-rootBox,
    .cl-cardBox,
    .cl-card,
    .cl-main {
      min-width: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .cl-socialButtonsBlockButton {
      min-height: 40px !important;
      border-radius: 12px !important;
    }
    .cl-socialButtonsBlockButton::after {
      color: #172033 !important;
      font-size: 11.5px !important;
      font-weight: 800 !important;
      white-space: nowrap !important;
    }
  }
  /* Mobile styles */
  .auth-mobile-sheet { animation: auth-slide-up 0.65s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
  .auth-mobile-hdr   { animation: auth-mobile-header 0.8s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
`;

function AuthPageLayout({ children, mode }: { children: React.ReactNode; mode: "sign-in" | "sign-up" }) {
  const realmSettings = useRealmSettings();
  const realmName = getRealmDisplayName(realmSettings);
  const realmLogoUrl = realmSettings?.realmLogoUrl?.trim();
  const logoSrc = realmLogoUrl || `${basePath}/logo.svg`;
  const authAction = mode === "sign-in" ? "Enter" : "Join";
  const authEyebrow = mode === "sign-in" ? "Welcome Back" : "New Legend";






  // Shared: particles + sparkles + ambient
  const particlesLayer = (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {AUTH_PARTICLES.map((p) => (
        <div
          key={p.id}
          className="auth-particle absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: 0,
            width:  `${p.size}px`,
            height: `${p.size}px`,
            background: p.id % 3 === 0
              ? `rgba(212,175,55,${p.opacity})`
              : p.id % 3 === 1
              ? `rgba(160,100,255,${p.opacity})`
              : `rgba(255,255,255,${p.opacity * 0.45})`,
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
            boxShadow: p.id % 3 === 0
              ? `0 0 ${p.size * 2}px rgba(212,175,55,0.85)`
              : `0 0 ${p.size}px rgba(160,100,255,0.65)`,
          }}
        />
      ))}

      {[...Array(12)].map((_, i) => (
        <div
          key={`star-${i}`}
          className="auth-sparkle absolute text-amber-300 select-none"
          style={{
            left:              `${4 + (i * 8.3) % 90}%`,
            top:               `${8 + (i * 11.9) % 82}%`,
            fontSize:          `${7 + (i % 3) * 5}px`,
            animationDuration: `${2.2 + (i * 0.5) % 3}s`,
            animationDelay:    `${(i * 0.55) % 3}s`,
          }}
        >
          {i % 2 === 0 ? "*" : "+"}
        </div>
      ))}
    </div>
  );





  return (
    <div className="relative flex min-h-[100dvh] w-full overflow-hidden bg-[#050408]">
      <style dangerouslySetInnerHTML={{ __html: AUTH_STYLES }} />

      <div className="relative hidden min-h-[100dvh] w-full items-center justify-center overflow-hidden px-6 py-10 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(121,73,255,0.18),transparent_34%),radial-gradient(circle_at_18%_80%,rgba(212,175,55,0.08),transparent_28%),linear-gradient(180deg,#050408_0%,#090511_54%,#050408_100%)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] rounded-full bg-purple-500/10 blur-3xl auth-card-aura" />
        <div className="pointer-events-none absolute left-[calc(50%-330px)] top-[16%] h-52 w-52 rounded-full bg-amber-300/28 blur-3xl" />
        <div className="pointer-events-none absolute right-[calc(50%-360px)] top-[32%] h-64 w-64 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute left-1/2 bottom-[10%] h-44 w-[520px] -translate-x-1/2 rounded-full bg-sky-400/14 blur-3xl" />
        {particlesLayer}

        <div className="auth-login-card relative z-30 w-full max-w-[500px] rounded-[34px] border border-white/44 bg-white/[0.34] px-12 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_34px_120px_rgba(0,0,0,0.34)] backdrop-blur-[30px]">
          <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(145deg,rgba(255,255,255,0.48),rgba(255,255,255,0.16)_42%,rgba(255,255,255,0.08)),radial-gradient(circle_at_52%_0%,rgba(168,85,247,0.16),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-white/90" />
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-white/35" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="auth-login-logo relative mb-5 grid h-16 w-16 place-items-center rounded-sm bg-amber-400/5">
              <div className="absolute inset-0 rounded-full bg-amber-300/20 blur-2xl" />
              <img src={logoSrc} alt={realmName} className="relative h-12 w-12 object-contain drop-shadow-[0_0_24px_rgba(212,175,55,0.35)]" />
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.45em] text-purple-600/80">
              {authEyebrow}
            </p>
            <h1 className="mt-12 text-center text-2xl font-black tracking-tight text-slate-950">
              {authAction} {realmName}
            </h1>
            <p className="mt-2 text-center text-base font-medium text-slate-500">
              {mode === "sign-in" ? "Sign in to access your player profile" : "Create your player profile"}
            </p>
          </div>

          <div className="relative z-10 mt-7">
            {children}
          </div>
        </div>
      </div>

      <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#07101d] px-4 pb-5 pt-6 lg:hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(125,92,255,0.34),transparent_28%),radial-gradient(circle_at_82%_12%,rgba(77,190,218,0.24),transparent_24%),radial-gradient(circle_at_50%_86%,rgba(212,175,55,0.14),transparent_28%),linear-gradient(180deg,#07101d_0%,#102846_58%,#07101d_100%)]" />
        <div className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-sky-300/16 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-24 h-64 w-64 rounded-full bg-violet-400/22 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />

        <div className="relative z-20 flex items-center justify-between">
          <button
            type="button"
            aria-label="Back"
            className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl"
            onClick={() => window.history.back()}
          >
            <span className="relative block h-5 w-5">
              <span className="absolute left-0 top-1/2 h-[2px] w-5 -translate-y-1/2 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 h-[2px] w-3 origin-left -translate-y-1/2 rotate-45 rounded-full bg-current" />
              <span className="absolute left-0 top-1/2 h-[2px] w-3 origin-left -translate-y-1/2 -rotate-45 rounded-full bg-current" />
            </span>
          </button>
          <div className="rounded-full border border-white/10 bg-white/8 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
            Arcadia
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-7">
          <div className="mx-auto mb-5 flex max-w-[350px] flex-col items-center text-center">
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_48px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
              <img src={logoSrc} alt={realmName} className="relative h-11 w-11 object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.26)]" />
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.38em] text-sky-100/70">
              {authEyebrow}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              {authAction} {realmName}
            </h1>
            <p className="mt-2 max-w-[280px] text-sm font-medium leading-relaxed text-sky-100/58">
              {mode === "sign-in" ? "Sign in and continue your story." : "Create your profile and begin your story."}
            </p>
          </div>

          <div className="auth-login-card relative mx-auto w-full max-w-[370px] overflow-hidden rounded-[32px] border border-white/24 bg-white/[0.22] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.36),0_28px_70px_rgba(0,0,0,0.34)] backdrop-blur-[30px]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.34),rgba(255,255,255,0.10)_42%,rgba(255,255,255,0.04)),radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.34),transparent_32%)]" />
            <div className="relative rounded-[24px] border border-white/60 bg-white/70 px-4 py-5 shadow-[0_18px_46px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
              <div className="min-w-0 [&_.cl-cardBox]:!w-full [&_.cl-main]:!gap-3 [&_.cl-socialButtonsBlock]:!gap-2 [&_.cl-socialButtonsBlockButton]:!min-h-10 [&_.cl-socialButtonsBlockButton]:!text-sm [&_.cl-formFieldInput]:!h-10 [&_.cl-formButtonPrimary]:!h-10 [&_.cl-footer]:!hidden">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function SignInPage() {
  return (
    <AuthPageLayout mode="sign-in">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        oidcPrompt="login select_account consent"
      />
    </AuthPageLayout>
  );
}

function SignUpPage() {
  return (
    <AuthPageLayout mode="sign-up">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        oidcPrompt="login select_account consent"
      />
    </AuthPageLayout>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050408]/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-purple-500/10 backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 border border-purple-500/20">
            <img src={`${basePath}/logo.svg`} alt="" className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-black text-white">Pilih Handle Publik</h2>
          <p className="mt-2 text-sm text-white/40">
            Handle boleh sama dengan akun lain karena nanti dibedakan pakai tagar.
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold text-white/70" htmlFor="public-username">
            Handle manual
          </label>
          <input
            id="public-username"
            value={publicUsername}
            onChange={(event) => setPublicUsername(event.target.value)}
            placeholder="contoh: steve"
            className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-white outline-none focus:border-purple-500/60 placeholder:text-white/25"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("manual")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 font-black text-white hover:from-purple-500 hover:to-violet-500 disabled:opacity-60 shadow-lg shadow-purple-500/25"
          >
            Pakai Manual
          </button>
          <button
            type="button"
            onClick={() => void completeWithPublicUsername("auto")}
            disabled={isSubmittingRef.current}
            className="h-11 rounded-xl border border-white/10 bg-white/5 font-bold text-white/80 hover:bg-white/10 disabled:opacity-60"
          >
            Generate Otomatis
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <Redirect to="/member" />;
  }

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
        <Redirect to="/member?tab=messages" />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function PremiumProtected() {
  return (
    <>
      <Show when="signed-in">
        <Premium />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function AddFriendProtected() {
  return (
    <>
      <Show when="signed-in">
        <AddFriendPage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const realmSettings = useRealmSettings();
  const realmName = getRealmDisplayName(realmSettings);

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
            title: `Enter ${realmName}`,
            subtitle: "Sign in to access your player profile",
          },
        },
        signUp: {
          start: {
            title: `Join ${realmName}`,
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
            <Route path="/premium" component={PremiumProtected} />
            <Route path="/invite/:code">
              {(params) => <Redirect to={`/member?tab=messages&inviteCode=${params.code}`} />}
            </Route>
            <Route path="/add-friend/:target" component={AddFriendProtected} />
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
