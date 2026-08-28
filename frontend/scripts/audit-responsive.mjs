/** Auditoría de desborde horizontal en anchos reales.
 *
 *  Los tests corren en jsdom, que NO calcula layout: un elemento que se sale de
 *  la pantalla en 390px pasa toda la suite de vitest. Esto conduce un Chrome de
 *  verdad por CDP y mide `scrollWidth` contra `clientWidth`, señalando el
 *  elemento más externo que se sale.
 *
 *  Así se encontró el desborde de la cabecera del proyecto anterior: medía
 *  574px en un viewport de 390 y arrastraba a scroll horizontal la página
 *  entera.
 *
 *  No entra en `npm run build` a propósito: necesita la app levantada, así que
 *  es herramienta de revisión y no un guard de CI.
 *
 *  Uso:
 *    npm run dev                                              # en otra terminal
 *    google-chrome --headless=new --remote-debugging-port=9222 about:blank &
 *    node scripts/audit-responsive.mjs /login /ruta-inexistente
 *
 *  Variables: CDP_HOST, APP_URL, THEME (light|dark).
 */
const CDP_HOST = process.env.CDP_HOST ?? "http://127.0.0.1:9222";
const APP = process.env.APP_URL ?? "http://localhost:5173";
const THEME = process.env.THEME ?? "light";

const ANCHOS = [
  { nombre: "movil", width: 390, height: 844, dpr: 2, mobile: true },
  { nombre: "tablet", width: 768, height: 1024, dpr: 2, mobile: true },
  { nombre: "escritorio", width: 1440, height: 900, dpr: 1, mobile: false },
];

const rutas = process.argv.slice(2);
if (rutas.length === 0) {
  console.error("uso: node scripts/audit-responsive.mjs <ruta> [<ruta>...]");
  process.exit(2);
}

const targets = await (await fetch(`${CDP_HOST}/json/list`)).json();
const page = targets.find((t) => t.type === "page");
if (!page) {
  console.error(`sin pestaña en ${CDP_HOST}: ¿arrancaste Chrome con --remote-debugging-port=9222?`);
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pendientes = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pendientes.has(m.id)) {
    pendientes.get(m.id)(m.result);
    pendientes.delete(m.id);
  }
};
const cdp = (method, params = {}) =>
  new Promise((res) => {
    const mid = ++id;
    pendientes.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-color-scheme", value: THEME }],
});

const MEDIDA = `
  (() => {
    const limite = document.documentElement.clientWidth;
    const culpables = [];
    for (const el of document.querySelectorAll("*")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > limite + 1 || b.width > limite + 1) {
        // Sólo el más externo de cada rama: si el padre también se sale, el
        // culpable es el padre.
        const pb = el.parentElement?.getBoundingClientRect();
        if (pb && (pb.right > limite + 1 || pb.width > limite + 1)) continue;
        culpables.push(
          el.tagName.toLowerCase() + "." +
          (el.getAttribute("class") ?? "").slice(0, 70) +
          " (" + Math.round(b.width) + "px)",
        );
      }
    }
    return JSON.stringify({
      scroll: document.documentElement.scrollWidth,
      limite,
      culpables: culpables.slice(0, 5),
    });
  })()`;

let fallos = 0;
for (const ruta of rutas) {
  for (const a of ANCHOS) {
    await cdp("Emulation.setDeviceMetricsOverride", {
      width: a.width,
      height: a.height,
      deviceScaleFactor: a.dpr,
      mobile: a.mobile,
    });
    await cdp("Page.navigate", { url: `${APP}${ruta}` });
    await espera(2200);
    const r = await cdp("Runtime.evaluate", { expression: MEDIDA, returnByValue: true });
    const m = JSON.parse(r.result.value);

    // Un contenedor con overflow-x propio (una tabla ancha) es válido: lo que
    // no puede pasar es que el DOCUMENTO scrollee en horizontal.
    const desborda = m.scroll > m.limite + 1;
    if (desborda) fallos++;
    console.log(
      `${ruta.padEnd(28)} ${a.nombre.padEnd(11)} ${String(a.width).padStart(4)}px  ` +
        (desborda ? `DESBORDA (${m.scroll}px) -> ${m.culpables.join(" | ")}` : "ok"),
    );
  }
}
ws.close();
process.exit(fallos > 0 ? 1 : 0);
