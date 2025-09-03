import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDI5-NlhqEInMh4VYEg2zBjwWn8fmmBhjQ",
  authDomain: "agendamentos-348f3.firebaseapp.com",
  projectId: "agendamentos-348f3",
  storageBucket: "agendamentos-348f3.firebasestorage.app",
  messagingSenderId: "691316969145",
  appId: "1:691316969145:web:eff04404e65e384c70d568"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementos
const form = document.getElementById("atendimentoForm");
const tabela = document.querySelector("#tabelaAtendimentos tbody");
const filtroBtns = document.querySelectorAll(".filtro-btn");
const mesInput = document.getElementById("mesSelecionado");
const btnImprimirMes = document.getElementById("btnImprimirMes");

let filtroAtual = "dia";

// ----- REGISTRAR ATENDIMENTO -----
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = document.getElementById("nome").value.trim();
  const cpf = document.getElementById("cpf").value.trim();
  const nis = document.getElementById("nis").value.trim();
  const motivo = document.getElementById("motivo").value.trim();

  if (!nome || !cpf || !motivo) return alert("Preencha todos os campos obrigatórios!");

  try {
    await addDoc(collection(db, "atendimentos"), {
      nome,
      cpf,
      nis: nis || null,
      motivo,
      data: serverTimestamp()
    });
    form.reset();
    carregarAtendimentos();
  } catch (error) {
    console.error("Erro ao salvar atendimento:", error);
    alert("Erro ao registrar atendimento. Verifique o console.");
  }
});

// ----- CARREGAR ATENDIMENTOS -----
async function carregarAtendimentos() {
  tabela.innerHTML = "";

  try {
    const q = query(collection(db, "atendimentos"), orderBy("data", "desc"));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const atendimento = docSnap.data();
      if (!atendimento.data) return;
      const data = atendimento.data.toDate();

      if (!filtrarPorData(data)) return;

      const dataFormatada = data.toLocaleDateString("pt-BR");

      const linha = document.createElement("tr");
      linha.innerHTML = `
        <td>${atendimento.nome}</td>
        <td>${atendimento.cpf}</td>
        <td>${atendimento.nis || "-"}</td>
        <td>${atendimento.motivo}</td>
        <td>${dataFormatada}</td>
        <td>
          <button class="acao-btn edit-btn" data-id="${docSnap.id}">Editar</button>
          <button class="acao-btn delete-btn" data-id="${docSnap.id}">Excluir</button>
        </td>
      `;
      tabela.appendChild(linha);
    });

    document.querySelectorAll(".edit-btn").forEach((btn) =>
      btn.addEventListener("click", () => abrirModalEdicao(btn.dataset.id))
    );
    document.querySelectorAll(".delete-btn").forEach((btn) =>
      btn.addEventListener("click", () => excluirAtendimento(btn.dataset.id))
    );
  } catch (error) {
    console.error("Erro ao carregar atendimentos:", error);
  }
}

// ----- FILTRO DE DATA -----
function filtrarPorData(data) {
  const hoje = new Date();

  if (filtroAtual === "dia") return data.toDateString() === hoje.toDateString();

  if (filtroAtual === "semana") {
    const primeiroDia = new Date(hoje);
    primeiroDia.setDate(hoje.getDate() - hoje.getDay() + 1);
    const ultimoDia = new Date(primeiroDia);
    ultimoDia.setDate(primeiroDia.getDate() + 6);
    return data >= primeiroDia && data <= ultimoDia;
  }

  if (filtroAtual === "mes") {
    if (!mesInput.value) return true;
    const [ano, mes] = mesInput.value.split("-");
    return data.getMonth() === parseInt(mes) - 1 && data.getFullYear() === parseInt(ano);
  }

  return true;
}

// ----- BOTÕES DE FILTRO -----
filtroBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filtroAtual = btn.dataset.filtro;
    filtroBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    mesInput.style.display = filtroAtual === "mes" ? "inline-block" : "none";
    btnImprimirMes.style.display = filtroAtual === "mes" ? "inline-block" : "none";

    carregarAtendimentos();
  });
});

mesInput.addEventListener("change", carregarAtendimentos);

// ----- IMPRESSÃO PDF PROFISSIONAL -----
btnImprimirMes.addEventListener("click", () => {
  const { jsPDF } = window.jspdf;
  const docPDF = new jsPDF({ orientation: "landscape" });

  const headers = [["Nome","CPF","NIS","Motivo","Data"]];
  const dataRows = [];

  tabela.querySelectorAll("tbody tr").forEach((tr) => {
    const row = Array.from(tr.querySelectorAll("td")).slice(0,5).map(td => td.innerText);
    dataRows.push(row);
  });

  docPDF.autoTable({
    head: headers,
    body: dataRows,
    startY: 20,
    theme:"grid",
    headStyles:{fillColor:[46,90,134]},
    styles:{fontSize:10, cellPadding:3},
    didDrawPage: function (data) {
      // Cabeçalho oficial
      docPDF.setFontSize(14);
      docPDF.setTextColor(0,0,0);
      docPDF.text("Registro de Atendimentos - Documento Oficial", data.settings.margin.left, 10);
      // Rodapé com numeração
      const str = "Página " + docPDF.internal.getNumberOfPages();
      docPDF.setFontSize(10);
      docPDF.text(str, docPDF.internal.pageSize.getWidth() - 20, docPDF.internal.pageSize.getHeight() - 10);
    }
  });

  docPDF.save(`Atendimentos-${mesInput.value}.pdf`);
});

// ----- MODAL E EDIÇÃO -----
const modal = document.getElementById("modal");
const closeModal = document.getElementById("closeModal");
const editForm = document.getElementById("editForm");

let idEditar = null;

function abrirModalEdicao(id) {
  idEditar = id;
  modal.classList.add("show");
  getDocs(doc(db, "atendimentos", id)).then((docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();
    document.getElementById("editNome").value = data.nome;
    document.getElementById("editCpf").value = data.cpf;
    document.getElementById("editNis").value = data.nis || "";
    document.getElementById("editMotivo").value = data.motivo;
  });
}

closeModal.addEventListener("click", () => modal.classList.remove("show"));

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!idEditar) return;
  try {
    await updateDoc(doc(db, "atendimentos", idEditar), {
      nome: document.getElementById("editNome").value.trim(),
      cpf: document.getElementById("editCpf").value.trim(),
      nis: document.getElementById("editNis").value.trim() || null,
      motivo: document.getElementById("editMotivo").value.trim()
    });
    modal.classList.remove("show");
    carregarAtendimentos();
  } catch (error) {
    console.error("Erro ao atualizar atendimento:", error);
  }
});

// ----- EXCLUIR ATENDIMENTO -----
async function excluirAtendimento(id) {
  if (confirm("Deseja excluir este atendimento?")) {
    await deleteDoc(doc(db, "atendimentos", id));
    carregarAtendimentos();
  }
}

// ----- INICIALIZAÇÃO -----
window.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".filtro-btn[data-filtro='dia']").classList.add("active");
  carregarAtendimentos();
});
