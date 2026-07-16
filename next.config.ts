import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Hay un package-lock.json en C:\Users\Adria (fuera de este proyecto) que
  // hacía que Turbopack infiriera mal la raíz del workspace. Se fija
  // explícitamente para que siempre use este directorio.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
