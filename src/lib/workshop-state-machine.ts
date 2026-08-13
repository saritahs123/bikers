export interface ServiceStateActions {
  canStart: boolean;
  canPause: boolean;
  canResume: boolean;
  canComplete: boolean;
  canReopen: boolean;
  canAddLabor: boolean;
  canAddProduct: boolean;
  canAssignMechanic: boolean;
  requiresMechanicToStart: boolean;
  badgeLabel: string;
  badgeClass: string;
}

export function getServiceStateRules(
  estadoServicioId: number,
  mecanicoId: number | null | undefined,
  orderStateId: number = 5,
  userPerms: { puede_editar?: boolean; puede_reabrir?: boolean } = {}
): ServiceStateActions {
  const hasMechanic = Boolean(mecanicoId && Number(mecanicoId) > 0);
  const isOrderInRepair = Number(orderStateId) === 5; // Must be REPARACIÓN (5)
  const isOrderEditable = Number(orderStateId) === 1 || Number(orderStateId) === 5; // RECIBIDA (1) or REPARACIÓN (5)
  const canEdit = Boolean(userPerms.puede_editar ?? true);
  const canReopenPerm = userPerms.puede_reabrir === true;

  // States: 1 = PENDIENTE, 2 = EN_PROCESO, 3 = COMPLETADO, 5 = PAUSADO
  switch (Number(estadoServicioId)) {
    case 1: // PENDIENTE
      return {
        canStart: isOrderInRepair && hasMechanic && canEdit,
        canPause: false,
        canResume: false,
        canComplete: false,
        canReopen: false,
        canAddLabor: false,
        canAddProduct: false,
        canAssignMechanic: isOrderEditable && canEdit,
        requiresMechanicToStart: isOrderInRepair && !hasMechanic,
        badgeLabel: "Pendiente",
        badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30"
      };

    case 2: // EN_PROCESO
      return {
        canStart: false,
        canPause: isOrderInRepair && canEdit,
        canResume: false,
        canComplete: isOrderInRepair && canEdit,
        canReopen: false,
        canAddLabor: isOrderInRepair && canEdit,
        canAddProduct: isOrderInRepair && canEdit,
        canAssignMechanic: isOrderInRepair && canEdit,
        requiresMechanicToStart: false,
        badgeLabel: "En Proceso",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30"
      };

    case 5: // PAUSADO
      return {
        canStart: false,
        canPause: false,
        canResume: isOrderInRepair && canEdit,
        canComplete: false,
        canReopen: false,
        canAddLabor: false,
        canAddProduct: false,
        canAssignMechanic: false,
        requiresMechanicToStart: false,
        badgeLabel: "Pausado",
        badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30"
      };

    case 3: // COMPLETADO
      return {
        canStart: false,
        canPause: false,
        canResume: false,
        canComplete: false,
        canReopen: isOrderInRepair && canEdit && canReopenPerm,
        canAddLabor: false,
        canAddProduct: false,
        canAssignMechanic: false,
        requiresMechanicToStart: false,
        badgeLabel: "Completado",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      };

    default:
      return {
        canStart: false,
        canPause: false,
        canResume: false,
        canComplete: false,
        canReopen: false,
        canAddLabor: false,
        canAddProduct: false,
        canAssignMechanic: false,
        requiresMechanicToStart: false,
        badgeLabel: "Pausado",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30"
      };
  }
}
