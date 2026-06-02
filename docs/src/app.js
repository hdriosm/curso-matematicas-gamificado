const app = document.querySelector("#app");

const routes = [
  { id: "inicio",     label: "Inicio",      icon: "⌂" },
  { id: "resultados", label: "Resultados",  icon: "✓" },
  { id: "modulos",    label: "Modulos",     icon: "▦" },
  { id: "actividades",label: "Actividades", icon: "◆" },
  { id: "quices",     label: "Quices",      icon: "?" },
  { id: "juegos",     label: "Juegos",      icon: "★" },
  { id: "foros",      label: "Foros",       icon: "◌" },
  { id: "evaluacion", label: "Evaluacion",  icon: "%" },
  { id: "progreso",   label: "Progreso",    icon: "↗" },
  { id: "misiones",   label: "Misiones",    icon: "◎" }
];

let state = {
  data: null,
  active: "inicio",
  playerName: null,
  quizAnswers: {},
  quizSelections: {},
  gameAnswers: {},
  feedback: "Selecciona una actividad, quiz o reto para recibir retroalimentacion inmediata."
};

// ─── Persistencia en localStorage ────────────────────────────────────────────

const PLAYER_KEY  = "mati_current_player";
const saveKey     = (name) => `mati_save_${name.trim().toLowerCase()}`;

function saveProgress() {
  if (!state.playerName) return;
  const save = {
    playerName:    state.playerName,
    quizAnswers:   state.quizAnswers,
    quizSelections: state.quizSelections,
    gameAnswers:   state.gameAnswers,
    puntos:        state.data.gamificacion.puntos,
    nivelNumero:   state.data.gamificacion.nivelNumero,
    nivelActual:   state.data.gamificacion.nivelActual,
    ranking:       state.data.gamificacion.ranking,
    insignias:     state.data.gamificacion.insignias,
    misiones:      state.data.misiones
  };
  localStorage.setItem(saveKey(state.playerName), JSON.stringify(save));
  localStorage.setItem(PLAYER_KEY, state.playerName);
}

function applyProgress(save) {
  state.quizAnswers    = save.quizAnswers    || {};
  state.quizSelections = save.quizSelections || {};
  state.gameAnswers    = save.gameAnswers    || {};
  state.data.gamificacion.puntos      = save.puntos      ?? 0;
  state.data.gamificacion.nivelNumero = save.nivelNumero ?? 1;
  state.data.gamificacion.nivelActual = save.nivelActual ?? state.data.gamificacion.niveles[0].nombre;
  if (save.ranking)   state.data.gamificacion.ranking   = save.ranking;
  if (save.insignias) state.data.gamificacion.insignias = save.insignias;
  if (save.misiones)  state.data.misiones = save.misiones;
}

function showWelcomeModal(onSubmit) {
  const overlay = document.createElement("div");
  overlay.className = "welcome-overlay";
  const lastPlayer = localStorage.getItem(PLAYER_KEY) || "";
  overlay.innerHTML = `
    <div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div class="welcome-logo" aria-hidden="true">f(x)</div>
      <h1 id="welcome-title">Matematicas Interactivas</h1>
      <p>Ingresa tu nombre para comenzar o continuar donde lo dejaste.</p>
      <form class="welcome-form" autocomplete="off" novalidate>
        <label for="welcome-name">Tu nombre</label>
        <input
          id="welcome-name"
          type="text"
          placeholder="Escribe tu nombre..."
          maxlength="30"
          value="${escapeHtml(lastPlayer)}"
          required
        />
        <p class="welcome-error" hidden>Por favor escribe tu nombre.</p>
        <button type="submit" class="primary">
          ${lastPlayer ? "Continuar" : "Comenzar"}
        </button>
      </form>
      ${lastPlayer ? `<button class="welcome-new" type="button">Entrar como otro jugador</button>` : ""}
    </div>
  `;
  document.body.appendChild(overlay);

  const input    = overlay.querySelector("#welcome-name");
  const form     = overlay.querySelector(".welcome-form");
  const errorEl  = overlay.querySelector(".welcome-error");
  const submitBtn = overlay.querySelector("[type=submit]");
  const newBtn   = overlay.querySelector(".welcome-new");

  setTimeout(() => input.focus(), 50);

  input.addEventListener("input", () => {
    submitBtn.textContent = input.value.trim() ? "Continuar" : "Comenzar";
    errorEl.hidden = true;
  });

  if (newBtn) {
    newBtn.addEventListener("click", () => {
      input.value = "";
      input.focus();
      submitBtn.textContent = "Comenzar";
      newBtn.remove();
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) {
      errorEl.hidden = false;
      input.focus();
      return;
    }
    overlay.classList.add("welcome-out");
    overlay.addEventListener("animationend", () => overlay.remove(), { once: true });
    onSubmit(name);
  });
}

// ─── Banco de preguntas aleatorias ───────────────────────────────────────────

