const API =
  "https://script.google.com/macros/s/AKfycbw9ugA1sV5nywFHIFcekwi3vx_ziGuQX5CLBcX7k5ew93eJx-6ICVnxELJuwnwGphHuqA/exec";

let chartPromedios = null;
let chartVariacion = null;

// =====================
// LECTURA DE PARÁMETROS
// =====================
const params = new URLSearchParams(window.location.search);
const cliente = params.get("cliente");
const anio = params.get("anio");
const servicio = params.get("servicio");

// =====================
// CARGA INICIAL
// =====================
window.onload = () => {
  if (!cliente || !anio || !servicio) {
    alert("Faltan parámetros para el dashboard");
    return;
  }
  cargarDashboard();
};

// =====================
// DASHBOARD
// =====================
async function cargarDashboard() {
  try {
    const [histRes, inflRes] = await Promise.all([
      fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`),
      fetch(`${API}?action=inflacion_trimestral&año=${anio}`)
    ]);

    const histData = await histRes.json();
    const inflData = await inflRes.json();

    const historial = histData.historial;
    const inflacion = inflData.inflacion;

    if (!historial || historial.length === 0) {
      alert("No hay datos trimestrales");
      return;
    }

    calcularKPIs(historial, inflacion);
    renderGraficos(historial);

  } catch (e) {
    console.error(e);
    alert("Error cargando el dashboard");
  }
}

// =====================
// KPIs
// =====================
function calcularKPIs(historial, inflacion) {

  const mapaInflacion = {};
  inflacion.forEach(i => mapaInflacion[i.periodo] = i.inflacion);

  let trimestresBajoInflacion = 0;

  historial.forEach(h => {
    const ipc = mapaInflacion[h.periodo] ?? 0;
    const brecha = Number((h.variacion - ipc).toFixed(2));

    h.inflacion = ipc;
    h.brecha = brecha;

    if (brecha < 0) trimestresBajoInflacion++;
  });

  const ultimo = historial.at(-1);

  const kpis = [
    {
      titulo: "Tarifa actual",
      valor: `$ ${ultimo.promedio.toLocaleString("es-AR")}`,
      color: "verde"
    },
    {
      titulo: "Variación último trimestre",
      valor: `${ultimo.variacion > 0 ? "+" : ""}${ultimo.variacion}%`,
      color: ultimo.variacion >= ultimo.inflacion ? "verde" : "rojo"
    },
    {
      titulo: "Inflación último trimestre",
      valor: `${ultimo.inflacion}%`,
      color: "amarillo"
    },
    {
      titulo: "Brecha vs inflación",
      valor: `${ultimo.brecha > 0 ? "+" : ""}${ultimo.brecha}%`,
      color: ultimo.brecha >= 0 ? "verde" : "rojo"
    },
    {
      titulo: "Trimestres bajo inflación",
      valor: `${trimestresBajoInflacion} / ${historial.length}`,
      color:
        trimestresBajoInflacion === 0
          ? "verde"
          : trimestresBajoInflacion <= historial.length / 2
          ? "amarillo"
          : "rojo"
    }
  ];

  renderKPIs(kpis);
}

// =====================
// RENDER KPIs
// =====================
function renderKPIs(kpis) {
  const cont = document.getElementById("kpis");
  cont.innerHTML = "";

  kpis.forEach(k => {
    cont.innerHTML += `
      <div class="kpi ${k.color}">
        <small>${k.titulo}</small>
        <h2>${k.valor}</h2>
      </div>
    `;
  });
}

// =====================
// GRÁFICOS
// =====================
function renderGraficos(historial) {

  const labels = historial.map(h => h.periodo);

  // -------- PROMEDIOS --------
  if (chartPromedios) chartPromedios.destroy();
  chartPromedios = new Chart(document.getElementById("graficoPromedios"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Tarifa promedio",
        data: historial.map(h => h.promedio),
        borderColor: "#ff7a18",
        backgroundColor: "rgba(255,122,24,0.2)",
        fill: true,
        tension: 0.3
      }]
    }
  });

  // -------- VARIACIÓN vs INFLACIÓN --------
  if (chartVariacion) chartVariacion.destroy();
  chartVariacion = new Chart(document.getElementById("graficoVariacion"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Variación tarifa %",
          data: historial.map(h => h.variacion),
          borderColor: "#ff7a18",
          borderWidth: 2,
          tension: 0.3
        },
        {
          label: "Inflación %",
          data: historial.map(h => h.inflacion),
          borderColor: "#4dd0e1",
          borderDash: [6, 6],
          borderWidth: 2,
          tension: 0.3
        }
      ]
    }
  });
}
