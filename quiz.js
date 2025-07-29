function showQuestion() {
  if (!quizLoaded) return;
  const quiz = document.getElementById('quiz');
  const q = quizData[current];
  hasAnswered = false;

  // 1. Erkennung: Ist es eine Freitext-Frage?
  const isFreeText = q.answers.length === 1;
  let freeTextAnswer = "";
  if (isFreeText) freeTextAnswer = q.answers[0].text;

  // 2. Fortschritt + Progressbar
  document.getElementById('quiz-progress').textContent = `Frage ${current + 1} von ${quizData.length}`;
  const progress = ((current + 1) / quizData.length) * 100;
  document.getElementById('progressbar-inner').style.width = progress + "%";

  // 3. HTML-Generierung
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

  // 4. Button-Logik
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

  // 5. Listener: 
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
