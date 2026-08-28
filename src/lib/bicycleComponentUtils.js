/**
 * Helper utility to normalize bicycle component payload according to DB contract.
 */
export function normalizeBicycleComponentPayload(component) {
  if (!component) return {};

  const rawCatId = component.categoria_componente_id ?? component.categoryId;
  const rawStateId = component.estado_componente_id ?? component.stateId;

  const categoryId = Number(rawCatId);
  const stateId = Number(rawStateId);

  const marca = typeof component.marca === "string" ? component.marca.trim() : "";
  const modelo = typeof component.modelo === "string" ? component.modelo.trim() : "";
  const especificacion = typeof component.especificacion === "string" ? component.especificacion.trim() : "";
  const numero_serie = typeof component.numero_serie === "string" ? component.numero_serie.trim() : "";
  const descripcion = typeof component.descripcion === "string" ? component.descripcion.trim() : "";
  const observaciones = typeof component.observaciones === "string" ? component.observaciones.trim() : "";

  const specText = especificacion || [marca, modelo].filter(Boolean).join(" ") || "Componente";

  return {
    categoria_componente_id: !isNaN(categoryId) && categoryId > 0 ? categoryId : null,
    estado_componente_id: !isNaN(stateId) && stateId > 0 ? stateId : null,
    marca: marca || null,
    modelo: modelo || null,
    especificacion: specText || null,
    numero_serie: numero_serie || null,
    descripcion: descripcion || null,
    observaciones: observaciones || null
  };
}
