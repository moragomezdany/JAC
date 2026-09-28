// 1. Importar las funciones de inicialización desde los servidores de Google (CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// 2. CONFIGURACIÓN DE TU PROYECTO
// 👉 REEMPLAZA todo este bloque 'firebaseConfig' por el que te da Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAo0oxpox4UNYuSeGx8amsMjMc0apxTaa4",
  authDomain: "votaciones-jac.firebaseapp.com",
  projectId: "votaciones-jac",
  storageBucket: "votaciones-jac.firebasestorage.app",
  messagingSenderId: "140975550876",
  appId: "1:140975550876:web:eaa4b035066d4639195859",
  measurementId: "G-QCN7PG3RJ5"
};

// 3. Inicializar Firebase con tu configuración
const app = initializeApp(firebaseConfig);

// 4. Inicializar Firestore y EXPORTARLO para que BaseDeDatosJAC.js lo pueda usar
export const dbFirestore = getFirestore(app);

console.log("🔥 Firebase inicializado y exportado correctamente");