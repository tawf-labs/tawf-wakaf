import HeroSection from "../landing/HeroSection";
import AkadSection from "../landing/AkadSection";
import PillarsSection from "../landing/PillarsSection";
import StepsSection from "../landing/StepsSection";
import RiskSection from "../landing/RiskSection";
import CtaSection from "../landing/CtaSection";

/// The landing page is one wrapper and six sections. The `data-landing` attribute is what scopes
/// the foundation palette to this page: everything inside it reads the tokens re-pointed in
/// styles/index.css, and nothing outside it does.
export default function Landing() {
  return (
    <div data-landing className="bg-tawf-sand">
      <HeroSection />
      <AkadSection />
      <PillarsSection />
      <StepsSection />
      <RiskSection />
      <CtaSection />
    </div>
  );
}
