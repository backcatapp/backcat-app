import ExtEarlyAccess from "@/components/ExtEarlyAccess";
import ExtFaq from "@/components/ExtFaq";
import ExtHero from "@/components/ExtHero";
import ExtHow from "@/components/ExtHow";
import ExtPricing from "@/components/ExtPricing";
import ExtTrust from "@/components/ExtTrust";
import Footer from "@/components/Footer";
import Motion from "@/components/Motion";
import Nav from "@/components/Nav";

export default function Page() {
  return (
    <Motion>
      <div className="ext-page">
        <Nav />
        <ExtHero />
        <ExtHow />
        <ExtTrust />
        <ExtPricing />
        <ExtFaq />
        <ExtEarlyAccess />
        <Footer />
      </div>
    </Motion>
  );
}
