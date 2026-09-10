import { createContext, useContext, useEffect, useState } from "react";
import type { MeasurementUnit } from "../../lib/units.ts";

const STORAGE_KEY = "measurement-unit";

interface MeasurementUnitContextValue {
  unit: MeasurementUnit;
  setUnit: (unit: MeasurementUnit) => void;
}

const MeasurementUnitContext = createContext<MeasurementUnitContextValue>({
  unit: "in",
  setUnit: () => {},
});

function readStored(): MeasurementUnit {
  if (typeof window === "undefined") return "in";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "cm" ? "cm" : "in";
}

/**
 * App-wide measurement unit preference (in/cm), persisted to localStorage.
 * Changing it anywhere (Pattern Lab, customer measurements) updates every
 * other place reading it, since they all share this one provider. Inches is
 * the native, stored unit — cm is a display/entry convenience converted at
 * the UI boundary only (see ../../lib/units.ts).
 */
export function MeasurementUnitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
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
