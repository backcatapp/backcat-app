import Faq from "@/components/Faq";
import Features from "@/components/Features";
import FinalCta from "@/components/FinalCta";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Motion from "@/components/Motion";
import MoreFeatures from "@/components/MoreFeatures";
import Nav from "@/components/Nav";
import Numbers from "@/components/Numbers";
import Pricing from "@/components/Pricing";
import Quote from "@/components/Quote";
import Showcase from "@/components/Showcase";
import TrustStrip from "@/components/TrustStrip";

export default function Page() {
  return (
    <Motion>
      <Nav />
      <Hero />
      <TrustStrip />
      <Features />
      <Showcase />
      <HowItWorks />
      <MoreFeatures />
      <Numbers />
      <Quote />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </Motion>
  );
}
