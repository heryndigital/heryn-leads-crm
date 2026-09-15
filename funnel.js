import { firebaseConfig } from '/firebase-config.js';
import { SEGMENTS, REVENUE_RANGES, PAID_TRAFFIC_OPTIONS, MEETING_DAYS_AHEAD } from '/constants.js';
import { SCHEDULER_URL } from '/scheduler-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const answers = { name: '', whatsapp: '', company: '', segment: '', revenueRange: '', paidTraffic: '' };

const steps = [
  { key: 'name', type: 'text', eyebrow: 'Pergunta 1 de 7', question: 'Como você se chama?', placeholder: 'Seu nome completo' },
  { key: 'whatsapp', type: 'tel', eyebrow: 'Pergunta 2 de 7', question: 'Qual seu <span class="accent">WhatsApp</span>?', placeholder: '(11) 99999-9999' },
  { key: 'company', type: 'text', eyebrow: 'Pergunta 3 de 7', question: 'Qual o nome da sua empresa?', placeholder: 'Nome da empresa' },
  { key: 'segment', type: 'choice', eyebrow: 'Pergunta 4 de 7', question: 'Qual o <span class="accent">ramo</span> de atuação?', options: SEGMENTS, grid: true },
  { key: 'revenueRange', type: 'choice', eyebrow: 'Pergunta 5 de 7', question: 'Qual o faturamento médio mensal?', options: REVENUE_RANGES },
  { key: 'paidTraffic', type: 'choice', eyebrow: 'Pergunta 6 de 7', question: 'Você investe ou já investiu em <span class="accent">tráfego pago</span>?', options: PAID_TRAFFIC_OPTIONS }
];
const TOTAL_STEPS = steps.length + 1;

let current = 0;
let submitting = false;

const container = document.getElementById('stepContainer');
const backBtn = document.getElementById('backBtn');
const progressFill = document.getElementById('progressFill');

function updateProgress() {
  const pct = Math.min(current, TOTAL_STEPS) / TOTAL_STEPS * 100;
  progressFill.style.width = pct + '%';
  backBtn.hidden = current === 0;
}