function getOrSelectQuestions(quizId, count = 5) {
  if (state.quizSelections[quizId]) return state.quizSelections[quizId];
  const bank = state.data.bancoPreguntas.filter((q) => q.quiz === quizId);
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  state.quizSelections[quizId] = shuffled.slice(0, count);
  return state.quizSelections[quizId];
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadData() {
  const response = await fetch("./public/db.json");
  return response.json();
}

function progressBar(value, label = "") {
  return `
    <div class="meter" aria-label="${label || `Progreso ${value}%`}">
      <span style="width:${value}%"></span>
    </div>
  `;
}

// ─── Sistema de toasts ────────────────────────────────────────────────────────

(function initToastContainer() {
  if (!document.getElementById("toast-container")) {
    const container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "false");
    document.body.appendChild(container);
  }
})();

function showToast(message, type = "info", duration = 4000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  const icons = { ok: "✓", warn: "!", info: "i" };
  toast.innerHTML = `
    <span aria-hidden="true" class="toast-icon">${icons[type] ?? "i"}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
    <button class="toast-close" aria-label="Cerrar notificacion">✕</button>
  `;
  container.appendChild(toast);
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast.querySelector(".toast-close").addEventListener("click", () => {
    clearTimeout(timer);
    dismissToast(toast);
  });
}

function dismissToast(toast) {
  toast.classList.add("toast-hide");
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}

// ─── Motor de gamificacion ────────────────────────────────────────────────────

function calcularNivel(puntos) {
  const niveles = state.data.gamificacion.niveles;
  let actual = niveles[0];
  for (const n of niveles) {
    if (puntos >= n.puntosNecesarios) actual = n;
    else break;
  }
  return actual;
}

function porcentajeXP() {
  const { puntos, nivelNumero, niveles } = state.data.gamificacion;
  const actual    = niveles.find((n) => n.nivel === nivelNumero);
  const siguiente = niveles.find((n) => n.nivel === nivelNumero + 1);
  if (!siguiente) return 100;
  const rango  = siguiente.puntosNecesarios - actual.puntosNecesarios;
  const avance = puntos - actual.puntosNecesarios;
  return Math.min(100, Math.round((avance / rango) * 100));
}

function puntosParaSiguienteNivel() {
  const { puntos, nivelNumero, niveles } = state.data.gamificacion;
  const siguiente = niveles.find((n) => n.nivel === nivelNumero + 1);
  return siguiente ? siguiente.puntosNecesarios - puntos : null;
}

function sumarPuntos(cantidad, origen = "") {
  if (cantidad <= 0) return;
  const gam = state.data.gamificacion;
  gam.puntos += cantidad;

  const rankEntry = gam.ranking.find((r) => r.nombre === "Tu progreso");
  if (rankEntry) rankEntry.puntos = gam.puntos;
  gam.ranking.sort((a, b) => b.puntos - a.puntos);

  const nivelNuevo = calcularNivel(gam.puntos);
  if (nivelNuevo.nivel > gam.nivelNumero) {
    gam.nivelNumero = nivelNuevo.nivel;
    gam.nivelActual = nivelNuevo.nombre;
    mostrarCelebracion("nivel", `¡Subiste a ${nivelNuevo.nombre}!`);
  }

  actualizarTopbarPuntos();
  evaluarMisiones();
  saveProgress();
}

function actualizarTopbarPuntos() {
  const gam = state.data.gamificacion;
  const ptsEl = document.querySelector(".player-pts");
  if (ptsEl) ptsEl.innerHTML = `${gam.puntos} <small>XP</small>`;
  const fillEl = document.querySelector(".xp-bar-fill");
  if (fillEl) fillEl.style.width = `${porcentajeXP()}%`;
  const levelEl = document.querySelector(".player-level");
  if (levelEl) levelEl.textContent = gam.nivelActual;
}

// ─── Motor de insignias ───────────────────────────────────────────────────────

function desbloquearInsignia(id) {
  const insignia = state.data.gamificacion.insignias.find((i) => i.id === id);
  if (!insignia || insignia.desbloqueada) return;
  insignia.desbloqueada = true;
  mostrarCelebracion("insignia", `Insignia desbloqueada: ${insignia.nombre}`);
}

function verificarInsigniasQuiz(quiz) {
  if (quiz.id === "quiz-numerico") desbloquearInsignia("primera-mision");

  const seleccionadas = getOrSelectQuestions(quiz.id, 5);
  const respondidas   = seleccionadas.filter(
    (p) => state.quizAnswers[`${quiz.id}-${p.id}`] !== undefined
  ).length;

  if (respondidas === seleccionadas.length) {
    const todasCorrectas = seleccionadas.every(
      (p) => state.quizAnswers[`${quiz.id}-${p.id}`] === p.correcta
    );
    if (todasCorrectas) desbloquearInsignia("quiz-perfecto");
    if (quiz.id === "quiz-algebra") desbloquearInsignia("pensamiento-estadistico");
  }

  if (state.data.gamificacion.puntos >= 400) desbloquearInsignia("proyecto-final");
}

function verificarInsigniasJuego() {
  const juego = state.data.juegos[0];
  const scoreJuego = juego.retos.reduce((total, reto, i) => {
    return total + (state.gameAnswers[i] === reto.correcta ? (reto.puntos ?? 20) : 0);
  }, 0);
  if (scoreJuego >= 60) desbloquearInsignia("dominio-algebra");
  if (state.data.gamificacion.puntos >= 400) desbloquearInsignia("proyecto-final");
}

