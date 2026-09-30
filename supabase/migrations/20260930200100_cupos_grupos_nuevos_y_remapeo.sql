-- ============================================================
-- ga-auditor-supabase, 2026-09-30 — spec §12.1 (parte 2 de 2).
-- PROPUESTA: NO APLICADA en producción. Sebas la revisa y la aplica.
--
-- 1. Topes de los grupos nuevos IJ, CT, MY y TC (50 % y 100 %).
--    R-10 decidido por Sebas: estos grupos usan la tasa de OF
--    en cada porcentaje. cuota_mensual = capacidad × tasa redondeada a miles;
--    total_credito = capacidad + plazo × cuota (la fórmula de la fila OF 100 %).
--    R-11 decidido por Sebas: el 50 % de MY y TC es la mitad del 100 %.
--    Se calculan desde las filas OF para no copiar tasas a mano.
-- 2. Remapeo de grados.grupo_credito:
--    SLP, C3, CS → PT · CP → SI · SS, ST → IT · IJ, SV, SP, TE → IJ
--    (SP → IJ: decidido por Sebas, spec §12.14; ningún grado seleccionable queda sin cupo)
--    CT → CT · MY → MY · TC → TC. Ningún grado seleccionable queda en OF;
--    OF (heredado, no seleccionable) conserva su grupo por los datos viejos.
-- Efecto en solicitudes: las pendientes guardan su grupo, tasa y plazo al
-- crearse (validar_monto_solicitud), así que el remapeo no las toca. Las
-- nuevas usan el grupo nuevo. tr_proteger_topes no se dispara (solo inserts).
-- Idempotente: on conflict do nothing y updates con el mismo valor.
-- ============================================================

-- 1. Topes nuevos (tasa de OF — R-10 decidido por Sebas)
insert into public.grados_credito
  (grado, porcentaje, capacidad_maxima, cuota_mensual, total_credito, plazo_meses, tasa_interes_mensual)
select n.grupo::public.grado_policial,
       o.porcentaje,
       n.capacidad,
       round(n.capacidad * o.tasa_interes_mensual, -3),
       n.capacidad + o.plazo_meses * round(n.capacidad * o.tasa_interes_mensual, -3),
       o.plazo_meses,
       o.tasa_interes_mensual
from (values
        ('IJ', '50',  2500000::numeric), ('IJ', '100', 5000000::numeric),
        ('CT', '50',  3500000::numeric), ('CT', '100', 7000000::numeric),
        ('MY', '50',  4500000::numeric), ('MY', '100', 9000000::numeric),   -- 50 % = mitad (R-11 decidido por Sebas)
        ('TC', '50',  6000000::numeric), ('TC', '100', 12000000::numeric)   -- 50 % = mitad (R-11 decidido por Sebas)
     ) as n(grupo, porcentaje, capacidad)
join public.grados_credito o
  on o.grado = 'OF'::public.grado_policial
 and o.porcentaje = n.porcentaje::public.porcentaje_devolucion
on conflict (grado, porcentaje) do nothing;

-- 2. Remapeo de grupos (spec §12.1)
update public.grados g
   set grupo_credito = m.grupo::public.grado_policial
from (values
        ('PP','PP'), ('PT','PT'), ('SI','SI'), ('IT','IT'),
        ('SLP','PT'), ('C3','PT'), ('CS','PT'),
        ('CP','SI'),
        ('SS','IT'), ('ST','IT'),
        ('IJ','IJ'), ('SV','IJ'), ('SP','IJ'), ('TE','IJ'),
        ('CT','CT'), ('MY','MY'), ('TC','TC')
     ) as m(codigo, grupo)
where g.codigo = m.codigo
  and g.grupo_credito is distinct from m.grupo::public.grado_policial;

comment on column public.grados.grupo_credito is
  'Grupo de crédito cuyos topes aplican (spec §12.1). SP usa IJ (§12.14). OF solo para datos heredados.';
