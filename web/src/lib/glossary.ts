/// The Islamic-finance vocabulary this app actually uses, defined in plain English.
///
/// Scoped deliberately: only terms that appear somewhere in this interface. The full dictionary
/// lives at tawf.foundation/glossary and this file does not try to mirror it, because a copy that
/// drifts is worse than a short list that is correct.
///
/// The terms are kept rather than translated away. "Perpetual endowment" is not a synonym for waqf
/// mu'abbad, it is an approximation, and a waqif signing an akad deserves the real word with the
/// meaning attached.

export interface GlossaryTerm {
  /** How it is written in the interface. */
  term: string;
  /** Rough English pronunciation, for a reader meeting the word for the first time. */
  pronunciation?: string;
  /** One or two sentences, no prior knowledge assumed. */
  definition: string;
  /** What it means specifically here, where that differs from the general sense. */
  context?: string;
  related?: string[];
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  waqf: {
    term: "Waqf",
    pronunciation: "wah-kf",
    definition:
      "An Islamic endowment. Capital is dedicated to a charitable purpose, the capital itself is preserved rather than spent, and only the benefit it produces is given away.",
    context:
      "This app applies that structure to money rather than to land or buildings, which is what makes it possible at retail sizes.",
    related: ["waqf-muabbad", "waqf-muaqqat", "waqif", "nazir"],
  },
  "waqf-muabbad": {
    term: "Waqf mu'abbad",
    pronunciation: "wah-kf moo-ab-bad",
    definition:
      "Perpetual waqf, the classical form. The capital is given permanently and never returned to the giver. It is held in perpetuity and only its yield is distributed.",
    context:
      "Enforced by the contract, not by this interface. A perpetual position has no withdrawal function at all, for you, for the Nazir, or for the contract owner.",
    related: ["waqf", "waqf-muaqqat"],
  },
  "waqf-muaqqat": {
    term: "Waqf mu'aqqat",
    pronunciation: "wah-kf moo-ah-kat",
    definition:
      "Temporary waqf. Capital is dedicated for a fixed term, and the original amount returns to the giver once that term ends.",
    context:
      "Offered here alongside the perpetual akad, for anyone who may need the capital back.",
    related: ["waqf", "waqf-muabbad"],
  },
  waqif: {
    term: "Waqif",
    pronunciation: "wah-kif",
    definition: "The person who creates a waqf: the giver who dedicates the capital.",
    context: "You, when you deposit.",
    related: ["waqf", "nazir"],
  },
  nazir: {
    term: "Nazir",
    pronunciation: "nah-zir",
    definition:
      "The trustee of a waqf, responsible for administering the endowed assets and directing the benefit they produce to the intended recipients.",
    context:
      "The Nazir's wallet receives stripped yield directly from the contract. No intermediary can intercept it.",
    related: ["waqf", "waqif"],
  },
  akad: {
    term: "Akad",
    pronunciation: "ah-kad",
    definition:
      "The contract or agreement itself, in the sense of the terms both sides consent to. Which akad applies determines what may and may not happen to the capital.",
    context:
      "Every deposit mints a certificate recording which akad was signed, and the two akad carry different wording because they make different promises.",
    related: ["wakalah-bil-istithmar", "waqf-muabbad", "waqf-muaqqat"],
  },
  "wakalah-bil-istithmar": {
    term: "Wakalah bil istithmar",
    pronunciation: "wa-kah-lah bil is-tith-mar",
    definition:
      "An agency contract for investment. The owner of the capital appoints an agent to invest it on their behalf, under agreed terms, rather than lending it at interest.",
    context: "The akad under which this vault invests deposits across the staking basket.",
    related: ["akad", "riba"],
  },
  "hifzul-mal": {
    term: "Hifzul mal",
    pronunciation: "hif-zul mahl",
    definition:
      "Preservation of wealth: one of the higher objectives of Islamic law, which treats protecting people's property as an end the law exists to serve.",
    context:
      "The reason only surplus above the corpus plus a buffer may ever leave the vault.",
  },
  "baitul-maal": {
    term: "Baitul Maal",
    pronunciation: "bah-yool ma-al",
    definition:
      "The historical Islamic community treasury, which collected, held and distributed communal wealth for public welfare. Something between a foundation, a charity and a community bank.",
    context: "What this protocol is a small, verifiable piece of.",
  },
  shariah: {
    term: "Shariah",
    pronunciation: "sha-ree-ah",
    definition:
      "Islamic law, derived from the Qur'an and the Sunnah. In finance it sets what a contract may contain, notably prohibiting interest, excessive uncertainty and gambling.",
    related: ["riba", "fiqh"],
  },
  riba: {
    term: "Riba",
    pronunciation: "ree-bah",
    definition:
      "Interest or usury, prohibited in Islamic law. It is why returns here come from a share in real invested assets rather than from lending money at a rate.",
    related: ["shariah", "wakalah-bil-istithmar"],
  },
  fiqh: {
    term: "Fiqh",
    pronunciation: "fikh",
    definition:
      "Islamic jurisprudence: the scholarly work of deriving practical rulings from the sources of Shariah. Where the distinction between the two waqf types comes from.",
    related: ["shariah"],
  },
};

export const glossaryList = (): Array<GlossaryTerm & { key: string }> =>
  Object.entries(GLOSSARY)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.term.localeCompare(b.term));

export const getTerm = (key: string): GlossaryTerm | undefined => GLOSSARY[key];
