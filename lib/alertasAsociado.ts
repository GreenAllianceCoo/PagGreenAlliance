/** Tipos de alerta del asociado al admin (enum public.tipo_alerta_asociado). Puro: sirve en cliente y servidor. */
export const TIPOS_ALERTA_ASOCIADO = ["retiro_anticipado", "renovacion"] as const;
export type TipoAlertaAsociado = (typeof TIPOS_ALERTA_ASOCIADO)[number];

export const ETIQUETA_ALERTA: Record<TipoAlertaAsociado, string> = {
  retiro_anticipado: "Retiro anticipado",
  renovacion: "Renovación de los 36 meses",
};
