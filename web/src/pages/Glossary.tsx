import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen } from "lucide-react";
import { Card, Label, PageHeader, Section } from "../components/ui";
import { fadeUp } from "../lib/motion";
import { glossaryList } from "../lib/glossary";

/// Every Islamic-finance term this interface uses, defined in one place.
///
/// The vocabulary is kept rather than translated away, because "perpetual endowment" is an
/// approximation of waqf mu'abbad rather than a synonym for it. Keeping the word means owing the
/// reader its meaning, which is what this page is for.
export default function Glossary() {
  const terms = glossaryList();

  return (
    <Section tone="sand">
      <PageHeader
        eyebrow="Glossary"
        title="The words on this site"
        lead="Islamic finance has precise vocabulary, and this protocol depends on the distinctions it draws. Nothing here assumes you already know any of it."
        aside={
          <div className="text-right">
            <Label>Terms Defined</Label>
            <p className="tnum mt-2 font-serif text-3xl text-tawf-green">{terms.length}</p>
          </div>
        }
      />

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {terms.map((t, i) => (
          <motion.div
            key={t.key}
            {...fadeUp}
            transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.05 }}
          >
            <Card id={t.key} className="flex h-full scroll-mt-24 flex-col">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-serif text-2xl text-tawf-green">{t.term}</h2>
                {t.pronunciation && (
                  <span className="text-sm italic text-tawf-gold">/{t.pronunciation}/</span>
                )}
              </div>

              <p className="mt-4 flex-1 text-tawf-muted">{t.definition}</p>

              {t.context && (
                <p className="mt-4 rounded-2xl bg-tawf-sand/60 p-4 text-sm text-tawf-muted">
                  <span className="font-medium text-tawf-green">Here: </span>
                  {t.context}
                </p>
              )}

              {t.related && t.related.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-tawf-green/10 pt-4">
                  <span className="text-xs uppercase tracking-widest text-tawf-gold">Related</span>
                  {t.related.map((key) => {
                    const label = terms.find((x) => x.key === key)?.term;
                    return label ? (
                      <a
                        key={key}
                        href={`#${key}`}
                        className="rounded-full bg-tawf-green/5 px-3 py-1 text-sm text-tawf-green transition-colors hover:bg-tawf-green/10"
                      >
                        {label}
                      </a>
                    ) : null;
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-tawf-green/10 bg-white p-8">
        <div className="flex items-start gap-4">
          <BookOpen className="mt-1 h-6 w-6 shrink-0 text-tawf-gold" aria-hidden />
          <div>
            <h2 className="font-serif text-xl text-tawf-green">Looking for a word that is not here?</h2>
            <p className="mt-2 text-tawf-muted">
              This list covers only what this app uses. The Foundation keeps the full dictionary,
              including zakat, sadaqah, qardhul hasan and the eight asnaf categories.
            </p>
            <a
              href="https://tawf.foundation/glossary"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-flex items-center gap-2 text-sm text-tawf-green transition-colors hover:text-tawf-gold"
            >
              Full glossary at tawf.foundation
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Link to="/earn" className="btn-primary">
          Back to the waqf pool
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Section>
  );
}
