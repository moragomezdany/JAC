
// ==========================================
// 1. IMPORTACIONES
// ==========================================
import { dbFirestore } from './firebase-config.js';
import { BaseDeDatosJAC } from './BaseDeDatosJAC.js';
import { Vecino, ProyectoInfraestructura, EleccionPresupuesto } from './clases.js';

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
const gestorBD = new BaseDeDatosJAC(dbFirestore);
let vecinoLogueado = null;
let propuestasActuales = [];
let cancelarSuscripcionPropuestas = null;
let votoEnProceso = false;
let mostrarSoloResultados = false;
let proteccionHistorialActiva = false;

// ==========================================
// 3. REFERENCIAS A LA INTERFAZ (DOM)
// ==========================================
// Elementos del Login
const formLogin = document.getElementById('formLogin');
const inputCedula = document.getElementById('inputCedula');
const inputClave = document.getElementById('inputClave');
const msjErrorLogin = document.getElementById('msjErrorLogin');
const seccionLogin = document.getElementById('seccionLogin');

// Elementos de Votación
const seccionVotacion = document.getElementById('seccionVotacion');
const nombreVecinoSpan = document.getElementById('nombreVecino');
const vistaSeleccion = document.getElementById('vistaSeleccion');
const contenedorPropuestas = document.getElementById('contenedorPropuestas');
const panelResultados = document.getElementById('panelResultados');
const contenedorResultados = document.getElementById('contenedorResultados');

document.querySelectorAll('[data-panel-legal]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
        const panelLegal = document.getElementById(enlace.dataset.panelLegal);
        if (panelLegal instanceof HTMLDetailsElement) {
            panelLegal.open = true;
        }
    });
});

// ==========================================
// 4. LÓGICA DE CONTROL (Eventos)
// ==========================================

// Evento de Login
formLogin.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    msjErrorLogin.textContent = "Buscando en la base de datos...";
    msjErrorLogin.style.color = "blue";

    const cedulaDigitada = inputCedula.value.trim();
    const claveDigitada = inputClave.value.trim();

    try {
        const datosVecinoBD = await gestorBD.obtenerVecinoPorCedula(cedulaDigitada);

        if (!datosVecinoBD) {
            mostrarError("La cédula no está registrada en el barrio.");
            return;
        }

        const vecinoIntento = new Vecino(
            datosVecinoBD.idDoc,
            datosVecinoBD.nombre,
            datosVecinoBD.cedula,
            datosVecinoBD.contrasena,
            datosVecinoBD.direccion,
            datosVecinoBD.haVotado
        );

        const esValido = vecinoIntento.validarCredenciales(cedulaDigitada, claveDigitada);

        if (!esValido) {
            mostrarError("Contraseña incorrecta. Intenta nuevamente.");
            return;
        }

        vecinoLogueado = vecinoIntento;
        mostrarSoloResultados =
            obtenerVotoLocal() || vecinoLogueado.getHaVotado();
        iniciarSesionExitosamente();

    } catch (error) {
        mostrarError("Error de conexión. Revisa la consola.");
        console.error(error);
    }
});

function mostrarError(mensaje) {
    msjErrorLogin.textContent = mensaje;
    msjErrorLogin.style.color = "red";
}

function iniciarSesionExitosamente() {
    seccionLogin.style.display = 'none';
    seccionVotacion.hidden = false;
    nombreVecinoSpan.textContent = vecinoLogueado.nombre;

    cargarPropuestasEnPantalla();
}

// ==========================================
// 5. LÓGICA DE VOTACIÓN (Cargar Propuestas)
// ==========================================

async function cargarPropuestasEnPantalla() {
    contenedorPropuestas.innerHTML = "<p class='estado-mensaje'>Cargando propuestas de la JAC...</p>";

    try {
        if (cancelarSuscripcionPropuestas) {
            cancelarSuscripcionPropuestas();
        }

        cancelarSuscripcionPropuestas = gestorBD.suscribirseAPropuestasActivas(
            (datosPropuestas) => {
                propuestasActuales = datosPropuestas
                    .map(crearObjetoPropuesta)
                    .filter(Boolean);
                renderizarPropuestas();
            },
            () => {
                contenedorPropuestas.innerHTML =
                    "<p class='estado-mensaje estado-mensaje-error'>Error al actualizar los resultados.</p>";
            }
        );

    } catch (error) {
        console.error("Error al cargar propuestas:", error);
        contenedorPropuestas.innerHTML = "<p class='estado-mensaje estado-mensaje-error'>Error al cargar las propuestas.</p>";
    }
}

