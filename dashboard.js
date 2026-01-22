const API = "https://script.google.com/macros/s/AKfycbzbJXAFOLJn6-PL2-i2TKCz1czgJCtokr8nMHGWGTBY1R3wFjJqNCr4x_C0Iatb0gglsQ/exec";

// =====================
// PARÁMETROS (Globales)
// =====================
const params = new URLSearchParams(window.location.search);
const cliente  = params.get("cliente") || "Cliente";
const anio     = params.get("anio") || "2024";
const servicio = params.get("servicio") || "Servicio";

let chart = null;

// =====================
// UI E INICIALIZACIÓN
// =====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("detalle").innerText = `${cliente} · ${servicio} · ${anio}`;
    document.getElementById("btnTrimestral").onclick = cargarDashboard;
    document.getElementById("btnAnual").onclick = cargarAnalisisAnual;
    
    // Vinculación directa del botón PDF
    const btnPDF = document.getElementById("btnPDF");
    if (btnPDF) {
        btnPDF.onclick = exportarReporteCompleto;
    }
    
    cargarDashboard();
});

function activar(id) {
    document.getElementById("btnTrimestral").classList.remove("activo");
    document.getElementById("btnAnual").classList.remove("activo");
    const btn = document.getElementById(id);
    if (btn) btn.classList.add("activo");
}

// =====================
// HELPERS
// =====================
function normalizarPorcentaje(v) {
    if (v === null || v === undefined || isNaN(v)) return 0;
    let num = Number(v);
    if (Math.abs(num) < 1 && num !== 0) return parseFloat((num * 100).toFixed(2));
    return parseFloat(num.toFixed(2));
}

function extraerTrimestre(periodo) {
    if (!periodo) return "";
    const match = periodo.toString().match(/T\d/);
    return match ? match[0] : periodo; 
}

// =====================
// CARGA DE DATOS
// =====================
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
            document.getElementById("kpis").innerHTML = "<p>No hay datos trimestrales disponibles.</p>";
            return;
        }

        const mapaRef = {};
        datosRef.forEach(d => { mapaRef[d.periodo] = { inf: d.inflacion, sal: d.salario }; });

        historial.forEach(h => {
            const t = extraerTrimestre(h.periodo);
            const ref = mapaRef[t] || { inf: 0, sal: 0 };
            h.variacion = normalizarPorcentaje(h.variacion);
            h.inflacion = normalizarPorcentaje(ref.inf);
            h.salario   = normalizarPorcentaje(ref.sal);
        });

        const u = historial[historial.length - 1];
        const bInf = parseFloat((u.variacion - u.inflacion).toFixed(2));
        const bSal = parseFloat((u.variacion - u.salario).toFixed(2));

        document.getElementById("kpis").innerHTML = `
            <div class="kpi verde"><small>Tarifa Promedio</small><h2>$ ${u.promedio.toLocaleString("es-AR")}</h2></div>
            <div class="kpi amarillo"><small>Variación Tarifa</small><h2>${u.variacion}%</h2></div>
            <div class="kpi amarillo"><small>Inflación (T)</small><h2>${u.inflacion}%</h2></div>
            <div class="kpi amarillo"><small>Sueldos (T)</small><h2>${u.salario}%</h2></div>
            <div class="kpi ${bInf >= 0 ? 'verde' : 'rojo'}"><small>Brecha vs Infl.</small><h2>${bInf > 0 ? '+' : ''}${bInf}%</h2></div>
            <div class="kpi ${bSal >= 0 ? 'verde' : 'rojo'}"><small>Brecha vs Salario</small><h2>${bSal > 0 ? '+' : ''}${bSal}%</h2></div>
        `;

        renderGrafico(historial);
    } catch (error) {
        console.error("Error trimestral:", error);
    }
}

