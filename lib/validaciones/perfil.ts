import { z } from "zod";
import { esquemaCelular } from "./comunes";

/** «Mis datos» en /cuenta: el único dato que el asociado puede cambiar. */
export const esquemaTelefono = z.object({ telefono: esquemaCelular });
