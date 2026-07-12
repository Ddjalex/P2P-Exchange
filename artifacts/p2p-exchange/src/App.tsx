import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AdminAuthProvider } from "@/hooks/use-admin-auth";
import { useSse } from "@/hooks/use-sse";
import { KycGate } from "@/components/kyc-gate";
import { NotificationPermissionModal } from "@/components/notification-permission";
import { InstallAppModal } from "@/components/install-app-modal";
import { TelegramConnectPopup } from "@/components/telegram-connect-popup";

// Regular pages
import AuthPage from "@/pages/auth";
import ForgotPasswordPage from "@/pages/forgot-password";
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
import TraderProfilePage from "@/pages/trader-profile";
import HelpCenterPage from "@/pages/help-center";
import AboutPage from "@/pages/about";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import ContactPage from "@/pages/contact";
import RefundPage from "@/pages/refund";
import SharedAdPage from "@/pages/shared-ad";
import CardPage from "@/pages/card";
import TransferHistoryPage from "@/pages/transfer-history";
import WalletUsdtPage from "@/pages/wallet-usdt";
import AddressVerifyPage from "@/pages/address-verify";
import AddressStatusPage from "@/pages/address-status";
import EmailVerifyPage from "@/pages/email-verify";
import PhoneVerifyPage from "@/pages/phone-verify";

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
import AdminWithdrawalDetailPage from "@/pages/admin-withdrawal-detail";
import AdminMessagesPage from "@/pages/admin-messages-page";
import AdminNotificationsPage from "@/pages/admin-notifications-page";
import AdminSettingsPage from "@/pages/admin-settings-page";
import AdminFeesPage from "@/pages/admin-fees-page";
import AdminLogsPage from "@/pages/admin-logs-page";
import AdminFraudPage from "@/pages/admin-fraud-page";
import AdminDepositsPage from "@/pages/admin-deposits-page";
import AdminBroadcastPage from "@/pages/admin-broadcast";
import AdminEmailPage from "@/pages/admin-email-page";
import AdminCardsPage from "@/pages/admin-cards-page";
import AdminSecurityPage from "@/pages/admin-security-page";

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

/**
 * Controls Tawk.to widget visibility based on auth state.
 *
 * Rules:
 *   - Unauthenticated (auth page, post-logout): widget visible
 *   - Authenticated: widget hidden; only shown on-demand via Profile → Contact Support
 *   - onChatMinimized while authenticated: hide widget (so it doesn't persist)
 *   - onChatMinimized while unauthenticated: no-op (floating button stays visible)
 *
 * Uses polling to handle Tawk.to's async initialisation reliably — the one-shot
 * onLoad chain is unreliable when Tawk crashes mid-init (i18next bug).
 */
function TawkVisibility() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const shouldShow = !user;
    let cancelled = false;

    function applyVisibility(): boolean {
      const tawk = (window as any).Tawk_API;
      if (!tawk || typeof tawk.hideWidget !== "function") return false;

      if (shouldShow) {
        // Logged out / auth page: show the floating widget
        tawk.showWidget();
        // Minimising just collapses the bubble — don't auto-hide
        tawk.onChatMinimized = undefined;
      } else {
        // Logged in: hide widget; re-hide if user minimises it
        tawk.hideWidget();
        tawk.onChatMinimized = () => {
          (window as any).Tawk_API?.hideWidget?.();
        };
      }
      return true;
    }

    // Try immediately; if Tawk isn't ready yet, poll every 300 ms for up to 10 s
    if (!applyVisibility()) {
      let attempts = 0;
      const timer = setInterval(() => {
        if (cancelled) { clearInterval(timer); return; }
        attempts++;
        if (applyVisibility() || attempts >= 33) clearInterval(timer);
      }, 300);
      return () => { cancelled = true; clearInterval(timer); };
    }
  }, [user?.id, isLoading]);

  return null;
}

