import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useUpsertTransport } from "@/features/courier/hooks";
import {
  TRANSPORT_TYPES,
  TRANSPORT_TYPE_LABELS,
  type Transport,
  type TransportType,
} from "@/features/courier/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Transport | null;
}

export function TransportEditDialog({ open, onOpenChange, initial }: Props) {
  const upsert = useUpsertTransport();
  const [model, setModel] = useState("");
  const [type, setType] = useState<TransportType>("car");
  const [maxWeight, setMaxWeight] = useState<string>("");
  const [maxVolume, setMaxVolume] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setModel(initial?.model ?? "");
    setType(initial?.type ?? "car");
    setMaxWeight(initial ? String(initial.max_weight) : "");
    setMaxVolume(initial ? String(initial.max_volume) : "");
    setErrors({});
  }, [open, initial]);

  const submit = async () => {
    const trimmedModel = model.trim();
    const w = Number(maxWeight);
    const v = Number(maxVolume);
    const errs: Record<string, string> = {};
    if (!trimmedModel) {
      errs.model = "Вкажіть модель транспорту";
    }
    if (!Number.isFinite(w) || w <= 0) {
      errs.max_weight = "Має бути додатнім числом";
    }
    if (!Number.isFinite(v) || v <= 0) {
      errs.max_volume = "Має бути додатнім числом";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await upsert.mutateAsync({
        model: trimmedModel,
        type,
        max_weight: w,
        max_volume: v,
      });
      toast.success("Транспорт збережено");
      onOpenChange(false);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не вдалося зберегти транспорт";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Редагувати транспорт" : "Додати транспорт"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Модель</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Напр. Honda CB200"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${errors.model ? "border-red-400" : "border-gray-300"}`}
            />
            {errors.model && <p className="text-xs text-red-500 mt-1">{errors.model}</p>}
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Тип</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TransportType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {TRANSPORT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TRANSPORT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Макс. вага, кг
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${errors.max_weight ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.max_weight && <p className="text-xs text-red-500 mt-1">{errors.max_weight}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Макс. обʼєм, м³
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxVolume}
                onChange={(e) => setMaxVolume(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${errors.max_volume ? "border-red-400" : "border-gray-300"}`}
              />
              {errors.max_volume && <p className="text-xs text-red-500 mt-1">{errors.max_volume}</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={upsert.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
          >
            {upsert.isPending ? "Зберігаємо..." : "Зберегти"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
