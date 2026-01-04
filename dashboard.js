const API =
  "https://script.google.com/macros/s/AKfycbw9ugA1sV5nywFHIFcekwi3vx_ziGuQX5CLBcX7k5ew93eJx-6ICVnxELJuwnwGphHuqA/exec";

let chartPromedios = null;
let chartVariacion = null;

// =====================
// LECTURA DE PARÁMETROS
// =====================
const params = new URLSearchParams(window.location.search);
const cliente = params.get("cliente");
const anio = params.get("año");
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
  const res = await fetch(
    `${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`
  );

  const { historial } = await res.json();

  if (!historial || historial.length === 0) {
    alert("No hay datos trimestrales");
    return;
  }

  calcularKPIs(historial);
  renderGraficos(historial);
}
Promise.all([
  fetch(`${API_URL}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`)
    .then(r => r.json()),
  fetch(`${API_URL}?action=inflacion_trimestral&año=${anio}`)
    .then(r => r.json())
])
.then(([hist, infl]) => {
  const historial = hist.historial;
  const inflacion = infl.inflacion;

  calcularKPIs(historial, inflacion);
  renderGraficos(historial, inflacion);
});

// =====================
// KPIs
// =====================
function calcularKPIs(historial) {
  const ultimo = historial[historial.length - 1];

  const promedioActual = ultimo.promedio;
  const variacionUltimo = ultimo.variacion;

  const acumulada =
    ((ultimo.promedio - historial[0].promedio) /
      historial[0].promedio) *
    100;

  const sinAjuste = historial.filter(h => h.variacion === 0).length;

  const valores = historial.map(h => h.promedio);
  const volatilidad = Math.max(...valores) - Math.min(...valores);

  const kpis = [
    {
      titulo: "Tarifa actual",
      valor: `$ ${promedioActual.toLocaleString("es-AR")}`,
      color: "verde"
    },
    {
      titulo: "Variación último trimestre",
      valor: `${variacionUltimo > 0 ? "+" : ""}${variacionUltimo}%`,
      color: variacionUltimo > 5 ? "rojo" : variacionUltimo > 0 ? "amarillo" : "verde"
    },
    {
      titulo: "Variación acumulada anual",
      valor: `${acumulada.toFixed(2)} %`,
      color: acumulada > 20 ? "rojo" : acumulada > 10 ? "amarillo" : "verde"
    },
    {
      titulo: "Trimestres sin ajuste",
      valor: sinAjuste,
      color: sinAjuste > 1 ? "rojo" : sinAjuste === 1 ? "amarillo" : "verde"
    },
    {
      titulo: "Volatilidad anual",
      valor: `$ ${volatilidad.toLocaleString("es-AR")}`,
      color: volatilidad > promedioActual * 0.25 ? "rojo" : "verde"
    }
  ];

  renderKPIs(kpis);
}
function calcularKPIs(historial, inflacion) {

  const mapaInflacion = {};
  inflacion.forEach(i => mapaInflacion[i.periodo] = i.inflacion);

  let trimestresBajoInflacion = 0;
  let peorBrecha = 999;
  let trimestreCritico = "";

  historial.forEach(h => {
    const ipc = mapaInflacion[h.periodo] ?? 0;
    const brecha = Number((h.variacion - ipc).toFixed(2));

    h.inflacion = ipc;
    h.brecha = brecha;

    if (brecha < 0) trimestresBajoInflacion++;
    if (brecha < peorBrecha) {
      peorBrecha = brecha;
      trimestreCritico = h.periodo;
    }
  });

  document.getElementById("kpis").innerHTML = `
    <div class="kpi">
      <small>Brecha último trimestre</small>
      <h2>${historial.at(-1).brecha}%</h2>
    </div>

    <div class="kpi">
      <small>Trimestres bajo inflación</small>
      <h2>${trimestresBajoInflacion} / ${historial.length}</h2>
    </div>

    <div class="kpi">
      <small>Trimestre crítico</small>
      <h2>${trimestreCritico}</h2>
    </div>
  `;
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

  if (chartPromedios) chartPromedios.destroy();
  chartPromedios = new Chart(graficoPromedios, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Promedio",
        data: historial.map(h => h.promedio),
        borderColor: "#ff7a18",
        backgroundColor: "rgba(255,122,24,0.2)",
        fill: true
      }]
    }
  });

  if (chartVariacion) chartVariacion.destroy();
  chartVariacion = new Chart(graficoVariacion, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Variación %",
        data: historial.map(h => h.variacion),
        backgroundColor: historial.map(h =>
          h.variacion > 0 ? "#4caf50" : "#f44336"
        )
      }]
    }
  });

  function renderGraficos(historial) {

  const labels = historial.map(h => h.periodo);

  new Chart(document.getElementById("graficoVariacion"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Variación tarifa %",
          data: historial.map(h => h.variacion),
          borderWidth: 2
        },
        {
          label: "Inflación %",
          data: historial.map(h => h.inflacion),
          borderDash: [6,6],
          borderWidth: 2
        }
      ]
    }
  });
} 
}