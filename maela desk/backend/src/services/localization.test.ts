import { describe, expect, it } from "vitest";
import { localized, resolveLocale } from "./localization.js";

describe("backend locale resolution", () => {
  it("uses an authenticated user's preference first", () => {
    const request = { authUser: { locale: "am" }, header: () => "en-US,en;q=0.9" } as never;
    expect(resolveLocale(request)).toBe("am");
  });

  it("accepts Amharic from the language header", () => {
    const request = { authUser: undefined, header: () => "am-ET,am;q=0.9,en;q=0.5" } as never;
    expect(resolveLocale(request)).toBe("am");
  });

  it("falls back to English", () => {
    const request = { authUser: undefined, header: () => "fr-FR,fr;q=0.9" } as never;
    expect(resolveLocale(request)).toBe("en");
  });

  it("uses the selected translation and an English fallback", () => {
    expect(localized("am", "ticketCreated")).toBe("የድጋፍ ጥያቄዎ ተፈጥሯል።");
    expect(localized("en", "ticketCreated")).toBe("Your support request has been created.");
  });
});
