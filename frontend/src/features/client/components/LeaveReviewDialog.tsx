import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCreateReview } from "../hooks";

interface Props {
  orderId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeaveReviewDialog({ orderId, open, onOpenChange }: Props) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const createReview = useCreateReview(orderId);

  const submit = async () => {
    try {
      await createReview.mutateAsync({
        rating,
        comment: comment || undefined,
      });
      toast.success("Дякуємо за відгук");
      onOpenChange(false);
      setComment("");
      setRating(5);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не вдалося зберегти відгук";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Залишити відгук</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className="p-1"
              >
                <Star
                  className={`w-8 h-8 ${
                    n <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={4}
            placeholder="Ваш коментар (необов'язково)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
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
            disabled={createReview.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300"
          >
            {createReview.isPending ? "Зберігаємо..." : "Надіслати"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
