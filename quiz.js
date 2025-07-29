document.addEventListener("DOMContentLoaded", function() {

// ---------- Hilfsfunktionen ----------
function shuffleArray(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// Levenshtein-Distanz: tolerant gegenüber Tippfehlern
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j] + 1,
                     matrix[i][j - 1] + 1,
                     matrix[i - 1][j - 1] + 1);
  return matrix[a.length][b.length];
}

// ---------- Quiz-Logik ----------
let quizData = [];
let current = 0;
let userAnswers = [];
let hasAnswered = false;
let shuffledAnswers = [];
let quizLoaded = false;

// Darkmode Toggle
const darkToggle = document.getElementById('darkToggle');
function setTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  darkToggle.textContent = dark ? '☀️' : '🌙';
  localStorage.setItem('quizapp_dark', dark ? '1' : '0');
}
darkToggle.onclick = () => setTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
if (localStorage.getItem('quizapp_dark') === '1'
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  setTheme(true);
}

// Anzeige der aktuellen Frage
function showQuestion() {
  if (!quizLoaded) return;
  const quiz = document.getElementById('quiz');
  const q = quizData[current];
  hasAnswered = false;

  // --- Erkennung: Freitext-Frage?
  const isFreeText = q.answers.length === 1;
  let freeTextAnswer = "";
  if (isFreeText) freeTextAnswer = q.answers[0].text;

  // Fortschritt + Progressbar
  document.getElementById('quiz-progress').textContent = `Frage ${current + 1} von ${quizData.length}`;
  const progress = ((current + 1) / quizData.length) * 100;
  document.getElementById('progressbar-inner').style.width = progress + "%";

  // Frage und Antworten-HTML
  let html = `<div class="question">${q.question}</div><div class="answers">`;

  if (isFreeText) {
    html += `<div style="padding-bottom:16px;">
      <input id="freeTextInput" type="text" placeholder="Antwort eingeben..." 
             style="width:95%;font-size:1.1em;padding:7px 8px;border-radius:6px;border:1.5px solid #b7c8be;">
    </div>`;
  } else {
    shuffledAnswers = shuffleArray(q.answers);
    shuffledAnswers.forEach((a, idx) => {
      html += `
        <label class="answer">
          <input type="radio" name="answer" value="${idx}"><span>${a.text}</span>
        </label>`;
    });
  }

  html += `</div>`;
  quiz.innerHTML = html;

  // Buttons/Feedback Zustand
  document.getElementById('okBtn').disabled = true;
  document.getElementById('okBtn').style.display = '';
  document.getElementById('nextBtn').disabled = true;
  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('feedback').textContent = "";
  document.getElementById('result').textContent = "";
  document.getElementById('downloadLog').style.display = 'none';
  document.getElementById('restartBtn').style.display = 'none';

  // Letzte Frage? Button-Text ändern
  const nextBtnText = document.getElementById('nextBtnText');
  if (current === quizData.length - 1) {
    nextBtnText.textContent = "Zum Ergebnis";
  } else {
    nextBtnText.textContent = "Nächste Frage";
  }

  // Listener: Auswahl- oder Texteingabe
  if (isFreeText) {
    document.getElementById('freeTextInput').addEventListener('input', function () {
      document.getElementById('okBtn').disabled = this.value.trim().length < 1;
    });
  } else {
    document.querySelectorAll('input[name="answer"]').forEach(input => {
      input.addEventListener('change', () => {
        if (hasAnswered) return;
        document.getElementById('okBtn').disabled = false;
        document.querySelectorAll('.answer').forEach(label => label.classList.remove('selected'));
        if (input.checked) input.parentElement.classList.add('selected');
      });
    });
  }
}

