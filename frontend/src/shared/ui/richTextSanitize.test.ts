import { describe, expect, it } from "vitest";

import { sanearRichText } from "./richTextSanitize";

describe("sanearRichText", () => {
  it("conserva las etiquetas de la lista blanca", () => {
    const html = "<p>Hola <strong>mundo</strong></p><ul><li>uno</li></ul>";
    expect(sanearRichText(html)).toBe(html);
  });

  it("traduce las etiquetas que produce execCommand", () => {
    expect(sanearRichText("<p><b>x</b> <i>y</i></p>")).toBe(
      "<p><strong>x</strong> <em>y</em></p>",
    );
  });

  it("desenvuelve las etiquetas no permitidas y conserva el texto", () => {
    expect(sanearRichText('<div><span style="color:red">texto</span></div>')).toBe(
      "<p>texto</p>",
    );
  });

  it("descarta scripts y href ejecutables", () => {
    expect(sanearRichText('<p>ok</p><script>alert(1)</script>')).toBe("<p>ok</p>");
    expect(sanearRichText('<a href="javascript:alert(1)">x</a>')).toBe(
      "<p><a>x</a></p>",
    );
  });

  it("mantiene los enlaces http y relativos", () => {
    expect(sanearRichText('<p><a href="https://x.com">x</a></p>')).toBe(
      '<p><a href="https://x.com">x</a></p>',
    );
  });

  it("envuelve el texto suelto en un párrafo y tira los bloques vacíos", () => {
    expect(sanearRichText("texto suelto<p></p>")).toBe("<p>texto suelto</p>");
  });
});
