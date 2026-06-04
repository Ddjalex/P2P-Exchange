import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { useSse } from "@/hooks/use-sse";
import { KycGate } from "@/components/kyc-gate";

// Regular pages
import AuthPage from "@/pages/auth";
import NotFound from "@/pages/not-found";
import WalletPage from "@/pages/wallet";
import P2PPage from "@/pages/p2p";
import AdsPage from "@/pages/ads";
import PostAdPage from "@/pages/post-ad";
import OrdersPage from "@/pages/orders";
import TradePage from "@/pages/trade";
import BuyConfirmPage from "@/pages/buy-confirm";
import ChatPage from "@/pages/chat";
import ChatThreadPage from "@/pages/chat-thread";
import ProfilePage from "@/pages/profile";
import PaymentMethodsPage from "@/pages/payment-methods";
import KycPage from "@/pages/kyc";
import ReceivedFeedbackPage from "@/pages/received-feedback";
import FollowsPage from "@/pages/follows";
import BlockedUsersPage from "@/pages/blocked-users";
import HelpCenterPage from "@/pages/help-center";
import AboutPage from "@/pages/about";

// Admin pages
import AdminLoginPage from "@/pages/admin-login";
import AdminDashboardPage from "@/pages/admin-dashboard";
import AdminUsersPage from "@/pages/admin-users";
import AdminUserDetailPage from "@/pages/admin-user-detail";
import AdminKycPage from "@/pages/admin-kyc";
import AdminAdsPage from "@/pages/admin-ads-page";
import AdminOrdersPage from "@/pages/admin-orders-page";
import AdminOrderDetailPage from "@/pages/admin-order-detail";
import AdminDisputesPage from "@/pages/admin-disputes-page";
import AdminDisputeDetailPage from "@/pages/admin-dispute-detail";
import AdminWalletPage from "@/pages/admin-wallet-page";
import AdminMessagesPage from "@/pages/admin-messages-page";
import AdminNotificationsPage from "@/pages/admin-notifications-page";
import AdminSettingsPage from "@/pages/admin-settings-page";
import AdminFeesPage from "@/pages/admin-fees-page";
import AdminLogsPage from "@/pages/admin-logs-page";
import AdminFraudPage from "@/pages/admin-fraud-page";
import AdminDepositsPage from "@/pages/admin-deposits-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  return <Component />;
}

function KycProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  return <KycGate><Component /></KycGate>;
}

function Router() {
  const { user, isLoading } = useAuth();
  useSse();

  return (
    <Switch>
      {/* Root redirect */}
      <Route path="/">
        {isLoading ? null : user ? <Redirect to="/wallet" /> : <Redirect to="/auth" />}
      </Route>

      {/* Auth page — redirect to /wallet if already logged in */}
      <Route path="/auth">
        {isLoading ? null : user ? <Redirect to="/wallet" /> : <AuthPage />}
      </Route>

      {/* KYC-gated pages — show verification wall if not verified */}
      <Route path="/wallet"><KycProtectedRoute component={WalletPage} /></Route>
      <Route path="/wallet/usdt"><Redirect to="/wallet" /></Route>
      <Route path="/p2p"><KycProtectedRoute component={P2PPage} /></Route>
      <Route path="/p2p/confirm/:adId"><KycProtectedRoute component={BuyConfirmPage} /></Route>
      <Route path="/ads"><KycProtectedRoute component={AdsPage} /></Route>
      <Route path="/ads/post"><KycProtectedRoute component={PostAdPage} /></Route>
      <Route path="/orders"><KycProtectedRoute component={OrdersPage} /></Route>
      <Route path="/trade/:id"><KycProtectedRoute component={TradePage} /></Route>
      <Route path="/chat"><KycProtectedRoute component={ChatPage} /></Route>
      <Route path="/chat/:orderId"><KycProtectedRoute component={ChatThreadPage} /></Route>

      {/* Always accessible after login — no KYC required */}
      <Route path="/profile"><ProtectedRoute component={ProfilePage} /></Route>
      <Route path="/profile/payment-methods"><ProtectedRoute component={PaymentMethodsPage} /></Route>
      <Route path="/profile/feedback"><ProtectedRoute component={ReceivedFeedbackPage} /></Route>
      <Route path="/profile/follows"><ProtectedRoute component={FollowsPage} /></Route>
      <Route path="/profile/blocked"><ProtectedRoute component={BlockedUsersPage} /></Route>
      <Route path="/help-center"><ProtectedRoute component={HelpCenterPage} /></Route>
      <Route path="/about"><ProtectedRoute component={AboutPage} /></Route>
      <Route path="/kyc"><ProtectedRoute component={KycPage} /></Route>

      {/* Admin auth — login now lives inside /auth */}
      <Route path="/admin/login"><Redirect to="/auth" /></Route>
      <Route path="/admin"><Redirect to="/admin/dashboard" /></Route>

      {/* Admin pages */}
      <Route path="/admin/dashboard" component={AdminDashboardPage} />
      <Route path="/admin/users/:id" component={AdminUserDetailPage} />
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/kyc" component={AdminKycPage} />
      <Route path="/admin/ads" component={AdminAdsPage} />
      <Route path="/admin/orders/:id" component={AdminOrderDetailPage} />
      <Route path="/admin/orders" component={AdminOrdersPage} />
      <Route path="/admin/disputes/:id" component={AdminDisputeDetailPage} />
      <Route path="/admin/disputes" component={AdminDisputesPage} />
      <Route path="/admin/fraud" component={AdminFraudPage} />
      <Route path="/admin/wallet" component={AdminWalletPage} />
      <Route path="/admin/messages" component={AdminMessagesPage} />
      <Route path="/admin/notifications" component={AdminNotificationsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin/fees" component={AdminFeesPage} />
      <Route path="/admin/logs" component={AdminLogsPage} />
      <Route path="/admin/deposits" component={AdminDepositsPage} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminAuthProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