// OK-Button
document.getElementById('okBtn').addEventListener('click', () => {
  if (!quizLoaded || hasAnswered) return;
  const q = quizData[current];
  const isFreeText = q.answers.length === 1;
  let freeTextAnswer = "";
  if (isFreeText) freeTextAnswer = q.answers[0].text;

  if (isFreeText) {
    const userInput = document.getElementById('freeTextInput').value.trim();
    const n1 = normalize(userInput);
    const n2 = normalize(freeTextAnswer);
    const isCorrect = (n1 === n2) || (levenshtein(n1, n2) <= 2);

    userAnswers.push({
      id: q.id,
      question: q.question,
      givenAnswer: userInput,
      correct: isCorrect,
      correctAnswer: freeTextAnswer
    });

    const feedback = document.getElementById('feedback');
    if (isCorrect) {
      feedback.innerHTML = `<span class="correct">✅ Richtig!</span><br><span>Richtige Antwort: ${freeTextAnswer}</span>`;
    } else {
      feedback.innerHTML = `<span class="incorrect">❌ Falsch!</span><br><span>Richtige Antwort: ${freeTextAnswer}</span>`;
    }

    document.getElementById('okBtn').disabled = true;
    document.getElementById('okBtn').style.display = 'none';
    document.getElementById('nextBtn').disabled = false;
    document.getElementById('nextBtn').style.display = '';
    document.getElementById('freeTextInput').disabled = true;
    hasAnswered = true;
    return;
  }

  // Multiple Choice
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) return;
  const answerIdx = parseInt(selected.value);
  const isCorrect = shuffledAnswers[answerIdx].isCorrect;
  const correctAnswerText = shuffledAnswers.find(a => a.isCorrect).text;
  hasAnswered = true;

  userAnswers.push({
    id: q.id,
    question: q.question,
    givenAnswer: shuffledAnswers[answerIdx].text,
    correct: isCorrect,
    correctAnswer: correctAnswerText
  });

  // Feedback
  const feedback = document.getElementById('feedback');
  if (isCorrect) {
    feedback.innerHTML = `<span class="correct">✅ Richtig!</span><br><span>Richtige Antwort: ${correctAnswerText}</span>`;
  } else {
    feedback.innerHTML = `<span class="incorrect">❌ Falsch!</span><br><span>Richtige Antwort: ${correctAnswerText}</span>`;
  }

  document.querySelectorAll('input[name="answer"]').forEach(input => input.disabled = true);
  document.getElementById('okBtn').disabled = true;
  document.getElementById('okBtn').style.display = 'none';
  document.getElementById('nextBtn').disabled = false;
  document.getElementById('nextBtn').style.display = '';
});

// Nächste Frage / Zum Ergebnis
document.getElementById('nextBtn').addEventListener('click', () => {
  if (!quizLoaded) return;
  current++;
  if (current < quizData.length) {
    showQuestion();
  } else {
    showResult();
  }
});

// Ergebnis-Seite
function showResult() {
  document.getElementById('quiz').innerHTML = '';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "100%";
  let correctCount = userAnswers.filter(a => a.correct).length;
  document.getElementById('result').innerHTML =
    `<div class="trophy">🏆</div>Quiz beendet!<br>Du hast <b>${correctCount}</b> von <b>${quizData.length}</b> Fragen richtig beantwortet.`;

  document.getElementById('downloadLog').style.display = '';
  document.getElementById('restartBtn').style.display = '';
  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('okBtn').style.display = 'none';
  document.getElementById('feedback').textContent = "";
}

// Log-Download
document.getElementById('downloadLog').addEventListener('click', () => {
  let log = '';
  userAnswers.forEach((a, idx) => {
    log += `Frage ${idx + 1} (ID: ${a.id}): ${a.question}\n`;
    log += `Deine Antwort: ${a.givenAnswer}\n`;
    log += `Korrekt? ${a.correct ? 'JA' : 'NEIN'}\n`;
    log += `Richtige Antwort: ${a.correctAnswer}\n\n`;
  });
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'quiz-log.txt';
  link.click();

  URL.revokeObjectURL(url);
});

// Quiz neu starten
document.getElementById('restartBtn').addEventListener('click', () => {
  if (!quizLoaded) return;
  quizData = shuffleArray(quizData);   // Auch die Fragen neu mischen!
  current = 0;
  userAnswers = [];
  showQuestion();
});

// Lade das Quiz aus externer JSON
function showLoading() {
  document.getElementById('quiz').innerHTML = '<div style="text-align:center; font-size:1.1em; padding:24px 0;">Quiz wird geladen…</div>';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "0%";
  document.getElementById('okBtn').style.display = 'none';
  document.getElementById('nextBtn').style.display = 'none';
  document.getElementById('downloadLog').style.display = 'none';
  document.getElementById('restartBtn').style.display = 'none';
  document.getElementById('feedback').textContent = "";
  document.getElementById('result').textContent = "";
}

function showError(msg) {
  document.getElementById('quiz').innerHTML = '<div style="color:var(--feedback-wrong);text-align:center;padding:24px 0;">'+msg+'</div>';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "0%";
}

showLoading();

fetch('q-and-a.json')
  .then(res => {
    if (!res.ok) throw new Error('Datei nicht gefunden');
    return res.json();
  })
  .then(data => {
    if (!Array.isArray(data) || !data[0].question || !data[0].answers) throw new Error('Ungültiges JSON-Format');
    quizData = shuffleArray(data); // Fragen werden gemischt!
    quizLoaded = true;
    current = 0;
    userAnswers = [];
    showQuestion();
  })
  .catch(err => {
    showError("Fehler beim Laden der Quiz-Daten: " + (err.message || err));
  });

}); // Ende DOMContentLoaded
