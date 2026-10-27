import { ProtectedServerPage } from "@/components/auth/ProtectedServerPage";
import MeasurementUnitsView from "@/components/inventory/catalogs/MeasurementUnitsView";

export default function MeasurementUnitsPage() {
  return (
    <ProtectedServerPage screenCode="CONFIG_UNIDADES_MEDIDA">
      <MeasurementUnitsView />
    </ProtectedServerPage>
  );
}
