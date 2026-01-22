const API = "https://script.google.com/macros/s/AKfycbzbJXAFOLJn6-PL2-i2TKCz1czgJCtokr8nMHGWGTBY1R3wFjJqNCr4x_C0Iatb0gglsQ/exec";

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

async function cargarDashboard() {
    activar("btnTrimestral");

    try {
        const [histRes, inflRes] = await Promise.all([
            fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r => r.json()),
            fetch(`${API}?action=inflacion_trimestral&año=${anio}`).then(r => r.json())
        ]);

        const historial = histRes.historial || [];
        const datosRef = inflRes.inflacion || [];

        if (!historial.length) {
            document.getElementById("kpis").innerHTML = "<p>No hay datos trimestrales.</p>";
            return;
        }

        // Mapeamos los datos para cruzarlos
        const mapaRef = {};
        datosRef.forEach(d => {
            mapaRef[d.periodo] = { inf: d.inflacion, sal: d.salario };
        });

        historial.forEach(h => {
            const t = extraerTrimestre(h.periodo);
            const ref = mapaRef[t] || { inf: 0, sal: 0 };
            h.variacion = normalizarPorcentaje(h.variacion);
            h.inflacion = normalizarPorcentaje(ref.inf);
            h.salario   = normalizarPorcentaje(ref.sal);
        });

        // Tomamos el último trimestre para los KPIs (T4 por ejemplo)
        const u = historial[historial.length - 1];

        // CALCULAMOS LAS BRECHAS (Diferencia porcentual)
        const brechaInflacion = parseFloat((u.variacion - u.inflacion).toFixed(2));
        const brechaSalario = parseFloat((u.variacion - u.salario).toFixed(2));

        // RENDERIZAMOS LOS KPIs
        const contenedor = document.getElementById("kpis");
        contenedor.innerHTML = `
            <div class="kpi amarillo">
                <small>Variación Tarifa</small>
                <h2>${u.variacion}%</h2>
            </div>
            <div class="kpi amarillo">
                <small>Inflación (T)</small>
                <h2>${u.inflacion}%</h2>
            </div>
            <div class="kpi amarillo">
                <small>Aumento Salarial (T)</small>
                <h2>${u.salario}%</h2>
            </div>
            <div class="kpi ${brechaInflacion >= 0 ? 'verde' : 'rojo'}">
                <small>Brecha vs Inflación</small>
                <h2>${brechaInflacion > 0 ? '+' : ''}${brechaInflacion}%</h2>
            </div>
            <div class="kpi ${brechaSalario >= 0 ? 'verde' : 'rojo'}">
                <small>Brecha vs Salario</small>
                <h2>${brechaSalario > 0 ? '+' : ''}${brechaSalario}%</h2>
            </div>
        `;

        renderGrafico(historial);
    } catch (error) {
        console.error("Error:", error);
    }
}

        // Tomamos el último trimestre disponible (ej: T4)
   // Tomamos el último trimestre disponible (ej: T4)
        const u = historial[historial.length - 1];

        // 1. KPIs SUPERIORES (Valores puros del trimestre)
        renderKPIs([
            { titulo: "Tarifa actual", valor: `$ ${u.promedio.toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Variación Tarifa (T)", valor: `${u.variacion}%`, color: "amarillo" },
            { titulo: "Inflación (T)", valor: `${u.inflacion}%`, color: "amarillo" },
            { titulo: "Aumento Salarial (T)", valor: `${u.salario}%`, color: "amarillo" }
        ]);

        // 2. KPIs INFERIORES (Brechas debajo del gráfico)
        // Buscamos o creamos un contenedor para las brechas debajo del canvas
        const contenedorBrechas = document.getElementById("brechas-detalle");
        if (contenedorBrechas) {
            const bInf = parseFloat((u.variacion - u.inflacion).toFixed(2));
            const bSal = parseFloat((u.variacion - u.salario).toFixed(2));
            
            contenedorBrechas.innerHTML = `
                <div class="kpi-mini ${bInf >= 0 ? 'verde' : 'rojo'}">
                    <small>Brecha vs Inflación</small>
                    <h3>${bInf > 0 ? '+' : ''}${bInf}%</h3>
                </div>
                <div class="kpi-mini ${bSal >= 0 ? 'verde' : 'rojo'}">
                    <small>Brecha vs Salarios</small>
                    <h3>${bSal > 0 ? '+' : ''}${bSal}%</h3>
                </div>
            `;
        }

   

// =====================
// ANÁLISIS ANUAL
// =====================
async function cargarAnalisisAnual() {
    activar("btnAnual");

    try {
        const res = await fetch(`${API}?action=analisis_anual&cliente=${cliente}&año=${anio}&servicio=${servicio}`);
        const d = await res.json();

        if (d.error) {
            alert("Error: " + d.error);
            return;
        }

        // 1. KPIs SUPERIORES (Valores nominales y totales)
        renderKPIs([
            { titulo: "Tarifa Enero", valor: `$ ${Number(d.tarifa_enero).toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Tarifa Diciembre", valor: `$ ${Number(d.tarifa_diciembre).toLocaleString("es-AR")}`, color: "verde" },
            { titulo: "Aumento Tarifario", valor: `${normalizarPorcentaje(d.variacion_anual)}%`, color: "amarillo" },
            { titulo: "Inflación Anual", valor: `${normalizarPorcentaje(d.inflacion_anual)}%`, color: "amarillo" },
            { titulo: "Aumento Salarial", valor: `${normalizarPorcentaje(d.variacion_salario_anual)}%`, color: "amarillo" }
        ]);

        // 2. CÁLCULO DE BRECHAS PARA EL DETALLE INFERIOR
        const bInf = parseFloat((d.variacion_anual - d.inflacion_anual).toFixed(1));
        const bSal = parseFloat((d.variacion_anual - d.variacion_salario_anual).toFixed(1));

        // Inyectamos las brechas en el contenedor de abajo (el mismo que usamos en el trimestral)
        const contenedorBrechas = document.getElementById("brechas-detalle");
        if (contenedorBrechas) {
            contenedorBrechas.innerHTML = `
                <div class="kpi-mini ${bInf >= 0 ? 'verde' : 'rojo'}">
                    <small>Brecha vs Inflación Anual</small>
                    <h3>${bInf > 0 ? '+' : ''}${bInf}%</h3>
                </div>
                <div class="kpi-mini ${bSal >= 0 ? 'verde' : 'rojo'}">
                    <small>Brecha vs Salarios Anual</small>
                    <h3>${bSal > 0 ? '+' : ''}${bSal}%</h3>
                </div>
            `;
        }

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
                {
                    label: "Salarios %",
                    data: hist.map(h => h.salario), // <--- Línea de salarios
                    borderColor: "#2196f3",
                    tension: .3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: "#aaa" } } },
            scales: {
                y: { ticks: { color: "#aaa" }, grid: { color: "#333" } },
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