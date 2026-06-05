import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
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
import Messages from "@/pages/messages";
import NotFound from "@/pages/not-found";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
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
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a2219] to-background">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
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

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/member" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
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
      publishableKey={clerkPubKey}
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
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/member" component={MemberProtected} />
          <Route path="/admin" component={AdminProtected} />
          <Route path="/friends" component={FriendsProtected} />
          <Route path="/messages" component={MessagesProtected} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
      <Toaster />
    </WouterRouter>
  );
}

export default App;
