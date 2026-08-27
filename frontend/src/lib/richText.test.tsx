/** El render del texto enriquecido sin TipTap.
 *
 *  La mitad de estos tests son de seguridad: al dejar de montar TipTap en modo
 *  lectura, la lista blanca de este módulo pasa a ser lo ÚNICO que separa el
 *  HTML guardado del DOM del estudiante. Si alguien introdujera HTML fuera del
 *  esquema —por un pegado, por un import, por un bug del Studio— tiene que
 *  quedarse fuera aquí.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RichTextView } from "./richText";

describe("RichTextView · esquema permitido", () => {
  it("renderiza párrafos, negrita, cursiva y código", () => {
    const { container } = render(
      <RichTextView html="<p>Hola <strong>fuerte</strong> y <em>suave</em> con <code>codigo</code></p>" />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("fuerte");
    expect(container.querySelector("em")?.textContent).toBe("suave");
    expect(container.querySelector("code")?.textContent).toBe("codigo");
  });

  it("renderiza listas con sus elementos", () => {
    const { container } = render(
      <RichTextView html="<ul><li>uno</li><li>dos</li></ul><ol><li>primero</li></ol>" />,
    );
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(1);
  });

  it("normaliza <b> e <i>, que es lo que produce un pegado", () => {
    const { container } = render(<RichTextView html="<p><b>negrita</b> <i>cursiva</i></p>" />);
    expect(container.querySelector("strong")?.textContent).toBe("negrita");
    expect(container.querySelector("em")?.textContent).toBe("cursiva");
  });

  it("renderiza el salto de línea sin hijos", () => {
    const { container } = render(<RichTextView html="<p>una<br>otra</p>" />);
    expect(container.querySelectorAll("br")).toHaveLength(1);
  });

  it("no pinta nada con contenido vacío", () => {
    const { container } = render(<RichTextView html="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("RichTextView · lo que NO debe pasar", () => {
  it("descarta <script> entero, contenido incluido", () => {
    const { container } = render(
      <RichTextView html={'<p>antes</p><script>window.robado = 1</script><p>despues</p>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("robado");
    expect(container.textContent).toContain("antes");
    expect(container.textContent).toContain("despues");
  });

  it("no copia manejadores de eventos", () => {
    const { container } = render(
      <RichTextView html={'<p onclick="alert(1)" onmouseover="alert(2)">texto</p>'} />,
    );
    const p = container.querySelector("p");
    expect(p?.getAttribute("onclick")).toBeNull();
    expect(p?.getAttribute("onmouseover")).toBeNull();
    expect(p?.textContent).toBe("texto");
  });

  it("rechaza un enlace javascript: pero conserva su texto", () => {
    const { container } = render(
      <RichTextView html={'<p><a href="javascript:alert(1)">pincha</a></p>'} />,
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("pincha");
  });

  it("rechaza un enlace data:", () => {
    const { container } = render(
      <RichTextView html={'<p><a href="data:text/html,<script>alert(1)</script>">x</a></p>'} />,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("acepta http, https y mailto, y los abre de forma segura", () => {
    const { container } = render(
      <RichTextView
        html={'<p><a href="https://imaquina.example.com">web</a> <a href="mailto:a@b.com">correo</a></p>'}
      />,
    );
    const enlaces = container.querySelectorAll("a");
    expect(enlaces).toHaveLength(2);
    expect(enlaces[0].getAttribute("rel")).toBe("noopener noreferrer");
    expect(enlaces[0].getAttribute("href")).toBe("https://imaquina.example.com");
  });

  it("descarta <iframe> y <img> pero conserva el texto alrededor", () => {
    const { container } = render(
      <RichTextView html={'<p>a<iframe src="https://malo"></iframe><img src=x onerror="alert(1)">b</p>'} />,
    );
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("a");
    expect(container.textContent).toContain("b");
  });

  it("no deja pasar encabezados ni citas, que el esquema excluye", () => {
    const { container } = render(
      <RichTextView html="<h1>titular</h1><blockquote>cita</blockquote>" />,
    );
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("blockquote")).toBeNull();
    // El texto se conserva: perder contenido del cliente sería peor.
    expect(container.textContent).toContain("titular");
    expect(container.textContent).toContain("cita");
  });
});
