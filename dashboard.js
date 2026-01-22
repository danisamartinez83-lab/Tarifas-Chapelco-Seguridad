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

        // 1. Normalizamos los valores (aseguramos que sean números)
        const vTarifa = parseFloat(normalizarPorcentaje(d.variacion_anual));
        const vInfa = parseFloat(normalizarPorcentaje(d.inflacion_anual));
        const vSalario = parseFloat(normalizarPorcentaje(d.variacion_salario_anual));

        // 2. Cálculo de Brechas (Diferencia porcentual)
        const bInf = parseFloat((vTarifa - vInfa).toFixed(1));
        const bSal = parseFloat((vTarifa - vSalario).toFixed(1));

        // 3. Renderizamos los 7 KPIs en el orden solicitado
        const contenedor = document.getElementById("kpis");
        contenedor.innerHTML = `
            <div class="kpi verde">
                <small>Tarifa Enero</small>
                <h2>$ ${Number(d.tarifa_enero).toLocaleString("es-AR")}</h2>
            </div>
            <div class="kpi verde">
                <small>Tarifa Dic.</small>
                <h2>$ ${Number(d.tarifa_diciembre).toLocaleString("es-AR")}</h2>
            </div>
            <div class="kpi amarillo">
                <small>Aumento Tarifa</small>
                <h2>${vTarifa}%</h2>
            </div>
            <div class="kpi amarillo">
                <small>Inflación Anual</small>
                <h2>${vInfa}%</h2>
            </div>
            <div class="kpi amarillo">
                <small>Aumento Salarial</small>
                <h2>${vSalario}%</h2>
            </div>
            <div class="kpi ${bInf >= 0 ? 'verde' : 'rojo'}">
                <small>Brecha vs Infl.</small>
                <h2>${bInf > 0 ? '+' : ''}${bInf}%</h2>
            </div>
            <div class="kpi ${bSal >= 0 ? 'verde' : 'rojo'}">
                <small>Brecha vs Salarios</small>
                <h2>${bSal > 0 ? '+' : ''}${bSal}%</h2>
            </div>
        `;

        // 4. Llamamos al gráfico pasando los datos corregidos
        renderGraficoAnual(vTarifa, vInfa, vSalario);

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

function renderGraficoAnual(tarifa, inflacion, salario) {
    if (chart) chart.destroy();
    const ctx = document.getElementById("grafico").getContext("2d");

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Comparativa Anual %'],
            datasets: [
                {
                    label: 'Aumento Tarifa',
                    data: [tarifa],
                    backgroundColor: '#ff7a18', // Naranja
                    borderWidth: 1
                },
                {
                    label: 'Inflación Anual',
                    data: [inflacion],
                    backgroundColor: '#4dd0e1', // Celeste
                    borderWidth: 1
                },
                {
                    label: 'Aumento Salarial',
                    data: [salario],
                    backgroundColor: '#2196f3', // Azul
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#aaa', callback: (v) => v + '%' }
                },
                x: {
                    ticks: { color: '#fff' }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#fff' }
                }
            }
        }
    });
}
// Usamos este método para asegurar que el botón responda sí o sí
document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'btnPDF') {
        exportarDashAPDF();
    }
});

