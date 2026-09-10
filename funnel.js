import { firebaseConfig } from '/firebase-config.js';
import { SEGMENTS, REVENUE_RANGES, PAID_TRAFFIC_OPTIONS } from '/constants.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const answers = { name: '', whatsapp: '', company: '', segment: '', revenueRange: '', paidTraffic: '' };

const steps = [
  { key: 'name', type: 'text', eyebrow: 'Pergunta 1 de 6', question: 'Como você se chama?', placeholder: 'Seu nome completo' },
  { key: 'whatsapp', type: 'tel', eyebrow: 'Pergunta 2 de 6', question: 'Qual seu <span class="accent">WhatsApp</span>?', placeholder: '(11) 99999-9999' },
  { key: 'company', type: 'text', eyebrow: 'Pergunta 3 de 6', question: 'Qual o nome da sua empresa?', placeholder: 'Nome da empresa' },
  { key: 'segment', type: 'choice', eyebrow: 'Pergunta 4 de 6', question: 'Qual o <span class="accent">ramo</span> de atuação?', options: SEGMENTS, grid: true },
  { key: 'revenueRange', type: 'choice', eyebrow: 'Pergunta 5 de 6', question: 'Qual o faturamento médio mensal?', options: REVENUE_RANGES },
  { key: 'paidTraffic', type: 'choice', eyebrow: 'Pergunta 6 de 6', question: 'Você investe ou já investiu em <span class="accent">tráfego pago</span>?', options: PAID_TRAFFIC_OPTIONS }
];

let current = 0;
let submitting = false;

const container = document.getElementById('stepContainer');
const backBtn = document.getElementById('backBtn');
const progressFill = document.getElementById('progressFill');

function updateProgress() {
  const pct = Math.min(current, steps.length) / steps.length * 100;
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
    submitLead();
    return;
  }
  transition(1, () => { current++; renderStep(); });
}

function goBack() {
  if (current === 0) return;
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

async function submitLead() {
  if (submitting) return;
  submitting = true;
  backBtn.hidden = true;
  progressFill.style.width = '100%';
  await transition(1, () => {
    container.innerHTML = `<div class="eyebrow">Quase lá</div><h1 class="headline">Enviando suas respostas...</h1>`;
  });
  try {
    const write = addDoc(collection(db, 'leads'), {
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
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    await Promise.race([write, timeout]);
    showDone();
  } catch (e) {
    container.innerHTML = `<div class="eyebrow">Ops</div><h1 class="headline">Não deu pra enviar agora</h1><p class="hint error">Tenta de novo em alguns segundos.</p><div class="actions"><button class="btn-continue" id="retryBtn">Tentar novamente</button></div>`;
    document.getElementById('retryBtn').addEventListener('click', () => { submitting = false; submitLead(); });
  }
}

function showDone() {
  container.innerHTML = `
    <div class="done-screen">
      <div class="check">&#10003;</div>
      <h1 class="headline">Recebemos seu <span class="accent">diagnóstico</span></h1>
      <p>Nosso time vai analisar suas respostas e chamar você no WhatsApp em breve.</p>
    </div>
  `;
}

renderStep();
