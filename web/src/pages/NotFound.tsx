import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Label, Section } from "../components/ui";

export default function NotFound() {
  return (
    <Section tone="sand">
      <div className="mx-auto max-w-xl py-16 text-center">
        <Compass className="mx-auto h-10 w-10 text-tawf-gold" aria-hidden />
        <Label>404</Label>
        <h1 className="mt-3 font-serif text-4xl">This page does not exist</h1>
        <p className="mt-4 text-tawf-muted">
          The protocol has four tools: the waqf pool, your dashboard, harvest, and the Nazir
          ledger.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link to="/" className="btn-primary">
            Back to home
          </Link>
          <Link to="/earn" className="btn-secondary">
            Open the app
          </Link>
        </div>
      </div>
    </Section>
  );
}
