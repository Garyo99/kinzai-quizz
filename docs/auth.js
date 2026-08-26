(() => {
  "use strict";
  const AUTH_KEY = "kinzai-access-v1";
  const FAILURE_KEY = "kinzai-access-failures-v1";
  const LOCK_KEY = "kinzai-access-locked-v1";
  const EXPECTED_HASH =
    "88bc475ec9844d05a8a7c7f132cbcbf3ccffce77c465551f7a36ec0e5df24f6b";

  async function matches(value) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(value);
      const digest = await crypto.subtle.digest("SHA-256", data);
      return (
        [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("") === EXPECTED_HASH
      );
    }
    return value === String.fromCharCode(48, 57, 48, 50);
  }

  if (localStorage.getItem(AUTH_KEY) === "granted") {
    document.documentElement.classList.remove("auth-pending");
    return;
  }

  document.documentElement.classList.add("auth-locked");
  const gate = document.createElement("main");
  gate.className = "auth-gate";
  gate.innerHTML = `<section class="auth-card" aria-labelledby="auth-title"><img src="docs/assets/finance-icon.png" alt=""><p class="auth-kicker">PRIVATE STUDY ROOM</p><h1 id="auth-title">パスワードを入力</h1><p class="auth-lead">この学習サイトを開くには認証が必要です。</p><form id="auth-form"><label for="auth-password">パスワード</label><input id="auth-password" name="password" type="password" inputmode="text" autocomplete="current-password" required autofocus><p id="auth-error" class="auth-error" role="alert" hidden>パスワードが正しくありません。</p><button type="submit">サイトを開く</button></form></section><button id="auth-unlock" class="auth-unlock" type="button" tabindex="-1" aria-hidden="true"></button>`;
  document.body.append(gate);
  document.documentElement.classList.remove("auth-pending");

  const form = document.getElementById("auth-form");
  const input = document.getElementById("auth-password");
  const submitButton = form.querySelector("button");
  const error = document.getElementById("auth-error");
  function setLocked(locked) {
    input.disabled = locked;
    submitButton.disabled = locked;
    error.hidden = false;
    error.textContent = locked
      ? "サイトがロックされました。管理者に連絡してください。"
      : "パスワードが正しくありません。";
  }
  if (localStorage.getItem(LOCK_KEY) === "locked") setLocked(true);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (localStorage.getItem(LOCK_KEY) === "locked") return;
    submitButton.disabled = true;
    if (await matches(input.value)) {
      localStorage.setItem(AUTH_KEY, "granted");
      localStorage.removeItem(FAILURE_KEY);
      localStorage.removeItem(LOCK_KEY);
      gate.remove();
      document.documentElement.classList.remove("auth-locked");
    } else {
      const failures = Number(localStorage.getItem(FAILURE_KEY) || 0) + 1;
      localStorage.setItem(FAILURE_KEY, String(failures));
      input.value = "";
      if (failures >= 3) {
        localStorage.setItem(LOCK_KEY, "locked");
        setLocked(true);
      } else {
        error.hidden = false;
        error.textContent = "パスワードが正しくありません。";
        submitButton.disabled = false;
        input.focus();
      }
    }
  });

  let unlockClicks = 0;
  let unlockTimer;
  document.getElementById("auth-unlock").addEventListener("click", () => {
    if (localStorage.getItem(LOCK_KEY) !== "locked") return;
    unlockClicks += 1;
    clearTimeout(unlockTimer);
    if (unlockClicks >= 3) {
      localStorage.removeItem(FAILURE_KEY);
      localStorage.removeItem(LOCK_KEY);
      unlockClicks = 0;
      setLocked(false);
      error.hidden = true;
      input.focus();
    } else {
      unlockTimer = window.setTimeout(() => {
        unlockClicks = 0;
      }, 1500);
    }
  });
})();
