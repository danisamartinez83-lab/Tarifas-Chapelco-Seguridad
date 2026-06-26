const API = "https://script.google.com/macros/s/AKfycbw1qVmmlR0bAf33L8ui2Vkgr1ix4nNntZpsX_YIztH1Z5JKQlhjyrJQYm-zhzocwjfmoA/exec";

// =====================
// PARÁMETROS (Globales)
// =====================
const params = new URLSearchParams(window.location.search);
const cliente  = params.get("cliente") || "Cliente";
const anio     = params.get("anio") || "2024";
const servicio = params.get("servicio") || "Servicio";

let chartPrincipal = null;
let chartSecundario = null;

// =====================
// UI E INICIALIZACIÓN
// =====================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("detalle").innerText = `${cliente} · ${servicio} · ${anio}`;
    document.getElementById("btnTrimestral").onclick = cargarDashboard;
    document.getElementById("btnAnual").onclick = cargarAnalisisAnual;
    
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
// CARGA VISTA TRIMESTRAL (DOBLE GRÁFICO Y KPIs)
// =====================
async function cargarDashboard() {
    activar("btnTrimestral");
    // Forzamos que se muestre el contenedor secundario en la vista trimestral
    document.getElementById("contenedorSecundario").style.display = "flex";
    document.getElementById("tituloGraficoPrincipal").innerText = "Tendencia de Evolución Acumulada Corriente";

    try {
        const [histRes, inflRes] = await Promise.all([
            fetch(`${API}?action=historial&cliente=${cliente}&año=${anio}&servicio=${servicio}&periodo=trimestral`).then(r => r.json()),
            fetch(`${API}?action=inflacion_trimestral&año=${anio}&cliente=${cliente}&servicio=${servicio}`).then(r => r.json())
        ]);

        const historialPuro = histRes.historial || []; 
        const datosCorridos = inflRes.inflacion || []; 

        if (!datosCorridos.length) {
            document.getElementById("kpis").innerHTML = "<p>No hay datos trimestrales disponibles.</p>";
            return;
        }

        // --- 1) GRÁFICO LINEAL ACUMULADO ---
        const datosGraficoLineas = datosCorridos.map(d => ({
            periodo: d.periodo,
            variacion: normalizarPorcentaje(d.tarifa),
            inflacion: normalizarPorcentaje(d.inflacion),
            salario: normalizarPorcentaje(d.salario)
        }));

        // --- 2) GRÁFICO DE BARRAS AISLADAS (CORRECCIÓN CLAVE) ---
        // Filtramos para limpiar puntos "Base" si existieran en el historial
        const historialFiltrado = historialPuro.filter(h => h.periodo && h.periodo.toString().toLowerCase() !== "base");
        
        // Calculamos los valores puros aislados para cada trimestre disponible
        const datosGraficoBarras = historialFiltrado.map((h, index) => {
            const t = extraerTrimestre(h.periodo);
            
            // Buscamos los datos correspondientes en la respuesta corrida
            const refActual = datosCorridos.find(d => extraerTrimestre(d.periodo) === t);
            
            // Para T1 el valor aislado es igual al acumulado. Para T2 en adelante restamos el acumulado anterior.
            let infPura = refActual ? refActual.inflacion : 0;
            let salPuro = refActual ? refActual.salario : 0;
            let tarPura = h.variacion; // Historial ya viene por trimestre aislado desde el backend

            if (index > 0) {
                const tAnt = extraerTrimestre(historialFiltrado[index - 1].periodo);
                const refAnt = datosCorridos.find(d => extraerTrimestre(d.periodo) === tAnt);
                if (refAnt) {
                    infPura = infPura - refAnt.inflacion;
                    salPuro = salPuro - refAnt.salario;
                }
            }

            return {
                periodo: t,
                tarifa: normalizarPorcentaje(tarPura),
                inflacion: normalizarPorcentaje(infPura),
                salario: normalizarPorcentaje(salPuro)
            };
        });

        // --- 3) KPIs DEL ÚLTIMO TRIMESTRE INDEPENDIENTE ---
        const uHist = historialFiltrado[historialFiltrado.length - 1] || { promedio: 0, variacion: 0 };
        const ultTrimestreLabel = extraerTrimestre(uHist.periodo);
        
        // Obtenemos los valores puros calculados para el último periodo en nuestra lista de barras
        const kpiPuro = datosGraficoBarras[datosGraficoBarras.length - 1] || { tarifa: 0, inflacion: 0, salario: 0 };

        const tVariacion = kpiPuro.tarifa;
        const tInflacion = kpiPuro.inflacion;
        const tSalario   = kpiPuro.salario;

        const bInf = parseFloat((tVariacion - tInflacion).toFixed(2));
        const bSal = parseFloat((tVariacion - tSalario).toFixed(2));
        
        const textoPeriodo = ultTrimestreLabel === "T2" ? "T2 (Parcial)" : ultTrimestreLabel;

        document.getElementById("kpis").innerHTML = `
            <div class="kpi verde"><small>Tarifa Promedio (${textoPeriodo})</small><h2>$ ${uHist.promedio.toLocaleString("es-AR")}</h2></div>
            <div class="kpi amarillo"><small>Variación Tarifa (${ultTrimestreLabel})</small><h2>${tVariacion}%</h2></div>
            <div class="kpi amarillo"><small>Inflación (${textoPeriodo})</small><h2>${tInflacion}%</h2></div>
            <div class="kpi amarillo"><small>Sueldos (${textoPeriodo})</small><h2>${tSalario}%</h2></div>
            <div class="kpi ${bInf >= 0 ? 'verde' : 'rojo'}"><small>Brecha vs Infl.</small><h2>${bInf > 0 ? '+' : ''}${bInf}%</h2></div>
            <div class="kpi ${bSal >= 0 ? 'verde' : 'rojo'}"><small>Brecha vs Salario</small><h2>${bSal > 0 ? '+' : ''}${bSal}%</h2></div>
        `;

        renderGraficoLineas(datosGraficoLineas);
        renderGraficoBarrasTrimestrales(datosGraficoBarras);

    } catch (error) {
        console.error("Error trimestral:", error);
    }
}

