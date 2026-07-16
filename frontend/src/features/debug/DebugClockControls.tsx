import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock4, RotateCcw } from "lucide-react";
import { clockApi } from "./clockApi";

// Convert UTC ISO returned by the backend into a value suitable for
// <input type="datetime-local"> (local time, no seconds, no timezone).
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

// Local-time string from the picker → UTC ISO.
function localInputToIso(local: string): string {
  return new Date(local).toISOString();
}

export function DebugClockControls() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["debug", "now"],
    queryFn: () => clockApi.get(),
    refetchOnWindowFocus: false,
  });

  const [value, setValue] = useState<string>("");

  useEffect(() => {
    if (data?.now) setValue(isoToLocalInput(data.now));
  }, [data?.now]);

  const setMut = useMutation({
    mutationFn: (iso: string) => clockApi.set(iso),
    onSuccess: () => {
      toast.success("Час оновлено");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Не вдалося оновити час"),
  });

  const clearMut = useMutation({
    mutationFn: () => clockApi.clear(),
    onSuccess: () => {
      toast.success("Повернуто реальний час");
      qc.invalidateQueries();
    },
    onError: () => toast.error("Не вдалося скинути"),
  });

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <Clock4 className="w-4 h-4 text-gray-600" />
        <span className="text-xs font-medium text-gray-700">
          Поточна дата та час
        </span>
        {data?.overridden && (
          <span className="ml-auto text-[10px] font-semibold uppercase text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
            Зафіксовано
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          disabled={!value || setMut.isPending}
          onClick={() => setMut.mutate(localInputToIso(value))}
          className="px-2.5 py-1.5 rounded bg-blue-600 text-white text-xs font-medium disabled:bg-gray-300"
        >
          Застосувати
        </button>
        <button
          disabled={clearMut.isPending || !data?.overridden}
          onClick={() => clearMut.mutate()}
          className="p-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          title="Повернути реальний час"
          aria-label="Повернути реальний час"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
