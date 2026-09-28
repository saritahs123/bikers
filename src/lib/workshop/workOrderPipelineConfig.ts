/**
 * WORK ORDER PIPELINE CONFIGURATION
 * Single source of truth for workshop order states, labels, colors, and order sequence.
 * Shared between internal Workshop Order Detail view and the Public Tracking Portal.
 */

export interface PipelineStepConfig {
  stepIndex: number;
  key: string;
  aliases: string[];
  catalogId: number;
  label: string;
  activeColor: string;
}

export const WORK_ORDER_PIPELINE_STEPS: PipelineStepConfig[] = [
  {
    stepIndex: 1,
    key: "RECIBIDA",
    aliases: ["RECIBIDA", "PENDIENTE"],
    catalogId: 1,
    label: "PENDIENTE",
    activeColor: "#3b82f6", // Blue for pending/received
  },
  {
    stepIndex: 2,
    key: "REPARACION",
    aliases: ["REPARACION", "EN REPARACION", "EN_REPARACION"],
    catalogId: 5,
    label: "EN REPARACION",
    activeColor: "#f97316", // Orange for in-repair
  },
  {
    stepIndex: 3,
    key: "LISTA_ENTREGA",
    aliases: ["LISTA_ENTREGA", "COMPLETADA", "COMPLETADO"],
    catalogId: 7,
    label: "COMPLETADA",
    activeColor: "#10b981", // Emerald green for ready/completed
  },
  {
    stepIndex: 4,
    key: "ENTREGADA",
    aliases: ["ENTREGADA", "ENTREGADO"],
    catalogId: 8,
    label: "ENTREGADA",
    activeColor: "#059669", // Deep emerald green for final delivered
  },
];

export interface ResolvedPipelineStep {
  stepIndex: number;
  key: string;
  label: string;
  activeColor: string;
  isCompleted: boolean;
  isActive: boolean;
}

export interface PipelineResolution {
  currentStepIndex: number;
  isHold: boolean;
  currentStepLabel: string;
  activeColor: string;
  steps: ResolvedPipelineStep[];
}

/**
 * Resolves current step index and active state based on official order status codes and IDs.
 */
export function resolvePipelineStep(
  estadoCodigo?: string | null,
  estadoId?: number | null
): PipelineResolution {
  const code = String(estadoCodigo || "").trim().toUpperCase();
  const id = Number(estadoId || 0);

  const isHold = code === "HOLD" || id === 2;

  let currentStepIndex = 1;
  if (isHold) {
    currentStepIndex = 2; // HOLD is a temporary condition handled within the repair step
  } else if (code === "ENTREGADA" || id === 8) {
    currentStepIndex = 4;
  } else if (code === "LISTA_ENTREGA" || code === "COMPLETADA" || id === 7) {
    currentStepIndex = 3;
  } else if (
    code === "REPARACION" ||
    code === "EN REPARACION" ||
    code === "EN_REPARACION" ||
    id === 5
  ) {
    currentStepIndex = 2;
  } else if (code === "RECIBIDA" || code === "PENDIENTE" || id === 1) {
    currentStepIndex = 1;
  } else {
    const foundStep = WORK_ORDER_PIPELINE_STEPS.find((s) => s.catalogId === id);
    currentStepIndex = foundStep ? foundStep.stepIndex : 1;
  }

  const steps: ResolvedPipelineStep[] = WORK_ORDER_PIPELINE_STEPS.map((step) => {
    const isCompleted = step.stepIndex < currentStepIndex;
    const isActive = step.stepIndex === currentStepIndex;
    const isHoldThisStep = isHold && step.stepIndex === 2;

    const label = isHoldThisStep ? "EN HOLD" : step.label;
    const activeColor = isHoldThisStep ? "#ef4444" : step.activeColor;

    return {
      stepIndex: step.stepIndex,
      key: step.key,
      label,
      activeColor,
      isCompleted,
      isActive,
    };
  });

  const activeStep = steps.find((s) => s.stepIndex === currentStepIndex);
  const currentStepLabel = activeStep ? activeStep.label : "PENDIENTE";
  const activeColor = activeStep ? activeStep.activeColor : "#3b82f6";

  return {
    currentStepIndex,
    isHold,
    currentStepLabel,
    activeColor,
    steps,
  };
}

/**
 * Compact customer-friendly message associated with the current order state.
 * Does NOT alter the state label name.
 */
export function getPipelineStatusMessage(
  estadoCodigo?: string | null,
  estadoNombre?: string | null
): string {
  const code = String(estadoCodigo || "").trim().toUpperCase();
  const name = String(estadoNombre || "").trim().toUpperCase();

  if (code === "ENTREGADA" || name === "ENTREGADA") {
    return "La reparación fue completada y la bicicleta fue entregada.";
  }
  if (
    code === "LISTA_ENTREGA" ||
    code === "COMPLETADA" ||
    name === "COMPLETADA" ||
    name.includes("LISTA")
  ) {
    return "Tu bicicleta está lista para ser retirada en el taller.";
  }
  if (code === "HOLD" || code === "EN_HOLD" || name.includes("HOLD")) {
    return "El trabajo está temporalmente en pausa esperando repuestos o confirmación.";
  }
  if (code === "APROBACION" || name.includes("APROBACI")) {
    return "Pendiente de tu confirmación para proceder con los trabajos aprobados.";
  }
  if (
    code === "REPARACION" ||
    code === "EN REPARACION" ||
    code === "EN_REPARACION" ||
    name.includes("REPARACI")
  ) {
    return "Nuestro equipo está trabajando en tu bicicleta.";
  }
  if (
    code === "RECIBIDA" ||
    code === "PENDIENTE" ||
    name.includes("RECIBIDA") ||
    name === "PENDIENTE"
  ) {
    return "Tu bicicleta fue recibida correctamente en nuestro taller.";
  }

  return "Nuestro equipo está trabajando en tu bicicleta.";
}
