import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";

// 📖 Opens this person's page of the Skuzi guide (/guide/waiter, …).
export default function GuideButton({ role, onColor = false }: { role: "waiter" | "kitchen" | "cashier" | "owner"; onColor?: boolean }) {
  return (
    <Link
      to={`/guide/${role}`}
      aria-label="How to use Skuzi"
      title="How to use Skuzi"
      className={`rounded-xl p-2.5 ${onColor ? "bg-white/10 text-white/80" : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"}`}
    >
      <BookOpen size={16} />
    </Link>
  );
}
