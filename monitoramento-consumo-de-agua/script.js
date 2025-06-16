const firebaseConfig = {
    apiKey: "AIzaSyAlSmPYQo6f2fzR5SVXMNWQd02579OWxqY",
    authDomain: "blueflow-7e0d7.firebaseapp.com",
    databaseURL: "https://blueflow-7e0d7-default-rtdb.firebaseio.com",
    projectId: "blueflow-7e0d7",
    storageBucket: "blueflow-7e0d7.appspot.com",
    messagingSenderId: "597793620379",
    appId: "1:597793620379:web:b1e3fe56a1cc449119e13e"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const valorAtualEl = document.getElementById('valorAtual');
const ctx = document.getElementById('graficoVazao').getContext('2d');
let periodoAtual = 'hora';

const grafico = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: [],
        datasets: [{
            label: 'Consumo Total (Litros)',
            data: [],
            backgroundColor: 'rgba(41, 128, 185, 0.6)',
            borderColor: '#2980b9',
            borderWidth: 1,
            borderRadius: 4,
            barThickness: 30
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true },
            tooltip: { enabled: true },
            title: {
                display: true,
                text: 'Selecione um período',
                font: { size: 16 }
            }
        },
        scales: {
            x: {
                title: { display: true, text: 'Período' },
                ticks: { maxRotation: 45, minRotation: 30 }
            },
            y: {
                title: { display: true, text: 'L/min' },
                beginAtZero: true
            }
        }
    }
});

function parseTimestampFirebase(str) {
    if (!str) return new Date();
    const [datePart, timePart] = str.split('_');
    const date = datePart.split('-').map(Number);
    const time = timePart?.split('-').map(Number) || [0, 0, 0];
    return new Date(date[0], date[1] - 1, date[2], time[0], time[1], time[2]);
}

async function verificarAnomalia(valorAtual) {
    try {
        const agora = new Date();
        const dezMinutosAtras = new Date(agora.getTime() - 10 * 60 * 1000);

        const snap = await db.ref('leituras_com_tempo').once('value');
        let soma = 0;
        let count = 0;

        snap.forEach(child => {
            const data = parseTimestampFirebase(child.key);
            const valor = parseFloat(child.val()) || 0;

            if (data >= dezMinutosAtras) {
                soma += valor;
                count++;
            }
        });

        if (count === 0) return;

        const media = soma / count;
        const variacao = Math.abs(valorAtual - media) / media;

        console.log(`Média últimos 10 min: ${media.toFixed(2)} | Variação: ${(variacao * 100).toFixed(2)}%`);

        if (variacao > 0.5) {
            exibirAlertaDeVazamento(valorAtual, media);
        }

    } catch (error) {
        console.error("Erro ao verificar anomalia:", error);
    }
}

function exibirAlertaDeVazamento(valorAtual, media) {
    const alertaEl = document.getElementById('alertaVazamento');
    const valorAtualSpan = document.getElementById('valorAtualAlerta');
    const mediaSpan = document.getElementById('mediaAlerta');

    valorAtualSpan.textContent = valorAtual.toFixed(2);
    mediaSpan.textContent = media.toFixed(2);

    alertaEl.style.display = 'block';

    clearTimeout(alertaEl.timeoutId);
    alertaEl.timeoutId = setTimeout(() => {
        alertaEl.style.display = 'none';
    }, 150000);
}

function fecharAlerta() {
    const alertaEl = document.getElementById('alertaVazamento');
    alertaEl.style.display = 'none';
}

function monitorarVazaoAtual() {
    db.ref('leituras/vazao_Lmin').on('value', async (snap) => {
        const val = snap.val();
        console.log('Valor atual recebido:', val);

        if (val !== null) {
            const vazaoAtual = parseFloat(val);
            valorAtualEl.textContent = vazaoAtual.toFixed(2) + ' L/min';

            await verificarAnomalia(vazaoAtual);
        } else {
            valorAtualEl.textContent = '--';
        }
    });
}

