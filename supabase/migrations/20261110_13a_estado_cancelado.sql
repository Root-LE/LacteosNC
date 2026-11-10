-- Migración 13a — nuevo estado de pedido 'cancelado' (va sola porque un valor nuevo de un tipo
-- no se puede usar en la misma transacción en que se agrega)
alter type public.estado_pedido add value if not exists 'cancelado';