function verificarInsigniaForo() {
  desbloquearInsignia("foro-activo");
}

// ─── Motor de misiones ────────────────────────────────────────────────────────

function evaluarObjetivo(obj) {
  const { quizAnswers, gameAnswers, data } = state;
  switch (obj.tipo) {
    case "quiz_completo": {
      const quiz = data.quices.find((q) => q.id === obj.referencia);
      if (!quiz) return false;
      const sel = getOrSelectQuestions(quiz.id, 5);
      return sel.every((p) => quizAnswers[`${quiz.id}-${p.id}`] !== undefined);
    }
    case "quiz_sin_errores": {
      const quiz = data.quices.find((q) => q.id === obj.referencia);
      if (!quiz) return false;
      const sel = getOrSelectQuestions(quiz.id, 5);
      return (
        sel.every((p) => quizAnswers[`${quiz.id}-${p.id}`] !== undefined) &&
        sel.every((p) => quizAnswers[`${quiz.id}-${p.id}`] === p.correcta)
      );
    }
    case "juego_puntos_min": {
      const juego = data.juegos[0];
      const score = juego.retos.reduce(
        (t, r, i) => t + (gameAnswers[i] === r.correcta ? (r.puntos ?? 20) : 0), 0
      );
      return score >= (obj.minimo ?? 60);
    }
    case "juego_completo": {
      return data.juegos[0].retos.every((_, i) => gameAnswers[i] !== undefined);
    }
    case "foro_respondido":
      return obj.completado;
    default:
      return false;
  }
}

function evaluarMisiones() {
  const misiones = state.data.misiones;
  if (!misiones) return;
  for (const mision of misiones) {
    if (mision.completada) continue;
    for (const obj of mision.objetivos) {
      if (!obj.completado) obj.completado = evaluarObjetivo(obj);
    }
    if (mision.objetivos.every((o) => o.completado) && !mision.completada) {
      mision.completada = true;
      sumarPuntos(mision.recompensa.puntos, `mision:${mision.id}`);
      if (mision.recompensa.insignia) desbloquearInsignia(mision.recompensa.insignia);
      mostrarCelebracion("mision", `Mision completada: ${mision.titulo}`);
    }
  }
}

// ─── Efectos de celebracion ───────────────────────────────────────────────────

const ICONOS_CELEB  = { nivel: "⬆", insignia: "★", mision: "◎" };
const COLORES_CONF  = ["#4a9eff","#7c3aed","#f59e0b","#ef4444","#10b981","#ec4899"];

