import { Hero } from "@/components/landing/Hero";
import { Logos } from "@/components/landing/Logos";
import { OfferSection } from "@/components/landing/OfferSection";
import { NumbersSection } from "@/components/landing/NumbersSection";
import { UseCases } from "@/components/landing/UseCases";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { CTA } from "@/components/landing/CTA";
import { Pricing } from "@/components/landing/Pricing";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Hero />
      <Logos />
      <OfferSection />
      <NumbersSection />
      <UseCases />
      <Testimonials />
      <FAQ />
      <Pricing />
      <CTA />
    </div>
  );
}
