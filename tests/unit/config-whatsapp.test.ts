import { describe, expect, it } from "vitest";
import { WHATSAPP_NUMERO, WHATSAPP_URL } from "@/lib/config";

describe("WhatsApp de la cooperativa (M-01, QA de producción 25-sep)", () => {
  it("se muestra con espacios y enlaza a wa.me con +57", () => {
    expect(WHATSAPP_NUMERO).toBe("311 724 1942");
    expect(WHATSAPP_URL).toBe("https://wa.me/573117241942");
  });
});
