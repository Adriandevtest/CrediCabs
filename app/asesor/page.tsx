import AsesorForm from '../../components/AsesorForm';
// Importamos el UserNav
import UserNav from '../../components/UserNav';

export default function AsesorPage() {
  return (
    <main className="min-h-screen bg-gray-950 p-4 md:p-8 flex flex-col items-center">
      <div className="max-w-xl w-full">
        
        {/* Cabecera actualizada con el menú de usuario */}
        <header className="mb-8 w-full flex justify-between items-center border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-3xl font-black text-white">Credi <span className="text-red-600">Asesor</span></h1>
            <p className="text-gray-500 uppercase text-xs tracking-widest mt-1">Captura de Campo</p>
          </div>
          
          {/* Avatar con menú desplegable para cerrar sesión */}
          <UserNav />
        </header>
        
        <AsesorForm />
        
        <footer className="mt-8 text-center text-gray-700 text-sm">
          Sube imágenes claras para evitar rechazos.
        </footer>
      </div>
    </main>
  );
}