(function () {
  "use strict";

  function postEvent(event) {
    try {
      fetch("/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ timestamp: Date.now() }, event)),
      }).catch(function () {});
    } catch (_) {}
  }

  function showStep(n) {
    var walkthrough = document.querySelector(".walkthrough");
    if (!walkthrough) return;

    var steps = walkthrough.querySelectorAll(".step");
    var total = steps.length;
    if (n < 1 || n > total) return;

    steps.forEach(function (step) {
      step.classList.remove("active");
    });
    steps[n - 1].classList.add("active");

    walkthrough.setAttribute("data-current", String(n));

    var indicator = walkthrough.querySelector(".step-indicator");
    if (indicator) {
      indicator.textContent = "Step " + n + " of " + total;
    }

    var prevBtn = walkthrough.querySelector("[data-action='prev']");
    var nextBtn = walkthrough.querySelector("[data-action='next']");
    if (prevBtn) prevBtn.disabled = n === 1;
    if (nextBtn) nextBtn.disabled = n === total;

    postEvent({ type: "walkthrough-step", step: n, total: total });

    if (n === total) {
      postEvent({ type: "walkthrough-complete", total: total });
    }
  }

  function checkAnswer(el) {
    var quiz = el.closest(".quiz");
    if (!quiz) return;

    var options = quiz.querySelectorAll(".quiz-option");
    options.forEach(function (opt) {
      opt.classList.add("locked");
    });

    var isCorrect = el.dataset.correct === "true";

    if (isCorrect) {
      el.classList.add("correct");
    } else {
      el.classList.add("incorrect");
      options.forEach(function (opt) {
        if (opt.dataset.correct === "true") {
          opt.classList.add("reveal-correct");
        }
      });
    }

    var contentEl = el.querySelector(".content");
    postEvent({
      type: "quiz-answer",
      choice: el.dataset.choice,
      correct: isCorrect,
      text: contentEl ? contentEl.textContent.trim() : "",
    });
  }

  function prevStep() {
    var walkthrough = document.querySelector(".walkthrough");
    if (!walkthrough) return;
    var current = parseInt(walkthrough.getAttribute("data-current"), 10) || 1;
    if (current > 1) {
      showStep(current - 1);
    }
  }

  function nextStep() {
    var walkthrough = document.querySelector(".walkthrough");
    if (!walkthrough) return;
    var steps = walkthrough.querySelectorAll(".step");
    var current = parseInt(walkthrough.getAttribute("data-current"), 10) || 1;
    if (current < steps.length) {
      showStep(current + 1);
    }
  }

  window.checkAnswer = checkAnswer;
  window.prevStep = prevStep;
  window.nextStep = nextStep;

  document.addEventListener("DOMContentLoaded", function () {
    if (document.querySelector(".walkthrough")) {
      showStep(1);
    }
  });
})();
