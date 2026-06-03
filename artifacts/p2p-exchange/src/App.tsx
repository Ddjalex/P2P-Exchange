import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

// Pages
import NotFound from "@/pages/not-found";
import WalletPage from "@/pages/wallet";
import P2PPage from "@/pages/p2p";
import AdsPage from "@/pages/ads";
import PostAdPage from "@/pages/post-ad";
import OrdersPage from "@/pages/orders";
import TradePage from "@/pages/trade";
import ChatPage from "@/pages/chat";
import ChatThreadPage from "@/pages/chat-thread";
import ProfilePage from "@/pages/profile";
import PaymentMethodsPage from "@/pages/payment-methods";
import KycPage from "@/pages/kyc";
import AdminKycPage from "@/pages/admin-kyc";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Redirect to="/wallet" />
      </Route>
      <Route path="/wallet" component={WalletPage} />
      <Route path="/wallet/usdt">
        <Redirect to="/wallet" />
      </Route>
      <Route path="/p2p" component={P2PPage} />
      <Route path="/ads" component={AdsPage} />
      <Route path="/ads/post" component={PostAdPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/trade/:id" component={TradePage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/chat/:orderId" component={ChatThreadPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/payment-methods" component={PaymentMethodsPage} />
      <Route path="/kyc" component={KycPage} />
      <Route path="/admin">
        <Redirect to="/admin/kyc" />
      </Route>
      <Route path="/admin/kyc" component={AdminKycPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
