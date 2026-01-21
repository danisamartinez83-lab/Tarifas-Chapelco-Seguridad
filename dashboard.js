const API = "https://script.google.com/macros/s/AKfycbwUB7Y1OBclpLAjfnhrnnX41LuU9L-wYzbcVmFSFj4B800zWX2qbQ716SSuffmw6mPuXg/exec";

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
function actualizarDashboard(d) {
    const contenedor = document.getElementById("kpis");
    
    // Calculamos brechas
    const brechaInf = d.brecha_anual;
    const brechaSal = d.brecha_vs_salario;

    contenedor.innerHTML = `
        <div class="kpi ${brechaInf >= 0 ? 'verde' : 'rojo'}">
            <small>Brecha vs Inflación</small>
            <h2>${brechaInf > 0 ? '+' : ''}${brechaInf}%</h2>
        </div>
        <div class="kpi ${brechaSal >= 0 ? 'verde' : 'rojo'}">
            <small>Brecha vs Salarios</small>
            <h2>${brechaSal > 0 ? '+' : ''}${brechaSal}%</h2>
        </div>
        <div class="kpi amarillo">
            <small>Tarifa Final</small>
            <h2>$${d.tarifa_diciembre.toLocaleString("es-AR")}</h2>
        </div>
    `;

    renderGraficoAnual(d);
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
                },
              
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
    
    const varSalario = d.variacion_salario_anual || 0;

    chart = new Chart(document.getElementById("grafico"), {
        type: "bar",
        data: {
            labels: ["Comparativa Anual"], // Etiqueta base
            datasets: [
                {
                    label: "Variación Tarifa",
                    data: [d.variacion_anual],
                    backgroundColor: "#ff7a18",
                    borderRadius: 5
                },
                {
                    label: "Inflación",
                    data: [d.inflacion_anual],
                    backgroundColor: "#4dd0e1",
                    borderRadius: 5
                },
                {
                    label: "Salarios",
                    data: [varSalario],
                    backgroundColor: "#2196f3",
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 12 }, color: '#aaa', padding: 20 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => ` ${context.dataset.label}: ${context.raw}%`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { 
                        color: '#aaa',
                        callback: (value) => value + '%' // Añade símbolo % al eje Y
                    },
                    grid: { color: '#333' }
                },
                x: {
                    ticks: { color: '#aaa', display: false } // Ocultamos el label repetitivo
                }
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