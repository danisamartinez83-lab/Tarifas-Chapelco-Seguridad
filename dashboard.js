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
// HELPERS (CORREGIDOS)
// =====================
function normalizarPorcentaje(v) {
  // Verificamos si es estrictamente null, undefined o NaN
  if (v === null || v === undefined || isNaN(v)) return 0;
  
  // Si es 0, devolvemos 0 explícitamente para evitar que se trate como null
  if (v === 0) return 0;

  // Ajuste para valores decimales (ej: 0.05 -> 5%) o valores ya enteros
  let num = Number(v);
  if (Math.abs(num) < 1 && num !== 0) {
    return parseFloat((num * 100).toFixed(2));
  }
  return parseFloat(num.toFixed(2));
}

function extraerTrimestre(periodo) {
  if (!periodo) return "";
  // Agregamos lógica más robusta: busca la "T" seguida de un número
  const match = periodo.match(/T\d/);
  return match ? match[0] : periodo; 
}

// =====================
// DASHBOARD TRIMESTRAL (REVISADO)
// =====================
async function cargarDashboard() {
  activar("btnTrimestral");

  try {
    const [histRes, inflRes] = await Promise.all([
      fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r => r.json()),
      fetch(`${API}?action=inflacion_trimestral&año=${anio}`).then(r => r.json())
    ]);

    const historial = histRes.historial || [];
    const inflacion = inflRes.inflacion || [];

    if (!historial.length) {
      console.warn("No hay datos trimestrales");
      return;
    }

    // MAPA DE INFLACIÓN - Aseguramos que la key sea limpia (ej: "T1")
    const mapaInflacion = {};
    inflacion.forEach(i => {
      const t = extraerTrimestre(i.periodo);
      mapaInflacion[t] = normalizarPorcentaje(i.inflacion);
    });

    historial.forEach(h => {
      const t = extraerTrimestre(h.periodo);
      h.promedio  = Number(h.promedio ?? 0);
      
      // Forzamos el 0 si el valor de variación es null en el JSON
      h.variacion = (h.variacion === null || h.variacion === undefined) ? 0 : normalizarPorcentaje(h.variacion);
      
      // Vinculamos la inflación
      h.inflacion = mapaInflacion[t] !== undefined ? mapaInflacion[t] : 0;
      h.brecha = parseFloat((h.variacion - h.inflacion).toFixed(2));
    });

    const u = historial[historial.length - 1];

    renderKPIs([
      {
        titulo: "Tarifa actual",
        valor: `$ ${u.promedio.toLocaleString("es-AR")}`,
        color: "verde"
      },
      {
        titulo: "Variación trimestre",
        valor: `${u.variacion >= 0 ? "+" : ""}${u.variacion}%`, // Cambiado > por >= para incluir el 0
        color: u.brecha >= 0 ? "verde" : "rojo"
      },
      {
        titulo: "Inflación trimestre",
        valor: `${u.inflacion}%`,
        color: "amarillo"
      },
      {
        titulo: "Brecha",
        valor: `${u.brecha >= 0 ? "+" : ""}${u.brecha}%`,
        color: u.brecha >= 0 ? "verde" : "rojo"
      }
    ]);

    renderGrafico(historial);
  } catch (error) {
    console.error("Error cargando dashboard:", error);
  }
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
  d.variacion_anual  = normalizarPorcentaje(d.variacion_anual);
  d.inflacion_anual  = normalizarPorcentaje(d.inflacion_anual);
  d.brecha_anual     = +(d.variacion_anual - d.inflacion_anual).toFixed(2);

  renderKPIs([
    { titulo: "Tarifa Enero",     valor: `$ ${d.tarifa_enero.toLocaleString("es-AR")}`, color: "verde" },
    { titulo: "Tarifa Diciembre", valor: `$ ${d.tarifa_diciembre.toLocaleString("es-AR")}`, color: "verde" },
    { titulo: "Variación anual",  valor: `${d.variacion_anual}%`, color: "amarillo" },
    { titulo: "Inflación anual",  valor: `${d.inflacion_anual}%`, color: "amarillo" },
    { titulo: "Brecha anual",     valor: `${d.brecha_anual}%`, color: d.brecha_anual >= 0 ? "verde" : "rojo" }
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

