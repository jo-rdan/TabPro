import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// One page of the Skuzi guide (in Kinyarwanda), for each person in the venue.
// Staff get the link with their invite and open it again from their own screen.
const PAGES: Record<string, string> = { waiter: "waiter", manager: "owner", owner: "owner", kitchen: "kitchen", cashier: "cashier", guest: "guest" };

export default function Guide() {
  const { role = "" } = useParams();
  const navigate = useNavigate();
  const page = PAGES[role] ?? "waiter";
  return (
    <div className="min-h-screen bg-[#FFF8EC]">
      <div className="mx-auto max-w-xl px-4 py-4">
        <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className="mb-3 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-gray-600">
          <ArrowLeft size={16} /> Garuka
        </button>
        <img src={`/guide/${page}.png`} alt="Uko Skuzi ikoreshwa" className="w-full rounded-2xl shadow-sm" />
      </div>
    </div>
  );
}
