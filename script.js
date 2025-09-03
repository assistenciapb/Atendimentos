const firebaseConfig = {
  apiKey: "AIzaSyDI5-NlhqEInMh4VYEg2zBjwWn8fmmBhjQ",
  authDomain: "agendamentos-348f3.firebaseapp.com",
  projectId: "agendamentos-348f3",
  storageBucket: "agendamentos-348f3.firebasestorage.app",
  messagingSenderId: "691316969145",
  appId: "1:691316969145:web:eff04404e65e384c70d568"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const form = document.getElementById('atendimentoForm');
const tabelaBody = document.querySelector('#tabelaAtendimentos tbody');
const filtroBtns = document.querySelectorAll('.filtro-btn');
const mesSelecionado = document.getElementById('mesSelecionado');
const btnImprimirMes = document.getElementById('btnImprimirMes');

let atendimentos = [];
let statusRealizado = JSON.parse(localStorage.getItem('statusRealizado')) || {};

function salvarStatus() { localStorage.setItem('statusRealizado', JSON.stringify(statusRealizado)); }

form.addEventListener('submit', function(e){
    e.preventDefault();
    const nome = document.getElementById('nome').value.trim();
    const cpf = document.getElementById('cpf').value.trim();
    const nis = document.getElementById('nis').value.trim();
    const motivo = document.getElementById('motivo').value.trim();
    const data = new Date().toISOString();

    if(!nome || !motivo) return alert('Nome e Motivo são obrigatórios.');

    db.collection('atendimentos').add({nome, cpf, nis, motivo, data})
      .then(() => {
          form.reset();
          carregarAtendimentos();
      })
      .catch(err => { console.error(err); alert("Erro ao registrar atendimento."); });
});

function carregarAtendimentos() {
    tabelaBody.innerHTML = '';
    db.collection('atendimentos').get()
      .then(snapshot => {
          atendimentos = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
          atendimentos.sort((a,b) => new Date(a.data) - new Date(b.data));
          aplicarFiltro('dia');
      })
      .catch(err => console.error(err));
}

function aplicarFiltro(tipo){
    let agora = new Date();
    let filtrados = [];
    if(tipo === 'dia'){
        filtrados = atendimentos.filter(a => new Date(a.data).toDateString() === agora.toDateString());
        mesSelecionado.style.display = 'none'; btnImprimirMes.style.display = 'none';
    } else if(tipo === 'semana'){
        let inicioSemana = new Date(agora); inicioSemana.setDate(agora.getDate() - agora.getDay());
        let fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6);
        filtrados = atendimentos.filter(a => {
            let d = new Date(a.data);
            return d >= inicioSemana && d <= fimSemana;
        });
        mesSelecionado.style.display = 'none'; btnImprimirMes.style.display = 'none';
    } else if(tipo === 'mes'){
        mesSelecionado.style.display = 'inline-block'; btnImprimirMes.style.display = 'inline-block';
        if(mesSelecionado.value){
            const [ano, mes] = mesSelecionado.value.split('-').map(Number);
            filtrados = atendimentos.filter(a => {
                let d = new Date(a.data);
                return d.getFullYear() === ano && (d.getMonth()+1) === mes;
            });
        } else {
            filtrados = [];
        }
    }
    atualizarTabela(filtrados);
}

function atualizarTabela(lista){
    tabelaBody.innerHTML = '';
    lista.forEach(a => {
        const tr = document.createElement('tr');
        const statusBtn = document.createElement('span');
        statusBtn.className = 'status-btn';
        if(statusRealizado[a.id]) statusBtn.classList.add('realizado');
        statusBtn.addEventListener('click', () => {
            statusBtn.classList.toggle('realizado');
            statusRealizado[a.id] = statusBtn.classList.contains('realizado');
            salvarStatus();
        });
        const acoes = document.createElement('td');
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Excluir'; delBtn.className='acao-btn delete-btn';
        delBtn.addEventListener('click', () => {
            db.collection('atendimentos').doc(a.id).delete().then(() => carregarAtendimentos());
        });
        acoes.appendChild(delBtn);

        tr.appendChild(document.createElement('td')).appendChild(statusBtn);
        tr.appendChild(document.createElement('td')).textContent = a.nome;
        tr.appendChild(document.createElement('td')).textContent = a.cpf;
        tr.appendChild(document.createElement('td')).textContent = a.nis;
        tr.appendChild(document.createElement('td')).textContent = a.motivo;
        tr.appendChild(document.createElement('td')).textContent = new Date(a.data).toLocaleString();
        tr.appendChild(acoes);
        tabelaBody.appendChild(tr);
    });
}

// Filtros
filtroBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filtroBtns.forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        aplicarFiltro(btn.dataset.filtro);
    });
});

mesSelecionado.addEventListener('change', () => aplicarFiltro('mes'));

// Imprimir PDF do mês
btnImprimirMes.addEventListener('click', () => {
    const mesAno = mesSelecionado.value;
    if(!mesAno) return alert('Selecione o mês.');
    const [ano, mes] = mesAno.split('-').map(Number);
    const lista = atendimentos.filter(a => {
        const d = new Date(a.data);
        return d.getFullYear() === ano && (d.getMonth()+1) === mes;
    });

    if(lista.length === 0) return alert('Nenhum atendimento neste mês.');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'landscape' });
    const dados = lista.map(a => [a.nome, a.cpf, a.nis, a.motivo, new Date(a.data).toLocaleString()]);
    doc.autoTable({ head:[['Nome','CPF','NIS','Motivo','Data']], body:dados, startY:10 });
    doc.save(`Atendimentos_${mesAno}.pdf`);
});

carregarAtendimentos();
