import { createContext, useContext, useMemo } from 'react';
import { CUPO_CARTERA } from '../constantes';
import { formatCOP } from '../utils/formato';

const CreditoContext = createContext(null);

/**
 * Cartera del cliente: cuánto crédito puede usar.
 *
 * La empresa solo financia un crédito por cliente a la vez. Mientras ese
 * crédito tenga saldo pendiente, el saldo usable se muestra en negativo
 * por el valor total financiado: es lo que el cliente debe, no lo que
 * puede gastar. Al quedar saldado, el cupo vuelve a su valor completo.
 *
 * Aquí no se guarda nada: todo se calcula a partir de los créditos que
 * llegan de la API (`creditos`). La API es la que aplica la regla de un
 * solo crédito al guardar.
 */
export function CreditoProvider({ creditos = [], cupoTotal = CUPO_CARTERA, children }) {
  const valor = useMemo(() => {
    // El crédito abierto es el que todavía tiene saldo por pagar
    const credito = creditos.find((c) => c.saldoValor > 0) ?? null;
    const saldoUsable = credito ? -credito.montoTotalValor : cupoTotal;

    return {
      cupoTotal,
      credito,
      tieneCredito: Boolean(credito),
      // Lo que el cliente debe hoy
      comprometidoTexto: formatCOP(credito ? credito.saldoValor : 0),
      saldoUsable,
      saldoUsableTexto: `${saldoUsable < 0 ? '-' : ''}${formatCOP(Math.abs(saldoUsable))}`,
      // ¿Se puede financiar este valor? Sin crédito abierto y dentro del cupo
      alcanza: (monto) => !credito && monto > 0 && monto <= saldoUsable,
    };
  }, [creditos, cupoTotal]);

  return <CreditoContext.Provider value={valor}>{children}</CreditoContext.Provider>;
}

export function useCredito() {
  const contexto = useContext(CreditoContext);
  if (!contexto) throw new Error('useCredito debe usarse dentro de un <CreditoProvider>');
  return contexto;
}
