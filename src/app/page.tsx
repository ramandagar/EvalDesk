import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { MatrixBackground } from "@/components/landing/MatrixBackground";
import { Hero } from "@/components/landing/Hero";
import { Logos } from "@/components/landing/Logos";
import { OfferSection } from "@/components/landing/OfferSection";
import { NumbersSection } from "@/components/landing/NumbersSection";
import { UseCases } from "@/components/landing/UseCases";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Pricing } from "@/components/landing/Pricing";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <MatrixBackground />
      <div className="relative z-10">
        <LandingNavbar />
        <Hero />
        <Logos />
        <OfferSection />
        <NumbersSection />
        <UseCases />
        <Testimonials />
        <FAQ />
        <Pricing />
        <CTA />
        <LandingFooter />
      </div>
    </div>
  );
}
