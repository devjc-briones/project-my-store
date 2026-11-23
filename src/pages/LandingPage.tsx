import { LandingNavbar } from '../components/landing/LandingNavbar';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { TemplatesShowcaseSection } from '../components/landing/TemplatesShowcaseSection';
import { FeaturesSection } from '../components/landing/FeaturesSection';
import { PricingAndCtaSection } from '../components/landing/PricingAndCtaSection';
import { LandingFooter } from '../components/landing/LandingFooter';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <HowItWorksSection />
        <TemplatesShowcaseSection />
        <FeaturesSection />
        <PricingAndCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
