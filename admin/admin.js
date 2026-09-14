import { firebaseConfig } from '/firebase-config.js';
import { STAGES } from '/constants.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, arrayUnion, serverTimestamp, query, orderBy } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let leads = new Map();
let unsubscribe = null;
let activeLeadId = null;

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');

document.getElementById('loginBtn').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    errorEl.textContent = 'Email ou senha incorretos.';
  }
}

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  if (user) {
    loginScreen.style.display = 'none';
    dashboard.style.display = 'flex';
    startListening();
  } else {
    loginScreen.style.display = 'flex';
    dashboard.style.display = 'none';
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    leads = new Map();
  }
});

function startListening() {
  const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, snapshot => {
    leads = new Map();
    snapshot.forEach(d => leads.set(d.id, { id: d.id, ...d.data() }));
    renderBoard();
    if (activeLeadId && leads.has(activeLeadId)) fillModal(leads.get(activeLeadId));
  });
}

function escapeHtml(str) {
  return (str || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function timeAgo(ts) {
  if (!ts || !ts.toDate) return 'agora';
  const diff = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return mins + 'min';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  return Math.floor(hours / 24) + 'd';
}

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  const all = Array.from(leads.values());
  if (!all.length) {
    board.innerHTML = '<div class="empty-state"><div class="headline">Nenhum lead ainda</div><p>Assim que alguém preencher o formulário, o lead aparece aqui automaticamente.</p></div>';
    return;
  }
  STAGES.forEach(stage => {
    const stageLeads = all.filter(l => l.stage === stage);
    const col = document.createElement('div');
    col.className = 'column';
    col.innerHTML = `<div class="column-head"><span>${escapeHtml(stage)}</span><span class="count">${stageLeads.length}</span></div><div class="column-body" data-stage="${escapeHtml(stage)}"></div>`;
    const body = col.querySelector('.column-body');
    body.addEventListener('dragover', e => { e.preventDefault(); body.classList.add('drag-over'); });
    body.addEventListener('dragleave', () => body.classList.remove('drag-over'));
    body.addEventListener('drop', async e => {
      e.preventDefault();
      body.classList.remove('drag-over');
      const leadId = e.dataTransfer.getData('text/plain');
      const lead = leads.get(leadId);
      if (lead && lead.stage !== stage) {
        await updateDoc(doc(db, 'leads', leadId), { stage, updatedAt: serverTimestamp() });
      }
    });
    stageLeads.forEach(lead => body.appendChild(renderCard(lead)));
    board.appendChild(col);
  });
}

function renderCard(lead) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.innerHTML = `
    <div class="name">${escapeHtml(lead.name)}</div>
    <div class="company">${escapeHtml(lead.company || '')}</div>
    <div class="meta"><span>${escapeHtml(lead.whatsapp || '')}</span><span>${timeAgo(lead.createdAt)}</span></div>
    <div class="tags">
      <span class="tag">${escapeHtml(lead.segment || '')}</span>
      <span class="tag">${escapeHtml(lead.revenueRange || '')}</span>
      ${lead.meetingAt ? `<span class="tag tag-meeting">${formatMeetingLabel(lead.meetingAt)}</span>` : ''}
    </div>
  `;
  card.addEventListener('dragstart', e => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', lead.id); });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));
  card.addEventListener('click', () => openLeadModal(lead.id));
  return card;
}

function openLeadModal(id) {
  activeLeadId = id;
  fillModal(leads.get(id));
  document.getElementById('leadModalOverlay').classList.add('open');
}

function fillModal(lead) {
  if (!lead) return;
  document.getElementById('leadModalName').textContent = lead.name;
  document.getElementById('leadModalCompany').textContent = lead.company || '';
  const digits = (lead.whatsapp || '').replace(/\D/g, '').slice(-11);
  const waLink = document.getElementById('leadWaLink');
  waLink.textContent = lead.whatsapp || '-';
  waLink.href = digits ? `https://wa.me/55${digits}` : '#';
  document.getElementById('leadSource').textContent = lead.source || '-';
  document.getElementById('leadSegment').textContent = lead.segment || '-';
  document.getElementById('leadRevenue').textContent = lead.revenueRange || '-';
  document.getElementById('leadPaidTraffic').textContent = lead.paidTraffic || '-';
  const meetingRow = document.getElementById('leadMeetingRow');
  meetingRow.hidden = !lead.meetingAt;
  if (lead.meetingAt) document.getElementById('leadMeeting').textContent = formatMeetingLabel(lead.meetingAt);
  const stageSelect = document.getElementById('leadStage');
  stageSelect.innerHTML = STAGES.map(s => `<option value="${s}" ${s === lead.stage ? 'selected' : ''}>${s}</option>`).join('');
  renderNotes(lead);
}

function formatMeetingLabel(meetingAt) {
  const [datePart, timePart] = meetingAt.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const hour = timePart ? timePart.slice(0, 2) : '';
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} às ${hour}h`;
}

function renderNotes(lead) {
  const el = document.getElementById('notesList');
  el.innerHTML = (lead.notes || []).slice().reverse().map(n => `
    <div class="note-item">${escapeHtml(n.text)}<div class="date">${new Date(n.date).toLocaleString('pt-BR')}</div></div>
  `).join('') || '<div style="color:var(--muted); font-size:12px;">Sem anotações ainda.</div>';
}

function closeLeadModal() {
  document.getElementById('leadModalOverlay').classList.remove('open');
  activeLeadId = null;
}
document.getElementById('leadModalClose').addEventListener('click', closeLeadModal);
document.getElementById('leadModalOverlay').addEventListener('click', e => { if (e.target.id === 'leadModalOverlay') closeLeadModal(); });

document.getElementById('saveStageBtn').addEventListener('click', async () => {
  const stage = document.getElementById('leadStage').value;
  await updateDoc(doc(db, 'leads', activeLeadId), { stage, updatedAt: serverTimestamp() });
  closeLeadModal();
});

document.getElementById('addNoteBtn').addEventListener('click', async () => {
  const input = document.getElementById('noteInput');
  if (!input.value.trim()) return;
  await updateDoc(doc(db, 'leads', activeLeadId), {
    notes: arrayUnion({ text: input.value.trim(), date: new Date().toISOString() }),
    updatedAt: serverTimestamp()
  });
  input.value = '';
});

document.getElementById('deleteLeadBtn').addEventListener('click', async () => {
  if (!confirm('Excluir este lead? Essa ação não pode ser desfeita.')) return;
  await deleteDoc(doc(db, 'leads', activeLeadId));
  closeLeadModal();
});
