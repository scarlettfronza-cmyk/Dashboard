import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import ManagerLogin from "./pages/ManagerLogin";
import ManagerDashboard from "./pages/ManagerDashboard";
import ManagerClientSettings from "./pages/ManagerClientSettings";
import ManagerSettings from "./pages/ManagerSettings";
import ManagerIntelligence from "./pages/ManagerIntelligence";
import ManagerCreativeAnalyst from "./pages/ManagerCreativeAnalyst";
import ManagerCreativeAgent from "./pages/ManagerCreativeAgent";
import ManagerCreativeVisuals from "./pages/ManagerCreativeVisuals";
import ManagerBeforeAfterStudio from "./pages/ManagerBeforeAfterStudio";
import ManagerCampaignAgent from "./pages/ManagerCampaignAgent";
import PublicClientReport from "./pages/PublicClientReport";
import CRMPage from "./pages/CRM";
import { getManagerEntryPath } from "./lib/managerSession";

function ManagerEntry() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const hasManagerToken = Boolean(localStorage.getItem("manager_token"));
    navigate(getManagerEntryPath(hasManagerToken), { replace: true });
  }, [navigate]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/settings" component={Settings} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/manager" component={ManagerEntry} />
      <Route path="/manager/login" component={ManagerLogin} />
      <Route path="/manager/dashboard" component={ManagerDashboard} />
      <Route path="/manager/settings" component={ManagerSettings} />
      <Route path="/manager/intelligence" component={ManagerIntelligence} />
      <Route path="/manager/creative-analyst" component={ManagerCreativeAnalyst} />
      <Route path="/manager/creative-agent" component={ManagerCreativeAgent} />
      <Route path="/manager/creative-visuals" component={ManagerCreativeVisuals} />
      <Route path="/manager/before-after" component={ManagerBeforeAfterStudio} />
      <Route path="/manager/campaign-agent" component={ManagerCampaignAgent} />
      <Route path="/manager/client/:id" component={ManagerClientSettings} />
      <Route path="/r/:token" component={PublicClientReport} />
      <Route path="/crm" component={CRMPage} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={true}>
        <TooltipProvider>
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: 'oklch(0.12 0.006 20)',
                border: '1px solid oklch(0.55 0.22 25 / 0.30)',
                color: 'oklch(0.95 0.005 60)',
                fontFamily: "'Inter', sans-serif",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