function Router() {
  const { user, isLoading } = useAuth();
  useSse();

  return (
    <>
    <TawkVisibility />
    <Switch>
      {/* Root redirect */}
      <Route path="/">
        {isLoading ? null : user ? <Redirect to="/wallet" /> : <Redirect to="/auth" />}
      </Route>

      {/* Auth page — handles own redirect after login/register */}
      <Route path="/auth">
        {isLoading ? null : <AuthPage />}
      </Route>

      {/* Forgot password flow — public */}
      <Route path="/forgot-password" component={ForgotPasswordPage} />

      {/* Compliance pages — public (no login required, needed for ad platforms) */}
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/refund" component={RefundPage} />

      {/* Shared ad link — public, handles own auth redirect */}
      <Route path="/p2p/ad/:adId" component={SharedAdPage} />

      {/* KYC-gated pages — show verification wall if not verified */}
      <Route path="/wallet"><KycProtectedRoute component={WalletPage} /></Route>
      <Route path="/wallet/usdt"><KycProtectedRoute component={WalletUsdtPage} /></Route>
      <Route path="/wallet/transfer-history"><KycProtectedRoute component={TransferHistoryPage} /></Route>
      <Route path="/p2p"><KycProtectedRoute component={P2PPage} /></Route>
      <Route path="/p2p/confirm/:adId"><KycProtectedRoute component={BuyConfirmPage} /></Route>
      <Route path="/ads"><KycProtectedRoute component={AdsPage} /></Route>
      <Route path="/ads/post"><KycProtectedRoute component={PostAdPage} /></Route>
      <Route path="/ads/edit/:id"><KycProtectedRoute component={PostAdPage} /></Route>
      <Route path="/orders"><KycProtectedRoute component={OrdersPage} /></Route>
      <Route path="/trade/:id"><KycProtectedRoute component={TradePage} /></Route>
      <Route path="/chat"><KycProtectedRoute component={ChatPage} /></Route>
      <Route path="/chat/:orderId"><KycProtectedRoute component={ChatThreadPage} /></Route>

      {/* Always accessible after login — no KYC required */}
      <Route path="/trader/:userId"><ProtectedRoute component={TraderProfilePage} /></Route>
      <Route path="/profile"><ProtectedRoute component={ProfilePage} /></Route>
      <Route path="/profile/payment-methods"><ProtectedRoute component={PaymentMethodsPage} /></Route>
      <Route path="/profile/feedback"><ProtectedRoute component={ReceivedFeedbackPage} /></Route>
      <Route path="/profile/follows"><ProtectedRoute component={FollowsPage} /></Route>
      <Route path="/profile/blocked"><ProtectedRoute component={BlockedUsersPage} /></Route>
      <Route path="/help-center"><ProtectedRoute component={HelpCenterPage} /></Route>
      <Route path="/about"><ProtectedRoute component={AboutPage} /></Route>
      <Route path="/kyc"><ProtectedRoute component={KycPage} /></Route>
      <Route path="/card"><ProtectedRoute component={CardPage} /></Route>
      <Route path="/settings/address-verify"><ProtectedRoute component={AddressVerifyPage} /></Route>
      <Route path="/settings/address"><ProtectedRoute component={AddressStatusPage} /></Route>
      <Route path="/settings/email-verify"><ProtectedRoute component={EmailVerifyPage} /></Route>
      <Route path="/settings/phone-verify"><ProtectedRoute component={PhoneVerifyPage} /></Route>

      {/* Admin auth — login now lives inside /auth */}
      <Route path="/admin/login" component={AdminLoginPage} />
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
      <Route path="/admin/security" component={AdminSecurityPage} />
      <Route path="/admin/wallet/withdrawals/:id" component={AdminWithdrawalDetailPage} />
      <Route path="/admin/wallet" component={AdminWalletPage} />
      <Route path="/admin/messages" component={AdminMessagesPage} />
      <Route path="/admin/notifications" component={AdminNotificationsPage} />
      <Route path="/admin/settings" component={AdminSettingsPage} />
      <Route path="/admin/fees" component={AdminFeesPage} />
      <Route path="/admin/logs" component={AdminLogsPage} />
      <Route path="/admin/deposits" component={AdminDepositsPage} />
      <Route path="/admin/broadcast" component={AdminBroadcastPage} />
      <Route path="/admin/email" component={AdminEmailPage} />
      <Route path="/admin/cards" component={AdminCardsPage} />

      <Route component={NotFound} />
    </Switch>
    {user && <NotificationPermissionModal userId={user.id} />}
    {user && <InstallAppModal />}
    {user && <TelegramConnectPopup userId={user.id} />}
    </>
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
            <SonnerToaster position="top-center" richColors />
          </TooltipProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
