import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";

// Regular pages
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
      {/* Default redirect */}
      <Route path="/">
        <Redirect to="/wallet" />
      </Route>

      {/* User-facing pages */}
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

      {/* Admin auth */}
      <Route path="/admin/login" component={AdminLoginPage} />

      {/* Admin redirect */}
      <Route path="/admin">
        <Redirect to="/admin/dashboard" />
      </Route>

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
      <Route path="/admin/wallet" component={AdminWalletPage} />
      <Route path="/admin/messages" component={AdminMessagesPage} />
      <Route path="/admin/notifications" component={AdminNotificationsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin/fees" component={AdminFeesPage} />
      <Route path="/admin/logs" component={AdminLogsPage} />

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
