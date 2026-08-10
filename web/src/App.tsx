import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import Earn from "./pages/Earn";
import Dashboard from "./pages/Dashboard";
import Harvest from "./pages/Harvest";
import Nazir from "./pages/Nazir";
import Glossary from "./pages/Glossary";
import NotFound from "./pages/NotFound";

/// React Router restores neither scroll position nor hash targets on its own. Without this,
/// navigating from the app back to `/#risks` lands you at whatever offset the previous page was
/// scrolled to, pointed at nothing.
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    // The target section may not be mounted on the frame the route changes, so try after paint.
    const id = hash.slice(1);
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <Layout>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/earn" element={<Earn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/harvest" element={<Harvest />} />
        <Route path="/nazir" element={<Nazir />} />
        <Route path="/glossary" element={<Glossary />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
