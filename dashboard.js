const API =
  "https://script.google.com/macros/s/AKfycbz-mwhaLXEjKsmxe-47_y-wFm6oq-rpGn9Gqe7UmyTZJ21tUW42fGn1bVQzZSzMq8cH/exec";

// =====================
// PARÁMETROS
// =====================
const params = new URLSearchParams(window.location.search);
const cliente  = params.get("cliente");
const anio     = params.get("anio");
const servicio = params.get("servicio");

let chart = null;

// =====================
// UI
// =====================
document.getElementById("detalle").innerText =
  `${cliente} · ${servicio} · ${anio}`;

document.getElementById("btnTrimestral").onclick = cargarDashboard;
document.getElementById("btnAnual").onclick = cargarAnalisisAnual;

window.onload = cargarDashboard;

// =====================
// HELPERS
// =====================
function normalizarPorcentaje(valor) {
  if (valor === 0) return 0;
  if (valor === null || valor === undefined) return 0;
  return Math.abs(valor) < 1
    ? Number((valor * 100).toFixed(2))
    : Number(valor.toFixed(2));
}

function obtenerTrimestre(periodo) {
  // "2024-T1" → "T1"
  const m = periodo?.match(/T[1-4]/);
  return m ? m[0] : periodo;
}
function extraerTrimestre(periodo) {
  // "2024-T1" → "T1"
  return periodo.split("-")[1];
} 


function activar(id) {
  document.getElementById("btnTrimestral").classList.remove("activo");
  document.getElementById("btnAnual").classList.remove("activo");
  document.getElementById(id).classList.add("activo");
}

// =====================
// DASHBOARD TRIMESTRAL
// =====================
async function cargarDashboard() {

  activar("btnTrimestral");

  const [histRes, inflRes] = await Promise.all([
    fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r => r.json()),
    fetch(`${API}?action=inflacion_trimestral&año=${anio}`).then(r => r.json())
  ]);

  const historial = histRes.historial || [];
  const inflacion = inflRes.inflacion || [];

  if (!historial.length) {
    alert("No hay datos trimestrales");
    return;
  }

  // ----- MAPA DE INFLACIÓN -----
   const mapaInflacion = {};
inflacion.forEach(i => {
  mapaInflacion[i.periodo] = normalizarPorcentaje(i.inflacion);
});

historial.forEach(h => {

  const trimestre = obtenerTrimestre(h.periodo);

  h.variacion = normalizarPorcentaje(h.variacion);
  h.inflacion = normalizarPorcentaje(mapaInflacion[trimestre]);

  h.brecha = Number((h.variacion - h.inflacion).toFixed(2));
});


  // ----- CALCULO KPIs -----
  historial.forEach(h => {
    h.promedio  = Number(h.promedio ?? 0);
    h.variacion = Number(h.variacion ?? 0);

    const t = extraerTrimestre(h.periodo);
    h.inflacion = mapaInflacion[t] ?? 0;
    h.brecha = Number((h.variacion - h.inflacion).toFixed(2));
  });

  const u = historial.at(-1);

  renderKPIs([
    {
      titulo: "Tarifa actual",
      valor: `$ ${u.promedio.toLocaleString("es-AR")}`,
      color: "verde"
    },
    {
      titulo: "Variación trimestre",
      valor: `${u.variacion > 0 ? "+" : ""}${u.variacion}%`,
      color: u.brecha >= 0 ? "verde" : "rojo"
    },
    {
      titulo: "Inflación trimestre",
      valor: `${u.inflacion.toFixed(2)}%`,
      color: "amarillo"
    },
    {
      titulo: "Brecha",
      valor: `${u.brecha > 0 ? "+" : ""}${u.brecha}%`,
      color: u.brecha >= 0 ? "verde" : "rojo"
    }
  ]);

  renderGrafico(historial);
}

// =====================
// ANÁLISIS ANUAL
// =====================
async function cargarAnalisisAnual() {

  activar("btnAnual");

  const res = await fetch(
    `${API}?action=analisis_anual&cliente=${cliente}&año=${anio}&servicio=${servicio}`
  );
  const d = await res.json();

  d.tarifa_enero     = Number(d.tarifa_enero ?? 0);
  d.tarifa_diciembre = Number(d.tarifa_diciembre ?? 0);
  d.variacion_anual  = Number(d.variacion_anual ?? 0);

  d.inflacion_anual =
    Math.abs(d.inflacion_anual) < 1
      ? Number((d.inflacion_anual * 100).toFixed(2))
      : Number(d.inflacion_anual ?? 0);

  d.brecha_anual = Number((d.variacion_anual - d.inflacion_anual).toFixed(2));

  renderKPIs([
    { titulo: "Tarifa Enero",     valor: `$ ${d.tarifa_enero.toLocaleString("es-AR")}`, color: "verde" },
    { titulo: "Tarifa Diciembre", valor: `$ ${d.tarifa_diciembre.toLocaleString("es-AR")}`, color: "verde" },
    { titulo: "Variación anual",  valor: `${d.variacion_anual.toFixed(2)}%`, color: "amarillo" },
    { titulo: "Inflación anual",  valor: `${d.inflacion_anual.toFixed(2)}%`, color: "amarillo" },
    { titulo: "Brecha anual",     valor: `${d.brecha_anual.toFixed(2)}%`, color: d.brecha_anual >= 0 ? "verde" : "rojo" }
  ]);

  renderGraficoAnual(d);
}

// =====================
// KPIs
// =====================
function renderKPIs(kpis) {
  const c = document.getElementById("kpis");
  c.innerHTML = "";
  kpis.forEach(k => {
    c.innerHTML += `
      <div class="kpi ${k.color}">
        <small>${k.titulo}</small>
        <h2>${k.valor}</h2>
      </div>`;
  });
}

// =====================
// GRÁFICOS
// =====================
function renderGrafico(hist) {

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("grafico"), {
    type: "line",
    data: {
      labels: hist.map(h => h.periodo),
      datasets: [
        {
          label: "Variación %",
          data: hist.map(h => h.variacion),
          borderColor: "#ff7a18",
          tension: .3
        },
        {
          label: "Inflación %",
          data: hist.map(h => h.inflacion),
          borderColor: "#4dd0e1",
          borderDash: [6,6],
          tension: .3
        }
      ]
    }
  });
}

function renderGraficoAnual(d) {

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("grafico"), {
    type: "bar",
    data: {
      labels: ["Variación tarifa", "Inflación"],
      datasets: [{
        label: "Comparación anual %",
        data: [d.variacion_anual, d.inflacion_anual],
        backgroundColor: ["#ff7a18", "#4dd0e1"]
      }]
    }
  });
}