function crearObjetoPropuesta(dato) {
    if (dato.tipo === "infraestructura") {
        return new ProyectoInfraestructura(
            dato.idDoc, dato.titulo, dato.descripcion, Number(dato.conteoVotos) || 0,
            dato.presupuestoEstimado, dato.duracionMeses
        );
    }

    if (dato.tipo === "presupuesto") {
        return new EleccionPresupuesto(
            dato.idDoc, dato.titulo, dato.descripcion, Number(dato.conteoVotos) || 0,
            dato.rubro
        );
    }

    return null;
}

function renderizarPropuestas() {
    const usuarioYaVoto =
        mostrarSoloResultados ||
        vecinoLogueado.getHaVotado() ||
        obtenerVotoLocal();

    if (propuestasActuales.length === 0) {
        if (usuarioYaVoto) {
            mostrarVistaResultados();
            contenedorResultados.innerHTML =
                "<p class='estado-mensaje'>Todavía no hay resultados disponibles.</p>";
            protegerHistorial();
        } else {
            contenedorPropuestas.innerHTML =
                "<p class='estado-mensaje'>No hay propuestas activas en este momento.</p>";
        }
        return;
    }

    if (usuarioYaVoto) {
        mostrarSoloResultados = true;
        mostrarVistaResultados();
        renderizarResultados();
        protegerHistorial();
        return;
    }

    mostrarVistaSeleccion();
    contenedorPropuestas.innerHTML = "";
    const totalVotos = propuestasActuales.reduce(
        (total, propuesta) => total + propuesta.getVotos(),
        0
    );

    propuestasActuales.forEach((propuesta) => {
        renderizarBotonPropuesta(propuesta, totalVotos);
    });
}

function renderizarResultados() {
    contenedorResultados.innerHTML = "";
    const totalVotos = propuestasActuales.reduce(
        (total, propuesta) => total + propuesta.getVotos(),
        0
    );

    propuestasActuales.forEach((propuesta) => {
        const votos = propuesta.getVotos();
        const porcentaje = totalVotos === 0 ? 0 : (votos / totalVotos) * 100;
        const porcentajeVisible = porcentaje.toFixed(1);
        const tarjeta = document.createElement('article');
        tarjeta.className = 'tarjeta-resultado';
        tarjeta.innerHTML = `
            <div class="fila-resultado">
                <h3></h3>
                <strong>${porcentajeVisible}%</strong>
            </div>
            <div class="barra-progreso" role="progressbar"
                aria-valuenow="${porcentajeVisible}" aria-valuemin="0" aria-valuemax="100">
                <div class="barra-progreso-valor" style="width: ${porcentaje}%"></div>
            </div>
            <span class="cantidad-votos">${votos} ${votos === 1 ? "voto" : "votos"}</span>
        `;
        tarjeta.querySelector('h3').textContent = propuesta.titulo;
        tarjeta.querySelector('.barra-progreso').setAttribute(
            'aria-label',
            `Porcentaje de votos para ${propuesta.titulo}`
        );
        contenedorResultados.appendChild(tarjeta);
    });
}

function mostrarVistaResultados() {
    vistaSeleccion.classList.add('vista-oculta');
    vistaSeleccion.setAttribute('aria-hidden', 'true');
    vistaSeleccion.inert = true;
    actualizarBotonesDespuesDeVotar();

    panelResultados.hidden = false;
    requestAnimationFrame(() => {
        panelResultados.classList.add('vista-visible');
    });
}

function mostrarVistaSeleccion() {
    vistaSeleccion.classList.remove('vista-oculta');
    vistaSeleccion.setAttribute('aria-hidden', 'false');
    vistaSeleccion.inert = false;
    panelResultados.classList.remove('vista-visible');
    panelResultados.hidden = true;
}

function protegerHistorial() {
    if (proteccionHistorialActiva) return;

    proteccionHistorialActiva = true;
    window.history.pushState({ vista: 'resultados-jac' }, '', window.location.href);
    window.addEventListener('popstate', () => {
        if (!mostrarSoloResultados) return;

        mostrarVistaResultados();
        renderizarResultados();
        window.history.pushState({ vista: 'resultados-jac' }, '', window.location.href);
    });
}

