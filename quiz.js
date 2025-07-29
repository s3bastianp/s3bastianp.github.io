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

// Cortical.io Fingerprint holen, via Replit NodeJS Proxy
async function getFingerprint(answerText) {
  const response = await fetch("https://173eb243-d3b9-47b6-869d-6703c8cd9e79-00-1a6pqjeggyha3.kirk.replit.dev/api/fingerprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: answerText })
  });
  if (!response.ok) throw new Error("API Fehler: " + response.status);
  return (await response.json()).representation;
}

// Jaccard-Ähnlichkeit von zwei Fingerprints (0...1)
function jaccardSimilarity(a, b) {
  let intersection = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === 1 || b[i] === 1) union++;
    if (a[i] === 1 && b[i] === 1) intersection++;
  }
  return union === 0 ? 0 : (intersection / union);
}

// Optional: Für Vorverarbeitung/Normalisierung vor Fingerprint
function normalizeForFingerprint(str) {
  return str.trim().toLowerCase()
    .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
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
    document.getElementById('okBtn').disabled = true;
    document.getElementById('okBtn').textContent = "Prüfe...";

    // --- Normalisierung für Vergleich ---
    const userNorm = userInput.trim().toLowerCase()
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const correctNorm = freeTextAnswer.trim().toLowerCase()
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
    const isExactlyEqual = userNorm === correctNorm;
        
    // Nur hier: Beide Fingerprints holen, dann vergleichen
    Promise.all([
      getFingerprint(userNorm),
      getFingerprint(correctNorm)
    ])
    .then(([userFp, correctFp]) => {

      console.log(userFp);
      console.log(correctFp);
      
      const similarity = jaccardSimilarity(userFp, correctFp);
      // Schwellenwert: ggf. anpassen! 0.18 ist ein sinnvoller Startwert.
      const isCorrect = isExactlyEqual || similarity >= 0.18;
      
      userAnswers.push({
        id: q.id,
        question: q.question,
        givenAnswer: userInput,
        correct: isCorrect,
        correctAnswer: freeTextAnswer,
        similarity: similarity
      });

      const feedback = document.getElementById('feedback');
      if (isCorrect) {
        feedback.innerHTML = `<span class="correct">✅ Richtig!</span><br><span>Richtige Antwort: ${freeTextAnswer}<br><small>Ähnlichkeit: ${(similarity*100).toFixed(1)}%</small></span>`;
      } else {
        feedback.innerHTML = `<span class="incorrect">❌ Falsch!</span><br><span>Richtige Antwort: ${freeTextAnswer}<br><small>Ähnlichkeit: ${(similarity*100).toFixed(1)}%</small></span>`;
      }

      document.getElementById('okBtn').style.display = 'none';
      document.getElementById('nextBtn').disabled = false;
      document.getElementById('nextBtn').style.display = '';
      document.getElementById('freeTextInput').disabled = true;
      hasAnswered = true;
      document.getElementById('okBtn').textContent = "OK";
    })
    .catch(err => {
      document.getElementById('feedback').textContent = "Fehler bei der KI-Bewertung: " + err.message;
      document.getElementById('okBtn').disabled = false;
      document.getElementById('okBtn').textContent = "OK";
    });
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
    log += `Richtige Antwort: ${a.correctAnswer}\n`;
    if (typeof a.similarity !== "undefined") {
      log += `Ähnlichkeit: ${(a.similarity*100).toFixed(1)}%\n`;
    }
    log += `\n`;
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
