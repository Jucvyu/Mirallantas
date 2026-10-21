import { createContext, useContext, useMemo } from 'react';
import { formatCOP } from '../utils/formato';

const CreditoContext = createContext(null);

/**
 * Cartera del cliente: si tiene un crédito abierto y cuánto debe.
 *
 * La empresa solo financia un crédito por cliente a la vez (sin tope de
 * monto). Mientras ese crédito tenga saldo pendiente no puede abrir otro.
 *
 * Aquí no se guarda nada: todo se calcula a partir de los créditos que
 * llegan de la API (`creditos`). La API es la que aplica la regla de un
 * solo crédito al guardar.
 */
export function CreditoProvider({ creditos = [], children }) {
  const valor = useMemo(() => {
    // El crédito abierto es el que todavía tiene saldo por pagar
    const credito = creditos.find((c) => c.saldoValor > 0) ?? null;
    return {
      credito,
      tieneCredito: Boolean(credito),
      // Lo que el cliente debe hoy
      comprometidoTexto: formatCOP(credito ? credito.saldoValor : 0),
      // ¿Se puede financiar este valor? Basta con no tener un crédito abierto
      alcanza: (monto) => !credito && monto > 0,
    };
  }, [creditos]);

  return <CreditoContext.Provider value={valor}>{children}</CreditoContext.Provider>;
}

export function useCredito() {
  const contexto = useContext(CreditoContext);
  if (!contexto) throw new Error('useCredito debe usarse dentro de un <CreditoProvider>');
  return contexto;
}