function renderizarBotonPropuesta(objetoPropuesta, totalVotos) {
    const divPropuesta = document.createElement('div');
    divPropuesta.className = 'tarjeta-propuesta';

    const votos = objetoPropuesta.getVotos();
    const porcentaje = totalVotos === 0 ? 0 : (votos / totalVotos) * 100;
    const porcentajeVisible = porcentaje.toFixed(1);
    const usuarioYaVoto = vecinoLogueado.getHaVotado() || obtenerVotoLocal();

    divPropuesta.innerHTML = `
        <h3></h3>
        <div class="detalle-tecnico"></div>
        <div class="resultado-propuesta" aria-label="${porcentajeVisible}% de los votos">
            <div class="fila-resultado">
                <span>Resultado actual</span>
                <strong>${porcentajeVisible}%</strong>
            </div>
            <div class="barra-progreso" role="progressbar"
                aria-valuenow="${porcentajeVisible}" aria-valuemin="0" aria-valuemax="100">
                <div class="barra-progreso-valor" style="width: ${porcentaje}%"></div>
            </div>
            <span class="cantidad-votos">${votos} ${votos === 1 ? "voto" : "votos"}</span>
        </div>
        <button class="btn-votar ${usuarioYaVoto ? "btn-deshabilitado" : ""}"
            ${usuarioYaVoto || votoEnProceso ? "disabled" : ""}>
            ${usuarioYaVoto ? "✅ Voto registrado" : "✅ Votar por esta propuesta"}
        </button>
    `;

    divPropuesta.querySelector('h3').textContent = objetoPropuesta.titulo;
    divPropuesta.querySelector('.detalle-tecnico').replaceWith(
        crearDetallesPropuesta(objetoPropuesta)
    );

    const btnVotar = divPropuesta.querySelector('.btn-votar');

    btnVotar.addEventListener('click', async () => {
        if (votoEnProceso || obtenerVotoLocal() || vecinoLogueado.getHaVotado()) {
            return;
        }

        const confirmar = confirm(`¿Estás seguro de votar por: ${objetoPropuesta.titulo}?`);

        if (confirmar) {
            votoEnProceso = true;
            btnVotar.disabled = true;
            btnVotar.textContent = "Registrando voto...";
            objetoPropuesta.incrementarVotos();
            renderizarPropuestas();

            try {
                const exito = await vecinoLogueado.votar(objetoPropuesta.id, gestorBD);

                if (exito) {
                    guardarVotoLocal();
                    votoEnProceso = false;
                    mostrarSoloResultados = true;
                    renderizarPropuestas();
                    actualizarBotonesDespuesDeVotar();
                    protegerHistorial();
                    alert("¡Gracias! Tu voto ha sido registrado en la base de datos.");
                } else {
                    objetoPropuesta.incrementarVotos(-1);
                    votoEnProceso = false;
                    renderizarPropuestas();
                    alert("No fue posible registrar el voto. Intenta nuevamente.");
                }
            } catch (error) {
                objetoPropuesta.incrementarVotos(-1);
                votoEnProceso = false;
                renderizarPropuestas();
                alert("Ocurrió un error: " + error.message);
            }
        }
    });

    contenedorPropuestas.appendChild(divPropuesta);
}

function crearDetallesPropuesta(propuesta) {
    const detalles = document.createElement('div');
    detalles.className = 'detalle-tecnico';

    const filas = propuesta instanceof ProyectoInfraestructura
        ? [
            { icono: '💵', etiqueta: 'Presupuesto estimado', valor: propuesta.presupuestoEstimado == null ? 'Sin especificar' : `$${propuesta.presupuestoEstimado}` },
            { icono: '⏱️', etiqueta: 'Duración', valor: propuesta.duracionMeses == null ? 'Sin especificar' : `${propuesta.duracionMeses} meses` }
        ]
        : [
            { icono: '💵', etiqueta: 'Modalidad', valor: 'Presupuesto comunitario' },
            { icono: '🏷️', etiqueta: 'Rubro', valor: propuesta.rubro }
        ];

    filas.forEach(({ icono, etiqueta, valor }) => {
        const fila = document.createElement('p');
        fila.className = 'detalle-fila';

        const simbolo = document.createElement('span');
        simbolo.className = 'detalle-icono';
        simbolo.setAttribute('aria-hidden', 'true');
        simbolo.textContent = icono;

        const texto = document.createElement('span');
        texto.className = 'detalle-texto';
        const nombre = document.createElement('strong');
        nombre.textContent = etiqueta;
        const contenido = document.createElement('span');
        contenido.textContent = valor ?? 'Sin especificar';

        texto.append(nombre, contenido);
        fila.append(simbolo, texto);
        detalles.appendChild(fila);
    });

    return detalles;
}

function actualizarBotonesDespuesDeVotar() {
    const botonesVotar = document.querySelectorAll('.btn-votar');

    botonesVotar.forEach((boton) => {
        boton.disabled = true;
        boton.classList.add('btn-deshabilitado');
        boton.textContent = '✅ Voto registrado';
    });
}

function obtenerClaveVoto() {
    return `jac-voto-${vecinoLogueado.getIdDocumento()}`;
}

function obtenerVotoLocal() {
    try {
        return localStorage.getItem(obtenerClaveVoto()) === "true";
    } catch (error) {
        console.warn("No se pudo consultar el voto guardado localmente:", error);
        return false;
    }
}

function guardarVotoLocal() {
    try {
        localStorage.setItem(obtenerClaveVoto(), "true");
    } catch (error) {
        console.warn("No se pudo guardar el voto localmente:", error);
    }
}