async function calcularMetricas(dataInicio, calcularPico = false) {
    try {
        const snap = await db.ref('leituras_com_tempo').once('value');
        let soma = 0, count = 0, pico = 0;

        snap.forEach(child => {
            const data = parseTimestampFirebase(child.key);
            const valor = parseFloat(child.val()) || 0;
            if (data >= dataInicio) {
                soma += valor;
                count++;
                if (calcularPico && valor > pico) pico = valor;
            }
        });

        return {
            media: count > 0 ? (soma / count).toFixed(2) : '0.00',
            pico: calcularPico ? pico.toFixed(2) : '--'
        };
    } catch (error) {
        console.error("Erro ao calcular métricas:", error);
        return { media: '0.00', pico: '0.00' };
    }
}

async function atualizarMesMaiorConsumo() {
  const resultado = await calcularMesMaiorConsumo();
  const el = document.getElementById('mesMaiorConsumo');

  if (resultado && resultado.mes && resultado.consumo !== undefined) {
    el.textContent = ` ${resultado.mes} com ${resultado.consumo} L`;
  } else {
    el.textContent = "dados indisponíveis";
  }
}


async function atualizarTodasMetricas() {
    try {
        const agora = new Date();
        const hoje = new Date(agora);
        hoje.setHours(0, 0, 0, 0);

        const [hora, dia, semana, mes] = await Promise.all([
            calcularMetricas(new Date(agora.getTime() - 3600000), true),
            calcularMetricas(hoje, true),
            calcularMetricas(new Date(agora.getTime() - 604800000)),
            calcularMetricas(new Date(agora.getTime() - 2592000000))
        ]);

        document.getElementById('vazaoMediaHora').textContent = hora.media;
        document.getElementById('vazaoPicoHora').textContent = hora.pico;
        document.getElementById('vazaoMediaDia').textContent = dia.media;
        document.getElementById('vazaoPicoDia').textContent = dia.pico;
        document.getElementById('vazaoMediaSemana').textContent = semana.media;
        document.getElementById('vazaoMediaMes').textContent = mes.media;

        await atualizarMesMaiorConsumo();
    } catch (error) {
        console.error("Erro ao atualizar métricas:", error);
    }
}


async function atualizarGrafico(periodo) {
    try {
        const agora = new Date();
        let labels = [], dados = [], cores = [], barThickness = 30, titulo = '';
        const snap = await db.ref('leituras_com_tempo').once('value');
        const leituras = [];

        snap.forEach(child => {
            leituras.push({
                data: parseTimestampFirebase(child.key),
                valor: parseFloat(child.val()) || 0
            });
        });

        if (periodo === 'hora') {
            const horaAtual = new Date(agora);
            horaAtual.setMinutes(0, 0, 0);
            const horaAnterior = new Date(horaAtual.getTime() - 3600000);
            const horaProxima = new Date(horaAtual.getTime() + 3600000);

            labels = ['Hora Anterior', 'Hora Atual', 'Próxima Hora'];
            const valoresPorHora = [0, 0, 0];

            leituras.forEach(({ data, valor }) => {
                const litros = valor / 60;
                if (data >= horaAnterior && data < horaAtual) valoresPorHora[0] += litros;
                else if (data >= horaAtual && data < horaProxima) valoresPorHora[1] += litros;
                else if (data >= horaProxima && data < (horaProxima.getTime() + 3600000)) valoresPorHora[2] += litros;
            });

            dados = valoresPorHora;
            cores = ['rgba(100, 149, 237, 0.6)', 'rgba(41, 128, 185, 1)', 'rgba(100, 149, 237, 0.6)'];
            barThickness = 50;
            titulo = 'Volume Total por Hora (L)';
        }

        else if (periodo === 'semana') {
            const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            labels = diasSemana;
            const hoje = new Date(agora);
            const domingo = new Date(hoje.setDate(hoje.getDate() - hoje.getDay()));
            domingo.setHours(0, 0, 0, 0);
            const dadosPorDia = Array(7).fill(0);

            leituras.forEach(({ data, valor }) => {
                const litros = valor / 60;
                if (data >= domingo) {
                    const diaIdx = Math.floor((data - domingo) / 86400000);
                    if (diaIdx >= 0 && diaIdx < 7) dadosPorDia[diaIdx] += litros;
                }
            });

            dados = dadosPorDia;
            cores = Array(7).fill('rgba(41, 128, 185, 0.8)');
            barThickness = 25;
            titulo = 'Volume Total por Dia da Semana (L)';
        }

        else if (periodo === 'mes') {
            const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1);
            const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
            const semanas = Math.ceil(diasNoMes / 7);

            labels = Array.from({ length: semanas }, (_, i) => `Sem ${i + 1}`);
            const dadosPorSemana = Array(semanas).fill(0);

            leituras.forEach(({ data, valor }) => {
                const litros = valor / 60;
                if (data.getMonth() === agora.getMonth() && data.getFullYear() === agora.getFullYear()) {
                    const semanaIdx = Math.floor((data.getDate() - 1) / 7);
                    dadosPorSemana[semanaIdx] += litros;
                }
            });

            dados = dadosPorSemana;
            cores = Array(semanas).fill('rgba(52, 152, 219, 0.8)');
            barThickness = 30;
            titulo = 'Volume Total por Semana do Mês (L)';
        }

        else if (periodo === 'anual') {
            labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const dadosPorMes = Array(12).fill(0);

            leituras.forEach(({ data, valor }) => {
                const litros = valor / 60;
                if (data.getFullYear() === agora.getFullYear()) {
                    dadosPorMes[data.getMonth()] += litros;
                }
            });

            dados = dadosPorMes;
            cores = Array(12).fill('rgba(20, 90, 120, 0.8)');
            barThickness = 20;
            titulo = 'Volume Total por Mês (L)';
        }

        grafico.data.labels = labels;
        grafico.data.datasets[0].data = dados;
        grafico.data.datasets[0].backgroundColor = cores;
        grafico.data.datasets[0].borderColor = cores.map(c => c.replace('0.8', '1').replace('0.6', '1'));
        grafico.data.datasets[0].barThickness = barThickness;
        grafico.options.plugins.title.text = titulo;
        grafico.update();

    } catch (error) {
        console.error("Erro ao atualizar gráfico:", error);
    }
}