async function cargarAnalisisAnual() {
    activar("btnAnual");
    try {
        const res = await fetch(`${API}?action=analisis_anual&cliente=${cliente}&año=${anio}&servicio=${servicio}`);
        const d = await res.json();

        const vTarifa = normalizarPorcentaje(d.variacion_anual);
        const vInfa = normalizarPorcentaje(d.inflacion_anual);
        const vSalario = normalizarPorcentaje(d.variacion_salario_anual);
        const bInf = parseFloat((vTarifa - vInfa).toFixed(1));
        const bSal = parseFloat((vTarifa - vSalario).toFixed(1));

        document.getElementById("kpis").innerHTML = `
            <div class="kpi verde"><small>Tarifa Ene</small><h2>$ ${Number(d.tarifa_enero).toLocaleString("es-AR")}</h2></div>
            <div class="kpi verde"><small>Tarifa Dic</small><h2>$ ${Number(d.tarifa_diciembre).toLocaleString("es-AR")}</h2></div>
            <div class="kpi amarillo"><small>Aumento Tarifa</small><h2>${vTarifa}%</h2></div>
            <div class="kpi amarillo"><small>Inflación</small><h2>${vInfa}%</h2></div>
            <div class="kpi amarillo"><small>Sueldos</small><h2>${vSalario}%</h2></div>
            <div class="kpi ${bInf >= 0 ? 'verde' : 'rojo'}"><small>Brecha Infl.</small><h2>${bInf > 0 ? '+' : ''}${bInf}%</h2></div>
            <div class="kpi ${bSal >= 0 ? 'verde' : 'rojo'}"><small>Brecha Salarios</small><h2>${bSal > 0 ? '+' : ''}${bSal}%</h2></div>
        `;

        renderGraficoAnual(vTarifa, vInfa, vSalario);
    } catch (error) {
        console.error("Error anual:", error);
    }
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
                { label: "Tarifa %", data: hist.map(h => h.variacion), borderColor: "#ff7a18", tension: .3 },
                { label: "Inflación %", data: hist.map(h => h.inflacion), borderColor: "#4dd0e1", borderDash: [5,5], tension: .3 },
                { label: "Salarios %", data: hist.map(h => h.salario), borderColor: "#2196f3", tension: .3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#aaa" } } } }
    });
}

function renderGraficoAnual(tarifa, inflacion, salario) {
    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("grafico"), {
        type: 'bar',
        data: {
            labels: ['Comparativa Anual %'],
            datasets: [
                { label: 'Tarifa', data: [tarifa], backgroundColor: '#ff7a18' },
                { label: 'Inflación', data: [inflacion], backgroundColor: '#4dd0e1' },
                { label: 'Sueldos', data: [salario], backgroundColor: '#2196f3' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// =====================
// EXPORTACIÓN PDF
// =====================
function exportarReporteCompleto() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const esAnual = document.getElementById("btnAnual").classList.contains("activo");
    const tipoAnalisis = esAnual ? "ANÁLISIS ANUAL" : "ANÁLISIS TRIMESTRAL";

    doc.setFontSize(18);
    doc.setTextColor(255, 122, 18);
    doc.text(tipoAnalisis, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Cliente: ${cliente} | Servicio: ${servicio} | Año: ${anio}`, 14, 28);
    doc.line(14, 32, 196, 32);

    const kpis = document.querySelectorAll("#kpis .kpi");
    const datosTabla = [];
    kpis.forEach(kpi => {
        datosTabla.push([kpi.querySelector("small").innerText, kpi.querySelector("h2").innerText]);
    });

    doc.autoTable({
        startY: 38,
        head: [['Indicador', 'Valor']],
        body: datosTabla,
        theme: 'grid',
        headStyles: { fillColor: [255, 122, 18] }
    });

    const canvas = document.getElementById("grafico");
    if (canvas) {
        const imgData = canvas.toDataURL("image/png", 1.0);
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.addImage(imgData, 'PNG', 14, finalY, 182, 90);
    }

    doc.save(`Reporte_${cliente}_${anio}.pdf`);
}
