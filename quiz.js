document.addEventListener("DOMContentLoaded", function() {

console.log("Quiz-App geladen.");

// ---------- Hilfsfunktionen ----------
function shuffleArray(array) {
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  console.log("Antworten/Fragen neu gemischt:", arr);
  return arr;
}

// Hilfsfunktion: Fetch mit Retry
async function fetchWithRetry(url, options, retries = 3, backoff = 300) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    return response;
  } catch (err) {
    if (retries > 0) {
      console.warn(`Fetch fehlgeschlagen (${err.message}), neuer Versuch in ${backoff} ms…`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;  // nach letzten Versuch weiterleiten
  }
}
  
// POST beide Texte an Semantic-Compare-API, liefere similarity (0...1)
async function getSimilarity(userText, correctText) {
  const data = [
    { text: userText, language: "de" },
    { text: correctText, language: "de" }
  ];
  console.log(data);
  const url = "https://173eb243-d3b9-47b6-869d-6703c8cd9e79-00-1a6pqjeggyha3.kirk.replit.dev/api/semantic-compare";
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
  const response = await fetchWithRetry(url, options, 3, 300);
  const json = await response.json();
  console.log(json);
  if (typeof json.similarity !== "number") {
    throw new Error("Fehlerhafte API-Antwort");
  }
  return json.similarity;
}

// ---------- Quiz-Logik ----------
let fullQuizData = [];
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
  console.log("Theme gewechselt:", dark ? "dark" : "light");
}
darkToggle.onclick = () => setTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
if (localStorage.getItem('quizapp_dark') === '1'
    || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  setTheme(true);
}

// Quiz-Start-/Auswahlseite (gleicher Look wie Fragen)
function showStartScreen() {
  let quizDiv = document.getElementById('quiz');
  let max = fullQuizData.length;
  let defaultNum = Math.min(10, max);
  let selectOptions = '';
  for (let i = 3; i <= max; i++) {
    selectOptions += `<option value="${i}" ${i===defaultNum?'selected':''}>${i}</option>`;
  }
  quizDiv.innerHTML = `
    <div class="quiz-start question" style="margin-top:32px">
      <div style="font-size:1.25em; font-weight:600; margin-bottom:12px;">Jägerausbildung MeckPomm QuizApp</div>
      <div style="margin-bottom:12px;">
        <label for="numQuestionsSelect" style="font-size:1.05em;">Wie viele Fragen möchtest du beantworten?</label>
        <select id="numQuestionsSelect" class="answers" style="width:auto; font-size:1.1em; margin-left:12px;">${selectOptions}</select>
      </div>
      <button id="startQuizBtn" class="main-btn" style="margin-top:20px;font-size:1.08em;padding:10px 22px;">Quiz starten</button>
    </div>
  `;
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "0%";
  if (document.getElementById('okBtn')) document.getElementById('okBtn').style.display = 'none';
  if (document.getElementById('nextBtn')) document.getElementById('nextBtn').style.display = 'none';
  if (document.getElementById('downloadLog')) document.getElementById('downloadLog').style.display = 'none';
  if (document.getElementById('feedback')) document.getElementById('feedback').textContent = "";
  if (document.getElementById('result')) document.getElementById('result').textContent = "";
  if (document.getElementById('restartBtn')) document.getElementById('restartBtn').style.display = 'none';
  if (document.getElementById('globalRestartBtn')) document.getElementById('globalRestartBtn').style.display = "";

  document.getElementById('startQuizBtn').onclick = () => {
    let n = parseInt(document.getElementById('numQuestionsSelect').value, 10);
    startQuizWithNQuestions(n);
  };
  console.log("Startscreen angezeigt, max Fragen:", max);
  if (document.getElementById('globalRestartBtn')) document.getElementById('globalRestartBtn').style.display = "";
}

// Quiz-Start (mit N Fragen)
function startQuizWithNQuestions(n) {
  quizData = shuffleArray(fullQuizData).slice(0, n);
  current = 0;
  userAnswers = [];
  quizLoaded = true;
  console.log(`Quiz startet mit ${n} Fragen.`);
  showQuestion();
}

// Quizfrage anzeigen
function showQuestion() {
  if (!quizLoaded) return;
  const quiz = document.getElementById('quiz');
  const q = quizData[current];
  hasAnswered = false;
  console.log(`Zeige Frage ${current+1}:`, q);

  // --- Freitext-Frage?
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
  if (document.getElementById('okBtn')) {
    document.getElementById('okBtn').disabled = true;
    document.getElementById('okBtn').style.display = '';
  }
  if (document.getElementById('nextBtn')) {
    document.getElementById('nextBtn').disabled = true;
    document.getElementById('nextBtn').style.display = 'none';
  }
  if (document.getElementById('feedback')) document.getElementById('feedback').textContent = "";
  if (document.getElementById('result')) document.getElementById('result').textContent = "";
  if (document.getElementById('downloadLog')) document.getElementById('downloadLog').style.display = 'none';
  if (document.getElementById('restartBtn')) document.getElementById('restartBtn').style.display = '';
  if (document.getElementById('globalRestartBtn')) document.getElementById('globalRestartBtn').style.display = '';

  // Letzte Frage? Button-Text ändern
  const nextBtnText = document.getElementById('nextBtnText');
  if (nextBtnText) {
    if (current === quizData.length - 1) {
      nextBtnText.textContent = "Zum Ergebnis";
    } else {
      nextBtnText.textContent = "Nächste Frage";
    }
  }

  // Listener: Auswahl- oder Texteingabe
  if (isFreeText) {
    const freeTextInput = document.getElementById('freeTextInput');
    if (freeTextInput && document.getElementById('okBtn')) {
      freeTextInput.addEventListener('input', function () {
        document.getElementById('okBtn').disabled = this.value.trim().length < 1;
        console.log("User tippt Freitext:", this.value);
      });
    }
  } else {
    document.querySelectorAll('input[name="answer"]').forEach(input => {
      input.addEventListener('change', () => {
        if (hasAnswered) return;
        if (document.getElementById('okBtn')) document.getElementById('okBtn').disabled = false;
        document.querySelectorAll('.answer').forEach(label => label.classList.remove('selected'));
        if (input.checked) input.parentElement.classList.add('selected');
        console.log("User hat Multiple-Choice ausgewählt:", input.value, input.nextElementSibling.textContent);
      });
    });
  }
}

// OK-Button
if (document.getElementById('okBtn')) {
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
      console.log("Freitext-Antwort wird geprüft:", { userInput, freeTextAnswer });

      const userNorm = userInput.trim().toLowerCase();
      const correctNorm = freeTextAnswer.trim().toLowerCase();
      const isExactlyEqual = userNorm === correctNorm;
      if (isExactlyEqual) console.log("Exakte Übereinstimmung erkannt.");

      getSimilarity(userInput, freeTextAnswer)
      .then(similarity => {
        const isCorrect = isExactlyEqual || similarity >= 0.7;
        console.log("Similarity von API:", similarity, "→ als korrekt gewertet?", isCorrect);

        userAnswers.push({
          id: q.id,
          question: q.question,
          givenAnswer: userInput,
          correct: isCorrect,
          correctAnswer: freeTextAnswer,
          similarity: similarity
        });
        console.log("Aktuelle Antwort gespeichert:", userAnswers[userAnswers.length-1]);

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
        console.error("Fehler bei der KI-Bewertung:", err);
        document.getElementById('feedback').textContent = "Fehler bei der KI-Bewertung: " + (err.message || err);
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
    console.log("Multiple-Choice ausgewertet:", {
      ausgewählt: shuffledAnswers[answerIdx].text,
      korrekt: correctAnswerText,
      isCorrect
    });

    userAnswers.push({
      id: q.id,
      question: q.question,
      givenAnswer: shuffledAnswers[answerIdx].text,
      correct: isCorrect,
      correctAnswer: correctAnswerText
    });

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
}

// Nächste Frage / Zum Ergebnis
if (document.getElementById('nextBtn')) {
  document.getElementById('nextBtn').addEventListener('click', () => {
    if (!quizLoaded) return;
    current++;
    console.log("Nächste Frage, Index:", current);
    if (current < quizData.length) {
      showQuestion();
    } else {
      showResult();
    }
  });
}

// Ergebnis-Seite
function showResult() {
  document.getElementById('quiz').innerHTML = '';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "100%";
  let correctCount = userAnswers.filter(a => a.correct).length;
  document.getElementById('result').innerHTML =
    `<div class="trophy">🏆</div>Quiz beendet!<br>Du hast <b>${correctCount}</b> von <b>${quizData.length}</b> Fragen richtig beantwortet.`;
  console.log("Quiz beendet! Ergebnis:", correctCount, "von", quizData.length, "richtig.");

  if (document.getElementById('downloadLog')) document.getElementById('downloadLog').style.display = '';
  if (document.getElementById('restartBtn')) document.getElementById('restartBtn').style.display = '';
  if (document.getElementById('nextBtn')) document.getElementById('nextBtn').style.display = 'none';
  if (document.getElementById('okBtn')) document.getElementById('okBtn').style.display = 'none';
  if (document.getElementById('feedback')) document.getElementById('feedback').textContent = "";
  if (document.getElementById('globalRestartBtn')) document.getElementById('globalRestartBtn').style.display = '';
}

// Log-Download
if (document.getElementById('downloadLog')) {
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
    console.log("Logdatei wurde erstellt und Download gestartet.");
  });
}

// Quiz neu starten (Button immer sichtbar)
if (document.getElementById('restartBtn')) {
  document.getElementById('restartBtn').addEventListener('click', () => {
    if (!fullQuizData.length) return;
    console.log("Quiz wird neu gestartet! (über Button)");
    quizLoaded = false;
    showStartScreen();
  });
}

// globalRestartBtn (immer oben sichtbar, wird hier dynamisch angelegt)
if (!document.getElementById('globalRestartBtn')) {
  let globalBtn = document.createElement('button');
  globalBtn.id = 'globalRestartBtn';
  globalBtn.textContent = 'Neu starten';
  globalBtn.className = 'main-btn';
  globalBtn.style = 'position:fixed;top:18px;right:18px;z-index:99;display:none;padding:7px 16px;font-size:1em;border-radius:12px;';
  globalBtn.onclick = () => {
    if (!fullQuizData.length) return;
    quizLoaded = false;
    console.log("Quiz wird neu gestartet! (global fixed)");
    showStartScreen();
  };
  document.body.appendChild(globalBtn);
}

// Lade das Quiz aus externer JSON
function showLoading() {
  document.getElementById('quiz').innerHTML = '<div style="text-align:center; font-size:1.1em; padding:24px 0;">Quiz wird geladen…</div>';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "0%";
  if (document.getElementById('okBtn')) document.getElementById('okBtn').style.display = 'none';
  if (document.getElementById('nextBtn')) document.getElementById('nextBtn').style.display = 'none';
  if (document.getElementById('downloadLog')) document.getElementById('downloadLog').style.display = 'none';
  if (document.getElementById('restartBtn')) document.getElementById('restartBtn').style.display = 'none';
  if (document.getElementById('feedback')) document.getElementById('feedback').textContent = "";
  if (document.getElementById('result')) document.getElementById('result').textContent = "";
  if (document.getElementById('globalRestartBtn')) document.getElementById('globalRestartBtn').style.display = '';
  console.log("Quiz wird geladen…");
}

function showError(msg) {
  document.getElementById('quiz').innerHTML = '<div style="color:var(--feedback-wrong);text-align:center;padding:24px 0;">'+msg+'</div>';
  document.getElementById('quiz-progress').textContent = "";
  document.getElementById('progressbar-inner').style.width = "0%";
  console.error("Quiz-Fehler:", msg);
}

showLoading();

fetch('q-and-a.json')
  .then(res => {
    if (!res.ok) throw new Error('Datei nicht gefunden');
    return res.json();
  })
  .then(data => {
    if (!Array.isArray(data) || !data[0].question || !data[0].answers) throw new Error('Ungültiges JSON-Format');
    fullQuizData = data;
    showStartScreen();
    console.log("Quizdaten erfolgreich geladen:", fullQuizData);
  })
  .catch(err => {
    showError("Fehler beim Laden der Quiz-Daten: " + (err.message || err));
  });

}); // Ende DOMContentLoaded
