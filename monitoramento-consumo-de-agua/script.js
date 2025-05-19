const firebaseConfig = {
    apiKey: "AIzaSyAlSmPYQo6f2fzR5SVXMNWQd02579OWxqY",
    authDomain: "blueflow-7e0d7.firebaseapp.com",
    databaseURL: "https://blueflow-7e0d7-default-rtdb.firebaseio.com",
    projectId: "blueflow-7e0d7",
    storageBucket: "blueflow-7e0d7.firebasestorage.app",
    messagingSenderId: "597793620379",
    appId: "1:597793620379:web:b1e3fe56a1cc449119e13e"
    //deixando sem por motivos de privacidade e segurança
    // aqui vai a parte de config do firebase
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const valorAtualEl = document.getElementById('valorAtual');

const ctx = document.getElementById('graficoVazao').getContext('2d');
const grafico = new Chart(ctx, {
    type: 'line',
    data: {
    labels: [],
    datasets: [{
        label: 'Vazão (L/min)',
        data: [],
        borderColor: '#2980b9',
        backgroundColor: 'rgba(41, 128, 185, 0.2)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
    }]
    },
    options: {
    responsive: true,
    animation: false,
    scales: {
        x: {
        type: 'time',
        time: {
            unit: 'hour',
            tooltipFormat: 'dd/MM/yyyy HH:mm:ss'
        },
        title: { display: true, text: 'Hora' }
        },
        y: {
        title: { display: true, text: 'L/min' },
        beginAtZero: true
        }
    },
    plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
        title: {
            display: true,
            text: '',
            font: {
            size: 18
            },
            padding: {
            top: 10,
            bottom: 10
            }
        }
    }
                
    }
});

function parseTimestampFirebase(str) {
    const [datePart, timePart] = str.split('_');
    const date = datePart.split('-').map(Number);
    const time = timePart.split('-').map(Number);
    return new Date(date[0], date[1] - 1, date[2], time[0], time[1], time[2]);
}

function atualizarValorAtual() {
    db.ref('leituras/vazao_Lmin').on('value', snap => {
    const val = snap.val();
    valorAtualEl.textContent = val !== null ? parseFloat(val).toFixed(2) : '--';
    });
}

async function atualizarMetricasPeriodo(dataInicio, calcularPico = false) {
    const snap = await db.ref('leituras_com_tempo').once('value');
    let soma = 0, count = 0, pico = 0;

    snap.forEach(child => {
    const data = parseTimestampFirebase(child.key);
    const valor = parseFloat(child.val());
    if (data >= dataInicio) {
        soma += valor;
        count++;
        if (calcularPico && valor > pico) pico = valor;
    }
    });

    return {
    media: count > 0 ? (soma / count).toFixed(2) : '--',
    pico: calcularPico && pico > 0 ? pico.toFixed(2) : '--'
    };
}

async function atualizarTodasMetricas() {
    const agora = new Date();
    const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
    const umaHoraAtras = new Date(agora.getTime() - 60 * 60 * 1000);
    const inicioSemana = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
    const inicioMes = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const hora = await atualizarMetricasPeriodo(umaHoraAtras, true);
    document.getElementById('vazaoMediaHora').textContent = hora.media;
    document.getElementById('vazaoPicoHora').textContent = hora.pico;

    const dia = await atualizarMetricasPeriodo(hoje, true);
    document.getElementById('vazaoMediaDia').textContent = dia.media;
    document.getElementById('vazaoPicoDia').textContent = dia.pico;

    const semana = await atualizarMetricasPeriodo(inicioSemana, false);
    document.getElementById('vazaoMediaSemana').textContent = semana.media;

    const mes = await atualizarMetricasPeriodo(inicioMes, false);
    document.getElementById('vazaoMediaMes').textContent = mes.media;
}

async function atualizarGraficoPorPeriodo(periodo) {
    const agora = new Date();
    let dataInicio;
    let cor;
    let titulo;

    if (periodo === 'hora') {
        dataInicio = new Date(agora.getTime() - 1 * 60 * 60 * 1000); 
        cor = 'rgba(52, 152, 219, 0.8)';
        titulo = 'Histórico da Última Hora';
    } else if (periodo === 'semana') {
        dataInicio = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
        cor = 'rgba(41, 128, 185, 1.0)';
        titulo = 'Histórico Semanal';
    } else if (periodo === 'mes') {
        dataInicio = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000); 
        cor = 'rgba(20, 60, 90, 0.9)';
        titulo = 'Histórico Mensal';
    } else {
        return;
    }

    const leiturasSnap = await db.ref('leituras_com_tempo').once('value');
    const labels = [];
    const dados = [];

    leiturasSnap.forEach(child => {
        const data = parseTimestampFirebase(child.key);
        if (data >= dataInicio && data <= agora) {
            labels.push(data);
            dados.push(parseFloat(child.val()));
        }
    });

    const zipped = labels.map((e, i) => ({ time: e, val: dados[i] }));
    zipped.sort((a, b) => a.time - b.time);

    grafico.data.labels = zipped.map(item => item.time);
    grafico.data.datasets[0].data = zipped.map(item => item.val);
    grafico.data.datasets[0].backgroundColor = cor;
    grafico.data.datasets[0].borderColor = cor.replace('0.6', '1');

    grafico.options.plugins.title.text = titulo;

    grafico.update();
}


function atualizarTudo() {
    atualizarValorAtual();
    atualizarTodasMetricas();
    atualizarGraficoPorPeriodo('hora');
}

atualizarTudo();
setInterval(atualizarTudo, 30000);