async function calcularMesMaiorConsumo() {
    try {
        const agora = new Date();
        const snap = await db.ref('leituras_com_tempo').once('value');
        const consumoPorMes = Array(12).fill(0);

        snap.forEach(child => {
            const data = parseTimestampFirebase(child.key);
            const valor = parseFloat(child.val()) || 0;
            if (data.getFullYear() === agora.getFullYear()) {
                consumoPorMes[data.getMonth()] += valor / 60;
            }
        });

        let maiorConsumo = 0;
        let mesMaiorConsumoIdx = 0;
        consumoPorMes.forEach((valor, idx) => {
            if (valor > maiorConsumo) {
                maiorConsumo = valor;
                mesMaiorConsumoIdx = idx;
            }
        });

        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                       'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        return {
            mes: meses[mesMaiorConsumoIdx],
            consumo: maiorConsumo.toFixed(2)
        };
    } catch (error) {
        console.error("Erro ao calcular mês de maior consumo:", error);
        return { mes: '--', consumo: '0.00' };
    }
}

document.getElementById('btnHora').addEventListener('click', () => {
    periodoAtual = 'hora';
    atualizarTodasMetricas();
    atualizarGrafico(periodoAtual);
    document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnHora').classList.add('active');
});

document.getElementById('btnSemana').addEventListener('click', () => {
    periodoAtual = 'semana';
    atualizarTodasMetricas();
    atualizarGrafico(periodoAtual);
    document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnSemana').classList.add('active');
});

document.getElementById('btnMes').addEventListener('click', () => {
    periodoAtual = 'mes';
    atualizarTodasMetricas();
    atualizarGrafico(periodoAtual);
    document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnMes').classList.add('active');
});

document.getElementById('btnAnual').addEventListener('click', () => {
    periodoAtual = 'anual';
    atualizarTodasMetricas();
    atualizarGrafico(periodoAtual);
    document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btnAnual').classList.add('active');
});

document.getElementById('btnHora').classList.add('active');
monitorarVazaoAtual();
atualizarTodasMetricas();
atualizarGrafico(periodoAtual);
setInterval(() => {
    atualizarTodasMetricas();
    atualizarGrafico(periodoAtual);
}, 30000);
