-- ============================================================
-- Pedido de Sebas (2026-10-08): vuelve «Patrullero de Policía» (PP).
--
-- La migración 20261002600000 lo dejó de ofrecer porque se pensó que era el
-- mismo grado que «Patrullero» (PT). Se vuelve a ofrecer en la afiliación,
-- con su propio cupo (grupo PP: 1,0 M al 50 % y 2,1 M al 100 %, filas que
-- nunca se borraron de grados_credito). «Patrullero» (PT) sigue igual.
-- ============================================================

update public.grados set seleccionable = true where codigo = 'PP';
