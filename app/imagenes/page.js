'use client';

import React, { useState, useEffect } from 'react';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getMetadata } from 'firebase/storage';
import { addDoc, collection, deleteDoc, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import Link from 'next/link';

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

async function guardarRegistroImagen({ nombreArchivo, url, matricula, orden }) {
  try {
    await addDoc(collection(db, 'imagenes_vehiculo'), {
      nombreArchivo,
      rutaStorage: `imagenes/${nombreArchivo}`,
      url,
      matricula: String(matricula || '').trim().toUpperCase(),
      matriculaNormalizada: normalizeText(matricula),
      numeroOR: String(orden || '').trim(),
      numeroORNormalizado: normalizeText(orden),
      fechaSubida: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error guardando el registro de la imagen en Firestore:', error);
  }
}

async function borrarRegistrosImagen(nombreArchivo) {
  try {
    const q = query(collection(db, 'imagenes_vehiculo'), where('nombreArchivo', '==', nombreArchivo));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    console.error('Error eliminando el registro de la imagen en Firestore:', error);
  }
}

async function getNextFilename(baseName, ext) {
  const listRef = ref(storage, 'imagenes/');
  const res = await listAll(listRef);
  const existingNames = res.items.map(item => item.name);
  const filtered = existingNames.filter(name => name.startsWith(baseName));
  if (!filtered.includes(`${baseName}.${ext}`)) return `${baseName}.${ext}`;
  let i = 1;
  while (filtered.includes(`${baseName} (${i}).${ext}`)) i++;
  return `${baseName} (${i}).${ext}`;
}

const ordenarPorRecientes = (lista) => [...lista].sort((a, b) => (b.fechaMs || 0) - (a.fechaMs || 0));

export default function ImagenesPage() {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [matricula, setMatricula] = useState('');
  const [orden, setOrden] = useState('');
  const [search, setSearch] = useState('');
  
  const handleCameraCapture = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      let mat = matricula;
      let ord = orden;
      if (!mat || !ord) {
        mat = prompt('Introduce la matrícula:');
        ord = prompt('Introduce el número de orden:');
        if (!mat || !ord) {
          alert('Se necesita matrícula y nº OR para guardar la imagen.');
          return;
        }
      }
      const ext = file.name.split('.').pop();
      const baseName = `${mat}-${ord}`;
      const nombreArchivo = await getNextFilename(baseName, ext);
      const storageRef = ref(storage, `imagenes/${nombreArchivo}`);
      try {
        setUploading(true);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        const metadata = await getMetadata(storageRef);
        await guardarRegistroImagen({ nombreArchivo, url, matricula: mat, orden: ord });
        const fechaMs = new Date(metadata.timeCreated || metadata.updated || Date.now()).getTime();
        setArchivos((prev) => ordenarPorRecientes([{ url, name: nombreArchivo, fechaMs }, ...prev]));
        alert('Foto subida correctamente.');
      } catch (error) {
        console.error('Error al subir imagen desde cámara:', error);
        alert('Error al subir la imagen.');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleImageChange = (e) => {
    if (e.target.files.length > 0) setImages(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (images.length === 0 || !matricula || !orden) {
      alert('Debes rellenar matrícula, número de orden y seleccionar al menos una imagen.');
      return;
    }
    setUploading(true);
    try {
      const nuevas = [];
      for (const image of images) {
        const ext = image.name.split('.').pop();
        const baseName = `${matricula}-${orden}`;
        const nombreArchivo = await getNextFilename(baseName, ext);
        const storageRef = ref(storage, `imagenes/${nombreArchivo}`);
        await uploadBytes(storageRef, image);
        const url = await getDownloadURL(storageRef);
        const metadata = await getMetadata(storageRef);
        await guardarRegistroImagen({ nombreArchivo, url, matricula, orden });
        nuevas.push({ url, name: nombreArchivo, fechaMs: new Date(metadata.timeCreated || metadata.updated || Date.now()).getTime() });
      }
      setArchivos((prev) => ordenarPorRecientes([...nuevas, ...prev]));
      setImages([]);
      setMatricula('');
      setOrden('');
      alert('Imágenes subidas correctamente.');
    } catch (error) {
      console.error('Error al subir imágenes:', error);
      alert('Hubo un error al subir las imágenes.');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchImages = async () => {
      const listRef = ref(storage, 'imagenes/');
      try {
        const res = await listAll(listRef);
        const urls = await Promise.all(
          res.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            const metadata = await getMetadata(itemRef);
            return {
              url,
              name: itemRef.name,
              fechaMs: new Date(metadata.timeCreated || metadata.updated || 0).getTime(),
            };
          })
        );
        setArchivos(ordenarPorRecientes(urls));
      } catch (error) {
        console.error('Error al obtener imágenes:', error);
      }
    };
    fetchImages();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-8 bg-gray-50 min-h-screen">
      <div className="mb-4">
        <Link href="/dashboard" className="inline-block bg-gray-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          ← Volver al Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Gestión de Imágenes</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-8">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input type="text" placeholder="Matrícula" value={matricula} onChange={(e) => setMatricula(e.target.value.toUpperCase())} className="border-2 border-red-500 px-3 py-2 rounded w-full sm:w-1/2" />
          <input type="text" placeholder="Número de orden" value={orden} onChange={(e) => setOrden(e.target.value)} className="border-2 border-red-500 px-3 py-2 rounded w-full sm:w-1/2" />
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="bg-gray-200 text-gray-800 px-4 py-2 rounded cursor-pointer hover:bg-gray-300 transition">
            Seleccionar archivo
            <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
          </label>
          {images.length > 0 && (
            <ul className="text-sm text-gray-600 max-w-xs">
              {images.map((img, idx) => <li key={idx}>{img.name}</li>)}
            </ul>
          )}
          <button onClick={handleUpload} disabled={uploading} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
          <button type="button" onClick={handleCameraCapture} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 transition">
            📷 Usar Cámara
          </button>
        </div>
      </div>

      <div className="relative mb-6">
        <input type="text" placeholder="🔍 Buscar por matrícula o número de orden..." value={search} onChange={(e) => setSearch(e.target.value.toLowerCase())} className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300" />
      </div>

      <h2 className="text-2xl font-semibold mb-1 text-gray-800">Imágenes guardadas</h2>
      <p className="text-sm text-gray-500 mb-4">Ordenadas de más recientes a más antiguas.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {archivos
          .filter(({ name }) => name.toLowerCase().includes(search))
          .map(({ url, name }, idx) => (
            <div key={`${name}-${idx}`} className="bg-white rounded-xl shadow p-4 flex flex-col items-center">
              <img src={url} alt={name} className="w-full h-48 object-contain rounded" />
              <p className="mt-2 text-sm text-gray-700 font-medium break-words text-center">{name}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => window.open(url, '_blank')} className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm">Ver</button>
                <button
                  onClick={async () => {
                    const clave = prompt('Introduce la clave para eliminar esta imagen');
                    if (clave === 'CALENDABORRAR') {
                      try {
                        const imageRef = ref(storage, `imagenes/${name}`);
                        await deleteObject(imageRef);
                        await borrarRegistrosImagen(name);
                        setArchivos((prev) => prev.filter((item) => item.name !== name));
                        alert('Imagen eliminada correctamente');
                      } catch (error) {
                        console.error('Error al eliminar imagen:', error);
                        alert('Hubo un error al eliminar la imagen.');
                      }
                    } else {
                      alert('Clave incorrecta.');
                    }
                  }}
                  className="px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Eliminar
                </button>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
}
