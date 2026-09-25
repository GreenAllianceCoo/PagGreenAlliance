import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { escaparVariables } from "@/lib/correo/resend";

describe("escaparVariables (S-15)", () => {
  it("escapa HTML en los textos que van a {{{VAR}}}", () => {
    const r = escaparVariables({
      NOMBRE: '<a href="https://falso.co">Verifica tu Nequi</a>',
      MOTIVO: "Tope & cupo 'agotado'",
    });
    expect(r.NOMBRE).toBe("&lt;a href=&quot;https://falso.co&quot;&gt;Verifica tu Nequi&lt;/a&gt;");
    expect(r.MOTIVO).toBe("Tope &amp; cupo &#39;agotado&#39;");
  });

  it("deja igual los textos normales, las tildes y los números", () => {
    expect(escaparVariables({ NOMBRE: "José Peña", MONTO: "1.500.000", N: 7 })).toEqual({
      NOMBRE: "José Peña",
      MONTO: "1.500.000",
      N: 7,
    });
  });
});
