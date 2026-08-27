/** Auditoría de desborde horizontal en anchos reales (I3).
 *
 *  Los tests de vitest corren en jsdom, que NO calcula layout: un elemento que
 *  se sale de la pantalla en 390px pasa todos los tests. Esto conduce un
 *  Chrome de verdad por CDP y mide `scrollWidth` contra `clientWidth` en cada
 *  ancho, señalando el elemento más externo que se sale.
 *
 *  Así se encontró el desborde de `AppHeader`: la cabecera medía 574px en un
 *  viewport de 390 y arrastraba a scroll horizontal TODA página autenticada.
 *
 *  No es parte de `npm run build` a propósito: necesita la app y la API
 *  levantadas, así que es una herramienta de revisión, no un guard de CI.
 *
 *  Uso:
 *    make up && make migrate && make seed && make api    # en otra terminal
 *    npm run dev                                          # en otra terminal
 *    google-chrome --headless=new --remote-debugging-port=9222 about:blank &
 *    node scripts/audit-responsive.mjs <email> <password> <ruta> [<ruta>...]
 */
const CDP_HOST = process.env.CDP_HOST ?? "http://127.0.0.1:9222";
const APP = process.env.APP_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:8000/api/v1";

const ANCHOS = [
  { nombre: "movil", width: 390, height: 844, dpr: 2, mobile: true },
  { nombre: "tablet", width: 768, height: 1024, dpr: 2, mobile: true },
  { nombre: "escritorio", width: 1280, height: 900, dpr: 1, mobile: false },
];

const [email, password, ...rutas] = process.argv.slice(2);
if (!email || !password || rutas.length === 0) {
  console.error("uso: node scripts/audit-responsive.mjs <email> <password> <ruta>...");
  process.exit(2);
}

const login = await (
  await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
).json();
if (!login.access_token) {
  console.error("login fallido:", JSON.stringify(login));
  process.exit(1);
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

// El origen tiene que existir antes de poder escribir en su localStorage.
await cdp("Page.navigate", { url: APP });
await espera(1500);
await cdp("Runtime.evaluate", {
  expression: `
    localStorage.setItem("access_token", ${JSON.stringify(login.access_token)});
    localStorage.setItem("refresh_token", ${JSON.stringify(login.refresh_token)});
    localStorage.setItem("session", JSON.stringify({ role: ${JSON.stringify(login.role)}, lang: ${JSON.stringify(login.lang)} }));
  `,
});

const MEDIDA = `
  (() => {
    const limite = document.documentElement.clientWidth;
    const culpables = [];
    for (const el of document.querySelectorAll("*")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0) continue;
      if (b.right > limite + 1 || b.width > limite + 1) {
        // Sólo el elemento más externo de cada rama: si el padre también se
        // sale, el culpable es el padre.
        const pb = el.parentElement?.getBoundingClientRect();
        if (pb && (pb.right > limite + 1 || pb.width > limite + 1)) continue;
        culpables.push(
          el.tagName.toLowerCase() +
            "." + (el.getAttribute("class") ?? "").slice(0, 70) +
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

    // Un contenedor con overflow-x propio (una tabla ancha, p.ej.) es válido:
    // lo que no puede pasar es que el DOCUMENTO scrollee en horizontal.
    const desborda = m.scroll > m.limite + 1;
    if (desborda) fallos++;
    console.log(
      `${ruta.padEnd(46)} ${a.nombre.padEnd(11)} ${String(a.width).padStart(4)}px  ` +
        (desborda ? `DESBORDA (${m.scroll}px) -> ${m.culpables.join(" | ")}` : "ok"),
    );
  }
}
ws.close();
process.exit(fallos > 0 ? 1 : 0);
