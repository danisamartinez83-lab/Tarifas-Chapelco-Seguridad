const API = "https://script.google.com/macros/s/AKfycby7H9J4_CS8BUBi4WAR2xro_qY26tqRlnUxlhVHVX4YBEbJlh8xSlSYO67YDj1b0sGFUg/exec";

// =====================
// PARÁMETROS
// =====================
const params = new URLSearchParams(window.location.search);
const cliente  = params.get("cliente");
const anio     = params.get("anio");
const servicio = params.get("servicio");

let chart = null;

// =====================
// UI E INICIALIZACIÓN
// =====================
document.getElementById("detalle").innerText = `${cliente} · ${servicio} · ${anio}`;

document.getElementById("btnTrimestral").onclick = cargarDashboard;
document.getElementById("btnAnual").onclick = cargarAnalisisAnual;

// Función para manejar el estado de los botones (marcar cuál está activo)
function activar(id) {
    document.getElementById("btnTrimestral").classList.remove("activo");
    document.getElementById("btnAnual").classList.remove("activo");
    const btn = document.getElementById(id);
    if (btn) btn.classList.add("activo");
}

window.onload = cargarDashboard;

// =====================
// HELPERS
// =====================
function normalizarPorcentaje(v) {
    if (v === null || v === undefined || isNaN(v)) return 0;
    if (v === 0) return 0;
    let num = Number(v);
    // Si el número es un decimal muy pequeño (ej: 0.05) lo tratamos como porcentaje (5%)
    if (Math.abs(num) < 1 && num !== 0) {
        return parseFloat((num * 100).toFixed(2));
    }
    return parseFloat(num.toFixed(2));
}

function extraerTrimestre(periodo) {
    if (!periodo) return "";
    const match = periodo.toString().match(/T\d/);
    return match ? match[0] : periodo; 
}

// =====================
// DASHBOARD TRIMESTRAL
// =====================
async function cargarDashboard() {
    activar("btnTrimestral"); // Esto marca el botón de Trimestral

    try {
        const [histRes, inflRes] = await Promise.all([
            fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r => r.json()),
            fetch(`${API}?action=inflacion_trimestral&año=${anio}`).then(r => r.json())
        ]);

        const historial = histRes.historial || [];
        const inflacion = inflRes.inflacion || [];

        if (!historial.length) {
            document.getElementById("kpis").innerHTML = "<p>No hay datos trimestrales para este año.</p>";
            return;
        }

        const mapaInflacion = {};
        inflacion.forEach(i => {
            const t = extraerTrimestre(i.periodo);
            mapaInflacion[t] = normalizarPorcentaje(i.inflacion);
        });

        historial.forEach(h => {
            const t = extraerTrimestre(h.periodo);
            h.promedio  = Number(h.promedio) || 0;
            h.variacion = normalizarPorcentaje(h.variacion);
            h.inflacion = mapaInflacion[t] !== undefined ? mapaInflacion[t] : 0;
            h.brecha    = parseFloat((h.variacion - h.inflacion).toFixed(2));
        });

        const u = historial[historial.length - 1];

        renderKPIs([
            { titulo: "Tarifa actual", valor: `$ ${u.promedio.toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Variación trimestre", valor: `${u.variacion >= 0 ? "+" : ""}${u.variacion}%`, color: u.brecha >= 0 ? "verde" : "rojo" },
            { titulo: "Inflación trimestre", valor: `${u.inflacion}%`, color: "amarillo" },
            { titulo: "Brecha", valor: `${u.brecha >= 0 ? "+" : ""}${u.brecha}%`, color: u.brecha >= 0 ? "verde" : "rojo" }
        ]);

        renderGrafico(historial);
    } catch (error) {
        console.error("Error en dashboard trimestral:", error);
    }
}

// =====================
// ANÁLISIS ANUAL
// =====================
async function cargarAnalisisAnual() {
    activar("btnAnual"); // Esto marca el botón de Anual

    try {
        const res = await fetch(`${API}?action=analisis_anual&cliente=${cliente}&año=${anio}&servicio=${servicio}`);
        const d = await res.json();

        if (d.error) {
            alert("Error: " + d.error);
            return;
        }

        d.tarifa_enero     = Number(d.tarifa_enero) || 0;
        d.tarifa_diciembre = Number(d.tarifa_diciembre) || 0;
        d.variacion_anual  = normalizarPorcentaje(d.variacion_anual);
        d.inflacion_anual  = normalizarPorcentaje(d.inflacion_anual);
        d.brecha_anual     = parseFloat((d.variacion_anual - d.inflacion_anual).toFixed(2));

        renderKPIs([
            { titulo: "Tarifa Enero", valor: `$ ${d.tarifa_enero.toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Tarifa Diciembre", valor: `$ ${d.tarifa_diciembre.toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Variación anual", valor: `${d.variacion_anual}%`, color: "amarillo" },
            { titulo: "Inflación anual", valor: `${d.inflacion_anual}%`, color: "amarillo" },
            { titulo: "Brecha anual", valor: `${d.brecha_anual >= 0 ? "+" : ""}${d.brecha_anual}%`, color: d.brecha_anual >= 0 ? "verde" : "rojo" }
        ]);

        renderGraficoAnual(d);
    } catch (error) {
        console.error("Error en análisis anual:", error);
    }
}

// =====================
// RENDERIZADO
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

function renderGrafico(hist) {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("grafico"), {
        type: "line",
        data: {
            labels: hist.map(h => h.periodo),
            datasets: [
                {
                    label: "Variación Tarifa %",
                    data: hist.map(h => h.variacion),
                    borderColor: "#ff7a18",
                    backgroundColor: "#ff7a18",
                    tension: .3
                },
                {
                    label: "Inflación %",
                    data: hist.map(h => h.inflacion),
                    borderColor: "#4dd0e1",
                    borderDash: [6, 6],
                    tension: .3
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#fff" } } },
            scales: {
                y: { ticks: { color: "#aaa" } },
                x: { ticks: { color: "#aaa" } }
            }
        }
    });
}

function renderGraficoAnual(d) {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("grafico"), {
        type: "bar",
        data: {
            labels: ["Variación Tarifa", "Inflación"],
            datasets: [{
                label: "Comparación Anual %",
                data: [d.variacion_anual, d.inflacion_anual],
                backgroundColor: ["#ff7a18", "#4dd0e1"]
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: "#fff" } } },
            scales: {
                y: { ticks: { color: "#aaa" }, beginAtZero: true }
            }
        }
    });
}
document.getElementById("btnPDF").onclick = () => {
    // Ocultamos los botones para que no salgan en el PDF
    const acciones = document.querySelector(".acciones-dashboard");
    acciones.style.display = "none";
    
    // Disparamos la impresión
    window.print();
    
    // Los volvemos a mostrar después
    acciones.style.display = "flex";
};