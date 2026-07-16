import { Phone } from "lucide-react";
import { toast } from "sonner";

type Props = {
  phone: string;
  label?: string;
  className?: string;
};

export function PhoneButton({ phone, label, className }: Props) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("Номер скопійовано");
    } catch {
      toast.error("Не вдалося скопіювати");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "inline-flex items-center gap-2 text-blue-600 text-sm font-medium hover:underline"
      }
    >
      <Phone className="w-4 h-4" />
      {label ?? phone}
    </button>
  );
}
