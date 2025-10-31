"use client";
import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db, storage } from "../../lib/firebase";
import Link from "next/link";

const CONFIRM_KEY = "CALENDABORRAR";

export default function DocumentosPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [docs, setDocs] = useState([]);
  const [search, setSearch] = useState("");
  const [categoria, setCategoria] = useState("Presupuestos");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");

  const fetchDocs = async () => {
    const q = query(collection(db, "documentos"), orderBy("creadoEn", "desc"));
    const snapshot = await getDocs(q);
    setDocs(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleUpload = async () => {
    if (!file) return alert("Selecciona un archivo.");
    setUploading(true);

    const fileRef = ref(storage, `documentos/${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await addDoc(collection(db, "documentos"), {
      nombre: file.name,
      url,
      categoria,
      creadoEn: new Date(),
    });

    alert("Archivo subido correctamente.");
    setFile(null);
    setUploading(false);
    fetchDocs();
  };

  const handleDelete = async (docId, fileName) => {
    const clave = prompt("Introduce la clave para eliminar el archivo:");
    if (clave !== CONFIRM_KEY) return alert("Clave incorrecta.");
    if (!confirm("¿Seguro que deseas eliminar este documento?")) return;

    await deleteDoc(doc(db, "documentos", docId));
    await deleteObject(ref(storage, `documentos/${fileName}`));
    alert("Documento eliminado correctamente.");
    fetchDocs();
  };

  const filteredDocs = docs.filter((d) => {
    const coincideTexto = d.nombre.toLowerCase().includes(search.toLowerCase());
    const coincideCategoria = filtroCategoria === "Todos" || d.categoria === filtroCategoria;
    return coincideTexto && coincideCategoria;
  });

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <Link
        href="/dashboard"
        className="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
      >
        ← Volver al Dashboard
      </Link>
      <h1 className="text-3xl font-bold">Gestión de Documentos</h1>

      {/* Subida de documento */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <label className="relative cursor-pointer bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Seleccionar archivo
          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>

        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="border p-2 rounded"
        >
          <option>Presupuestos</option>
          <option>Valoraciones CIA</option>
          <option>Partes de Asistencia</option>
          <option>Otros</option>
        </select>

        <span className="text-sm text-gray-700">
          {file ? file.name : "Ningún archivo seleccionado"}
        </span>

        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className={`px-4 py-2 rounded text-white transition ${
            uploading || !file
              ? "bg-green-300 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {uploading ? "Subiendo…" : "Subir Documento"}
        </button>
      </div>

      {/* Filtro por subcarpeta */}
      <div className="flex flex-wrap gap-2 mb-2">
        {["Todos", "Presupuestos", "Valoraciones CIA", "Partes de Asistencia", "Otros"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFiltroCategoria(cat)}
            className={`px-3 py-1 rounded ${
              filtroCategoria === cat
                ? "bg-blue-600 text-white"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Barra de búsqueda"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        />
      </div>

      {/* Lista de documentos */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <p className="text-gray-600 col-span-full">No hay documentos.</p>
        ) : (
          filteredDocs.map((d) => {
            const extension = d.nombre.split(".").pop().toLowerCase();
            const esImagen = ["jpg", "jpeg", "png", "gif"].includes(extension);
            const esPDF = extension === "pdf";

            return (
              <div
                key={d.id}
                className="bg-white shadow p-4 rounded flex flex-col justify-between"
              >
                {/* Vista previa */}
                <div className="mb-2">
                  {esImagen && (
                    <img
                      src={d.url}
                      alt={d.nombre}
                      className="w-full h-48 object-cover rounded"
                    />
                  )}
                  {esPDF && (
                    <iframe
                      src={d.url}
                      className="w-full h-48 rounded"
                      title={d.nombre}
                    />
                  )}
                  {!esImagen && !esPDF && (
                    <div className="text-gray-500 italic text-sm">
                      Vista previa no disponible
                    </div>
                  )}
                </div>

                {/* Nombre del archivo */}
                <p className="font-medium break-all">{d.nombre}</p>

                {/* Acciones */}
                <div className="flex justify-between mt-4">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                  >
                    Ver
                  </a>
                  <button
                    onClick={() => handleDelete(d.id, d.nombre)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