function escapeHtml(str) {
  return (str || '').toString().replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function renderStep() {
  const step = steps[current];
  let html = `<div class="eyebrow">${step.eyebrow}</div><h1 class="headline">${step.question}</h1>`;

  if (step.type === 'text' || step.type === 'tel') {
    html += `
      <input class="text-input" id="fieldInput" type="${step.type === 'tel' ? 'tel' : 'text'}" placeholder="${step.placeholder}" value="${escapeHtml(answers[step.key])}" autocomplete="off">
      <div class="hint" id="fieldHint">&nbsp;</div>
      <div class="actions">
        <button class="btn-continue" id="continueBtn">Continuar</button>
        <span class="key-hint">aperte <kbd>Enter</kbd> ↵</span>
      </div>`;
  } else if (step.type === 'choice') {
    html += `<div class="choice-grid ${step.grid ? 'grid-2col' : ''}" id="choiceGrid">` +
      step.options.map(opt => `<button class="choice-btn ${answers[step.key] === opt ? 'selected' : ''}" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('') +
      `</div>`;
  }

  container.innerHTML = html;
  attachEvents(step);
  updateProgress();
}

function attachEvents(step) {
  if (step.type === 'text' || step.type === 'tel') {
    const input = document.getElementById('fieldInput');
    const continueBtn = document.getElementById('continueBtn');
    input.focus();
    if (step.type === 'tel') {
      input.addEventListener('input', () => { input.value = formatPhone(input.value); });
    }
    const tryAdvance = () => {
      const val = input.value.trim();
      if (!validateField(step.key, val)) {
        const hint = document.getElementById('fieldHint');
        hint.textContent = fieldError(step.key);
        hint.classList.add('error');
        return;
      }
      answers[step.key] = val;
      goNext();
    };
    continueBtn.addEventListener('click', tryAdvance);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') tryAdvance(); });
  } else if (step.type === 'choice') {
    document.querySelectorAll('.choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        answers[step.key] = btn.dataset.value;
        goNext();
      });
    });
  }
}

function formatPhone(v) {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function validateField(key, val) {
  if (key === 'name' || key === 'company') return val.length >= 2;
  if (key === 'whatsapp') return val.replace(/\D/g, '').length >= 10;
  return !!val;
}

function fieldError(key) {
  if (key === 'whatsapp') return 'Digite um WhatsApp válido, com DDD.';
  return 'Preenche esse campo pra gente continuar.';
}

function goNext() {
  if (current === steps.length - 1) {
    transition(1, () => { current = steps.length; renderSchedule(); });
    return;
  }
  transition(1, () => { current++; renderStep(); });
}

function goBack() {
  if (current === 0) return;
  if (current === steps.length) {
    transition(-1, () => { current = steps.length - 1; renderStep(); });
    return;
  }
  transition(-1, () => { current--; renderStep(); });
}

function transition(dir, cb) {
  return new Promise(resolve => {
    container.classList.add(dir === 1 ? 'leave-left' : 'leave-right');
    setTimeout(() => {
      cb();
      container.classList.remove('leave-left', 'leave-right');
      container.classList.add(dir === 1 ? 'enter-right' : 'enter-left');
      requestAnimationFrame(() => requestAnimationFrame(() => {
        container.classList.remove('enter-right', 'enter-left');
        resolve();
      }));
    }, 260);
  });
}

backBtn.addEventListener('click', goBack);

let availabilityPromise = null;

function fetchAvailability() {
  availabilityPromise = fetch(`${SCHEDULER_URL}?action=availability&days=${MEETING_DAYS_AHEAD}`)
    .then(res => { if (!res.ok) throw new Error('bad response'); return res.json(); });
  return availabilityPromise;
}

// Começa a buscar os horários assim que o formulário abre, em segundo plano —
// enquanto a pessoa responde as 6 primeiras perguntas, a busca já roda ao fundo,
// então quando ela chega na pergunta 7 os horários já devem estar prontos.
fetchAvailability();

async function renderSchedule() {
  updateProgress();
  container.innerHTML = `
    <div class="eyebrow">Pergunta 7 de 7</div>
    <h1 class="headline">Quando podemos <span class="accent">conversar</span>?</h1>
    <div id="slotsArea"><p class="hint">Carregando horários disponíveis...</p></div>
    <div class="actions">
      <button class="btn-skip" id="skipScheduleBtn">Prefiro combinar por WhatsApp depois</button>
    </div>
  `;
  document.getElementById('skipScheduleBtn').addEventListener('click', () => finalizeLead(null));
  try {
    const data = await (availabilityPromise || fetchAvailability());
    renderSlotFields(data.slots || []);
  } catch (e) {
    document.getElementById('slotsArea').innerHTML = '<p class="hint error">Não consegui carregar os horários agora. Sem problema, você pode combinar por WhatsApp.</p>';
  }
}

function renderSlotFields(slots) {
  const area = document.getElementById('slotsArea');
  if (!slots.length) {
    area.innerHTML = '<p class="hint">Sem horários disponíveis nos próximos dias — pode combinar por WhatsApp.</p>';
    return;
  }
  const byDate = {};
  slots.forEach(s => { (byDate[s.date] = byDate[s.date] || []).push(s.hour); });
  const dates = Object.keys(byDate).sort();

  area.innerHTML = `
    <div class="field">
      <label>Dia</label>
      <select id="dayField">
        <option value="" disabled selected>Escolha o dia</option>
        ${dates.map(d => `<option value="${d}">${formatDateLabel(d)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Horário</label>
      <select id="hourField" disabled>
        <option value="" disabled selected>Escolha o dia primeiro</option>
      </select>
    </div>
    <div class="actions">
      <button class="btn-continue" id="confirmSlotBtn" disabled>Confirmar horário</button>
    </div>
  `;

  const dayField = document.getElementById('dayField');
  const hourField = document.getElementById('hourField');
  const confirmBtn = document.getElementById('confirmSlotBtn');

  dayField.addEventListener('change', () => {
    const hours = (byDate[dayField.value] || []).slice().sort((a, b) => a - b);
    hourField.innerHTML = `<option value="" disabled selected>Escolha o horário</option>` +
      hours.map(h => `<option value="${h}">${h}h</option>`).join('');
    hourField.disabled = false;
    confirmBtn.disabled = true;
  });

  hourField.addEventListener('change', () => {
    confirmBtn.disabled = !hourField.value;
  });

  confirmBtn.addEventListener('click', () => {
    selectSlot(dayField.value, parseInt(hourField.value, 10));
  });
}

function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

async function selectSlot(date, hour) {
  container.innerHTML = `<div class="eyebrow">Quase lá</div><h1 class="headline">Marcando sua reunião...</h1>`;
  try {
    const res = await fetch(SCHEDULER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ date, hour, name: answers.name, whatsapp: answers.whatsapp, company: answers.company, segment: answers.segment, revenueRange: answers.revenueRange, paidTraffic: answers.paidTraffic })
    });
    const data = await res.json();
    if (!data.ok) {
      container.innerHTML = `<div class="eyebrow">Ops</div><h1 class="headline">Esse horário acabou de ser preenchido</h1><p class="hint">Escolhe outro, já atualizei a lista.</p>`;
      await new Promise(r => setTimeout(r, 1400));
      renderSchedule();
      return;
    }
    finalizeLead({ date, hour });
  } catch (e) {
    container.innerHTML = `<div class="eyebrow">Ops</div><h1 class="headline">Não deu pra marcar agora</h1><p class="hint error">Escolhe de novo.</p>`;
    await new Promise(r => setTimeout(r, 1400));
    renderSchedule();
  }
}

async function finalizeLead(meeting) {
  if (submitting) return;
  submitting = true;
  backBtn.hidden = true;
  progressFill.style.width = '100%';
  await transition(1, () => {
    container.innerHTML = `<div class="eyebrow">Quase lá</div><h1 class="headline">Salvando suas respostas...</h1>`;
  });
  try {
    const payload = {
      name: answers.name,
      whatsapp: answers.whatsapp,
      company: answers.company,
      segment: answers.segment,
      revenueRange: answers.revenueRange,
      paidTraffic: answers.paidTraffic,
      stage: 'Novo',
      source: 'Formulário',
      notes: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (meeting) payload.meetingAt = `${meeting.date}T${String(meeting.hour).padStart(2, '0')}:00`;
    const write = addDoc(collection(db, 'leads'), payload);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    await Promise.race([write, timeout]);
    showDone(meeting);
  } catch (e) {
    container.innerHTML = `<div class="eyebrow">Ops</div><h1 class="headline">Não deu pra enviar agora</h1><p class="hint error">Tenta de novo em alguns segundos.</p><div class="actions"><button class="btn-continue" id="retryBtn">Tentar novamente</button></div>`;
    document.getElementById('retryBtn').addEventListener('click', () => { submitting = false; finalizeLead(meeting); });
  }
}

function showDone(meeting) {
  const meetingHtml = meeting
    ? `<p class="hint meeting-confirmed">Reunião marcada para <strong>${formatDateLabel(meeting.date)} às ${meeting.hour}h</strong>.</p>`
    : '';
  container.innerHTML = `
    <div class="done-screen">
      <div class="check">&#10003;</div>
      <h1 class="headline">Recebemos seu <span class="accent">diagnóstico</span></h1>
      ${meetingHtml}
      <p>Nosso time vai analisar suas respostas ${meeting ? 'e te encontra no horário combinado.' : 'e chamar você no WhatsApp em breve.'}</p>
    </div>
  `;
}

renderStep();
