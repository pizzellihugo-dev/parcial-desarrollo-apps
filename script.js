/*
 * Parcial online — Desarrollo de Aplicaciones Móviles
 *
 * Antes de publicar:
 * 1. Implementá Code.gs como aplicación web en Google Apps Script.
 * 2. Copiá la URL que termina en /exec.
 * 3. Pegala en APPS_SCRIPT_URL.
 */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzRCRn7xMB40-cBEAUhZpBtGtp40bAL7yBcb3-AhVkx8pjNdqay-NL6VLKSjuBc9X1q/exec";

const respuestasCorrectas = {
  p1: "V",
  p2: "V",
  p3: "F",
  p4: "V",
  p5: "V",
  p6: "F",
  p7: "V",
  p8: "V",
  p9: "B",
  p10: "A",
  p11: "B",
  p12: "B",
  p13: "B",
  p14: "A",
  p15: "C",
  p16: "B",
  p17: "B",
  p18: "A",
  p19: "A",
  p20: "A"
};

const totalPreguntas = Object.keys(respuestasCorrectas).length;
const notaMaxima = 10;
const porcentajeAprobacion = 40;

document.addEventListener("DOMContentLoaded", () => {
  mezclarPreguntas();
  mezclarOpciones();
  actualizarNumeracion();
});

function mezclar(array) {
  const copia = [...array];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

function mezclarPreguntas() {
  document.querySelectorAll(".exam-section").forEach(section => {
    const preguntas = mezclar([...section.querySelectorAll(".question")]);
    preguntas.forEach(pregunta => section.appendChild(pregunta));
  });
}

function mezclarOpciones() {
  document.querySelectorAll(".radio-options").forEach(container => {
    const opciones = mezclar([...container.querySelectorAll("label")]);

    opciones.forEach(opcion => container.appendChild(opcion));

    opciones.forEach((opcion, index) => {
      const letra = opcion.querySelector(".option-letter");
      if (letra) {
        letra.textContent = `${String.fromCharCode(65 + index)})`;
      }
    });
  });

  // También se mezclan las opciones del único select.
  // La primera opción ("Seleccioná...") queda siempre arriba.
  document.querySelectorAll("select").forEach(select => {
    const placeholder = select.querySelector('option[value=""]');
    const opciones = mezclar(
      [...select.querySelectorAll('option:not([value=""])')]
    );

    opciones.forEach(opcion => select.appendChild(opcion));
    if (placeholder) {
      select.insertBefore(placeholder, select.firstChild);
    }
  });
}

function actualizarNumeracion() {
  let numero = 1;

  document.querySelectorAll(".question").forEach(question => {
    const p = question.querySelector(":scope > p");
    if (!p) return;

    const numeroAnterior = p.querySelector(".question-number");
    if (numeroAnterior) numeroAnterior.remove();

    const texto = p.innerHTML.replace(/^\s*<strong>\d+\.<\/strong>\s*/, "");
    p.innerHTML = `<strong class="question-number">${numero}.</strong> ${texto}`;
    numero++;
  });
}

document.getElementById("examForm").addEventListener("submit", async function(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const submitBtn = document.getElementById("submitBtn");

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const nombre = document.getElementById("nombre").value.trim();
  const dni = normalizarDni(document.getElementById("dni").value);

  if (nombre.length < 3 || dni.length < 7) {
    alert("Revisá el nombre y el DNI antes de enviar.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Verificando DNI...";

  try {
    const disponible = await consultarDni(dni);

    if (!disponible) {
      mostrarBloqueoDni();
      submitBtn.disabled = false;
      submitBtn.textContent = "Finalizar y enviar parcial";
      return;
    }

    const datos = {
      nombre,
      dni,
      fecha: new Date().toLocaleString("es-AR"),
      respuestas: {},
      aciertos: 0
    };

    for (const pregunta of Object.keys(respuestasCorrectas)) {
      const seleccionada = obtenerRespuesta(pregunta);

      if (seleccionada === null) {
        throw new Error(`Falta responder ${pregunta}.`);
      }

      datos.respuestas[pregunta] = seleccionada;

      if (seleccionada === respuestasCorrectas[pregunta]) {
        datos.aciertos++;
      }
    }

    datos.porcentaje = Math.round((datos.aciertos / totalPreguntas) * 100);
    datos.nota = Number(((datos.aciertos / totalPreguntas) * notaMaxima).toFixed(2));
    datos.estado = datos.porcentaje >= porcentajeAprobacion ? "APROBADO" : "DESAPROBADO";

    submitBtn.textContent = "Enviando...";

    await enviarResultado(datos);

    mostrarResultado(datos);

    form.querySelectorAll("input, select").forEach(elemento => {
      elemento.disabled = true;
    });

    submitBtn.style.display = "none";

  } catch (error) {
    console.error(error);
    submitBtn.disabled = false;
    submitBtn.textContent = "Finalizar y enviar parcial";

    alert(
      "No se pudo enviar el parcial.\n\n" +
      "Si el problema continúa, avisale al docente."
    );
  }
});

function obtenerRespuesta(nombre) {
  const radio = document.querySelector(`input[name="${nombre}"]:checked`);
  if (radio) return radio.value;

  const select = document.querySelector(`select[name="${nombre}"]`);
  if (select && select.value) return select.value;

  return null;
}

function normalizarDni(dni) {
  return dni.replace(/\D/g, "");
}

/*
 * Consulta el DNI mediante JSONP.
 * Esto permite leer la respuesta de Apps Script desde GitHub Pages
 * sin depender de CORS.
 */
function consultarDni(dni) {
  return new Promise((resolve, reject) => {
    const callbackName =
      "respuestaDni_" + Date.now() + "_" + Math.floor(Math.random() * 100000);

    const script = document.createElement("script");

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Tiempo de espera agotado al verificar DNI."));
    }, 10000);

    window[callbackName] = function(respuesta) {
      cleanup();

      if (!respuesta || respuesta.ok !== true) {
        reject(new Error("No se pudo verificar el DNI."));
        return;
      }

      resolve(!respuesta.existe);
    };

    script.src =
      `${APPS_SCRIPT_URL}?action=checkDni&dni=${encodeURIComponent(dni)}&callback=${callbackName}`;

    script.onerror = () => {
      cleanup();
      reject(new Error("No se pudo conectar con Apps Script."));
    };

    document.body.appendChild(script);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }
  });
}

function enviarResultado(datos) {
  if (APPS_SCRIPT_URL.includes("PEGAR_AQUI")) {
    throw new Error("Falta configurar la URL de Apps Script.");
  }

  return fetch(APPS_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(datos)
  });
}

function mostrarBloqueoDni() {
  const result = document.getElementById("result");

  result.className = "result card warning";
  result.innerHTML = `
    <h2>Parcial ya enviado</h2>
    <p>El DNI ingresado ya tiene un envío registrado.</p>
    <p>No se puede realizar un segundo envío con el mismo DNI.</p>
  `;

  result.scrollIntoView({ behavior: "smooth" });
}

function mostrarResultado(datos) {
  const result = document.getElementById("result");

  result.className =
    `result card ${datos.estado === "APROBADO" ? "approved" : "failed"}`;

  result.innerHTML = `
    <h2>Parcial enviado</h2>
    <p>Estudiante: <strong>${escapeHtml(datos.nombre)}</strong></p>
    <p class="score">${datos.nota} / 10</p>
    <p>${datos.aciertos} respuestas correctas de ${totalPreguntas}.</p>
    <p><strong>${datos.estado}</strong></p>
    <p>El resultado fue registrado correctamente.</p>
  `;

  result.scrollIntoView({ behavior: "smooth" });
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
