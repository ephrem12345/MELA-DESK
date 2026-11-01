import type { Request } from "express";

export type Locale = "en" | "am";

const copy: Record<Locale, Record<string, string>> = {
  en: {
    ticketCreated: "Your support request has been created.",
    ticketAssigned: "A support request was assigned to you.",
    newReply: "There is a new reply on a support request.",
    statusChanged: "The support request status has changed.",
    ticketResolved: "Your support request has been resolved.",
    slaWarning: "A support request is approaching its service deadline.",
    slaBreach: "A support request has exceeded its service deadline.",
    resetSubject: "Reset your MELA DESK password",
    resetBody: "Use the secure link to reset your password. If you did not request this, ignore this message.",
  },
  am: {
    ticketCreated: "የድጋፍ ጥያቄዎ ተፈጥሯል።",
    ticketAssigned: "የድጋፍ ጥያቄ ለእርስዎ ተመድቧል።",
    newReply: "በድጋፍ ጥያቄ ላይ አዲስ ምላሽ አለ።",
    statusChanged: "የድጋፍ ጥያቄው ሁኔታ ተቀይሯል።",
    ticketResolved: "የድጋፍ ጥያቄዎ ተፈትቷል።",
    slaWarning: "የድጋፍ ጥያቄው የአገልግሎት ጊዜ ገደብ ሊደርስ ነው።",
    slaBreach: "የድጋፍ ጥያቄው የአገልግሎት ጊዜ ገደቡን አልፏል።",
    resetSubject: "የMELA DESK የይለፍ ቃልዎን ያድሱ",
    resetBody: "የይለፍ ቃልዎን ለማደስ ደህንነቱ የተጠበቀውን አገናኝ ይጠቀሙ። ይህን ካልጠየቁ መልዕክቱን ችላ ይበሉ።",
  },
};

export function resolveLocale(req: Request): Locale {
  const preferred = req.authUser?.locale;
  if (preferred) return preferred;
  const accept = req.header("accept-language")?.toLowerCase() ?? "";
  return accept.split(",").some((entry) => entry.trim().startsWith("am")) ? "am" : "en";
}

export function localized(locale: Locale, key: keyof typeof copy.en): string {
  return copy[locale][key] ?? copy.en[key];
}