// =====================
// CARGA VISTA ANUAL
// =====================
async function cargarAnalisisAnual() {
    activar("btnAnual");
    // Ocultamos por completo el contenedor de barras en la vista anual
    document.getElementById("contenedorSecundario").style.display = "none"; 
    document.getElementById("tituloGraficoPrincipal").innerText = "Comparativa de Cierre Anual %";

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
            <div class="kpi amarillo"><small>Aumento Tarifa Anual</small><h2>${vTarifa}%</h2></div>
            <div class="kpi amarillo"><small>Inflación Anual</small><h2>${vInfa}%</h2></div>
            <div class="kpi amarillo"><small>Sueldos Anual</small><h2>${vSalario}%</h2></div>
            <div class="kpi ${bInf >= 0 ? 'verde' : 'rojo'}"><small>Brecha Infl.</small><h2>${bInf > 0 ? '+' : ''}${bInf}%</h2></div>
            <div class="kpi ${bSal >= 0 ? 'verde' : 'rojo'}"><small>Brecha Salarios</small><h2>${bSal > 0 ? '+' : ''}${bSal}%</h2></div>
        `;

        renderGraficoAnual(vTarifa, vInfa, vSalario);
    } catch (error) {
        console.error("Error anual:", error);
    }
}

// =====================
// RENDERIZADORES DE GRÁFICOS
// =====================
function renderGraficoLineas(hist) {
    if (chartPrincipal) chartPrincipal.destroy();
    chartPrincipal = new Chart(document.getElementById("grafico"), {
        type: "line",
        data: {
            labels: hist.map(h => h.periodo),
            datasets: [
                { label: "Tarifa % Acum.", data: hist.map(h => h.variacion), borderColor: "#ff7a18", tension: .3 },
                { label: "Inflación % Acum.", data: hist.map(h => h.inflacion), borderColor: "#4dd0e1", borderDash: [5,5], tension: .3 },
                { label: "Salarios % Acum.", data: hist.map(h => h.salario), borderColor: "#2196f3", tension: .3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#aaa" } } } }
    });
}

function renderGraficoBarrasTrimestrales(datosBarras) {
    if (chartSecundario) chartSecundario.destroy();
    chartSecundario = new Chart(document.getElementById("graficoBarrasTrimestral"), {
        type: "bar",
        data: {
            labels: datosBarras.map(d => d.periodo),
            datasets: [
                { label: "Tarifa % del Trimestre", data: datosBarras.map(d => d.tarifa), backgroundColor: "#ff7a18" },
                { label: "Inflación % del Trimestre", data: datosBarras.map(d => d.inflacion), backgroundColor: "#4dd0e1" },
                { label: "Salarios % del Trimestre", data: datosBarras.map(d => d.salario), backgroundColor: "#2196f3" }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#aaa" } } } }
    });
}

function renderGraficoAnual(tarifa, inflacion, salario) {
    if (chartPrincipal) chartPrincipal.destroy();
    chartPrincipal = new Chart(document.getElementById("grafico"), {
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
    const tipoAnalisis = esAnual ? "ANÁLISIS ANUAL" : "ANÁLISIS TRIMESTRAL E INTEGRAL";

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

    let finalY = doc.lastAutoTable.finalY + 10;

    const canvas1 = document.getElementById("grafico");
    if (canvas1) {
        const imgData1 = canvas1.toDataURL("image/png", 1.0);
        doc.addImage(imgData1, 'PNG', 14, finalY, 182, 75);
        finalY += 85;
    }

    if (!esAnual) {
        const canvas2 = document.getElementById("graficoBarrasTrimestral");
        if (canvas2) {
            if (finalY > 220) { doc.addPage(); finalY = 20; }
            const imgData2 = canvas2.toDataURL("image/png", 1.0);
            doc.addImage(imgData2, 'PNG', 14, finalY, 182, 75);
        }
    }

    doc.save(`Reporte_Ejecutivo_${cliente}_${anio}.pdf`);
}
