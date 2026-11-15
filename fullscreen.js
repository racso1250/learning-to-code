// A "Full screen" button for every game in the arcade.
// Each game page just loads this file, and it adds the button by itself.
// Press the button (or the F key) to fill the whole screen, and again to go back.

(function () {
  const page = document.documentElement;

  // Some browsers (like iPhones) can't do full screen. Then we don't show the button.
  if (!page.requestFullscreen) return;

  // ----- How things look in full screen -----
  const style = document.createElement("style");
  style.textContent = `
    .fullscreen-button {
      font-family: inherit;
      font-size: 9px;
      padding: 6px 10px;
      margin: 0;
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 6px;
      background: rgba(20, 15, 40, 0.85);
      color: #ffffff;
      cursor: pointer;
      line-height: 1.5;
    }
    .fullscreen-button:hover {
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
    }
    .fullscreen-button.floating {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 1000;
    }

    /* In full screen: hide the title and help text, and make the game as big as it fits */
    html.is-fullscreen body {
      padding-top: 8px;
    }
    html.is-fullscreen h1,
    html.is-fullscreen .help {
      display: none;
    }
    html.is-fullscreen .screen,
    html.is-fullscreen .hud,
    html.is-fullscreen #place,
    html.is-fullscreen #game {
      max-width: min(100%, calc((100vh - 64px) * 1.5));
    }
    html.is-fullscreen #game {
      margin-left: auto;
      margin-right: auto;
    }
  `;
  document.head.appendChild(style);

  // ----- The button -----
  const button = document.createElement("button");
  button.className = "fullscreen-button";
  button.textContent = "⛶ Full screen";
  button.title = "Full screen (F)";

  // Put it in the game's top bar if there is one, otherwise in the top-right corner
  const hud = document.querySelector(".hud");
  if (hud) {
    hud.appendChild(button);
  } else {
    button.classList.add("floating");
    document.body.appendChild(button);
  }

  function toggle() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      page.requestFullscreen().catch(function () {
        // The browser said no (this can happen in some settings). Nothing to do.
      });
    }
  }

  button.addEventListener("click", function () {
    button.blur(); // so the arrow keys keep going to the game
    toggle();
  });

  // The F key works too (but not while typing in a box, like in Guess the Number)
  document.addEventListener("keydown", function (event) {
    const typing = event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA";
    if ((event.key === "f" || event.key === "F") && !typing && !event.ctrlKey && !event.metaKey) {
      toggle();
    }
  });

  // When full screen starts or stops (even with Escape), update the look and the button
  document.addEventListener("fullscreenchange", function () {
    const on = Boolean(document.fullscreenElement);
    page.classList.toggle("is-fullscreen", on);
    button.textContent = on ? "✕ Exit full screen" : "⛶ Full screen";
  });
})();
