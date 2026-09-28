import { collection, doc, query, where, getDocs, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

export class BaseDeDatosJAC {
  constructor(dbInstancia) {
    this.db = dbInstancia; 
  }

  async obtenerVecinoPorCedula(cedula) {
    try {
      const usuariosRef = collection(this.db, "usuarios");
      const consulta = query(usuariosRef, where("cedula", "==", cedula));
      const resultados = await getDocs(consulta);

      if (resultados.empty) return null; 

      let datosVecino = null;
      resultados.forEach((documento) => {
        datosVecino = { idDoc: documento.id, ...documento.data() };
      });
      return datosVecino;
    } catch (error) {
      console.error("Error al consultar Firestore:", error);
      throw error; 
    }
  }

  async obtenerPropuestasActivas() {
      try {
          const propuestasRef = collection(this.db, "propuestas");
          const resultados = await getDocs(propuestasRef);
          
          let listaPropuestas = [];
          resultados.forEach((documento) => {
              listaPropuestas.push({ idDoc: documento.id, ...documento.data() });
          });
          return listaPropuestas;
      } catch (error) {
          console.error("Error al cargar las propuestas:", error);
          return [];
      }
  }

  suscribirseAPropuestasActivas(callback, callbackError) {
    const propuestasRef = collection(this.db, "propuestas");

    return onSnapshot(
      propuestasRef,
      (snapshot) => {
        const propuestas = snapshot.docs.map((documento) => ({
          idDoc: documento.id,
          ...documento.data()
        }));
        callback(propuestas);
      },
      (error) => {
        console.error("Error al escuchar las propuestas:", error);
        if (callbackError) callbackError(error);
      }
    );
  }

  async registrarVotoEnBD(idDocVecino, idDocPropuesta) {
    try {
      const vecinoRef = doc(this.db, "usuarios", idDocVecino);
      const propuestaRef = doc(this.db, "propuestas", idDocPropuesta);

      await updateDoc(vecinoRef, { haVotado: true });
      await updateDoc(propuestaRef, { conteoVotos: increment(1) });

      console.log("Transacción exitosa en la nube.");
      return true;
    } catch (error) {
      console.error("Error crítico al registrar el voto:", error);
      return false;
    }
  }
}