function mostrarCelebracion(tipo, mensaje) {
  document.querySelectorAll(".celebracion-overlay").forEach((el) => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "celebracion-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="celebracion-card">
      <span class="celeb-icono" aria-hidden="true">${ICONOS_CELEB[tipo] ?? "★"}</span>
      <p>${escapeHtml(mensaje)}</p>
    </div>
  `;
  document.body.appendChild(overlay);

  for (let i = 0; i < 40; i++) {
    const pieza = document.createElement("div");
    pieza.className = "confeti-pieza";
    pieza.style.setProperty("--dur",   `${1.4 + Math.random() * 1.2}s`);
    pieza.style.setProperty("--delay", `${Math.random() * 0.6}s`);
    pieza.style.left       = `${Math.random() * 100}vw`;
    pieza.style.background = COLORES_CONF[Math.floor(Math.random() * COLORES_CONF.length)];
    pieza.style.width      = `${6 + Math.random() * 8}px`;
    pieza.style.height     = `${6 + Math.random() * 8}px`;
    document.body.appendChild(pieza);
    pieza.addEventListener("animationend", () => pieza.remove());
  }

  setTimeout(() => overlay.remove(), 2900);
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────

function renderXPBar() {
  const { puntos, nivelActual, nivelNumero, niveles } = state.data.gamificacion;
  const pct       = porcentajeXP();
  const faltante  = puntosParaSiguienteNivel();
  const siguiente = niveles.find((n) => n.nivel === nivelNumero + 1);
  return `
    <div class="xp-bar-wrap" aria-label="Barra de experiencia">
      <div class="xp-bar-labels">
        <span class="player-level">${nivelActual}</span>
        <span class="xp-hint">${faltante === null ? "Nivel maximo" : `${faltante} pts para ${siguiente.nombre}`}</span>
      </div>
      <div class="xp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="xp-bar-fill ${pct === 100 ? "xp-bar-fill--max" : ""}" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function layout(content) {
  const { curso, gamificacion } = state.data;
  return `
    <header class="topbar">
      <div>
        <p class="eyebrow">Ambiente virtual de aprendizaje</p>
        <h1>${curso.nombre}</h1>
      </div>
      <div class="player-summary" aria-label="Resumen de gamificacion">
        <div class="player-name-row">
          <span class="player-name" aria-label="Jugador">${escapeHtml(state.playerName || "")}</span>
          <button class="player-switch" title="Cambiar jugador" aria-label="Cambiar jugador">⇄</button>
        </div>
        <strong class="player-pts">${gamificacion.puntos} <small>XP</small></strong>
        ${renderXPBar()}
      </div>
    </header>
    <div class="shell">
      <nav class="sidebar" aria-label="Navegacion principal">
        ${routes
          .map(
            (route) => `
              <button
                class="${state.active === route.id ? "active" : ""}"
                data-route="${route.id}"
                ${state.active === route.id ? 'aria-current="page"' : ""}
              >
                <span aria-hidden="true">${route.icon}</span>
                ${route.label}
              </button>
            `
          )
          .join("")}
      </nav>
      <main id="main-content" class="content view-enter" tabindex="-1" aria-label="Contenido principal">${content}</main>
    </div>
  `;
}

// ─── Vistas ───────────────────────────────────────────────────────────────────

function renderHome() {
  const { curso, gamificacion, retroalimentaciones } = state.data;
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">${curso.modalidad} · ${curso.duracion}</p>
        <h2>${curso.nombre}</h2>
        <p>${curso.proposito}</p>
        <div class="hero-actions">
          <button class="primary" data-route="modulos">Explorar modulos</button>
          <button class="secondary" data-route="quices">Resolver quiz</button>
        </div>
      </div>
      <div class="math-panel" aria-label="Panel visual matematico">
        <div class="formula">f(x)=2x+1</div>
        <div class="grid-chart">
          <span></span><span></span><span></span><span></span>
        </div>
        <div class="badge-cloud">
          ${gamificacion.insignias
            .filter((b) => b.desbloqueada)
            .slice(0, 3)
            .map((b) => `<span title="${b.descripcion}">${b.icono} ${b.nombre}</span>`)
            .join("") || "<span>Completa actividades para ganar insignias</span>"}
        </div>
      </div>
    </section>
    <section class="section-grid">
      <article class="panel wide">
        <h3>Presentacion del curso</h3>
        <p>${curso.descripcion}</p>
        <p><strong>Contexto educativo:</strong> ${curso.contexto}</p>
        <p><strong>Justificacion pedagogica:</strong> ${curso.justificacion}</p>
        <p><strong>Perfil del estudiante:</strong> ${curso.perfil}</p>
      </article>
      <article class="panel">
        <h3>Competencias</h3>
        <ul class="clean-list">${curso.competencias.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="panel feedback">
        <h3>Retroalimentacion formativa</h3>
        <p>${retroalimentaciones[0]}</p>
      </article>
    </section>
  `;
}

function renderResultados() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Alineacion pedagogica</p>
      <h2>Resultados de aprendizaje</h2>
      <p>Los resultados conectan actividades, recursos digitales, evaluacion y retroalimentacion.</p>
    </section>
    <div class="cards">
      ${state.data.resultadosAprendizaje
        .map(
          (ra) => `
            <article class="card">
              <span class="tag">${ra.id}</span>
              <h3>${ra.texto}</h3>
              <p>${ra.alineacion}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderModulos() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Arquitectura navegable</p>
      <h2>Unidades tematicas</h2>
    </section>
    <div class="module-grid">
      ${state.data.modulos
        .map(
          (modulo) => `
            <article class="module-card">
              <div class="module-number">Unidad ${modulo.id}</div>
              <h3>${modulo.titulo}</h3>
              <p><strong>Tema central:</strong> ${modulo.tema}</p>
              <p><strong>Actividad:</strong> ${modulo.actividad}</p>
              <p><strong>Evaluacion:</strong> ${modulo.evaluacion}</p>
              <p><strong>Recurso:</strong> ${modulo.recurso}</p>
              ${progressBar(modulo.progreso, `Progreso unidad ${modulo.id}`)}
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderActividades() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Aprendizaje activo</p>
      <h2>Actividades mediadas por tecnologia</h2>
    </section>
    <div class="activity-list">
      ${state.data.actividades
        .map(
          (actividad, index) => `
            <article class="activity">
              <div>
                <span class="tag">${actividad.tipo}</span>
                <h3>${actividad.titulo}</h3>
                <p>${actividad.descripcion}</p>
                <dl>
                  <div><dt>Unidad</dt><dd>${actividad.unidad}</dd></div>
                  <div><dt>Resultado</dt><dd>${actividad.resultado}</dd></div>
                  <div><dt>Producto</dt><dd>${actividad.producto}</dd></div>
                  <div><dt>Criterios</dt><dd>${actividad.criterios}</dd></div>
                </dl>
              </div>
              <aside class="activity-aside">
                <strong class="activity-pts">${actividad.puntos} pts</strong>
                <p>${actividad.instrucciones}</p>
                <button class="primary" data-feedback="${index}">Ver retroalimentacion</button>
              </aside>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderQuices() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Evaluacion automatica</p>
      <h2>Quices interactivos</h2>
      <p class="quiz-bank-note">Cada sesion muestra 5 preguntas seleccionadas aleatoriamente del banco.</p>
      <p>${state.feedback}</p>
    </section>
    ${state.data.quices
      .map(
        (quiz) => {
          const preguntas = getOrSelectQuestions(quiz.id, 5);
          return `
            <section class="quiz">
              <div class="quiz-title">
                <h3>${quiz.titulo}</h3>
                <span>${quiz.logro}</span>
              </div>
              ${preguntas
                .map((pregunta, questionIndex) => {
                  const key    = `${quiz.id}-${pregunta.id}`;
                  const answer = state.quizAnswers[key];
                  return `
                    <fieldset class="question">
                      <legend>${questionIndex + 1}. ${pregunta.enunciado}</legend>
                      <div class="options" role="radiogroup">
                        ${pregunta.opciones
                          .map(
                            (opcion, optionIndex) => {
                              let cls = "";
                              if (answer !== undefined) {
                                if (optionIndex === answer && answer === pregunta.correcta) cls = "is-correct selected";
                                else if (optionIndex === answer && answer !== pregunta.correcta) cls = "is-wrong selected";
                                else if (optionIndex === pregunta.correcta) cls = "is-correct";
                              }
                              return `
                                <button
                                  class="${cls}"
                                  data-quiz="${quiz.id}"
                                  data-question-id="${pregunta.id}"
                                  data-option="${optionIndex}"
                                  role="radio"
                                  aria-checked="${answer === optionIndex ? 'true' : 'false'}"
                                  ${answer !== undefined ? "disabled" : ""}
                                >${opcion}</button>
                              `;
                            }
                          )
                          .join("")}
                      </div>
                      ${
                        answer !== undefined
                          ? `<p class="question-feedback ${answer === pregunta.correcta ? "ok" : "warn"}" aria-live="polite">${pregunta.retroalimentacion}</p>`
                          : ""
                      }
                    </fieldset>
                  `;
                })
                .join("")}
              <div class="score">${quizScore(quiz)} puntos obtenidos</div>
            </section>
          `;
        }
      )
      .join("")}
  `;
}

function quizScore(quiz) {
  const preguntas = getOrSelectQuestions(quiz.id, 5);
  return preguntas.reduce((total, pregunta) => {
    const answer = state.quizAnswers[`${quiz.id}-${pregunta.id}`];
    return total + (answer === pregunta.correcta ? pregunta.puntos : 0);
  }, 0);
}

function renderJuegos() {
  const juego = state.data.juegos[0];
  const score = juego.retos.reduce((total, reto, index) => {
    return total + (state.gameAnswers[index] === reto.correcta ? (reto.puntos ?? 20) : 0);
  }, 0);
  return `
    <section class="page-heading">
      <p class="eyebrow">Reto desbloqueable</p>
      <h2>${juego.titulo}</h2>
      <p>${juego.instrucciones}</p>
    </section>
    <div class="game-board">
      ${juego.retos
        .map(
          (reto, index) => `
            <article class="game-card">
              <span class="tag dificultad-${reto.dificultad ?? 'basico'}">${reto.dificultad ?? 'basico'} · ${reto.puntos ?? 20} pts</span>
              <h3>${reto.pregunta}</h3>
              <div class="options">
                ${reto.opciones
                  .map(
                    (opcion, optionIndex) => {
                      let cls = "";
                      const ans = state.gameAnswers[index];
                      if (ans !== undefined) {
                        if (optionIndex === ans && ans === reto.correcta) cls = "is-correct selected";
                        else if (optionIndex === ans && ans !== reto.correcta) cls = "is-wrong selected";
                        else if (optionIndex === reto.correcta) cls = "is-correct";
                      }
                      return `
                        <button
                          class="${cls}"
                          data-game="${index}"
                          data-game-option="${optionIndex}"
                          ${ans !== undefined ? "disabled" : ""}
                        >${opcion}</button>
                      `;
                    }
                  )
                  .join("")}
              </div>
              ${
                state.gameAnswers[index] !== undefined
                  ? `<p class="game-feedback ${state.gameAnswers[index] === reto.correcta ? "ok" : "warn"}">${reto.feedback}</p>`
                  : ""
              }
            </article>
          `
        )
        .join("")}
    </div>
    <aside class="achievement">
      <strong>${score} puntos de juego</strong>
      <span>${score >= 60 ? "Insignia desbloqueada: Dominio de algebra" : "Completa los retos para desbloquear la insignia."}</span>
    </aside>
  `;
}

function renderForos() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Colaboracion academica</p>
      <h2>Foros del curso</h2>
    </section>
    <div class="forum-list">
      ${state.data.foros
        .map(
          (foro) => {
            const forumId = foro.titulo.replace(/\s+/g, "-").toLowerCase();
            return `
              <article class="forum">
                <div class="forum-head">
                  <h3>${foro.titulo}</h3>
                  <span>${foro.puntos} pts</span>
                </div>
                <p class="prompt">${foro.pregunta}</p>
                <p><strong>Apertura:</strong> ${foro.apertura} · <strong>Cierre:</strong> ${foro.cierre}</p>
                <p><strong>Criterios:</strong> ${foro.criterios}</p>
                <div class="posts" id="posts-${forumId}">
                  ${foro.participaciones.map((post) => `<blockquote><strong>${escapeHtml(post.autor)}:</strong> ${escapeHtml(post.mensaje)}</blockquote>`).join("")}
                </div>
                <div class="reply-zone">
                  <button class="secondary toggle-reply"
                          data-forum-id="${forumId}"
                          data-forum-title="${escapeHtml(foro.titulo)}"
                          aria-expanded="false"
                          aria-controls="reply-form-${forumId}"
                          aria-label="Responder en ${escapeHtml(foro.titulo)}">
                    Responder
                  </button>
                  <div class="reply-form" id="reply-form-${forumId}" hidden>
                    <label for="author-${forumId}" class="sr-only">Tu nombre</label>
                    <input id="author-${forumId}" class="reply-author" type="text" placeholder="Tu nombre" maxlength="40" />
                    <label for="msg-${forumId}" class="sr-only">Tu participacion</label>
                    <textarea id="msg-${forumId}" class="reply-textarea" placeholder="Escribe tu participacion…" rows="3" maxlength="600"></textarea>
                    <div class="reply-actions">
                      <button class="primary submit-reply"
                              data-forum-id="${forumId}"
                              data-forum-title="${escapeHtml(foro.titulo)}">Publicar</button>
                      <button class="secondary cancel-reply" data-forum-id="${forumId}">Cancelar</button>
                    </div>
                  </div>
                </div>
              </article>
            `;
          }
        )
        .join("")}
    </div>
  `;
}

function renderEvaluacion() {
  return `
    <section class="page-heading">
      <p class="eyebrow">Evaluacion formativa</p>
      <h2>Evaluacion y rubricas</h2>
    </section>
    <section class="panel">
      <h3>Distribucion porcentual</h3>
      <div class="evaluation-grid">
        ${state.data.evaluacion.map((item) => `<div><span>${item.evidencia}</span><strong>${item.porcentaje}%</strong></div>`).join("")}
      </div>
    </section>
    <section class="rubric-wrap">
      <table>
        <caption>Rubrica de evaluacion</caption>
        <thead>
          <tr><th>Criterio</th><th>Excelente</th><th>Alto</th><th>Basico</th><th>Bajo</th></tr>
        </thead>
        <tbody>
          ${state.data.rubricas
            .map(
              (rubrica) => `
                <tr>
                  <th>${rubrica.criterio}</th>
                  <td>${rubrica.excelente}</td>
                  <td>${rubrica.alto}</td>
                  <td>${rubrica.basico}</td>
                  <td>${rubrica.bajo}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderProgreso() {
  const { gamificacion, progreso, retroalimentaciones } = state.data;
  const insigniasDesbloqueadas = gamificacion.insignias.filter((b) => b.desbloqueada);
  return `
    <section class="page-heading">
      <p class="eyebrow">Autorregulacion</p>
      <h2>Panel de progreso</h2>
    </section>
    <div class="dashboard">
      <article class="panel">
        <h3>Puntos, nivel e insignias</h3>
        <div class="big-number">${gamificacion.puntos}</div>
        ${renderXPBar()}
        <div class="badge-cloud" style="margin-top:14px">
          ${gamificacion.insignias.map((b) => `
            <span class="badge ${b.desbloqueada ? "badge--on" : "badge--off"}" title="${b.descripcion}">
              ${b.icono} ${b.nombre}
            </span>
          `).join("")}
        </div>
        ${insigniasDesbloqueadas.length === 0 ? `<p class="muted-note">Completa actividades para desbloquear insignias.</p>` : ""}
      </article>
      <article class="panel">
        <h3>Avance del estudiante</h3>
        ${progreso.map((item) => `
          <p class="progreso-label">${item.seccion}: <strong>${item.valor}%</strong></p>
          ${progressBar(item.valor, item.seccion)}
        `).join("")}
      </article>
      <article class="panel">
        <h3>Ranking simulado</h3>
        <ol class="ranking">${gamificacion.ranking.map((item) => `<li><span>${item.nombre}</span><strong>${item.puntos}</strong></li>`).join("")}</ol>
      </article>
      <article class="panel feedback">
        <h3>Recomendaciones</h3>
        ${retroalimentaciones.map((item) => `<p>${item}</p>`).join("")}
      </article>
    </div>
  `;
}

function renderMisiones() {
  const misiones = state.data.misiones ?? [];
  return `
    <section class="page-heading">
      <p class="eyebrow">Objetivos activos</p>
      <h2>Misiones</h2>
      <p>Completa los objetivos de cada mision para ganar puntos extra e insignias.</p>
    </section>
    <div class="cards">
      ${misiones.map((m) => `
        <article class="card ${m.completada ? "card--done" : ""}">
          <div class="mision-header">
            <span class="tag">${m.tipo === "diaria" ? "Diaria" : "Modulo " + m.modulo}</span>
            ${m.completada ? '<span class="tag tag-done">Completada ✓</span>' : ""}
          </div>
          <h3>${m.titulo}</h3>
          <p>${m.descripcion}</p>
          <ul class="clean-list mision-objetivos">
            ${m.objetivos.map((o) => `
              <li class="${o.completado ? "obj-done" : ""}">
                <span aria-hidden="true">${o.completado ? "✓" : "○"}</span>
                ${o.descripcion}
              </li>
            `).join("")}
          </ul>
          <p class="mision-reward">
            <strong>Recompensa:</strong> ${m.recompensa.puntos} pts
            ${m.recompensa.insignia ? `· insignia "${m.recompensa.insignia}"` : ""}
          </p>
        </article>
      `).join("")}
    </div>
  `;
}


// ─── Render principal ─────────────────────────────────────────────────────────

function render() {
  const views = {
    inicio:      renderHome,
    resultados:  renderResultados,
    modulos:     renderModulos,
    actividades: renderActividades,
    quices:      renderQuices,
    juegos:      renderJuegos,
    foros:       renderForos,
    evaluacion:  renderEvaluacion,
    progreso:    renderProgreso,
    misiones:    renderMisiones
  };
  app.innerHTML = layout(views[state.active]());
  bindEvents();
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

function bindEvents() {
  // Cambiar jugador
  document.querySelector(".player-switch")?.addEventListener("click", () => {
    saveProgress();
    state.quizAnswers    = {};
    state.quizSelections = {};
    state.gameAnswers    = {};
    state.playerName     = null;
    showWelcomeModal((name) => {
      state.playerName = name;
      const save = localStorage.getItem(saveKey(name));
      if (save) applyProgress(JSON.parse(save));
      else {
        state.data.gamificacion.puntos      = 0;
        state.data.gamificacion.nivelNumero = 1;
        state.data.gamificacion.nivelActual = state.data.gamificacion.niveles[0].nombre;
        state.data.gamificacion.ranking.forEach((r) => { if (r.nombre === "Tu progreso") r.puntos = 0; });
        state.data.gamificacion.insignias.forEach((i) => { i.desbloqueada = false; });
        state.data.misiones.forEach((m) => {
          m.completada = false;
          m.objetivos.forEach((o) => { o.completado = false; });
        });
      }
      saveProgress();
      render();
    });
  });

  // Navegacion con transicion
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      state.active = button.dataset.route;
      render();
      window.scrollTo({ top: 0, behavior: "instant" });
      const main = document.querySelector("#main-content");
      if (main) {
        main.classList.remove("view-enter");
        void main.offsetWidth;
        main.classList.add("view-enter");
        main.focus({ preventScroll: true });
      }
    });
  });

  // Retroalimentacion de actividades → toast
  document.querySelectorAll("[data-feedback]").forEach((button) => {
    button.addEventListener("click", () => {
      const actividad = state.data.actividades[Number(button.dataset.feedback)];
      state.feedback = actividad.retroalimentacion;
      showToast(actividad.retroalimentacion, "info", 6000);
    });
  });

  // Quiz: actualiza solo el fieldset, no re-renderiza toda la vista
  document.querySelectorAll("[data-quiz]").forEach((button) => {
    button.addEventListener("click", () => {
      const quizId      = button.dataset.quiz;
      const questionId  = button.dataset.questionId;
      const optionIndex = Number(button.dataset.option);
      const key         = `${quizId}-${questionId}`;
      if (state.quizAnswers[key] !== undefined) return;

      state.quizAnswers[key] = optionIndex;
      const quiz     = state.data.quices.find((item) => item.id === quizId);
      const question = state.data.bancoPreguntas.find((q) => q.id === questionId);
      state.feedback = question.retroalimentacion;
      const isCorrect = optionIndex === question.correcta;

      const fieldset = button.closest("fieldset.question");
      fieldset.querySelectorAll("button").forEach((btn, idx) => {
        btn.disabled = true;
        btn.setAttribute("aria-checked", idx === optionIndex ? "true" : "false");
        if (idx === optionIndex) btn.classList.add(isCorrect ? "is-correct" : "is-wrong", "selected");
        if (idx === question.correcta && !isCorrect) btn.classList.add("is-correct");
      });

      let feedbackEl = fieldset.querySelector(".question-feedback");
      if (!feedbackEl) {
        feedbackEl = document.createElement("p");
        feedbackEl.setAttribute("aria-live", "polite");
        fieldset.appendChild(feedbackEl);
      }
      feedbackEl.className = `question-feedback ${isCorrect ? "ok" : "warn"}`;
      feedbackEl.textContent = question.retroalimentacion;

      const scoreEl = button.closest("section.quiz")?.querySelector(".score");
      if (scoreEl) scoreEl.textContent = `${quizScore(quiz)} puntos obtenidos`;

      if (isCorrect) {
        sumarPuntos(question.puntos, "quiz");
        showToast(`Correcto. +${question.puntos} pts`, "ok");
      } else {
        showToast("Incorrecto. Revisa la retroalimentacion.", "warn");
        saveProgress();
      }

      verificarInsigniasQuiz(quiz);
      evaluarMisiones();
    });
  });

  // Juego: actualiza solo la card
  document.querySelectorAll("[data-game]").forEach((button) => {
    button.addEventListener("click", () => {
      const idx         = Number(button.dataset.game);
      const optionIndex = Number(button.dataset.gameOption);
      if (state.gameAnswers[idx] !== undefined) return;

      state.gameAnswers[idx] = optionIndex;
      const reto      = state.data.juegos[0].retos[idx];
      const isCorrect = optionIndex === reto.correcta;
      const card      = button.closest(".game-card");

      card.querySelectorAll("button").forEach((btn, i) => {
        btn.disabled = true;
        if (i === optionIndex) btn.classList.add(isCorrect ? "is-correct" : "is-wrong", "selected");
        if (i === reto.correcta && !isCorrect) btn.classList.add("is-correct");
      });

      let fbEl = card.querySelector(".game-feedback");
      if (!fbEl) {
        fbEl = document.createElement("p");
        card.appendChild(fbEl);
      }
      fbEl.className = `game-feedback ${isCorrect ? "ok" : "warn"}`;
      fbEl.textContent = reto.feedback;

      // Actualizar marcador de la aside
      const pts = reto.puntos ?? 20;
      if (isCorrect) {
        sumarPuntos(pts, "juego");
        showToast(`Reto superado. +${pts} pts`, "ok");
      } else {
        showToast("Incorrecto. Sigue intentando.", "warn");
        saveProgress();
      }

      const totalScore = state.data.juegos[0].retos.reduce(
        (t, r, i) => t + (state.gameAnswers[i] === r.correcta ? (r.puntos ?? 20) : 0), 0
      );
      const achievementPts  = document.querySelector(".achievement strong");
      const achievementMsg  = document.querySelector(".achievement span");
      if (achievementPts) achievementPts.textContent = `${totalScore} puntos de juego`;
      if (achievementMsg) achievementMsg.textContent = totalScore >= 60
        ? "Insignia desbloqueada: Dominio de algebra"
        : "Completa los retos para desbloquear la insignia.";

      verificarInsigniasJuego();
      evaluarMisiones();
    });
  });

  // Foros: toggle formulario
  document.querySelectorAll(".toggle-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const forumId = btn.dataset.forumId;
      const form    = document.getElementById(`reply-form-${forumId}`);
      const isOpen  = btn.getAttribute("aria-expanded") === "true";
      form.hidden   = isOpen;
      btn.setAttribute("aria-expanded", String(!isOpen));
      btn.textContent = isOpen ? "Responder" : "Cerrar";
      if (!isOpen) form.querySelector(".reply-author")?.focus();
    });
  });

  // Foros: cancelar
  document.querySelectorAll(".cancel-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const forumId  = btn.dataset.forumId;
      const form     = document.getElementById(`reply-form-${forumId}`);
      const toggleBtn = document.querySelector(`.toggle-reply[data-forum-id="${forumId}"]`);
      form.hidden    = true;
      toggleBtn?.setAttribute("aria-expanded", "false");
      if (toggleBtn) toggleBtn.textContent = "Responder";
      form.querySelector(".reply-author").value = "";
      form.querySelector(".reply-textarea").value = "";
    });
  });

  // Foros: publicar
  document.querySelectorAll(".submit-reply").forEach((btn) => {
    btn.addEventListener("click", () => {
      const forumId    = btn.dataset.forumId;
      const forumTitle = btn.dataset.forumTitle;
      const form       = document.getElementById(`reply-form-${forumId}`);
      const authorInput = form.querySelector(".reply-author");
      const msgInput    = form.querySelector(".reply-textarea");
      const autor   = authorInput.value.trim();
      const mensaje = msgInput.value.trim();

      if (!autor) {
        authorInput.setAttribute("aria-invalid", "true");
        showToast("Escribe tu nombre para participar.", "warn");
        authorInput.focus();
        return;
      }
      if (mensaje.length < 10) {
        msgInput.setAttribute("aria-invalid", "true");
        showToast("Tu participacion debe tener al menos 10 caracteres.", "warn");
        msgInput.focus();
        return;
      }

      const foro = state.data.foros.find((f) => f.titulo === forumTitle);
      if (foro) foro.participaciones.push({ autor, mensaje });

      const postsContainer = document.getElementById(`posts-${forumId}`);
      const newPost = document.createElement("blockquote");
      newPost.classList.add("post-new");
      newPost.innerHTML = `<strong>${escapeHtml(autor)}:</strong> ${escapeHtml(mensaje)}`;
      postsContainer.appendChild(newPost);
      newPost.scrollIntoView({ behavior: "smooth", block: "nearest" });

      form.hidden = true;
      const toggleBtn = document.querySelector(`.toggle-reply[data-forum-id="${forumId}"]`);
      toggleBtn?.setAttribute("aria-expanded", "false");
      if (toggleBtn) toggleBtn.textContent = "Responder";
      authorInput.value = "";
      msgInput.value    = "";
      authorInput.removeAttribute("aria-invalid");
      msgInput.removeAttribute("aria-invalid");

      sumarPuntos(20, "foro");
      verificarInsigniaForo();
      evaluarMisiones();
      showToast(`Participacion publicada en "${forumTitle}". +20 pts`, "ok");
      saveProgress();
    });
  });
}

// ─── Arranque ─────────────────────────────────────────────────────────────────

loadData()
  .then((data) => {
    state.data = data;
    showWelcomeModal((name) => {
      state.playerName = name;
      const raw = localStorage.getItem(saveKey(name));
      if (raw) {
        try { applyProgress(JSON.parse(raw)); } catch { /* ignora datos corruptos */ }
      }
      saveProgress();
      render();
    });
  })
  .catch(() => {
    app.innerHTML = `
      <main class="content error">
        <h1>No se pudo cargar public/db.json</h1>
        <p>Ejecuta el prototipo desde un servidor local: <code>node server.js</code></p>
      </main>
    `;
  });
