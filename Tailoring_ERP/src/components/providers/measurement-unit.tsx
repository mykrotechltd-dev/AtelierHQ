import { createContext, useContext, useEffect, useState } from "react";
import type { MeasurementUnit } from "../../lib/units.ts";

const STORAGE_KEY = "measurement-unit";

interface MeasurementUnitContextValue {
  unit: MeasurementUnit;
  setUnit: (unit: MeasurementUnit) => void;
}

const MeasurementUnitContext = createContext<MeasurementUnitContextValue>({
  unit: "cm",
  setUnit: () => {},
});

function readStored(): MeasurementUnit {
  if (typeof window === "undefined") return "cm";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "in" ? "in" : "cm";
}

/**
 * App-wide measurement unit preference (cm/in), persisted to localStorage.
 * Changing it anywhere (Pattern Lab, customer measurements) updates every
 * other place reading it, since they all share this one provider.
 */
export function MeasurementUnitProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnitState] = useState<MeasurementUnit>(readStored);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, unit);
  }, [unit]);

  return (
    <MeasurementUnitContext.Provider value={{ unit, setUnit: setUnitState }}>
      {children}
    </MeasurementUnitContext.Provider>
  );
}

export function useMeasurementUnit() {
  return useContext(MeasurementUnitContext);
}
