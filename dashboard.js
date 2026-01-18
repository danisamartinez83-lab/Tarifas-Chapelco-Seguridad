const API = "https://script.google.com/macros/s/AKfycbz-mwhaLXEjKsmxe-47_y-wFm6oq-rpGn9Gqe7UmyTZJ21tUW42fGn1bVQzZSzMq8cH/exec";

const params = new URLSearchParams(window.location.search);
const cliente  = params.get("cliente");
const anio     = params.get("anio");
const servicio = params.get("servicio");

let chart = null;

document.getElementById("detalle").innerText =
  `${cliente} · ${servicio} · ${anio}`;

document.getElementById("btnTrimestral").onclick = cargarDashboard;
document.getElementById("btnAnual").onclick = cargarAnalisisAnual;

window.onload = cargarDashboard;

// =====================
// DASHBOARD TRIMESTRAL
// =====================
async function cargarDashboard() {

  activar("btnTrimestral");

  const [histRes, inflRes] = await Promise.all([
    fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r=>r.json()),
    fetch(`${API}?action=inflacion_trimestral&año=${anio}`).then(r=>r.json())
  ]);

  const historial = histRes.historial || [];
  const inflacion = inflRes.inflacion || [];

  if (!historial.length) {
    alert("No hay datos trimestrales");
    return;
  }

  const mapa = {};
  inflacion.forEach(i => mapa[i.periodo] = i.inflacion);

  historial.forEach(h => {
    const ipcRaw = mapa[h.periodo] ?? 0;

    h.inflacion = Math.abs(ipcRaw) < 1 ? ipcRaw * 100 : ipcRaw;
    h.brecha = Number((h.variacion - h.inflacion).toFixed(2));
  });

  const u = historial.at(-1);

  renderKPIs([
    { titulo: "Tarifa actual", valor: `$ ${u.promedio.toLocaleString("es-AR")}`, color:"verde" },
    { titulo: "Variación trimestre", valor: `${u.variacion}%`, color: u.brecha>=0?"verde":"rojo" },
    { titulo: "Inflación trimestre", valor: `${u.inflacion.toFixed(2)}%`, color:"amarillo" },
    { titulo: "Brecha", valor: `${u.brecha > 0 ? "+" : ""}${u.brecha}%`, color: u.brecha>=0?"verde":"rojo" }
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

  // 🔒 blindaje total
  d.tarifa_enero     = Number(d.tarifa_enero ?? 0);
  d.tarifa_diciembre = Number(d.tarifa_diciembre ?? 0);
  d.variacion_anual  = Number(d.variacion_anual ?? 0);
  d.inflacion_anual  = Number(d.inflacion_anual ?? 0);
  d.brecha_anual     = Number(d.brecha_anual ?? 0);

  renderKPIs([
    { titulo:"Tarifa Enero", valor:`$ ${d.tarifa_enero.toLocaleString("es-AR")}`, color:"verde" },
    { titulo:"Tarifa Diciembre", valor:`$ ${d.tarifa_diciembre.toLocaleString("es-AR")}`, color:"verde" },
    { titulo:"Variación anual", valor:`${d.variacion_anual.toFixed(2)}%`, color:"amarillo" },
    { titulo:"Inflación anual", valor:`${d.inflacion_anual.toFixed(2)}%`, color:"amarillo" },
    { titulo:"Brecha anual", valor:`${d.brecha_anual.toFixed(2)}%`, color:d.brecha_anual>=0?"verde":"rojo" }
  ]);

  if (chart) chart.destroy();
}

// =====================
function renderKPIs(kpis) {
  const c = document.getElementById("kpis");
  c.innerHTML = "";
  kpis.forEach(k=>{
    c.innerHTML += `
      <div class="kpi ${k.color}">
        <small>${k.titulo}</small>
        <h2>${k.valor}</h2>
      </div>`;
  });
}

function renderGrafico(hist) {

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("grafico"), {
    type:"line",
    data:{
      labels: hist.map(h=>h.periodo),
      datasets:[
        { label:"Variación %", data:hist.map(h=>h.variacion), borderColor:"#ff7a18", tension:.3 },
        { label:"Inflación %", data:hist.map(h=>h.inflacion), borderColor:"#4dd0e1", borderDash:[6,6], tension:.3 }
      ]
    }
  });
}

function activar(id) {
  document.getElementById("btnTrimestral").classList.remove("activo");
  document.getElementById("btnAnual").classList.remove("activo");
  document.getElementById(id).classList.add("activo");
}
