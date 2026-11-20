function showFormMessage(form, message, isError = false) {
  let box = form.querySelector(".form-message");

  if (!box) {
    box = document.createElement("div");
    box.className = "form-message alert py-2 px-3 small mb-3";
    form.prepend(box);
  }

  box.setAttribute("role", isError ? "alert" : "status");
  box.setAttribute("aria-live", isError ? "assertive" : "polite");
  box.textContent = message;
  box.className = `form-message alert py-2 px-3 small mb-3 ${isError ? 'alert-danger' : 'alert-success'}`;
}

async function sendForm(form, endpoint) {
  const data = Object.fromEntries(new FormData(form).entries());

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // Keep empty if not json
  }

  if (!response.ok) {
    throw new Error(result.message || "The request could not be completed.");
  }

  return result;
}

function setSubmitting(form, isSubmitting, buttonText) {
  const button = form.querySelector('button[type="submit"]');

  if (!button) {
    return;
  }

  if (isSubmitting) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span> ${buttonText}`;
  } else {
    button.disabled = false;
    if (button.dataset.originalText) {
      button.textContent = button.dataset.originalText;
      delete button.dataset.originalText;
    }
  }
}

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setSubmitting(registerForm, true, "Creating account…");

    try {
      const result = await sendForm(registerForm, "/api/register");
      window.location.href = result.redirectUrl || "/patient-dashboard.html";
    } catch (error) {
      showFormMessage(registerForm, error.message, true);
    } finally {
      setSubmitting(registerForm, false);
    }
  });
}

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setSubmitting(loginForm, true, "Signing in…");

    try {
      const result = await sendForm(loginForm, "/api/login");
      const requested = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = requested || result.redirectUrl || "/patient-dashboard.html";
    } catch (error) {
      showFormMessage(loginForm, error.message, true);
    } finally {
      setSubmitting(loginForm, false);
    }
  });

  if (new URLSearchParams(window.location.search).has("registered")) {
    showFormMessage(loginForm, "Account created successfully. Please log in.");
  }
}
